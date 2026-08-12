import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// syncVehicleOperator — keeps the Vehicle.current_operator_*
// fields in sync with the live DeliveryLog activity.
//
// Triggered by an entity automation on DeliveryLog create/update.
// When a delivery/collection/handover task moves to 'in_progress',
// the assigned driver becomes the vehicle's live "Driving Now"
// operator. When the task completes (or the vehicle_id changes),
// the operator is cleared — unless another active task for the
// same vehicle takes over.
//
// This is the DYNAMIC driver status. The FIXED keeper assignment
// comes from Geotab (geotab_keeper_name) via syncGeotabFleet.
// ============================================================

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    let { event, data, old_data } = body;

    // Fetch the current delivery record if it wasn't included in the payload
    if (!data && event?.entity_id) {
      try {
        data = await base44.asServiceRole.entities.DeliveryLog.get(event.entity_id);
      } catch (_) {
        data = null;
      }
    }

    if (!data) {
      return Response.json({ ok: true, skipped: true, reason: 'no data' });
    }

    // Collect every vehicle that might be affected: the current vehicle_id
    // and (for updates) the previous vehicle_id if it changed.
    const vehicleIds = new Set<string>();
    if (data.vehicle_id) vehicleIds.add(data.vehicle_id);
    if (old_data?.vehicle_id && old_data.vehicle_id !== data.vehicle_id) {
      vehicleIds.add(old_data.vehicle_id);
    }

    const now = new Date().toISOString();
    let updatedCount = 0;

    for (const vehicleId of vehicleIds) {
      // Find all in_progress delivery tasks for this vehicle, most recent first.
      const active = await base44.asServiceRole.entities.DeliveryLog.filter(
        { vehicle_id: vehicleId, status: 'in_progress' },
        '-started_at',
        5,
      );

      if (active.length > 0) {
        const d = active[0];
        // Resolve driver name — prefer the denormalised field, fall back to Staff lookup
        let driverName = d.driver_staff_name || '';
        if (!driverName && d.driver_staff_id) {
          try {
            const staff = await base44.asServiceRole.entities.Staff.get(d.driver_staff_id);
            if (staff?.name) driverName = staff.name;
          } catch (_) {}
        }

        try {
          await base44.asServiceRole.entities.Vehicle.update(vehicleId, {
            current_operator_id: d.driver_staff_id || '',
            current_operator_name: driverName,
            current_delivery_id: d.id,
            current_job_id: d.job_id || '',
            current_job_name: d.job_name || '',
            current_delivery_type: d.delivery_type || '',
            current_delivery_items: d.items || '',
            operator_updated_at: now,
          });
          updatedCount++;
        } catch (_) {}
      } else {
        // No active task for this vehicle — clear the live operator
        try {
          await base44.asServiceRole.entities.Vehicle.update(vehicleId, {
            current_operator_id: '',
            current_operator_name: '',
            current_delivery_id: '',
            current_job_id: '',
            current_job_name: '',
            current_delivery_type: '',
            current_delivery_items: '',
            operator_updated_at: now,
          });
          updatedCount++;
        } catch (_) {}
      }
    }

    return Response.json({
      ok: true,
      vehicles_updated: updatedCount,
      vehicle_ids: Array.from(vehicleIds),
    });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}