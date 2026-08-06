import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const DEFAULT_ASSIGNMENT_TEMPLATE = "Hi {staff_name},\n\nYou have a new shift:\n\nJob: {job_name}\nLocation: {location}\nDate: {date}\nType: {job_type}\n{notes}\n\nPlease review the details and check your app for the full schedule.\n\nGC Mission Control";

function escapeHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function linkBlock(baseUrl, path, label) {
  if (!baseUrl) return '';
  const href = baseUrl.replace(/\/+$/, '') + (path || '');
  return '<p style="margin-top:18px"><a href="' + escapeHtml(href) + '" style="display:inline-block;background:#0e7a4f;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;font-family:Arial,Helvetica,sans-serif">' + escapeHtml(label) + '</a></p>';
}
function styledHtml(rawBodyHtml, cfg) {
  const accent = (cfg && cfg.accent_color) || '#0e7a4f';
  const bannerTitle = (cfg && cfg.banner_title) || 'GC Mission Control';
  const showBanner = !(cfg && cfg.show_banner === false);
  const footer = (cfg && cfg.footer_text) || 'GC Mission Control';
  const banner = showBanner
    ? '<tr><td style="background:' + accent + ';padding:18px 24px"><h1 style="margin:0;color:#ffffff;font-size:18px;font-family:Arial,Helvetica,sans-serif;letter-spacing:0.3px">' + escapeHtml(bannerTitle) + '</h1></td></tr>'
    : '';
  return '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">' +
    '<table align="center" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;margin:24px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 6px 24px rgba(15,42,31,0.08)">' +
    banner +
    '<tr><td style="padding:24px;color:#1e293b;font-size:14px;line-height:1.6">' + rawBodyHtml + '</td></tr>' +
    '<tr><td style="padding:14px 24px;background:#f8fafc;color:#64748b;font-size:12px;border-top:1px solid #e2e8f0;text-align:center">' + escapeHtml(footer) + '</td></tr>' +
    '</table></body></html>';
}
async function getAppBaseUrl(base44) {
  try { const list = await base44.asServiceRole.entities.AppSetting.filter({ key: 'global' }); return (list[0] && list[0].app_base_url) || ''; } catch (e) { return ''; }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const data = body.data || body;
    const staffId = data.staff_id;
    const jobId = data.job_id;
    const assignedDate = data.assigned_date;

    if (!staffId || !jobId) {
      return Response.json({ skipped: true, reason: 'Missing staff_id or job_id' });
    }

    const staffList = await base44.asServiceRole.entities.Staff.filter({ id: staffId });
    const staff = staffList[0];
    if (!staff || !staff.email) {
      return Response.json({ skipped: true, reason: 'Staff not found or no email' });
    }
    if (staff.email_notifications_enabled === false) {
      return Response.json({ skipped: true, reason: 'Staff unsubscribed from emails' });
    }

    const jobList = await base44.asServiceRole.entities.Job.filter({ id: jobId });
    const job = jobList[0];
    if (!job) {
      return Response.json({ skipped: true, reason: 'Job not found' });
    }

    const settings = await base44.asServiceRole.entities.EmailAlertSetting.filter({ alert_key: 'assignment_notification' });
    const cfg = settings[0];
    if (!cfg || cfg.enabled === false) {
      return Response.json({ skipped: true, reason: 'Alert disabled' });
    }
    const effectiveTemplate = (cfg && cfg.template) || DEFAULT_ASSIGNMENT_TEMPLATE;

    const dateObj = assignedDate ? new Date(assignedDate + 'T00:00:00') : new Date();
    const formattedDate = dateObj.toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    const notesLine = job.notes ? 'Notes: ' + job.notes : '';
    const text = effectiveTemplate
      .replace(/\{staff_name\}/g, staff.name)
      .replace(/\{job_name\}/g, job.name)
      .replace(/\{location\}/g, job.location)
      .replace(/\{date\}/g, formattedDate)
      .replace(/\{job_type\}/g, (job.job_type || 'general').replace(/_/g, ' '))
      .replace(/\{notes\}/g, notesLine);
    const subject = (cfg && cfg.subject)
      ? cfg.subject.replace(/\{job_name\}/g, job.name).replace(/\{staff_name\}/g, staff.name)
      : 'New Shift: ' + job.name;

    const baseUrl = await getAppBaseUrl(base44);
    const bodyHtml = escapeHtml(text).replace(/\n/g, '<br>') + linkBlock(baseUrl, '/staff-schedule', 'View your schedule');

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: staff.email,
      subject,
      body: styledHtml(bodyHtml, cfg)
    });

    // Send a copy to configured recipients (managers/admins)
    const recipients = (cfg && cfg.recipient_emails) ? String(cfg.recipient_emails).split(',').map((e) => e.trim()).filter(Boolean) : [];
    let copies = 0;
    for (const email of recipients) {
      if (email === staff.email) continue;
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({ to: email, subject, body: styledHtml(bodyHtml, cfg) });
        copies++;
      } catch (e) {}
    }

    return Response.json({ sent: true, to: staff.email, copies });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});