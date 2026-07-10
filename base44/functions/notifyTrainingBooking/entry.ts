import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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

    const subject = `Training Booking — ${course?.title || 'Training Course'}`;

    const lines = [
      `Hello ${staff.name?.split(' ')[0] || ''},`,
      ``,
      `You have been booked onto a training course:`,
      ``,
      `Course: ${course?.title || 'N/A'}`,
      `Date: ${startDate}${endDate ? ' to ' + endDate : ''}`,
    ];
    if (course?.start_time) lines.push(`Time: ${course.start_time}${course.end_time ? ' – ' + course.end_time : ''}`);
    if (course?.venue) lines.push(`Venue: ${course.venue}`);
    if (course?.address) lines.push(`Address: ${course.address}`);
    if (course?.provider) lines.push(`Provider: ${course.provider}`);
    if (course?.provider_phone) lines.push(`Provider Phone: ${course.provider_phone}`);
    if (course?.description) lines.push(``, `Details: ${course.description}`);
    lines.push(``, `Please arrive on time and bring any required PPE or identification. Contact your manager if you have any questions.`, ``, `GC Job Planner`);

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: staff.email,
      subject,
      body: lines.join('\n')
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});