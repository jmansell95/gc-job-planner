import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { booking_id } = await req.json();
    if (!booking_id) return Response.json({ error: 'booking_id required' }, { status: 400 });

    const booking = await base44.asServiceRole.entities.VehicleMaintenanceBooking.get(booking_id);
    if (!booking) return Response.json({ error: 'Booking not found' }, { status: 404 });
    if (!booking.assigned_staff_id) return Response.json({ skipped: true, reason: 'No staff assigned' });

    const staff = await base44.asServiceRole.entities.Staff.get(booking.assigned_staff_id);
    if (!staff || !staff.email) return Response.json({ skipped: true, reason: 'No staff email' });
    if (staff.email_notifications_enabled === false) return Response.json({ skipped: true, reason: 'Notifications disabled' });

    const vehicle = booking.vehicle_id ? await base44.asServiceRole.entities.Vehicle.get(booking.vehicle_id) : null;

    const typeLabels = { mot: 'MOT', service: 'Service', windscreen: 'Windscreen Repair', repair: 'Repair', inspection: 'Inspection', other: 'Maintenance' };
    const typeLabel = typeLabels[booking.booking_type] || 'Maintenance';

    const dateStr = booking.booking_date
      ? new Date(booking.booking_date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : 'To be confirmed';
    const timeStr = booking.booking_time || 'Time to be confirmed';

    const cfgList = await base44.asServiceRole.entities.EmailAlertSetting.filter({ alert_key: 'maintenance_booking' });
    const cfg = cfgList[0] || { accent_color: '#0e7a4f', banner_title: 'GC Mission Control', show_banner: true, footer_text: 'GC Mission Control' };
    if (cfg.enabled === false) return Response.json({ skipped: true, reason: 'Email alert disabled' });

    const vehicleName = `${vehicle?.name || booking.vehicle_name || 'N/A'} (${vehicle?.registration_number || 'N/A'})`;
    const tok = {
      staff_name: staff.name?.split(' ')[0] || '',
      vehicle_name: vehicleName, booking_type: typeLabel,
      booking_date: dateStr, booking_time: timeStr,
      supplier_name: booking.supplier_name || '', supplier_phone: booking.supplier_phone || '',
      location: booking.location || '', notes: booking.notes || ''
    };

    let text;
    if (cfg.template) {
      text = cfg.template
        .replace(/\{staff_name\}/g, tok.staff_name).replace(/\{vehicle_name\}/g, tok.vehicle_name)
        .replace(/\{booking_type\}/g, tok.booking_type).replace(/\{booking_date\}/g, tok.booking_date)
        .replace(/\{booking_time\}/g, tok.booking_time).replace(/\{supplier_name\}/g, tok.supplier_name)
        .replace(/\{supplier_phone\}/g, tok.supplier_phone).replace(/\{location\}/g, tok.location)
        .replace(/\{notes\}/g, tok.notes);
    } else {
      const intro = cfg.intro_message ? cfg.intro_message + '\n\n' : '';
      text = intro + `Hello ${tok.staff_name},\n\nA vehicle ${typeLabel.toLowerCase()} booking has been scheduled for you:\n\nVehicle: ${tok.vehicle_name}\nBooking Type: ${tok.booking_type}\nDate: ${tok.booking_date}\nTime: ${tok.booking_time}`;
      if (tok.supplier_name) text += `\nSupplier: ${tok.supplier_name}`;
      if (tok.supplier_phone) text += `\nSupplier Phone: ${tok.supplier_phone}`;
      if (tok.location) text += `\nLocation: ${tok.location}`;
      if (tok.notes) text += `\n\nNotes: ${tok.notes}`;
      text += `\n\nPlease ensure the vehicle is taken to the appointment on time. Contact your manager if you have any questions.\n\nGC Mission Control`;
    }

    const subject = cfg.subject
      ? cfg.subject.replace(/\{booking_type\}/g, typeLabel).replace(/\{vehicle_name\}/g, vehicle?.registration_number || booking.vehicle_name || 'Vehicle')
      : `${typeLabel} Booking — ${vehicle?.registration_number || booking.vehicle_name || 'Vehicle'}`;

    const baseUrl = await getAppBaseUrl(base44);
    const bodyHtml = escapeHtml(text).replace(/\n/g, '<br>') + linkBlock(baseUrl, '/staff-schedule', 'View your schedule');

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: staff.email,
      subject,
      body: styledHtml(bodyHtml, cfg)
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});