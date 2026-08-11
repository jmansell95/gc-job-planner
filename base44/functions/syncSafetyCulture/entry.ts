import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// SafetyCulture pull-based sync
// ============================================================
// Pulls recent audits from the SafetyCulture REST API using the stored
// API token (SafetyCultureConfig.api_token). Stores each new audit as a
// SafetyReport — same shape as the webhook receiver. Designed to run on
// a schedule (every 15-30 minutes) so audits appear in the platform even
// if the webhook isn't configured yet.
//
// SafetyCulture API docs: https://developer.safetyculture.com/
// Endpoint: GET https://api.safetyculture.com/audits?modified_after=...
// Auth: Bearer <api_token>

function num(v: any): number | null {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? null : n;
}

function deepGet(obj: any, ...paths: string[]): any {
  for (const p of paths) {
    const parts = p.split('.');
    let cur: any = obj;
    let ok = true;
    for (const part of parts) {
      if (cur == null || typeof cur !== 'object' || !(part in cur)) { ok = false; break; }
      cur = cur[part];
    }
    if (ok && cur != null && cur !== '') return cur;
  }
  return '';
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Load config singleton
  let config: any = null;
  try {
    const configs = await base44.asServiceRole.entities.SafetyCultureConfig.filter({ key: 'global' });
    config = configs && configs[0];
  } catch (e) { /* entity may not exist yet */ }

  if (!config) {
    return Response.json({ error: 'SafetyCulture not configured.' }, { status: 422 });
  }
  if (!config.api_token) {
    return Response.json({ error: 'No API token configured. Add one in Settings → SafetyCulture.' }, { status: 422 });
  }

  // Pull audits modified in the last 24 hours
  const modifiedAfter = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const apiUrl = `https://api.safetyculture.com/audits?modified_after=${encodeURIComponent(modifiedAfter)}&field=audit_id&field=template_id&field=owner&field=audit_data&field=audit_metadata&field=score&field=score_percentage&field=items_failed&field=items_passed&field=audit_progress`;

  let audits: any[] = [];
  let nextCursor: string | null = null;
  let totalPages = 0;
  const maxPages = 5; // cap at 5 pages to avoid timeout

  try {
    do {
      const pageUrl = nextCursor ? `${apiUrl}&cursor=${encodeURIComponent(nextCursor)}` : apiUrl;
      const resp = await fetch(pageUrl, {
        headers: {
          'Authorization': `Bearer ${config.api_token}`,
          'Accept': 'application/json',
        },
      });

      if (!resp.ok) {
        const errText = await resp.text();
        return Response.json({
          error: `SafetyCulture API returned ${resp.status}`,
          details: errText.slice(0, 500),
        }, { status: 502 });
      }

      const page = await resp.json();
      const pageAudits = Array.isArray(page.audits) ? page.audits : [];
      audits = audits.concat(pageAudits);
      nextCursor = page.next_cursor || null;
      totalPages++;
    } while (nextCursor && totalPages < maxPages);
  } catch (err) {
    return Response.json({ error: 'Failed to reach SafetyCulture API', details: err.message }, { status: 502 });
  }

  // Load jobs once for auto-matching
  let jobs: any[] = [];
  if (config.auto_link_to_jobs) {
    try {
      jobs = await base44.asServiceRole.entities.Job.list('-created_date', 200);
    } catch (e) { /* continue */ }
  }

  let stored = 0;
  let updated = 0;
  let skipped = 0;
  let linkedJobs = 0;
  const errors: string[] = [];

  for (const audit of audits) {
    try {
      const auditId = String(audit.audit_id || audit.id || '');
      if (!auditId) { skipped++; continue; }

      // Check if we already have this audit
      let existingId: string | null = null;
      try {
        const existing = await base44.asServiceRole.entities.SafetyReport.filter({ safetyculture_audit_id: auditId });
        if (existing && existing[0]) existingId = existing[0].id;
      } catch (e) { /* continue */ }

      // Extract fields from the audit payload
      const templateName = String(deepGet(audit, 'template_id', 'audit_metadata.template_name', 'audit_data.template_name') || '');
      const auditTitle = String(deepGet(audit, 'audit_metadata.name', 'audit_data.name', 'name') || '');
      const auditorName = String(deepGet(audit, 'owner.name', 'audit_data.author.name', 'author.name') || '');
      const auditorEmail = String(deepGet(audit, 'owner.email', 'audit_data.author.email', 'author.email') || '');
      const siteName = String(deepGet(audit, 'audit_metadata.site', 'audit_data.header_items.site', 'header_items.site', 'site', 'location') || '');
      const conductedAt = String(deepGet(audit, 'audit_data.audit_started_at', 'audit_started_at', 'created_at') || '');
      const completedAt = String(deepGet(audit, 'audit_data.audit_completed_at', 'audit_completed_at', 'completed_at') || '');
      const reportUrl = String(deepGet(audit, 'audit_metadata.report_url', 'report_url', 'pdf_url') || '');

      const overallScore = num(deepGet(audit, 'score', 'audit_data.score', 'overall_score'));
      const maxScore = num(deepGet(audit, 'max_score', 'audit_data.max_score'));
      const scorePct = num(deepGet(audit, 'score_percentage', 'audit_data.score_percentage'));
      const itemsPassed = num(deepGet(audit, 'items_passed', 'audit_data.items_passed'));
      const itemsFailed = num(deepGet(audit, 'items_failed', 'audit_data.items_failed'));
      const passFailRaw = String(deepGet(audit, 'audit_data.pass_fail', 'pass_fail', 'result') || '').toLowerCase();
      const passFail = passFailRaw === 'pass' ? 'pass' : passFailRaw === 'fail' ? 'fail' : 'pending';

      // Action items
      const actionItems: any[] = [];
      const rawActions: any = deepGet(audit, 'audit_data.action_items', 'action_items', 'corrective_actions', 'actions');
      if (Array.isArray(rawActions)) {
        for (const a of rawActions) {
          if (!a || typeof a !== 'object') continue;
          actionItems.push({
            description: String(a.description || a.action || a.text || ''),
            priority: String(a.priority || 'medium').toLowerCase(),
            assignee: String(a.assignee || a.assigned_to || ''),
            due_date: a.due_date ? String(a.due_date).slice(0, 10) : '',
          });
        }
      }

      // Auto-match Contractor by email
      let contractorId: string | null = null;
      if (auditorEmail) {
        try {
          const matches = await base44.asServiceRole.entities.Contractor.filter({ safetyculture_email: auditorEmail });
          if (matches && matches[0]) contractorId = matches[0].id;
        } catch (e) { /* continue */ }
      }

      // Auto-match Job by site name / reference
      let jobId: string | null = null;
      let jobName: string = '';
      if (config.auto_link_to_jobs && siteName && jobs.length > 0) {
        const q = siteName.toLowerCase().trim();
        const match =
          jobs.find((j: any) => j.job_reference && j.job_reference.toLowerCase() === q) ||
          jobs.find((j: any) => j.name && j.name.toLowerCase() === q) ||
          jobs.find((j: any) => j.location && j.location.toLowerCase().includes(q)) ||
          jobs.find((j: any) => j.name && j.name.toLowerCase().includes(q));
        if (match) { jobId = match.id; jobName = match.name; linkedJobs++; }
      }

      const computedPct = scorePct != null ? scorePct : (overallScore != null && maxScore && maxScore > 0 ? Math.round((overallScore / maxScore) * 10000) / 100 : null);

      const report: any = {
        safetyculture_audit_id: auditId,
        audit_template_name: templateName,
        audit_title: auditTitle,
        auditor_name: auditorName,
        auditor_email: auditorEmail,
        job_id: jobId || null,
        job_name: jobName,
        contractor_id: contractorId,
        site_name: siteName,
        conducted_at: conductedAt || null,
        completed_at: completedAt || null,
        overall_score: overallScore,
        max_score: maxScore,
        score_percentage: computedPct,
        pass_fail: passFail,
        audit_report_url: reportUrl,
        items_failed: itemsFailed || 0,
        items_passed: itemsPassed || 0,
        action_items: actionItems,
        status: actionItems.length > 0 ? 'open' : 'closed',
        raw_payload: JSON.stringify(audit),
      };

      if (existingId) {
        await base44.asServiceRole.entities.SafetyReport.update(existingId, report);
        updated++;
      } else {
        await base44.asServiceRole.entities.SafetyReport.create(report);
        stored++;
      }
    } catch (err) {
      errors.push(`Audit ${audit.audit_id || '?'}: ${err.message}`);
      skipped++;
    }
  }

  // Update config status
  try {
    await base44.asServiceRole.entities.SafetyCultureConfig.update(config.id, {
      last_webhook_at: new Date().toISOString(),
      last_webhook_status: 'success',
      last_webhook_summary: `Pull sync: ${stored} new, ${updated} updated, ${linkedJobs} jobs linked`,
    });
  } catch (e) { /* non-fatal */ }

  return Response.json({
    status: 'success',
    pulled: audits.length,
    stored,
    updated,
    skipped,
    linked_jobs: linkedJobs,
    errors: errors.slice(0, 5),
  });
});