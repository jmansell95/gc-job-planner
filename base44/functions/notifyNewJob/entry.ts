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
    const body = await req.json();
    const job = body.data || body;

    const ctrl = await base44.asServiceRole.entities.AutomationControl.filter({ automation_key: 'new_job_alert' });
    const ac = ctrl[0];
    if (ac && ac.enabled === false) return Response.json({ skipped: true, reason: 'Automation disabled' });

    if (!job || !job.name) return Response.json({ skipped: true, reason: 'No job data' });

    const users = await base44.asServiceRole.entities.User.list();
    const admins = users.filter(u => u.role === 'admin' && u.email);
    if (admins.length === 0) return Response.json({ skipped: true, reason: 'No admins' });

    const cfgList = await base44.asServiceRole.entities.EmailAlertSetting.filter({ alert_key: 'new_job' });
    const cfg = cfgList[0] || { accent_color: '#0e7a4f', banner_title: 'GC Job Planner', show_banner: true, footer_text: 'GC Job Planner' };
    if (cfg.enabled === false) return Response.json({ skipped: true, reason: 'Email alert disabled' });

    const jobType = (job.job_type || '').replace(/_/g, ' ');
    const ref = job.job_reference || '';
    let text;
    if (cfg.template) {
      text = cfg.template
        .replace(/\{job_name\}/g, job.name).replace(/\{location\}/g, job.location || '—')
        .replace(/\{job_type\}/g, jobType).replace(/\{start_date\}/g, job.start_date || '—')
        .replace(/\{end_date\}/g, job.end_date || '—').replace(/\{job_reference\}/g, ref);
    } else {
      const intro = cfg.intro_message ? cfg.intro_message + '\n\n' : '';
      text = intro + 'A new job has been created:\n\nJob: ' + job.name + '\nLocation: ' + (job.location || '—') + '\nType: ' + jobType + '\nStart: ' + (job.start_date || '—') + '\nEnd: ' + (job.end_date || '—') + (ref ? '\nReference: ' + ref : '') + '\n\nReview the job in the planner.\n\nGC Job Planner';
    }
    const subject = cfg.subject ? cfg.subject.replace(/\{job_name\}/g, job.name) : 'New Job Created: ' + job.name;

    const baseUrl = await getAppBaseUrl(base44);
    const bodyHtml = escapeHtml(text).replace(/\n/g, '<br>') + linkBlock(baseUrl, '/admin', 'Open planner');
    let notified = 0;
    for (const u of admins) {
      try { await base44.asServiceRole.integrations.Core.SendEmail({ to: u.email, subject, body: styledHtml(bodyHtml, cfg) }); notified++; } catch (e) {}
    }

    if (ac) { try { await base44.asServiceRole.entities.AutomationControl.update(ac.id, { last_run_at: new Date().toISOString(), last_run_status: 'success' }); } catch (e) {} }
    return Response.json({ sent: true, notified });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});