import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// KeyLogBook Webhook Receiver — Professionalised Site Logs Pipeline
// ============================================================
// Receives real-time borehole log data pushed from KeyLogBook.
//
// Two data streams:
//   1. Structured borehole data (boreholes[], logs[]) → source='ags_import'
//      Read-only technical records shown in the Borehole Data Explorer.
//
//   2. Driller remarks string (e.g. "7:30_8:45 = Start briefing... 8:45_9:00 = ...")
//      → Parsed into individual time-stamped activities, AI-professionalised,
//        and saved as source='keylogbook_remarks' with manager_review_status='pending'.
//        An admin reviews/edits these in the Site Logs tab, then approves them
//        to auto-generate the timesheet via the approveKeyLogBookLogs function.
//
// This endpoint is called by KeyLogBook (no authenticated user), so it uses the
// service role for all database operations and validates the shared secret.

interface WebhookPayload {
  job_reference?: string;
  job_id?: string;
  project_id?: string;
  date?: string;
  lead_driller_name?: string;
  lead_driller_id?: string;
  meterage?: number;
  remarks?: string;
  notes?: string;
  boreholes?: Array<Record<string, any>>;
  logs?: Array<Record<string, any>>;
  [key: string]: any;
}

interface ParsedActivity {
  start_time: string;
  end_time: string;
  duration_minutes: number;
  raw_description: string;
}

// ============================================================
// Shared parsing logic lives in base44/shared/keylogbookRemarks.ts
// (parseRemarks + professionaliseActivities are imported above).
// ============================================================

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function num(v: any): number | null {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? null : n;
}

