import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const DEFAULTS = [
  { alert_key: 'vehicle_maintenance', enabled: true, recipient_emails: '', days_before_warning: 30, subject: '', intro_message: '', template: '', accent_color: '#0e7a4f', banner_title: 'GC Job Planner', show_banner: true, footer_text: 'GC Job Planner' },
  { alert_key: 'assignment_notification', enabled: true, recipient_emails: '', days_before_warning: null, subject: '', intro_message: '', template: '', accent_color: '#0e7a4f', banner_title: 'GC Job Planner', show_banner: true, footer_text: 'GC Job Planner' },
  { alert_key: 'staff_schedule', enabled: true, recipient_emails: '', days_before_warning: null, subject: '', intro_message: '', template: '', accent_color: '#0e7a4f', banner_title: 'GC Job Planner', show_banner: true, footer_text: 'GC Job Planner' },
  { alert_key: 'staff_invitation', enabled: true, recipient_emails: '', days_before_warning: null, subject: '', intro_message: '', template: '', accent_color: '#0e7a4f', banner_title: 'GC Job Planner', show_banner: true, footer_text: 'GC Job Planner' },
  { alert_key: 'absence_request', enabled: true, recipient_emails: '', days_before_warning: null, subject: '', intro_message: '', template: '', accent_color: '#0e7a4f', banner_title: 'GC Job Planner', show_banner: true, footer_text: 'GC Job Planner' },
  { alert_key: 'job_status_change', enabled: true, recipient_emails: '', days_before_warning: null, subject: '', intro_message: '', template: '', accent_color: '#0e7a4f', banner_title: 'GC Job Planner', show_banner: true, footer_text: 'GC Job Planner' },
  { alert_key: 'new_job', enabled: true, recipient_emails: '', days_before_warning: null, subject: '', intro_message: '', template: '', accent_color: '#0e7a4f', banner_title: 'GC Job Planner', show_banner: true, footer_text: 'GC Job Planner' },
  { alert_key: 'timesheet_submitted', enabled: true, recipient_emails: '', days_before_warning: null, subject: '', intro_message: '', template: '', accent_color: '#0e7a4f', banner_title: 'GC Job Planner', show_banner: true, footer_text: 'GC Job Planner' },
  { alert_key: 'maintenance_booking', enabled: true, recipient_emails: '', days_before_warning: null, subject: '', intro_message: '', template: '', accent_color: '#0e7a4f', banner_title: 'GC Job Planner', show_banner: true, footer_text: 'GC Job Planner' },
  { alert_key: 'training_booking', enabled: true, recipient_emails: '', days_before_warning: null, subject: '', intro_message: '', template: '', accent_color: '#0e7a4f', banner_title: 'GC Job Planner', show_banner: true, footer_text: 'GC Job Planner' },
  { alert_key: 'daily_reminder', enabled: true, recipient_emails: '', days_before_warning: null, subject: '', intro_message: '', template: '', accent_color: '#0e7a4f', banner_title: 'GC Job Planner', show_banner: true, footer_text: 'GC Job Planner' },
  { alert_key: 'compliance_expiry', enabled: true, recipient_emails: '', days_before_warning: 30, subject: '', intro_message: '', template: '', accent_color: '#0e7a4f', banner_title: 'GC Job Planner', show_banner: true, footer_text: 'GC Job Planner' }
];

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function textToHtml(text) {
  return escapeHtml(text).replace(/\n/g, '<br>');
}
function linkBlock(baseUrl, path, label) {
  if (!baseUrl) return '';
  const href = baseUrl.replace(/\/+$/, '') + (path || '');
  return '<p style="margin-top:18px"><a href="' + escapeHtml(href) + '" style="display:inline-block;background:#0e7a4f;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;font-family:Arial,Helvetica,sans-serif">' + escapeHtml(label) + '</a></p>';
}
function styledHtml(rawBodyHtml, cfg) {
  const accent = (cfg && cfg.accent_color) || '#0e7a4f';
  const bannerTitle = (cfg && cfg.banner_title) || 'GC Job Planner';
  const showBanner = !(cfg && cfg.show_banner === false);
  const footer = (cfg && cfg.footer_text) || 'GC Job Planner';
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

function linkForAlert(alert_key) {
  if (alert_key === 'staff_schedule' || alert_key === 'assignment_notification') {
    return { path: '/staff-schedule', label: 'View your schedule' };
  }
  if (alert_key === 'staff_invitation') {
    return { path: '', label: 'Open the app' };
  }
  if (alert_key === 'maintenance_booking' || alert_key === 'training_booking' || alert_key === 'daily_reminder') {
    return { path: '/staff-schedule', label: 'View your schedule' };
  }
  return { path: '/admin', label: 'Open planner' };
}

function renderTestTemplate(alert_key, template) {
  if (alert_key === 'vehicle_maintenance') {
    const sampleList = 'Vehicle Maintenance Report\n\n2 vehicle(s) require maintenance attention:\n\nVan 01 (AB12 CDE):\n  - MOT: Due soon (due 2026-07-15)\n  - Service: OVERDUE (due 2026-06-30)\n';
    return template
      .replace(/\{alert_count\}/g, '2')
      .replace(/\{alert_list\}/g, sampleList);
  }
  if (alert_key === 'compliance_expiry') {
    const sampleList = 'Compliance Expiry Report\n\n2 item(s) require attention:\n\nJohn Smith — CSCS Card (staff):\n  EXPIRED (expiry: 2026-06)\nVan 01 — Vehicle MOT (vehicle):\n  Expiring soon (expiry: 2026-07-25)\n';
    return template
      .replace(/\{alert_count\}/g, '2')
      .replace(/\{alert_list\}/g, sampleList);
  }
  if (alert_key === 'staff_schedule') {
    return template
      .replace(/\{staff_name\}/g, 'John Smith')
      .replace(/\{week_start\}/g, 'Mon 6 Jul – Sun 12 Jul 2026')
      .replace(/\{assignment_count\}/g, '5');
  }
  if (alert_key === 'staff_invitation') {
    return template
      .replace(/\{staff_name\}/g, 'John Smith')
      .replace(/\{email\}/g, 'john@example.com');
  }
  if (alert_key === 'absence_request') {
    return template
      .replace(/\{staff_name\}/g, 'John Smith')
      .replace(/\{start_date\}/g, '2026-07-15')
      .replace(/\{end_date\}/g, '2026-07-18')
      .replace(/\{reason\}/g, 'Holiday')
      .replace(/\{notes\}/g, 'Family holiday');
  }
  if (alert_key === 'job_status_change') {
    return template
      .replace(/\{job_name\}/g, 'Sample Job')
      .replace(/\{location\}/g, 'Sample Site, London')
      .replace(/\{old_status\}/g, 'In Progress')
      .replace(/\{new_status\}/g, 'On Hold');
  }
  if (alert_key === 'new_job') {
    return template
      .replace(/\{job_name\}/g, 'Sample Job')
      .replace(/\{location\}/g, 'Sample Site, London')
      .replace(/\{job_type\}/g, 'groundworks')
      .replace(/\{start_date\}/g, '2026-07-15')
      .replace(/\{end_date\}/g, '2026-07-30')
      .replace(/\{job_reference\}/g, 'JOB-001');
  }
  if (alert_key === 'timesheet_submitted') {
    return template
      .replace(/\{staff_name\}/g, 'John Smith')
      .replace(/\{job_name\}/g, 'Sample Job')
      .replace(/\{date\}/g, '2026-07-10')
      .replace(/\{hours\}/g, '8h')
      .replace(/\{task_description\}/g, 'Setting up the rig')
      .replace(/\{notes\}/g, 'All went well');
  }
  if (alert_key === 'maintenance_booking') {
    return template
      .replace(/\{staff_name\}/g, 'John Smith')
      .replace(/\{vehicle_name\}/g, 'Van 01 (AB12 CDE)')
      .replace(/\{booking_type\}/g, 'MOT')
      .replace(/\{booking_date\}/g, 'Monday, 15 July 2026')
      .replace(/\{booking_time\}/g, '09:00')
      .replace(/\{supplier_name\}/g, 'Holeman')
      .replace(/\{supplier_phone\}/g, '01234 567890')
      .replace(/\{location\}/g, 'Holeman Garage, Bristol')
      .replace(/\{notes\}/g, 'Please arrive 15 mins early');
  }
  if (alert_key === 'training_booking') {
    return template
      .replace(/\{staff_name\}/g, 'John Smith')
      .replace(/\{course_title\}/g, 'Forklift Training')
      .replace(/\{start_date\}/g, 'Monday, 15 July 2026')
      .replace(/\{end_date\}/g, '')
      .replace(/\{start_time\}/g, '08:00')
      .replace(/\{end_time\}/g, '16:00')
      .replace(/\{venue\}/g, 'Training Centre Bristol')
      .replace(/\{address\}/g, '123 Industrial Way, Bristol')
      .replace(/\{provider\}/g, 'NPORS Training Ltd')
      .replace(/\{provider_phone\}/g, '01234 567890')
      .replace(/\{description\}/g, '3-day forklift operator certification course');
  }
  if (alert_key === 'daily_reminder') {
    return template
      .replace(/\{staff_name\}/g, 'John Smith')
      .replace(/\{today_date\}/g, '2026-07-10')
      .replace(/\{assignment_list\}/g, '   - Sample Job - Sample Site, London - 07:00-17:00 - AB12 CDE\n   - Second Job - Another Site, Bath - 07:00-17:00');
  }
  return template
    .replace(/\{staff_name\}/g, 'John Smith')
    .replace(/\{job_name\}/g, 'Sample Job')
    .replace(/\{location\}/g, 'Sample Site, London')
    .replace(/\{date\}/g, 'Monday, 6 July 2026')
    .replace(/\{job_type\}/g, 'groundworks')
    .replace(/\{notes\}/g, 'Notes: Sample note');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'get';

    if (action === 'get') {
      const existing = await base44.asServiceRole.entities.EmailAlertSetting.list();
      const map = {};
      existing.forEach((e) => { map[e.alert_key] = e; });
      const result = [];
      for (const d of DEFAULTS) {
        if (map[d.alert_key]) {
          result.push(map[d.alert_key]);
        } else {
          const created = await base44.asServiceRole.entities.EmailAlertSetting.create(d);
          result.push(created);
        }
      }
      return Response.json({ settings: result });
    }

    if (action === 'save') {
      const { alert_key, enabled, recipient_emails, days_before_warning, subject, intro_message, template, accent_color, banner_title, show_banner, footer_text } = body;
      if (!alert_key) return Response.json({ error: 'alert_key required' }, { status: 400 });
      const data = {
        alert_key,
        enabled: enabled !== false,
        recipient_emails: recipient_emails || '',
        days_before_warning: days_before_warning != null ? Number(days_before_warning) : null,
        subject: subject || '',
        intro_message: intro_message || '',
        template: template || '',
        accent_color: accent_color || '#0e7a4f',
        banner_title: banner_title || 'GC Job Planner',
        show_banner: show_banner !== false,
        footer_text: footer_text || 'GC Job Planner'
      };
      const existing = await base44.asServiceRole.entities.EmailAlertSetting.filter({ alert_key });
      let saved;
      if (existing[0]) {
        saved = await base44.asServiceRole.entities.EmailAlertSetting.update(existing[0].id, data);
      } else {
        saved = await base44.asServiceRole.entities.EmailAlertSetting.create(data);
      }
      return Response.json({ saved: true, setting: saved });
    }

    if (action === 'preview') {
      const { alert_key } = body;
      if (!alert_key) return Response.json({ error: 'alert_key required' }, { status: 400 });
      const existing = await base44.asServiceRole.entities.EmailAlertSetting.filter({ alert_key });
      const cfg = existing[0] || { accent_color: '#0e7a4f', banner_title: 'GC Job Planner', show_banner: true, footer_text: 'GC Job Planner' };
      if (!cfg.template) {
        const msg = 'No template configured. This alert will not send until you add a template under this tab.';
        return Response.json({ html: styledHtml('<p style="font-size:14px;color:#94a3b8">' + escapeHtml(msg) + '</p>', cfg) });
      }
      const text = renderTestTemplate(alert_key, cfg.template);
      const baseUrl = await getAppBaseUrl(base44);
      const link = linkForAlert(alert_key);
      const bodyHtml = textToHtml(text) + linkBlock(baseUrl, link.path, link.label);
      return Response.json({ html: styledHtml(bodyHtml, cfg) });
    }

    if (action === 'test') {
      const { alert_key } = body;
      if (!alert_key) return Response.json({ error: 'alert_key required' }, { status: 400 });
      const existing = await base44.asServiceRole.entities.EmailAlertSetting.filter({ alert_key });
      const cfg = existing[0];
      if (!cfg || cfg.enabled === false) {
        return Response.json({ error: 'This alert is disabled. Enable it first.' }, { status: 400 });
      }
      if (!cfg.template) {
        return Response.json({ error: 'No template configured for this alert. Add a template under this tab first.' }, { status: 400 });
      }
      let recipients = [];
      if (cfg.recipient_emails) {
        recipients = cfg.recipient_emails.split(',').map((s) => s.trim()).filter(Boolean);
      }
      if (recipients.length === 0) {
        const users = await base44.asServiceRole.entities.User.list();
        recipients = users.filter((u) => u.role === 'admin').map((u) => u.email);
      }
      if (recipients.length === 0) {
        return Response.json({ error: 'No recipients configured' }, { status: 400 });
      }
      const defaultSubjects = { vehicle_maintenance: 'Vehicle Maintenance Alert (Test)', assignment_notification: 'New Job Assignment (Test)', staff_schedule: 'Weekly Schedule (Test)', staff_invitation: 'App Invitation (Test)', absence_request: 'Absence Request (Test)', job_status_change: 'Job Status Updated (Test)', new_job: 'New Job Created (Test)', timesheet_submitted: 'Timesheet Submitted (Test)', maintenance_booking: 'Maintenance Booking (Test)', training_booking: 'Training Booking (Test)', daily_reminder: 'Daily Schedule Reminder (Test)', compliance_expiry: 'Compliance Expiry Alert (Test)' };
      const subject = cfg.subject || defaultSubjects[alert_key] || 'Alert (Test)';
      const text = renderTestTemplate(alert_key, cfg.template);
      const baseUrl = await getAppBaseUrl(base44);
      const link = linkForAlert(alert_key);
      const bodyHtml = textToHtml(text) + linkBlock(baseUrl, link.path, link.label);
      const html = styledHtml(bodyHtml, cfg);
      for (const to of recipients) {
        await base44.asServiceRole.integrations.Core.SendEmail({ to, subject, body: html });
      }
      return Response.json({ sent: true, recipients });
    }

    if (action === 'send_invitation') {
      const { email, staff_name } = body;
      if (!email) return Response.json({ error: 'email required' }, { status: 400 });
      const existing = await base44.asServiceRole.entities.EmailAlertSetting.filter({ alert_key: 'staff_invitation' });
      const cfg = existing[0];
      if (!cfg || cfg.enabled === false) {
        return Response.json({ error: 'Invitation email is disabled. Enable it in Email Alerts.' }, { status: 400 });
      }
      if (!cfg.template) {
        return Response.json({ error: 'No invitation template configured. Add one under the App Invitation tab first.' }, { status: 400 });
      }
      const name = staff_name || (email.split('@')[0] || 'there');
      const subject = cfg.subject
        ? cfg.subject.replace(/\{staff_name\}/g, name).replace(/\{email\}/g, email)
        : 'You are invited to GC Job Planner';
      const text = cfg.template.replace(/\{staff_name\}/g, name).replace(/\{email\}/g, email);
      const baseUrl = await getAppBaseUrl(base44);
      const bodyHtml = textToHtml(text) + linkBlock(baseUrl, '', 'Open the app');
      const html = styledHtml(bodyHtml, cfg);
      await base44.asServiceRole.integrations.Core.SendEmail({ to: email, subject, body: html });
      return Response.json({ sent: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});