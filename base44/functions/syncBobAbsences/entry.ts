import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// syncBobAbsences — Bob HR (Hibob) time-off integration bridge.
// ============================================================
// Bidirectional sync between this app's Absence entity and Bob HR's
// time-off API:
//   • PULL — fetches approved time-off requests from Bob HR and creates
//     matching Absence records (source='bob_hr'), skipping duplicates by
//     bob_request_id.
//   • PUSH — sends approved Absence records created in this app to Bob HR
//     as new time-off requests, stamping bob_request_id + bob_status='synced'.
//
// Config is stored in AppSetting keyed 'bob_hr_config' (saved by admins in
// Settings → Bob HR Sync).
//
// Payload: { action: "test" | "sync" | "scheduled" }

import { mapReason, isApprovedStatus, bobAuthHeaders, pushSingleAbsenceToBob } from '../../shared/bobHrHelpers.ts';

async function getConfig(base44: any) {
  const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: 'bob_hr_config' });
  const cfg = settings[0]?.value || {};
  const apiUrl = (cfg.api_url || 'https://api.hibob.com/v1').replace(/\/$/, '');
  return {
    apiUrl,
    username: cfg.username || '',
    apiToken: cfg.api_token || '',
    companyId: cfg.company_id || '',
    settingsId: settings[0]?.id,
    cfg,
  };
}



