import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * importConcurReconciliation — reverse sync from SAP Concur.
 *
 * For every DailyCost / SubcontractorLog already exported (status synced,
 * concur_export_id set), fetches the matching Quick Expense from Concur and
 * reconciles it back:
 *   • verifies the export landed in Concur (exists)
 *   • captures the Concur report id + approval status
 *   • pulls back any GL code Concur reassigned (expenseTypeCode) into our gl_code
 *
 * Reconciliation result is written to the record's notes as a compact tag:
 *   "Concur report: RPT-123 (approved) | GL: MISC"
 * so finance can trace each expense to its Concur report without a schema change.
 *
 * Payload: { action: "reconcile" } (default) — also respects scheduled cadence.
 */
async function getConfig(base44) {
  const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: 'concur_config' });
  const cfg = settings[0]?.value || {};
  const apiUrl = (cfg.api_url || '').replace(/\/$/, '');
  const tokenUrl = (cfg.token_url || '').replace(/\/$/, '');
  if (!cfg.client_id || !cfg.client_secret || !tokenUrl) {
    return { missing: true, settingsId: settings[0]?.id, cfg };
  }
  return { apiUrl, tokenUrl, companyUuid: cfg.company_uuid, settingsId: settings[0]?.id, cfg };
}

async function authenticate(tokenUrl, clientId, clientSecret) {
  const res = await fetch(`${tokenUrl}/access-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }).toString(),
  });
  if (!res.ok) return null;
  return (await res.json()).access_token;
}

function appendReconTag(notes, reportId, status, gl) {
  const parts = [];
  if (reportId) parts.push(`Concur report: ${reportId}${status ? ` (${status})` : ''}`);
  if (gl) parts.push(`GL: ${gl}`);
  const tag = parts.join(' | ');
  if (!tag) return notes || '';
  // Replace any previous recon tag, keep human notes
  const cleaned = (notes || '').replace(/\s*\[Concur recon:.*?\]\s*/g, '').trim();
  return `${cleaned}${cleaned ? ' ' : ''}[Concur recon: ${tag}]`.trim();
}

async function reconcileRecord(base44, headers, apiUrl, rec, entity, kind) {
  const concurId = rec.concur_export_id;
  if (!concurId || concurId.startsWith('sent-')) {
    // No real Concur id captured at export — cannot reconcile individually
    return { id: rec.id, kind, skipped: 'no_concur_id' };
  }
  try {
    const res = await fetch(`${apiUrl}/api/v3.0/expense/quickexpenses/${concurId}`, { method: 'GET', headers });
    if (res.status === 404) {
      return { id: rec.id, kind, status: 'missing_in_concur' };
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { id: rec.id, kind, error: `${res.status}: ${detail.slice(0, 120)}` };
    }
    const data = await res.json().catch(() => ({}));
    const reportId = data.reportId || data.ReportID || data.reportID || '';
    const reconStatus = data.status || data.Status || '';
    const concurGl = data.expenseTypeCode || data.ExpenseTypeCode || '';
    const updates = {};
    if (concurGl && concurGl !== (rec.gl_code || '')) {
      updates.gl_code = concurGl;
    }
    const newNotes = appendReconTag(rec.notes, reportId, reconStatus, concurGl || rec.gl_code || '');
    if (newNotes !== (rec.notes || '')) updates.notes = newNotes;
    if (Object.keys(updates).length > 0) {
      await base44.asServiceRole.entities[entity].update(rec.id, updates);
    }
    return { id: rec.id, kind, report_id: reportId, recon_status: reconStatus, gl: concurGl || rec.gl_code, updated: Object.keys(updates).length > 0 };
  } catch (e) {
    return { id: rec.id, kind, error: e.message };
  }
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    // Scheduled runs arrive without a user session and are trusted; manual
    // invocations require an admin.
    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== 'admin') return Response.json({ ok: false, error: 'Forbidden — admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'reconcile';

    const config = await getConfig(base44);
    if (config.missing) {
      return Response.json({
        ok: false,
        message: 'No API credentials configured — enter your SAP Concur client ID, secret and token URL in Settings to connect.',
      }, { status: 400 });
    }

    // Scheduled mode — respect auto-sync toggle + cadence (mirror export schedule)
    if (action === 'scheduled') {
      if (config.cfg.auto_sync_enabled === false) {
        return Response.json({ ok: true, skipped: true, reason: 'auto-sync disabled' });
      }
      const last = config.cfg.last_auto_reconcile_at ? new Date(config.cfg.last_auto_reconcile_at) : null;
      const nowDate = new Date();
      const freq = config.cfg.sync_frequency || 'weekly';
      const dayMs = 24 * 3600 * 1000;
      let due = true;
      if (last) {
        if (freq === 'daily') due = (nowDate - last) > 23 * 3600 * 1000;
        else if (freq === 'weekly') due = (nowDate - last) > 6 * dayMs;
        else if (freq === 'monthly') due = (nowDate - last) > 27 * dayMs;
      }
      if (!due) return Response.json({ ok: true, skipped: true, reason: `not due (${freq})` });
    }

    const accessToken = await authenticate(config.tokenUrl, config.cfg.client_id, config.cfg.client_secret);
    if (!accessToken) {
      return Response.json({ ok: false, message: 'Concur authentication failed — check client ID / secret / token URL.' }, { status: 402 });
    }

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(config.companyUuid ? { 'Concur-CorrelationId': config.companyUuid } : {}),
    };

    const syncedCosts = await base44.asServiceRole.entities.DailyCost.filter({ status: 'synced_to_concur' }, '-synced_at', 500);
    const syncedSubcons = await base44.asServiceRole.entities.SubcontractorLog.filter({ status: 'synced' }, '-synced_at', 500);

    const results = [];
    for (const c of syncedCosts) results.push(await reconcileRecord(base44, headers, config.apiUrl, c, 'DailyCost', 'expense'));
    for (const s of syncedSubcons) results.push(await reconcileRecord(base44, headers, config.apiUrl, s, 'SubcontractorLog', 'subcon'));

    const reconciled = results.filter((r) => r.report_id || r.recon_status || r.updated);
    const missing = results.filter((r) => r.status === 'missing_in_concur');
    const errors = results.filter((r) => r.error);

    // Persist last reconcile timestamp in scheduled mode
    if (action === 'scheduled' && config.settingsId) {
      try {
        await base44.entities.AppSetting.update(config.settingsId, {
          value: { ...config.cfg, last_auto_reconcile_at: new Date().toISOString() },
        });
      } catch (_) { /* non-fatal */ }
    }

    return Response.json({
      ok: true,
      checked: results.length,
      reconciled: reconciled.length,
      missing_in_concur: missing.length,
      errors: errors.length,
      error_details: errors.slice(0, 10),
      results: results.slice(0, 50),
      message: `Reconciled ${reconciled.length} of ${results.length} synced records${missing.length ? ` · ${missing.length} missing in Concur` : ''}${errors.length ? ` · ${errors.length} error(s)` : ''}.`,
    });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}