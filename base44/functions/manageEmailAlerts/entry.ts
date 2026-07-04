import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const DEFAULTS = [
  { alert_key: 'vehicle_maintenance', enabled: true, recipient_emails: '', days_before_warning: 30, subject: '', intro_message: '', template: '' },
  { alert_key: 'assignment_notification', enabled: true, recipient_emails: '', days_before_warning: null, subject: '', intro_message: '', template: '' }
];

function renderTestTemplate(alert_key, template) {
  if (alert_key === 'vehicle_maintenance') {
    const sampleList = 'Vehicle Maintenance Report\n\n2 vehicle(s) require maintenance attention:\n\nVan 01 (AB12 CDE):\n  - MOT: Due soon (due 2026-07-15)\n  - Service: OVERDUE (due 2026-06-30)\n';
    return template
      .replace(/\{alert_count\}/g, '2')
      .replace(/\{alert_list\}/g, sampleList);
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
      const { alert_key, enabled, recipient_emails, days_before_warning, subject, intro_message, template } = body;
      if (!alert_key) return Response.json({ error: 'alert_key required' }, { status: 400 });
      const data = {
        alert_key,
        enabled: enabled !== false,
        recipient_emails: recipient_emails || '',
        days_before_warning: days_before_warning != null ? Number(days_before_warning) : null,
        subject: subject || '',
        intro_message: intro_message || '',
        template: template || ''
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

    if (action === 'test') {
      const { alert_key } = body;
      if (!alert_key) return Response.json({ error: 'alert_key required' }, { status: 400 });
      const existing = await base44.asServiceRole.entities.EmailAlertSetting.filter({ alert_key });
      const cfg = existing[0];
      if (cfg && cfg.enabled === false) {
        return Response.json({ error: 'This alert is disabled. Enable it first.' }, { status: 400 });
      }
      let recipients = [];
      if (cfg && cfg.recipient_emails) {
        recipients = cfg.recipient_emails.split(',').map((s) => s.trim()).filter(Boolean);
      }
      if (recipients.length === 0) {
        const users = await base44.asServiceRole.entities.User.list();
        recipients = users.filter((u) => u.role === 'admin').map((u) => u.email);
      }
      if (recipients.length === 0) {
        return Response.json({ error: 'No recipients configured' }, { status: 400 });
      }
      const defaultSubject = alert_key === 'vehicle_maintenance' ? 'Vehicle Maintenance Alert (Test)' : 'New Job Assignment (Test)';
      const subject = (cfg && cfg.subject) ? cfg.subject : defaultSubject;
      let text;
      if (cfg && cfg.template) {
        text = renderTestTemplate(alert_key, cfg.template);
      } else {
        const intro = (cfg && cfg.intro_message) ? cfg.intro_message + '\n\n' : '';
        text = intro + 'This is a test email to confirm your automated alert is configured correctly.\n\nGC Job Planner';
      }
      for (const to of recipients) {
        await base44.asServiceRole.integrations.Core.SendEmail({ to, subject, body: text });
      }
      return Response.json({ sent: true, recipients });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});