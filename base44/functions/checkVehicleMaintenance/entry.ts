import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function styledHtml(bodyText, cfg) {
  const accent = (cfg && cfg.accent_color) || '#0e7a4f';
  const bannerTitle = (cfg && cfg.banner_title) || 'GC Job Planner';
  const showBanner = !(cfg && cfg.show_banner === false);
  const footer = (cfg && cfg.footer_text) || 'GC Job Planner';
  const safe = escapeHtml(bodyText).replace(/\n/g, '<br>');
  const banner = showBanner
    ? '<tr><td style="background:' + accent + ';padding:18px 24px"><h1 style="margin:0;color:#ffffff;font-size:18px;font-family:Arial,Helvetica,sans-serif;letter-spacing:0.3px">' + escapeHtml(bannerTitle) + '</h1></td></tr>'
    : '';
  return '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">' +
    '<table align="center" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;margin:24px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 6px 24px rgba(15,42,31,0.08)">' +
    banner +
    '<tr><td style="padding:24px;color:#1e293b;font-size:14px;line-height:1.6">' + safe + '</td></tr>' +
    '<tr><td style="padding:14px 24px;background:#f8fafc;color:#64748b;font-size:12px;border-top:1px solid #e2e8f0;text-align:center">' + escapeHtml(footer) + '</td></tr>' +
    '</table></body></html>';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const settings = await base44.asServiceRole.entities.EmailAlertSetting.filter({ alert_key: 'vehicle_maintenance' });
    const cfg = settings[0];
    if (cfg && cfg.enabled === false) {
      return Response.json({ skipped: true, reason: 'Alert disabled' });
    }
    const daysBefore = (cfg && cfg.days_before_warning) ? cfg.days_before_warning : 30;

    const vehicles = await base44.asServiceRole.entities.Vehicle.list();
    const users = await base44.asServiceRole.entities.User.list();
    const admins = users.filter(u => u.role === 'admin');

    let recipients = [];
    if (cfg && cfg.recipient_emails) {
      recipients = cfg.recipient_emails.split(',').map(s => s.trim()).filter(Boolean);
    } else {
      recipients = admins.map(u => u.email);
    }
    if (recipients.length === 0) {
      return Response.json({ skipped: true, reason: 'No recipients configured' });
    }

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + daysBefore * 24 * 60 * 60 * 1000);

    const alerts = [];

    vehicles.forEach(v => {
      const issues = [];
      if (v.mot_expiry) {
        const motDate = new Date(v.mot_expiry + 'T00:00:00');
        if (motDate < now) {
          issues.push({ type: 'MOT', status: 'OVERDUE', date: v.mot_expiry });
        } else if (motDate <= thirtyDaysFromNow) {
          issues.push({ type: 'MOT', status: 'Due soon', date: v.mot_expiry });
        }
      }
      if (v.service_due_date) {
        const serviceDate = new Date(v.service_due_date + 'T00:00:00');
        if (serviceDate < now) {
          issues.push({ type: 'Service', status: 'OVERDUE', date: v.service_due_date });
        } else if (serviceDate <= thirtyDaysFromNow) {
          issues.push({ type: 'Service', status: 'Due soon', date: v.service_due_date });
        }
      }
      if (issues.length > 0) {
        alerts.push({ vehicle: v.name, registration: v.registration_number, issues });
      }
    });

    if (alerts.length === 0) {
      return Response.json({ sent: false, reason: 'No maintenance alerts', checked: vehicles.length });
    }

    let emailBody = 'Vehicle Maintenance Report\n\n';
    emailBody += alerts.length + ' vehicle(s) require maintenance attention:\n\n';
    alerts.forEach(a => {
      emailBody += a.vehicle + ' (' + a.registration + '):\n';
      a.issues.forEach(issue => {
        emailBody += '  - ' + issue.type + ': ' + issue.status + ' (due ' + issue.date + ')\n';
      });
      emailBody += '\n';
    });
    emailBody += 'Please schedule maintenance as soon as possible.\n\nGC Job Planner';

    const subject = (cfg && cfg.subject) ? cfg.subject : 'Vehicle Maintenance Alert - ' + alerts.length + ' vehicle(s) need attention';
    let finalBody;
    if (cfg && cfg.template) {
      finalBody = cfg.template
        .replace(/\{alert_count\}/g, String(alerts.length))
        .replace(/\{alert_list\}/g, emailBody);
    } else {
      const intro = (cfg && cfg.intro_message) ? cfg.intro_message + '\n\n' : '';
      finalBody = intro + emailBody;
    }
    for (const to of recipients) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to,
        subject,
        body: styledHtml(finalBody, cfg)
      });
    }

    return Response.json({ sent: true, alertCount: alerts.length, notifiedRecipients: recipients.length, alerts });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});