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

// Parse compliance date — supports YYYY-MM (staff) and YYYY-MM-DD (other categories)
function parseDate(str) {
  if (!str) return null;
  if (/^\d{4}-\d{2}$/.test(str)) return new Date(str + '-01T00:00:00');
  return new Date(str + 'T00:00:00');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const settings = await base44.asServiceRole.entities.EmailAlertSetting.filter({ alert_key: 'compliance_expiry' });
    const cfg = settings[0];
    if (!cfg || cfg.enabled === false) {
      return Response.json({ skipped: true, reason: 'Alert disabled or not configured' });
    }
    if (!cfg.template) {
      return Response.json({ skipped: true, reason: 'No template configured for compliance expiry' });
    }
    const daysBefore = (cfg && cfg.days_before_warning) ? cfg.days_before_warning : 30;

    const complianceItems = await base44.asServiceRole.entities.ComplianceItem.list('-created_date', 500);
    const staff = await base44.asServiceRole.entities.Staff.list();
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
    const cutoff = new Date(now.getTime() + daysBefore * 24 * 60 * 60 * 1000);

    const alerts = [];
    complianceItems.forEach(c => {
      if (c.status_override === 'not_required' || c.status_override === 'missing') return;
      if (!c.expiry_date) return;
      const expiry = parseDate(c.expiry_date);
      if (!expiry || isNaN(expiry.getTime())) return;

      let status = null;
      if (expiry < now) {
        status = 'EXPIRED';
      } else if (expiry <= cutoff) {
        status = 'Expiring soon';
      }

      if (status) {
        const staffMember = staff.find(s => s.id === c.reference_id || s.name === c.reference_name);
        alerts.push({
          title: c.title,
          category: c.category,
          referenceName: c.reference_name || staffMember?.name || 'Unknown',
          expiryDate: c.expiry_date,
          status
        });
      }
    });

    if (alerts.length === 0) {
      return Response.json({ sent: false, reason: 'No compliance alerts', checked: complianceItems.length });
    }

    // Sort: expired first, then by expiry date
    alerts.sort((a, b) => {
      if (a.status === 'EXPIRED' && b.status !== 'EXPIRED') return -1;
      if (b.status === 'EXPIRED' && a.status !== 'EXPIRED') return 1;
      return a.expiryDate.localeCompare(b.expiryDate);
    });

    let alertList = '';
    alerts.forEach(a => {
      alertList += a.referenceName + ' — ' + a.title + ' (' + a.category + '):\n';
      alertList += '  ' + a.status + ' (expiry: ' + a.expiryDate + ')\n';
    });

    const subject = cfg.subject
      ? cfg.subject.replace(/\{alert_count\}/g, String(alerts.length))
      : 'Compliance Expiry Alert - ' + alerts.length + ' item(s) need attention';
    const text = cfg.template
      .replace(/\{alert_count\}/g, String(alerts.length))
      .replace(/\{alert_list\}/g, alertList);

    const baseUrl = await getAppBaseUrl(base44);
    const bodyHtml = escapeHtml(text).replace(/\n/g, '<br>') + linkBlock(baseUrl, '/admin', 'Open planner');

    for (const to of recipients) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to,
        subject,
        body: styledHtml(bodyHtml, cfg)
      });
    }

    return Response.json({ sent: true, alertCount: alerts.length, notifiedRecipients: recipients.length, alerts });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});