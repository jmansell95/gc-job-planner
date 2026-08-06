import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { sendWhatsAppToStaff } from '../../shared/whatsappSend.ts';

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

const statusLabels = { planning: 'Planning', in_progress: 'In Progress', completed: 'Completed', on_hold: 'On Hold' };

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const data = body.data;
    const old = body.old_data;

    const ctrl = await base44.asServiceRole.entities.AutomationControl.filter({ automation_key: 'job_status_change' });
    const ac = ctrl[0];
    if (ac && ac.enabled === false) return Response.json({ skipped: true, reason: 'Automation disabled' });

    if (!data || !old) return Response.json({ skipped: true, reason: 'Missing data' });
    const newStatus = data.status;
    const oldStatus = old.status;
    if (newStatus === oldStatus) return Response.json({ skipped: true, reason: 'Status unchanged' });

    const users = await base44.asServiceRole.entities.User.list();
    const admins = users.filter(u => u.role === 'admin' && u.email);
    if (admins.length === 0) return Response.json({ skipped: true, reason: 'No admins' });

    const cfgList = await base44.asServiceRole.entities.EmailAlertSetting.filter({ alert_key: 'job_status_change' });
    const cfg = cfgList[0] || { accent_color: '#0e7a4f', banner_title: 'GC Mission Control', show_banner: true, footer_text: 'GC Mission Control' };
    if (cfg.enabled === false) return Response.json({ skipped: true, reason: 'Email alert disabled' });

    const oldLabel = statusLabels[oldStatus] || oldStatus || '—';
    const newLabel = statusLabels[newStatus] || newStatus || '—';
    let text;
    if (cfg.template) {
      text = cfg.template
        .replace(/\{job_name\}/g, data.name || '—').replace(/\{location\}/g, data.location || '—')
        .replace(/\{old_status\}/g, oldLabel).replace(/\{new_status\}/g, newLabel);
    } else {
      const intro = cfg.intro_message ? cfg.intro_message + '\n\n' : '';
      text = intro + 'A job status has changed:\n\nJob: ' + (data.name || '—') + '\nLocation: ' + (data.location || '—') + '\nStatus: ' + oldLabel + ' -> ' + newLabel + '\n\nView the job in the planner.\n\nGC Mission Control';
    }
    const subject = cfg.subject ? cfg.subject.replace(/\{job_name\}/g, data.name || 'Job') : 'Job status updated: ' + (data.name || 'Job');

    const baseUrl = await getAppBaseUrl(base44);
    const bodyHtml = escapeHtml(text).replace(/\n/g, '<br>') + linkBlock(baseUrl, '/admin', 'Open planner');
    let notified = 0;
    for (const u of admins) {
      try { await base44.asServiceRole.integrations.Core.SendEmail({ to: u.email, subject, body: styledHtml(bodyHtml, cfg) }); notified++; } catch (e) {}
    }

    // WhatsApp crew notification on job cancellation / hold
    let waSent = 0;
    if (newStatus === 'on_hold' || newStatus === 'cancelled') {
      try {
        const waCfgList = await base44.asServiceRole.entities.AppSetting.filter({ key: 'whatsapp_config' }, '-created_date', 1);
        const waCfg = waCfgList?.[0]?.value || {};
        if (waCfg.notify_job_cancelled && waCfg.phone_number_id && waCfg.api_token) {
          const today = new Date().toISOString().slice(0, 10);
          const rotas = await base44.asServiceRole.entities.RotaAssignment.filter({ job_id: data.id, assigned_date: today }, '-created_date', 50);
          const staffIds = [...new Set(rotas.map(r => r.staff_id).filter(Boolean))];
          if (staffIds.length > 0) {
            const allStaff = await base44.asServiceRole.entities.Staff.list('-created_date', 500);
            const crew = allStaff.filter(s => staffIds.includes(s.id) && s.phone && s.is_active !== false);
            if (crew.length > 0) {
              const waText = `⚠️ JOB ${newStatus === 'cancelled' ? 'CANCELLED' : 'ON HOLD'}\n\n${data.name || 'Job'}\n${data.location || ''}\n\nYou are no longer required on site today. Contact your supervisor for reassignment.`;
              const waResults = await sendWhatsAppToStaff(base44, crew, waText);
              waSent = waResults.filter(r => r.ok).length;
            }
          }
        }
      } catch (e) { /* WhatsApp send failed — don't block the email notification */ }
    }

    if (ac) { try { await base44.asServiceRole.entities.AutomationControl.update(ac.id, { last_run_at: new Date().toISOString(), last_run_status: 'success' }); } catch (e) {} }
    return Response.json({ sent: true, notified, whatsapp_sent: waSent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});