import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function escapeHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const ctrl = await base44.asServiceRole.entities.AutomationControl.filter({ automation_key: 'daily_reminders' });
    const ac = ctrl[0];
    if (ac && ac.enabled === false) {
      return Response.json({ skipped: true, reason: 'Automation disabled' });
    }

    const staff = await base44.asServiceRole.entities.Staff.list();
    const jobs = await base44.asServiceRole.entities.Job.list();
    const vehicles = await base44.asServiceRole.entities.Vehicle.list();

    const todayStr = new Date().toISOString().slice(0, 10);
    const todaysRotas = await base44.asServiceRole.entities.RotaAssignment.filter({ assigned_date: todayStr });

    const byStaff = {};
    todaysRotas.forEach(r => {
      if (!byStaff[r.staff_id]) byStaff[r.staff_id] = [];
      byStaff[r.staff_id].push(r);
    });

    const baseUrl = await getAppBaseUrl(base44);
    const dailyCfgList = await base44.asServiceRole.entities.EmailAlertSetting.filter({ alert_key: 'daily_reminder' });
    const dailyCfg = dailyCfgList[0] || { accent_color: '#0e7a4f', banner_title: 'GC Job Planner', show_banner: true, footer_text: 'GC Job Planner' };
    if (dailyCfg.enabled === false) return Response.json({ skipped: true, reason: 'Email alert disabled' });
    let notified = 0;
    const skipped = [];

    for (const member of staff) {
      if (!member.email) { skipped.push({ name: member.name, reason: 'no email' }); continue; }
      if (member.email_notifications_enabled === false) { skipped.push({ name: member.name, reason: 'unsubscribed' }); continue; }
      const assignments = (byStaff[member.id] || []).filter(a => jobs.find(j => j.id === a.job_id));
      if (assignments.length === 0) continue;

      const lines = assignments.map(a => {
        const job = jobs.find(j => j.id === a.job_id);
        const vehicle = vehicles.find(v => v.id === a.vehicle_id);
        const jobName = job ? job.name : 'Unknown job';
        const location = job ? job.location : '';
        const time = (a.start_time || a.end_time) ? ` · ${a.start_time || '—'}–${a.end_time || '—'}` : '';
        const reg = vehicle ? ` · ${vehicle.registration_number}` : '';
        const notes = a.notes ? `\n      Notes: ${a.notes}` : '';
        return `   • ${jobName}${location ? ' — ' + location : ''}${time}${reg}${notes}`;
      }).join('\n');

      let bodyText;
      if (dailyCfg.template) {
        bodyText = dailyCfg.template
          .replace(/\{staff_name\}/g, member.name).replace(/\{today_date\}/g, todayStr)
          .replace(/\{assignment_list\}/g, lines);
      } else {
        const intro = dailyCfg.intro_message ? dailyCfg.intro_message + '\n\n' : '';
        bodyText = intro + `Hello ${member.name},\n\nHere is your schedule for today (${todayStr}):\n\n${lines}\n\nHave a safe shift.\n\nGC Job Planner`;
      }
      const bodyHtml = escapeHtml(bodyText).replace(/\n/g, '<br>') + linkBlock(baseUrl, '/staff-schedule', 'View your schedule');

      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: member.email,
          subject: dailyCfg.subject ? dailyCfg.subject.replace(/\{staff_name\}/g, member.name).replace(/\{today_date\}/g, todayStr) : `Your schedule for today — ${assignments.length} shift${assignments.length > 1 ? 's' : ''}`,
          body: styledHtml(bodyHtml, dailyCfg)
        });
        notified++;
      } catch (err) {
        skipped.push({ name: member.email, reason: err.message });
      }
    }

    // Send a combined daily schedule copy to configured recipients (managers/admins)
    const schedCfgList = await base44.asServiceRole.entities.EmailAlertSetting.filter({ alert_key: 'staff_schedule' });
    const schedCfg = schedCfgList[0];
    const recipients = (schedCfg && schedCfg.recipient_emails) ? String(schedCfg.recipient_emails).split(',').map((e) => e.trim()).filter(Boolean) : [];
    let copies = 0;
    if (recipients.length > 0) {
      const validRotas = todaysRotas.filter((a) => jobs.find((j) => j.id === a.job_id));
      if (validRotas.length > 0) {
        const lines = validRotas.map((a) => {
          const job = jobs.find((j) => j.id === a.job_id);
          const member = staff.find((s) => s.id === a.staff_id);
          const vehicle = vehicles.find((v) => v.id === a.vehicle_id);
          const staffName = member ? member.name : '—';
          const jobName = job ? job.name : 'Unknown job';
          const location = job ? job.location : '';
          const time = (a.start_time || a.end_time) ? ' · ' + (a.start_time || '—') + '–' + (a.end_time || '—') : '';
          const reg = vehicle ? ' · ' + vehicle.registration_number : '';
          return '   • ' + staffName + ' — ' + jobName + (location ? ' — ' + location : '') + time + reg;
        }).join('\n');
        const bodyText = 'Daily schedule overview for ' + todayStr + ':\n\n' + lines + '\n\nGC Job Planner';
        const bodyHtml = escapeHtml(bodyText).replace(/\n/g, '<br>') + linkBlock(baseUrl, '/admin', 'Open planner');
        for (const email of recipients) {
          try {
            await base44.asServiceRole.integrations.Core.SendEmail({ to: email, subject: 'Daily schedule overview — ' + todayStr, body: styledHtml(bodyHtml, schedCfg) });
            copies++;
          } catch (e) {}
        }
      }
    }

    if (ac) { try { await base44.asServiceRole.entities.AutomationControl.update(ac.id, { last_run_at: new Date().toISOString(), last_run_status: 'success' }); } catch (e) {} }
    return Response.json({ sent: true, date: todayStr, notified, copies, totalAssignments: todaysRotas.length, skipped });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});