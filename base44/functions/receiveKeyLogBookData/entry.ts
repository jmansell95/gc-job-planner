import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// KeyLogBook Webhook Receiver
// ============================================================
// Receives real-time borehole log data pushed from KeyLogBook
// (Option A: API / Webhook). Validates a shared secret, creates
// InvestigationLog records, and auto-generates draft Timesheet
// entries for the lead driller and second man assigned to the
// job that day.
//
// This endpoint is called by KeyLogBook (no authenticated user),
// so it uses the service role for all database operations and
// validates the shared secret stored in KeyLogBookConfig.

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

// AI enrichment — cleans up raw driller remarks into professional, spell-checked
// report-ready text. Preserves all technical accuracy. Never blocks the webhook
// (falls back to raw text on any error).
async function enrichRemarks(base44: any, rawText: string): Promise<string> {
  if (!rawText || rawText.trim().length < 10) return rawText || '';
  try {
    const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a geotechnical field log editor. Clean up the following raw driller remark from a cable percussion or rotary borehole log. Fix spelling, grammar, and capitalisation. Convert informal shorthand into professional, report-ready English while preserving all technical accuracy (depths, strata descriptions, groundwater, obstructions, equipment). Do NOT add information that isn't in the original. Return ONLY the cleaned text, no preamble.\n\nRaw remark:\n${rawText}`,
    });
    const cleaned = typeof res === 'string' ? res.trim() : String((res as any)?.text || (res as any)?.response || '').trim();
    return cleaned || rawText;
  } catch (e) {
    return rawText; // Never block the webhook — fall back to raw text
  }
}

// Parse HH:MM into minutes from midnight
function timeToMins(t: string | null | undefined): number | null {
  if (!t) return null;
  const m = String(t).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // --- Fetch the singleton config (service role — no user context) ---
    const configs = await base44.asServiceRole.entities.KeyLogBookConfig.filter({ key: 'global' });
    const config = configs[0];

    // --- Validate the shared secret ---
    // KeyLogBook sends it via the x-klb-signature header, or as a ?secret= query param.
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
    // AI enrichment — spell-check and professionalise the driller's raw remarks
    const remarks = await enrichRemarks(base44, rawRemarks);

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

    // --- Delete previous AGS-imported logs for this job (overwrite mode) ---
    let deletedCount = 0;
    try {
      const existing = await base44.asServiceRole.entities.InvestigationLog.filter({ job_id: job.id, source: 'ags_import' });
      deletedCount = existing.length;
      if (deletedCount > 0) {
        await base44.asServiceRole.entities.InvestigationLog.deleteMany({ job_id: job.id, source: 'ags_import' });
      }
    } catch (e) { /* continue */ }

    // --- Build InvestigationLog records from the payload ---
    const logs: any[] = [];

    // Top-level remarks → a borehole_progress log entry
    if (remarks) {
      logs.push({
        job_id: job.id,
        staff_id: null,
        date: workDate,
        log_type: 'borehole_progress',
        description: `Imported from KeyLogBook webhook — daily remarks: ${remarks}`,
        source: 'ags_import',
        completed_by_type: 'internal_staff',
        completed_by_name: 'KeyLogBook Webhook',
        manager_review_status: 'approved',
        chargeable: false,
      });
    }

    // Borehole-level entries (flexible field names)
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
        description: `Imported from KeyLogBook webhook — borehole ${bhRef || '—'}${bhRemarks ? `: ${bhRemarks}` : ''}`,
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

    // Generic log entries array (if KeyLogBook sends structured logs)
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
        description: `Imported from KeyLogBook webhook — ${str(gl.description || gl.remarks || gl.notes) || 'log entry'}`,
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

    // --- Auto-generate draft Timesheets for the crew ---
    let timesheetsDrafted = 0;
    let crewNames: string[] = [];

    if (config.auto_generate_timesheets !== false) {
      // Find rota assignments for this job on the work date
      const assignments = await base44.asServiceRole.entities.RotaAssignment.filter({
        job_id: job.id,
        assigned_date: workDate,
      });

      for (const a of assignments) {
        // Skip if a draft or submitted timesheet already exists for this staff+date+job
        // (avoids duplicates if the driller already logged manually)
        const existing = await base44.asServiceRole.entities.Timesheet.filter({
          staff_id: a.staff_id,
          date: workDate,
          job_id: job.id,
        });
        const hasExisting = existing.some((t: any) => t.status === 'draft' || t.status === 'submitted');
        if (hasExisting) continue;

        // Fetch the staff name for display
        let staffName = '';
        try {
          const staff = await base44.asServiceRole.entities.Staff.get(a.staff_id);
          staffName = staff?.name || '';
        } catch (e) { /* skip */ }

        const startTime = str(a.start_time);
        const endTime = str(a.end_time);
        const startMins = timeToMins(startTime);
        const endMins = timeToMins(endTime);
        let durationMins = 0;
        if (startMins != null && endMins != null && endMins > startMins) {
          durationMins = endMins - startMins;
        }

        const taskDesc = meterage != null
          ? `Drilling — ${meterage}m drilled (auto-generated from KeyLogBook)`
          : remarks
            ? `Drilling — ${remarks.slice(0, 120)} (auto-generated from KeyLogBook)`
            : 'Drilling shift (auto-generated from KeyLogBook)';

        await base44.asServiceRole.entities.Timesheet.create({
          staff_id: a.staff_id,
          job_id: job.id,
          date: workDate,
          task_description: taskDesc,
          task_type: 'on_site',
          start_time: startTime || null,
          end_time: endTime || null,
          task_duration_minutes: durationMins || 0,
          total_hours: Math.round((durationMins / 60) * 100) / 100,
          meterage: meterage || 0,
          status: 'draft',
          is_summary: false,
          notes: remarks || '',
        });
        timesheetsDrafted++;
        if (staffName) crewNames.push(staffName);
      }
    }

    // --- Update the config with the last webhook status ---
    const summary = `Processed ${insertedLogs} log entr${insertedLogs === 1 ? 'y' : 'ies'}${timesheetsDrafted > 0 ? ` · ${timesheetsDrafted} timesheet${timesheetsDrafted === 1 ? '' : 's'} drafted` : ''}${crewNames.length ? ` for ${crewNames.join(', ')}` : ''}`;
    await updateWebhookStatus(base44, config, 'success', summary);

    return Response.json({
      status: 'success',
      job_id: job.id,
      job_name: job.name,
      deleted: deletedCount,
      logs_inserted: insertedLogs,
      timesheets_drafted: timesheetsDrafted,
      crew: crewNames,
      summary,
    });
  } catch (error) {
    // Try to record the failure on the config (best-effort)
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