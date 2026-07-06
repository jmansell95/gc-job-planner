import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtDate(d) {
  const date = new Date(d + 'T00:00:00');
  return DAY_NAMES[date.getDay()] + ' ' + date.getDate() + ' ' + MONTHS[date.getMonth()];
}
function fmtWeek(weekStart) {
  const start = new Date(weekStart + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return fmtDate(weekStart) + ' – ' + DAY_NAMES[end.getDay()] + ' ' + end.getDate() + ' ' + MONTHS[end.getMonth()] + ' ' + end.getFullYear();
}
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function linkBlock(baseUrl, path, label) {
  if (!baseUrl) return '';
  const href = baseUrl.replace(/\/+$/, '') + (path || '');
  return '<p style="margin-top:18px"><a href="' + escapeHtml(href) + '" style="display:inline-block;background:#0e7a4f;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;font-family:Arial,Helvetica,sans-serif">' + escapeHtml(label) + '</a></p>';
}
async function getAppBaseUrl(base44) {
  try { const list = await base44.asServiceRole.entities.AppSetting.filter({ key: 'global' }); return (list[0] && list[0].app_base_url) || ''; } catch (e) { return ''; }
}

function buildEmail(staff, rotas, jobs, vehicles, cfg, weekStart, baseUrl) {
  const accent = (cfg && cfg.accent_color) || '#0e7a4f';
  const bannerTitle = (cfg && cfg.banner_title) || 'GC Job Planner';
  const showBanner = !(cfg && cfg.show_banner === false);
  const footer = (cfg && cfg.footer_text) || 'GC Job Planner';
  const weekLabel = fmtWeek(weekStart);
  const assignmentCount = rotas.length;

  // Only the configured template is sent as the intro — no default greeting.
  const intro = cfg.template
    .replace(/\{staff_name\}/g, staff.name)
    .replace(/\{week_start\}/g, weekLabel)
    .replace(/\{assignment_count\}/g, String(assignmentCount));

  let rows = '';
  for (const r of rotas) {
    const job = jobs.find((j) => j && j.id === r.job_id);
    const vehicle = vehicles.find((v) => v && v.id === r.vehicle_id);
    if (!job) continue;
    const times = (r.start_time || r.end_time) ? (r.start_time || '—') + '–' + (r.end_time || '—') : '—';
    rows += '<tr><td style="padding:8px 10px;border-bottom:1px solid #e2e8f0">' + fmtDate(r.assigned_date) + '</td>' +
      '<td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-weight:600">' + escapeHtml(job.name) + '</td>' +
      '<td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;color:#64748b">' + escapeHtml(job.location) + '</td>' +
      '<td style="padding:8px 10px;border-bottom:1px solid #e2e8f0">' + escapeHtml(times) + '</td>' +
      '<td style="padding:8px 10px;border-bottom:1px solid #e2e8f0">' + (vehicle ? escapeHtml(vehicle.registration_number) : '—') + '</td></tr>';
  }
  const thStyle = 'style="padding:10px;background:' + accent + ';color:white;text-align:left;font-size:12px;text-transform:uppercase"';
  const table = '<table style="width:100%;border-collapse:collapse"><thead><tr>' +
    '<th ' + thStyle + '>Date</th><th ' + thStyle + '>Job</th><th ' + thStyle + '>Location</th><th ' + thStyle + '>Times</th><th ' + thStyle + '>Vehicle</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table>';

  const banner = showBanner
    ? '<tr><td style="background:' + accent + ';padding:18px 24px"><h1 style="margin:0;color:#ffffff;font-size:18px;font-family:Arial,Helvetica,sans-serif">' + escapeHtml(bannerTitle) + '</h1></td></tr>'
    : '';
  const bodyCell = '<p style="font-size:14px;color:#475569;margin:0 0 16px 0;white-space:pre-wrap">' + escapeHtml(intro).replace(/\n/g, '<br>') + '</p>' +
    table + linkBlock(baseUrl, '/staff-schedule', 'View your schedule');
  const html = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">' +
    '<table align="center" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;margin:24px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 6px 24px rgba(15,42,31,0.08)">' +
    banner +
    '<tr><td style="padding:24px;color:#1e293b;font-size:14px;line-height:1.6">' + bodyCell + '</td></tr>' +
    '<tr><td style="padding:14px 24px;background:#f8fafc;color:#64748b;font-size:12px;border-top:1px solid #e2e8f0;text-align:center">' + escapeHtml(footer) + '</td></tr>' +
    '</table></body></html>';

  const subject = (cfg && cfg.subject)
    ? cfg.subject.replace(/\{staff_name\}/g, staff.name).replace(/\{week_start\}/g, weekLabel)
    : (staff.name + "'s Weekly Schedule – " + weekLabel);
  return { html, subject };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { weekStart } = await req.json().catch(() => ({}));
    if (!weekStart) return Response.json({ error: 'weekStart required' }, { status: 400 });

    // Upsert the RotaWeek as published
    const existing = await base44.asServiceRole.entities.RotaWeek.filter({ week_start: weekStart });
    const now = new Date().toISOString();
    if (existing[0]) {
      await base44.asServiceRole.entities.RotaWeek.update(existing[0].id, { status: 'published', published_at: now });
    } else {
      await base44.asServiceRole.entities.RotaWeek.create({ week_start: weekStart, status: 'published', published_at: now });
    }

    const cfgList = await base44.asServiceRole.entities.EmailAlertSetting.filter({ alert_key: 'staff_schedule' });
    const cfg = cfgList[0];
    if (!cfg || cfg.enabled === false) {
      return Response.json({ success: true, published: true, emailed: 0, skipped: 0, disabled: true });
    }
    // Only the configured template is sent — no default fallback.
    if (!cfg.template) {
      return Response.json({ success: true, published: true, emailed: 0, skipped: 0, reason: 'No template configured for staff schedule' });
    }

    const rotas = await base44.asServiceRole.entities.RotaAssignment.filter({ week_start: weekStart });
    const staffIds = [...new Set(rotas.map((r) => r.staff_id))];
    const jobIds = [...new Set(rotas.map((r) => r.job_id).filter(Boolean))];
    const vehicleIds = [...new Set(rotas.map((r) => r.vehicle_id).filter(Boolean))];
    const [staffList, jobs, vehicles] = await Promise.all([
      Promise.all(staffIds.map((id) => base44.asServiceRole.entities.Staff.get(id).catch(() => null))),
      Promise.all(jobIds.map((id) => base44.asServiceRole.entities.Job.get(id).catch(() => null))),
      Promise.all(vehicleIds.map((id) => base44.asServiceRole.entities.Vehicle.get(id).catch(() => null)))
    ]);

    const baseUrl = await getAppBaseUrl(base44);
    let emailed = 0, skipped = 0;
    for (const s of staffList) {
      if (!s || !s.email) { skipped++; continue; }
      const myRotas = rotas.filter((r) => r.staff_id === s.id && jobs.find((j) => j && j.id === r.job_id));
      if (myRotas.length === 0) continue;
      const { html, subject } = buildEmail(s, myRotas, jobs, vehicles, cfg, weekStart, baseUrl);
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({ to: s.email, subject, body: html, from_name: 'GC Job Planner' });
        emailed++;
      } catch (e) {
        skipped++;
      }
    }

    return Response.json({ success: true, published: true, emailed, skipped, disabled: false });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});