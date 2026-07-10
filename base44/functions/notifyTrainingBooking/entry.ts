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
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { booking_id } = await req.json();
    if (!booking_id) return Response.json({ error: 'booking_id required' }, { status: 400 });

    const booking = await base44.asServiceRole.entities.TrainingBooking.get(booking_id);
    if (!booking) return Response.json({ error: 'Booking not found' }, { status: 404 });

    const course = booking.course_id ? await base44.asServiceRole.entities.TrainingCourse.get(booking.course_id) : null;
    const staff = booking.staff_id ? await base44.asServiceRole.entities.Staff.get(booking.staff_id) : null;

    if (!staff || !staff.email) return Response.json({ skipped: true, reason: 'No staff email' });
    if (staff.email_notifications_enabled === false) return Response.json({ skipped: true, reason: 'Notifications disabled' });

    const startDate = course?.start_date
      ? new Date(course.start_date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : 'To be confirmed';
    const endDate = course?.end_date && course.end_date !== course.start_date
      ? new Date(course.end_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : null;

    const cfgList = await base44.asServiceRole.entities.EmailAlertSetting.filter({ alert_key: 'training_booking' });
    const cfg = cfgList[0] || { accent_color: '#0e7a4f', banner_title: 'GC Job Planner', show_banner: true, footer_text: 'GC Job Planner' };
    if (cfg.enabled === false) return Response.json({ skipped: true, reason: 'Email alert disabled' });

    const tok = {
      staff_name: staff.name?.split(' ')[0] || '',
      course_title: course?.title || 'N/A',
      start_date: startDate, end_date: endDate || '',
      start_time: course?.start_time || '', end_time: course?.end_time || '',
      venue: course?.venue || '', address: course?.address || '',
      provider: course?.provider || '', provider_phone: course?.provider_phone || '',
      description: course?.description || ''
    };

    let text;
    if (cfg.template) {
      text = cfg.template
        .replace(/\{staff_name\}/g, tok.staff_name).replace(/\{course_title\}/g, tok.course_title)
        .replace(/\{start_date\}/g, tok.start_date).replace(/\{end_date\}/g, tok.end_date)
        .replace(/\{start_time\}/g, tok.start_time).replace(/\{end_time\}/g, tok.end_time)
        .replace(/\{venue\}/g, tok.venue).replace(/\{address\}/g, tok.address)
        .replace(/\{provider\}/g, tok.provider).replace(/\{provider_phone\}/g, tok.provider_phone)
        .replace(/\{description\}/g, tok.description);
    } else {
      const intro = cfg.intro_message ? cfg.intro_message + '\n\n' : '';
      text = intro + `Hello ${tok.staff_name},\n\nYou have been booked onto a training course:\n\nCourse: ${tok.course_title}\nDate: ${tok.start_date}${tok.end_date ? ' to ' + tok.end_date : ''}`;
      if (tok.start_time) text += `\nTime: ${tok.start_time}${tok.end_time ? ' - ' + tok.end_time : ''}`;
      if (tok.venue) text += `\nVenue: ${tok.venue}`;
      if (tok.address) text += `\nAddress: ${tok.address}`;
      if (tok.provider) text += `\nProvider: ${tok.provider}`;
      if (tok.provider_phone) text += `\nProvider Phone: ${tok.provider_phone}`;
      if (tok.description) text += `\n\nDetails: ${tok.description}`;
      text += `\n\nPlease arrive on time and bring any required PPE or identification. Contact your manager if you have any questions.\n\nGC Job Planner`;
    }

    const subject = cfg.subject
      ? cfg.subject.replace(/\{course_title\}/g, tok.course_title).replace(/\{staff_name\}/g, tok.staff_name)
      : `Training Booking — ${course?.title || 'Training Course'}`;

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