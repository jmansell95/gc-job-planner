import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const DELIVERY_TYPE_LABELS = {
  site_delivery: 'Site delivery',
  supplier_delivery: 'Supplier delivery',
  supplier_collection: 'Supplier collection',
  item_handover: 'Item handover',
  sample_collection: 'Sample collection',
  sample_delivery: 'Sample delivery',
};

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { delivery_id } = body;
    if (!delivery_id) return Response.json({ error: 'delivery_id required' }, { status: 400 });

    // Load the delivery record
    const deliveries = await base44.asServiceRole.entities.DeliveryLog.filter({ id: delivery_id });
    const delivery = deliveries?.[0];
    if (!delivery) return Response.json({ error: 'Delivery not found' }, { status: 404 });

    // Only create a timesheet entry for completed deliveries
    if (delivery.status !== 'completed') {
      return Response.json({ error: 'Delivery is not completed' }, { status: 400 });
    }

    // Idempotency: skip if a timesheet entry already exists for this delivery
    const existing = await base44.asServiceRole.entities.Timesheet.filter({ linked_delivery_id: delivery_id });
    if (existing && existing.length > 0) {
      return Response.json({ success: true, skipped: true, message: 'Timesheet entry already exists for this delivery' });
    }

    // Load the driver's staff record to inherit division_id
    const staffList = await base44.asServiceRole.entities.Staff.filter({ id: delivery.driver_staff_id });
    const staff = staffList?.[0];
    if (!staff) return Response.json({ error: 'Driver staff record not found' }, { status: 404 });

    // Calculate actual duration from started_at → completed_at
    let durationMinutes = 0;
    let missingTimestamps = false;
    if (delivery.started_at && delivery.completed_at) {
      const startMs = new Date(delivery.started_at).getTime();
      const endMs = new Date(delivery.completed_at).getTime();
      durationMinutes = Math.round((endMs - startMs) / 60000);
      if (durationMinutes < 0) durationMinutes = 0;
    } else {
      missingTimestamps = true;
    }

    // Compute week_start (Monday of the scheduled_date's week)
    const dateStr = delivery.scheduled_date;
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const monday = new Date(d);
    monday.setDate(d.getDate() - diff);
    const weekStart = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;

    // Build a human-readable task description
    const typeLabel = DELIVERY_TYPE_LABELS[delivery.delivery_type] || 'Delivery';
    const items = delivery.items || '';
    const jobName = delivery.job_name || '';
    let description = `${typeLabel} — ${items}`;
    if (jobName) description += ` (${jobName})`;
    if (missingTimestamps) {
      description += ' ⚠️ Missing start/end times — please review and correct';
    }

    // Create the draft timesheet entry — task_type 'on_site' so driving time
    // counts as worked hours and flows through submitDailyTimesheet's per-job
    // grouping into the same weekly approval pipeline as yard work.
    const entry = await base44.asServiceRole.entities.Timesheet.create({
      staff_id: delivery.driver_staff_id,
      division_id: staff.division_id || '',
      job_id: delivery.job_id || '',
      date: dateStr,
      week_start: weekStart,
      task_description: description,
      task_duration_minutes: durationMinutes,
      total_hours: Math.round((durationMinutes / 60) * 100) / 100,
      task_type: 'on_site',
      source: 'staff',
      status: 'draft',
      linked_delivery_id: delivery_id,
    });

    return Response.json({ success: true, skipped: false, entry });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}