export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    // Scheduled runs arrive without a user session and are trusted;
    // manual invocations require an admin.
    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== 'admin') return Response.json({ ok: false, error: 'Forbidden — admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const action = ['test', 'sync', 'scheduled'].includes(body.action) ? body.action : 'test';

    const { apiUrl, username, apiToken, companyId, settingsId, cfg } = await getConfig(base44);

    if (!username || !apiToken) {
      return Response.json({
        ok: false,
        message: 'No API credentials configured — enter your Bob HR service username and API token in Settings to connect.',
      }, { status: 400 });
    }

    // Scheduled mode — respect auto-sync toggle + cadence
    if (action === 'scheduled') {
      if (cfg.auto_sync_enabled === false) {
        return Response.json({ ok: true, skipped: true, reason: 'auto-sync disabled' });
      }
      const last = cfg.last_sync_at ? new Date(cfg.last_sync_at) : null;
      const nowDate = new Date();
      const freq = cfg.sync_frequency || 'daily';
      const dayMs = 24 * 3600 * 1000;
      let due = true;
      if (last) {
        if (freq === 'daily') due = (nowDate - last) > 23 * 3600 * 1000;
        else if (freq === 'weekly') due = (nowDate - last) > 6 * dayMs;
        else if (freq === 'monthly') due = (nowDate - last) > 27 * dayMs;
      }
      if (!due) return Response.json({ ok: true, skipped: true, reason: `not due (${freq}) — last sync ${cfg.last_sync_at}` });
    }

    const headers = bobAuthHeaders(username, apiToken);

    // Test mode — verify auth by listing time-off types
    if (action === 'test') {
      const res = await fetch(`${apiUrl}/timeoff/types`, { method: 'GET', headers });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        return Response.json({ ok: false, message: `Bob HR auth failed (${res.status}). ${detail.slice(0, 200)}` }, { status: 402 });
      }
      return Response.json({ ok: true, message: `Connected to Bob HR successfully.${companyId ? ` Company ID: ${companyId}` : ''}` });
    }

    // ── Sync mode ──
    const pullEnabled = cfg.pull_time_off !== false;
    const pushEnabled = cfg.push_time_off !== false;
    const now = new Date().toISOString();
    const today = new Date().toISOString().slice(0, 10);
    // Look back ~90 days for pull (covers recent past + upcoming)
    const lookback = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString().slice(0, 10);

    let pulled = 0;
    let pullSkipped = 0;
    let pushed = 0;
    let pushErrors = 0;
    const errors: any[] = [];

    // Load staff for email matching
    const allStaff = await base44.asServiceRole.entities.Staff.list('-created_date', 500);
    const staffByEmail: Record<string, any> = {};
    for (const s of allStaff) {
      if (s.email) staffByEmail[s.email.toLowerCase()] = s;
    }

    // Load existing Bob-sourced absences to dedupe by bob_request_id
    let existingBobAbsences: any[] = [];
    try {
      existingBobAbsences = await base44.asServiceRole.entities.Absence.filter({ source: 'bob_hr' }, '-created_date', 500);
    } catch (_) {}
    const existingByBobId: Record<string, any> = {};
    for (const a of existingBobAbsences) {
      if (a.bob_request_id) existingByBobId[a.bob_request_id] = a;
    }

    // ── PULL: fetch approved time-off requests from Bob HR ──
    if (pullEnabled) {
      try {
        const pullRes = await fetch(`${apiUrl}/timeoff/requests?from=${lookback}&to=${today}`, { method: 'GET', headers });
        if (pullRes.ok) {
          const pullData = await pullRes.json().catch(() => ({}));
          const requests: any[] = pullData.requests || pullData || [];
          for (const r of requests) {
            const bobId = String(r.id || r.requestId || '');
            if (!bobId) continue;
            // Only sync approved requests from Bob HR
            const bobStatus = (r.status || r.approvalStatus || '').toLowerCase();
            if (bobStatus && !isApprovedStatus(bobStatus)) {
              pullSkipped++;
              continue;
            }
            if (existingByBobId[bobId]) {
              pullSkipped++;
              continue;
            }
            // Match staff by email
            const email = (r.employeeEmail || r.email || '').toLowerCase();
            const staffMember = staffByEmail[email];
            if (!staffMember) {
              pullSkipped++;
              continue;
            }
            await base44.asServiceRole.entities.Absence.create({
              staff_id: staffMember.id,
              start_date: (r.startDate || r.start_date || '').slice(0, 10),
              end_date: (r.endDate || r.end_date || '').slice(0, 10),
              reason: mapReason(r.type || r.policyName || r.requestType || ''),
              notes: r.description || r.comment || `Bob HR time-off (${r.type || r.policyName || 'unknown'})`,
              status: 'approved',
              bob_request_id: bobId,
              bob_status: 'synced',
              source: 'bob_hr',
            });
            pulled++;
          }
        } else {
          errors.push({ kind: 'pull', error: `${pullRes.status}: ${(await pullRes.text().catch(() => '')).slice(0, 150)}` });
        }
      } catch (e) {
        errors.push({ kind: 'pull', error: e.message });
      }
    }

    // ── PUSH: send approved manual absences to Bob HR ──
    if (pushEnabled) {
      let pendingAbsences: any[] = [];
      try {
        pendingAbsences = await base44.asServiceRole.entities.Absence.filter({ status: 'approved', source: 'manual', bob_status: 'pending' }, '-created_date', 200);
      } catch (_) {}

      for (const a of pendingAbsences) {
        const staffMember = allStaff.find((s: any) => s.id === a.staff_id);
        const result = await pushSingleAbsenceToBob(apiUrl, headers, a, staffMember);
        if (result.ok) {
          await base44.asServiceRole.entities.Absence.update(a.id, {
            bob_request_id: result.bobId,
            bob_status: 'synced',
          });
          pushed++;
        } else {
          errors.push({ id: a.id, kind: 'push', error: result.error });
          pushErrors++;
        }
      }
    }

    // ── AVATAR BACKFILL: pull employee photos from Bob HR ──
    // Bob HR's /employees endpoint returns profile photos. We fetch all
    // employees and update Staff records that are missing avatar_url,
    // fixing the placeholder '?' icons on the published site.
    let avatarsUpdated = 0;
    if (pullEnabled) {
      try {
        const empRes = await fetch(`${apiUrl}/employees?includeHuman=true`, { method: 'GET', headers });
        if (empRes.ok) {
          const empData = await empRes.json().catch(() => ({}));
          const employees = empData.employees || empData || [];
          for (const emp of employees) {
            const email = (emp.email || emp.workEmail || emp.homeEmail || '').toLowerCase();
            if (!email) continue;
            const staffMember = staffByEmail[email];
            if (!staffMember) continue;
            const avatar = emp.avatar || emp.photo || emp.profilePhoto || emp.thumbnail || '';
            if (avatar && !staffMember.avatar_url) {
              await base44.asServiceRole.entities.Staff.update(staffMember.id, { avatar_url: avatar });
              avatarsUpdated++;
            }
          }
        }
      } catch (e) {
        errors.push({ kind: 'avatar', error: e.message });
      }
    }

    // Persist last sync timestamp
    if (action === 'scheduled' && settingsId) {
      try {
        await base44.asServiceRole.entities.AppSetting.update(settingsId, {
          value: { ...cfg, last_sync_at: now },
        });
      } catch (_) { /* non-fatal */ }
    }

    return Response.json({
      ok: true,
      pulled,
      pull_skipped: pullSkipped,
      pushed,
      push_errors: pushErrors,
      avatars_updated: avatarsUpdated,
      errors: errors.slice(0, 20),
      message: `Sync complete — pulled ${pulled} from Bob HR, pushed ${pushed} to Bob HR, ${avatarsUpdated} avatars updated${pushErrors ? ` · ${pushErrors} push error(s)` : ''}.`,
    });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}