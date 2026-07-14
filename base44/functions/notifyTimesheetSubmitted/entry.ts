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

function fmtHours(mins) {
  const m = Math.round(Number(mins) || 0);
  const h = Math.floor(m / 60), r = m % 60;
  if (h && r) return h + 'h ' + r + 'm';
  if (h) return h + 'h';
  return m > 0 ? r + 'm' : '—';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const ctrl = await base44.asServiceRole.entities.AutomationControl.filter({ automation_key: 'timesheet_submitted' });
    const ac = ctrl[0];
    if (ac && ac.enabled === false) return Response.json({ skipped: true, reason: 'Automation disabled' });

    // Consolidated daily mode: { summaries: [...], staff_id, date }
    // Single-entry mode (backward compat): { data: {...} }
    let summaries = body.summaries;
    let staffId = body.staff_id;
    let date = body.date;

    if (!summaries && body.data) {
      summaries = [body.data];
      staffId = staffId || body.data.staff_id;
      date = date || body.data.date;
    }

    if (!summaries || summaries.length === 0 || !staffId) return Response.json({ skipped: true, reason: 'No timesheet data' });

    const staffList = await base44.asServiceRole.entities.Staff.filter({ id: staffId });
    const staff = staffList[0];

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

    const staffName = staff ? staff.name : 'Unknown crew member';

    // Resolve job names for each summary
    const jobIds = [...new Set(summaries.map(s => s.job_id).filter(Boolean))];
    const jobs = [];
    for (let i = 0; i < jobIds.length; i++) {
      const jl = await base44.asServiceRole.entities.Job.filter({ id: jobIds[i] });
      if (jl[0]) jobs.push(jl[0]);
    }
    const jobNameOf = (jid) => { const j = jobs.find(x => x.id === jid); return j ? j.name : 'Unknown job'; };

    const totalMins = summaries.reduce((s, t) => s + (Number(t.task_duration_minutes) || (t.total_hours ? t.total_hours * 60 : 0)), 0);
    const totalMeterage = summaries.reduce((s, t) => s + (Number(t.meterage) || 0), 0);

    const cfgList = await base44.asServiceRole.entities.EmailAlertSetting.filter({ alert_key: 'timesheet_submitted' });
    const cfg = cfgList[0] || { accent_color: '#0e7a4f', banner_title: 'GC Job Planner', show_banner: true, footer_text: 'GC Job Planner' };
    if (cfg.enabled === false) return Response.json({ skipped: true, reason: 'Email alert disabled' });

    const dateStr = date || summaries[0].date || '—';

    // Build a consolidated daily summary body
    const jobLines = summaries.map(s => {
      const jobName = jobNameOf(s.job_id);
      const mins = Number(s.task_duration_minutes) || (s.total_hours ? s.total_hours * 60 : 0);
      const meterage = Number(s.meterage) || 0;
      let line = '• Job: ' + jobName + ' — ' + fmtHours(mins);
      if (meterage > 0) line += ' · ' + meterage + 'm';
      if (s.is_overtime) line += ' (overtime)';
      return line;
    }).join('\n');

    let text;
    if (cfg.template) {
      text = cfg.template
        .replace(/\{staff_name\}/g, staffName).replace(/\{date\}/g, dateStr)
        .replace(/\{total_hours\}/g, fmtHours(totalMins))
        .replace(/\{job_summary\}/g, jobLines);
    } else {
      const intro = cfg.intro_message ? cfg.intro_message + '\n\n' : '';
      text = intro + 'A daily timesheet has been submitted for approval:\n\n' +
        'Crew: ' + staffName + '\n' +
        'Date: ' + dateStr + '\n' +
        'Total Hours: ' + fmtHours(totalMins) + (totalMeterage > 0 ? ' · ' + totalMeterage + 'm drilled' : '') + '\n\n' +
        'Jobs:\n' + jobLines + '\n\n' +
        'Review and approve it in the planner.\n\nGC Job Planner';
    }
    const subject = cfg.subject
      ? cfg.subject.replace(/\{staff_name\}/g, staffName).replace(/\{date\}/g, dateStr)
      : 'Daily timesheet submitted by ' + staffName + ' (' + dateStr + ')';

    const baseUrl = await getAppBaseUrl(base44);
    const bodyHtml = escapeHtml(text).replace(/\n/g, '<br>') + linkBlock(baseUrl, '/admin', 'Open planner');
    let notified = 0;
    for (const to of recipients) {
      try { await base44.asServiceRole.integrations.Core.SendEmail({ to, subject, body: styledHtml(bodyHtml, cfg) }); notified++; } catch (e) {}
    }

    if (ac) { try { await base44.asServiceRole.entities.AutomationControl.update(ac.id, { last_run_at: new Date().toISOString(), last_run_status: 'success' }); } catch (e) {} }
    return Response.json({ sent: true, notified });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});