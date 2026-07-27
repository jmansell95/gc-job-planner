import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { escapeHtml, styledHtml, parseDate } from '../../shared/emailStyling.ts';

/**
 * Predictive maintenance auto-booking.
 *
 * Scans every Vehicle for an MOT or service date falling due within the
 * warning window (default 14 days) or already overdue. For each due item
 * with no existing OPEN booking (requested / booked / in_progress) of the
 * same type, a VehicleMaintenanceBooking is auto-created in 'requested'
 * status so the office just has to call the garage in.
 *
 * Admins are emailed a digest of everything that was auto-booked this run.
 *
 * Runs as a scheduled task (no user context) — uses the service role.
 */
const WARNING_DAYS = 14;

function daysBetween(target, now) {
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const now = new Date();

    const vehicles = await base44.asServiceRole.entities.Vehicle.list('-created_date', 500);
    const existing = await base44.asServiceRole.entities.VehicleMaintenanceBooking.list('-booking_date', 500);

    // Index open bookings by `${vehicle_id}|${booking_type}` for de-dup
    const openKeys = new Set();
    existing.forEach((b) => {
      if (b.status === 'requested' || b.status === 'booked' || b.status === 'in_progress') {
        openKeys.add(`${b.vehicle_id}|${b.booking_type}`);
      }
    });

    const autoBooked = [];

    for (const v of vehicles) {
      const label = v.name ? `${v.name}${v.registration_number ? ` (${v.registration_number})` : ''}` : (v.registration_number || v.id);

      const checks = [
        { type: 'mot', date: v.mot_expiry, label: 'MOT' },
        { type: 'service', date: v.service_due_date, label: 'Service' },
      ];

      for (const c of checks) {
        if (!c.date) continue;
        const due = parseDate(c.date);
        if (!due) continue;
        const days = daysBetween(due, now);
        // Due within the warning window OR already overdue
        if (days > WARNING_DAYS) continue;

        const key = `${v.id}|${c.type}`;
        if (openKeys.has(key)) continue; // already booked

        const bookingDate = days < 0 ? now.toISOString().slice(0, 10) : c.date;
        try {
          await base44.asServiceRole.entities.VehicleMaintenanceBooking.create({
            vehicle_id: v.id,
            vehicle_name: label,
            booking_type: c.type,
            status: 'requested',
            booking_date: bookingDate,
            notes: `Auto-booked by predictive maintenance — ${c.label} ${days < 0 ? 'overdue' : 'due'} on ${c.date} (${days < 0 ? Math.abs(days) + 'd late' : days + 'd remaining'}).`,
          });
          openKeys.add(key); // prevent duplicates within the same run
          autoBooked.push({ vehicle: label, type: c.label, due: c.date, days });
        } catch (e) {
          // continue on per-vehicle error
        }
      }
    }

    // Email admins a digest if anything was auto-booked
    if (autoBooked.length > 0) {
      try {
        const users = await base44.asServiceRole.entities.User.list();
        const admins = users.filter((u) => u.role === 'admin');
        if (admins.length > 0) {
          const rows = autoBooked.map((a) =>
            `<tr><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-weight:600">${escapeHtml(a.vehicle)}</td>` +
            `<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${escapeHtml(a.type)}</td>` +
            `<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${escapeHtml(a.due)}</td>` +
            `<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:${a.days < 0 ? '#dc2626' : '#d97706'};font-weight:600">${a.days < 0 ? Math.abs(a.days) + 'd overdue' : a.days + 'd remaining'}</td></tr>`
          ).join('');
          const body =
            `<p style="margin-top:0">The predictive maintenance engine auto-created <strong>${autoBooked.length}</strong> booking${autoBooked.length === 1 ? '' : 's'} this run. Each is in <strong>Requested</strong> status — call the garage in to confirm a slot, then mark it as Booked in the Fleet Hub → Maintenance tab.</p>` +
            `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-top:12px">` +
            `<tr style="background:#f8fafc"><td style="padding:10px 12px;font-weight:700;font-size:12px;text-transform:uppercase;color:#475569">Vehicle</td><td style="padding:10px 12px;font-weight:700;font-size:12px;text-transform:uppercase;color:#475569">Type</td><td style="padding:10px 12px;font-weight:700;font-size:12px;text-transform:uppercase;color:#475569">Due</td><td style="padding:10px 12px;font-weight:700;font-size:12px;text-transform:uppercase;color:#475569">Status</td></tr>` +
            rows +
            `</table>`;
          for (const a of admins) {
            try {
              await base44.asServiceRole.integrations.Core.SendEmail({
                to: a.email,
                subject: `Maintenance Auto-Booked — ${autoBooked.length} item${autoBooked.length === 1 ? '' : 's'} need${autoBooked.length === 1 ? 's' : ''} confirming`,
                body: styledHtml(body),
              });
            } catch (_) {}
          }
        }
      } catch (_) {}
    }

    return Response.json({ ok: true, checked: vehicles.length, autoBooked: autoBooked.length, items: autoBooked });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}