function str(v: any): string {
  if (v == null) return '';
  return String(v).trim();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // --- Fetch the singleton config (service role — no user context) ---
    const configs = await base44.asServiceRole.entities.KeyLogBookConfig.filter({ key: 'global' });
    const config = configs[0];

    // --- Validate the shared secret ---
    const url = new URL(req.url);
    const providedSecret =
      req.headers.get('x-klb-signature') ||
      req.headers.get('x-keylogbook-signature') ||
      url.searchParams.get('secret') ||
      '';

    if (!config || !config.enabled) {
      return Response.json({ error: 'KeyLogBook sync is not enabled' }, { status: 403 });
    }
    if (!config.webhook_secret) {
      return Response.json({ error: 'Webhook secret not configured' }, { status: 503 });
    }
    if (providedSecret !== config.webhook_secret) {
      return Response.json({ error: 'Invalid webhook secret' }, { status: 401 });
    }

    // --- Parse the payload ---
    const body: WebhookPayload = await req.json().catch(() => ({}));
    if (!body || typeof body !== 'object') {
      return Response.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const jobRef = str(body.job_reference || body.project_id);
    const explicitJobId = str(body.job_id);
    const workDate = str(body.date) || todayStr();
    const meterage = num(body.meterage);
    const rawRemarks = str(body.remarks || body.notes);

    // --- Match the job ---
    let job: any = null;
    if (explicitJobId) {
      try { job = await base44.asServiceRole.entities.Job.get(explicitJobId); } catch (e) { job = null; }
    }
    if (!job && jobRef) {
      const jobs = await base44.asServiceRole.entities.Job.list('-created_date', 500);
      const lc = jobRef.toLowerCase();
      job =
        jobs.find((j: any) => j.job_reference && j.job_reference.toLowerCase() === lc) ||
        jobs.find((j: any) => j.name && j.name.toLowerCase() === lc) ||
        jobs.find((j: any) => j.job_reference && j.job_reference.toLowerCase().includes(lc)) ||
        jobs.find((j: any) => j.name && j.name.toLowerCase().includes(lc));
    }

    if (!job) {
      await updateWebhookStatus(base44, config, 'failed', `Job not found for reference "${jobRef || explicitJobId || '—'}"`);
      return Response.json({ error: 'Could not match an existing job. Ensure job_reference matches the Job reference field.' }, { status: 422 });
    }

    // --- Delete previous KeyLogBook-imported data for this job+date (overwrite mode) ---
    let deletedCount = 0;
    try {
      const existingRemarks = await base44.asServiceRole.entities.InvestigationLog.filter({ job_id: job.id, source: 'keylogbook_remarks', date: workDate });
      deletedCount = existingRemarks.length;
      if (deletedCount > 0) {
        await base44.asServiceRole.entities.InvestigationLog.deleteMany({ job_id: job.id, source: 'keylogbook_remarks', date: workDate });
      }
      // Also clear previous ags_import logs for this job (overwrite mode)
      const existingAgs = await base44.asServiceRole.entities.InvestigationLog.filter({ job_id: job.id, source: 'ags_import' });
      if (existingAgs.length > 0) {
        await base44.asServiceRole.entities.InvestigationLog.deleteMany({ job_id: job.id, source: 'ags_import' });
        deletedCount += existingAgs.length;
      }
    } catch (e) { /* continue */ }

    // --- Identify the lead driller (for staff_name on remarks logs) ---
    // Priority: 1) Driller name embedded in the AGS / borehole / log payload
    //           2) lead_driller_name from the webhook body
    //           3) Staff assigned that day whose team is a drilling crew (cp/rotary)
    //           4) First assigned staff member (last-resort fallback)
    let leadDrillerName = '';
    let leadDrillerId = '';

    // 1) Scan the AGS / borehole / log payloads for a driller / engineer name
    const agsNameFields = ['driller_name', 'driller', 'logged_by', 'engineer', 'operator', 'recorded_by', 'inspected_by'];
    const scanForDriller = (...arrs: any[][]) => {
      for (const arr of arrs) {
        if (!Array.isArray(arr)) continue;
        for (const item of arr) {
          if (!item || typeof item !== 'object') continue;
          for (const f of agsNameFields) {
            const val = str(item[f]);
            if (val) return val;
          }
        }
      }
      return '';
    };
    leadDrillerName = scanForDriller(body.boreholes, body.logs, body.remarks_data, body.ags_data);

    // 2) Fall back to the webhook body's explicit lead_driller_name
    if (!leadDrillerName) leadDrillerName = str(body.lead_driller_name);

    // 3 & 4) Resolve from the rota — prefer a staff member on a drilling team
    try {
      const assignments = await base44.asServiceRole.entities.RotaAssignment.filter({ job_id: job.id, assigned_date: workDate });
      if (assignments.length > 0) {
        const teams = await base44.asServiceRole.entities.Team.list('-created_date', 500);
        const drillingJobTypes = ['cp_drilling', 'rotary_drilling'];
        const drillingTeamIds = new Set(teams.filter((t: any) => drillingJobTypes.includes(t.job_type)).map((t: any) => t.id));

        const staffIds = [...new Set(assignments.map(a => a.staff_id).filter(Boolean))];
        const allStaff = (await Promise.all(staffIds.map(id => base44.asServiceRole.entities.Staff.get(id).catch(() => null)))).filter(Boolean) as any[];

        const drillerStaff = allStaff.find(s => drillingTeamIds.has(s.team_id));
        const chosen = drillerStaff || allStaff[0];
        const chosenAssignment = assignments.find(a => a.staff_id === chosen?.id) || assignments[0];

        leadDrillerId = chosenAssignment.staff_id || '';
        if (!leadDrillerName) leadDrillerName = chosen?.name || '';
      }
    } catch (e) { /* skip */ }

    const logs: any[] = [];

    // --- Stream 1: Parse driller remarks into professionalised time-stamped activities ---
    const activities = parseRemarks(rawRemarks);
    let professionalised: string[] = [];
    if (activities.length > 0) {
      professionalised = await professionaliseActivities(base44, activities);
    }
    activities.forEach((activity, i) => {
      logs.push({
        job_id: job.id,
        staff_id: leadDrillerId || null,
        staff_name: leadDrillerName || '',
        date: workDate,
        log_type: 'other',
        source: 'keylogbook_remarks',
        start_time: activity.start_time,
        end_time: activity.end_time,
        duration_minutes: activity.duration_minutes,
        description: professionalised[i] || activity.raw_description,
        completed_by_type: 'internal_staff',
        completed_by_name: leadDrillerName || 'KeyLogBook Webhook',
        manager_review_status: 'pending',
        chargeable: false,
        billing_status: 'no_charge',
      });
    });

    // Fallback: if remarks exist but didn't parse into activities, store as one entry
    if (activities.length === 0 && rawRemarks) {
      logs.push({
        job_id: job.id,
        staff_id: leadDrillerId || null,
        staff_name: leadDrillerName || '',
        date: workDate,
        log_type: 'other',
        source: 'keylogbook_remarks',
        description: rawRemarks,
        completed_by_type: 'internal_staff',
        completed_by_name: leadDrillerName || 'KeyLogBook Webhook',
        manager_review_status: 'pending',
        chargeable: false,
        billing_status: 'no_charge',
      });
    }

    // --- Stream 2: Structured borehole data (AGS import — read-only technical records) ---
    const boreholes = Array.isArray(body.boreholes) ? body.boreholes : [];
    for (const bh of boreholes) {
      const bhRef = str(bh.reference || bh.borehole_ref || bh.id || bh.loca_id);
      const bhRemarks = str(bh.remarks || bh.notes || bh.description);
      const bhDepth = num(bh.final_depth || bh.depth || bh.depth_to);
      const bhMeterage = num(bh.meterage);
      logs.push({
        job_id: job.id,
        staff_id: null,
        date: str(bh.date) || workDate,
        log_type: 'borehole_progress',
        borehole_ref: bhRef || null,
        depth_to: bhDepth || null,
        description: `Imported from KeyLogBook — borehole ${bhRef || '—'}${bhRemarks ? `: ${bhRemarks}` : ''}`,
        source: 'ags_import',
        completed_by_type: 'internal_staff',
        completed_by_name: 'KeyLogBook Webhook',
        manager_review_status: 'approved',
        chargeable: false,
      });
      if (bhMeterage != null) {
        logs[logs.length - 1].units_completed = bhMeterage;
        logs[logs.length - 1].units_label = 'metres';
      }
    }

    const genericLogs = Array.isArray(body.logs) ? body.logs : [];
    for (const gl of genericLogs) {
      logs.push({
        job_id: job.id,
        staff_id: null,
        date: str(gl.date) || workDate,
        log_type: str(gl.log_type) || 'borehole_progress',
        borehole_ref: str(gl.borehole_ref || gl.reference) || null,
        depth_from: num(gl.depth_from),
        depth_to: num(gl.depth_to),
        description: `Imported from KeyLogBook — ${str(gl.description || gl.remarks || gl.notes) || 'log entry'}`,
        source: 'ags_import',
        completed_by_type: 'internal_staff',
        completed_by_name: 'KeyLogBook Webhook',
        manager_review_status: 'approved',
        chargeable: false,
      });
    }

    let insertedLogs = 0;
    if (logs.length > 0) {
      for (let i = 0; i < logs.length; i += 500) {
        const batch = logs.slice(i, i + 500);
        await base44.asServiceRole.entities.InvestigationLog.bulkCreate(batch);
        insertedLogs += batch.length;
      }
    }

    // --- Update the config with the last webhook status ---
    const remarksCount = logs.filter(l => l.source === 'keylogbook_remarks').length;
    const agsCount = logs.filter(l => l.source === 'ags_import').length;
    const summary = `Processed ${insertedLogs} log entr${insertedLogs === 1 ? 'y' : 'ies'}${remarksCount > 0 ? ` · ${remarksCount} site log activit${remarksCount === 1 ? 'y' : 'ies'} (pending review)` : ''}${agsCount > 0 ? ` · ${agsCount} borehole record${agsCount === 1 ? '' : 's'}` : ''}`;
    await updateWebhookStatus(base44, config, 'success', summary);

    return Response.json({
      status: 'success',
      job_id: job.id,
      job_name: job.name,
      deleted: deletedCount,
      logs_inserted: insertedLogs,
      remarks_activities: remarksCount,
      borehole_records: agsCount,
      lead_driller: leadDrillerName || '',
      summary,
    });
  } catch (error) {
    try {
      const base44 = createClientFromRequest(req);
      const configs = await base44.asServiceRole.entities.KeyLogBookConfig.filter({ key: 'global' });
      if (configs[0]) {
        await updateWebhookStatus(base44, configs[0], 'failed', error.message);
      }
    } catch (e) { /* swallow */ }
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function updateWebhookStatus(base44: any, config: any, status: string, summary: string) {
  await base44.asServiceRole.entities.KeyLogBookConfig.update(config.id, {
    last_webhook_at: new Date().toISOString(),
    last_webhook_status: status,
    last_webhook_summary: summary,
  });
}