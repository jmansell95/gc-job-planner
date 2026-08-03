// Shared email styling helpers used by automated email backend functions.
// Plain module — no Deno.serve. Import from "../../shared/emailStyling.ts".

export function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function linkBlock(baseUrl, path, label) {
  if (!baseUrl) return '';
  const href = baseUrl.replace(/\/+$/, '') + (path || '');
  return '<p style="margin-top:18px"><a href="' + escapeHtml(href) + '" style="display:inline-block;background:#2E5A1A;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;font-family:Arial,Helvetica,sans-serif">' + escapeHtml(label) + '</a></p>';
}

export function styledHtml(rawBodyHtml, cfg) {
  const accent = (cfg && cfg.accent_color) || '#2E5A1A';
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

// Parse a stored date string into a Date at local midnight.
// Supports YYYY-MM (staff compliance) and YYYY-MM-DD (other categories).
export function parseDate(str) {
  if (!str) return null;
  if (/^\d{4}-\d{2}$/.test(str)) return new Date(str + '-01T00:00:00');
  const d = new Date(str + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

export async function getAppBaseUrl(base44) {
  try {
    const list = await base44.asServiceRole.entities.AppSetting.filter({ key: 'global' });
    return (list[0] && list[0].app_base_url) || '';
  } catch (e) {
    return '';
  }
}