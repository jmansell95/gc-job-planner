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
    const ts = body.data || body;

    const ctrl = await base44.asServiceRole.entities.AutomationControl.filter({ automation_key: 'timesheet_submitted' });
    const ac = ctrl[0];
    if (ac && ac.enabled === false) return Response.json({ skipped: true, reason: 'Automation disabled' });

    if (!ts || !ts.staff_id) return Response.json({ skipped: true, reason: 'No timesheet data' });

    const staffList = await base44.asServiceRole.entities.Staff.filter({ id: ts.staff_id });
    const staff = staffList[0];
    const jobList = await base44.asServiceRole.entities.Job.filter({ id: ts.job_id });
    const job = jobList[0];

    let recipients = [];
    if (staff && staff.manager_id) {
      const mgrList = await base44.asServiceRole.entities.Staff.filter({ id: staff.manager_id });
      if (mgrList[0] && mgrList[0].email) recipients.push(mgrList[0].email);
    }
    if (recipients.length === 0) {
      const users = await base44.asServiceRole.entities.User.list();
      recipients = users.filter(u => u.role === 'admin' && u.email).map(u => u.email);
    }
    if (recipients.length === 0) return Response.json({ skipped: true, reason: 'No recipients' });

    const staffName = staff ? staff.name : 'Unknown staff';
    const jobName = job ? job.name : 'Unknown job';
    const hours = ts.total_hours != null ? ts.total_hours + 'h' : ((ts.task_duration_minutes ? (ts.task_duration_minutes / 60).toFixed(1) + 'h' : '—'));

    const text = 'A timesheet has been submitted for approval:\n\n' +
      'Staff: ' + staffName + '\n' +
      'Job: ' + jobName + '\n' +
      'Date: ' + (ts.date || '—') + '\n' +
      'Hours: ' + hours + '\n' +
      (ts.task_description ? 'Task: ' + ts.task_description + '\n' : '') +
      (ts.notes ? 'Notes: ' + ts.notes + '\n' : '') +
      '\nReview and approve it in the planner.\n\nGC Job Planner';

    let notified = 0;
    for (const to of recipients) {
      try { await base44.asServiceRole.integrations.Core.SendEmail({ to, subject: 'Timesheet submitted by ' + staffName, body: styledHtml(text) }); notified++; } catch (e) {}
    }

    if (ac) { try { await base44.asServiceRole.entities.AutomationControl.update(ac.id, { last_run_at: new Date().toISOString(), last_run_status: 'success' }); } catch (e) {} }
    return Response.json({ sent: true, notified });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});