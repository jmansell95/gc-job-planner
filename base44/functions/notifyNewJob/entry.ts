import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function styledHtml(bodyText) {
  const safe = escapeHtml(bodyText).replace(/\n/g, '<br>');
  return '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">' +
    '<table align="center" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;margin:24px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 6px 24px rgba(15,42,31,0.08)">' +
    '<tr><td style="background:#0e7a4f;padding:18px 24px"><h1 style="margin:0;color:#ffffff;font-size:18px">GC Job Planner</h1></td></tr>' +
    '<tr><td style="padding:24px;color:#1e293b;font-size:14px;line-height:1.6">' + safe + '</td></tr>' +
    '<tr><td style="padding:14px 24px;background:#f8fafc;color:#64748b;font-size:12px;border-top:1px solid #e2e8f0;text-align:center">GC Job Planner</td></tr>' +
    '</table></body></html>';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const job = body.data || body;

    const ctrl = await base44.asServiceRole.entities.AutomationControl.filter({ automation_key: 'new_job_alert' });
    const ac = ctrl[0];
    if (ac && ac.enabled === false) return Response.json({ skipped: true, reason: 'Automation disabled' });

    if (!job || !job.name) return Response.json({ skipped: true, reason: 'No job data' });

    const users = await base44.asServiceRole.entities.User.list();
    const admins = users.filter(u => u.role === 'admin' && u.email);
    if (admins.length === 0) return Response.json({ skipped: true, reason: 'No admins' });

    const text = 'A new job has been created:\n\n' +
      'Job: ' + job.name + '\n' +
      'Location: ' + (job.location || '—') + '\n' +
      'Type: ' + (job.job_type || '').replace(/_/g, ' ') + '\n' +
      'Start: ' + (job.start_date || '—') + '\n' +
      'End: ' + (job.end_date || '—') + '\n' +
      (job.job_reference ? 'Reference: ' + job.job_reference + '\n' : '') +
      '\nReview the job in the planner.\n\nGC Job Planner';

    let notified = 0;
    for (const u of admins) {
      try { await base44.asServiceRole.integrations.Core.SendEmail({ to: u.email, subject: 'New Job Created: ' + job.name, body: styledHtml(text) }); notified++; } catch (e) {}
    }

    if (ac) { try { await base44.asServiceRole.entities.AutomationControl.update(ac.id, { last_run_at: new Date().toISOString(), last_run_status: 'success' }); } catch (e) {} }
    return Response.json({ sent: true, notified });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});