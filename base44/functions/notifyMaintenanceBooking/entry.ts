import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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

    const subject = `${typeLabel} Booking — ${vehicle?.registration_number || booking.vehicle_name || 'Vehicle'}`;

    const lines = [
      `Hello ${staff.name?.split(' ')[0] || ''},`,
      ``,
      `A vehicle ${typeLabel.toLowerCase()} booking has been scheduled for you:`,
      ``,
      `Vehicle: ${vehicle?.name || booking.vehicle_name || 'N/A'} (${vehicle?.registration_number || 'N/A'})`,
      `Booking Type: ${typeLabel}`,
      `Date: ${dateStr}`,
      `Time: ${timeStr}`,
    ];
    if (booking.supplier_name) lines.push(`Supplier: ${booking.supplier_name}`);
    if (booking.supplier_phone) lines.push(`Supplier Phone: ${booking.supplier_phone}`);
    if (booking.location) lines.push(`Location: ${booking.location}`);
    if (booking.notes) lines.push(``, `Notes: ${booking.notes}`);
    lines.push(``, `Please ensure the vehicle is taken to the appointment on time. Contact your manager if you have any questions.`, ``, `GC Job Planner`);

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