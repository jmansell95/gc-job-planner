import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Triggered when a VehicleMaintenanceBooking is updated to 'completed'.
// Updates the linked SiteAsset's compliance status and next service date
// so the Rig Fleet reflects the maintenance work automatically.

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { event, data } = await req.json();
    
    // Only act on update events where status changed to completed
    if (!event || event.type !== 'update') {
      return Response.json({ skipped: true, reason: 'not an update event' });
    }

    const booking = data;
    const oldBooking = event.old_data;

    if (!booking || booking.status !== 'completed') {
      return Response.json({ skipped: true, reason: 'booking not completed' });
    }

    // Only fire when the status actually transitioned to completed
    if (oldBooking && oldBooking.status === 'completed') {
      return Response.json({ skipped: true, reason: 'was already completed' });
    }

    // Find the linked SiteAsset — VehicleMaintenanceBooking doesn't have a direct
    // site_asset_id field, so we match by vehicle_id → Vehicle → or by name match.
    // For now, we look up any SiteAsset whose serial_number or name matches the
    // booking's vehicle_name, or that has a linked_equipment reference.
    if (!booking.vehicle_id && !booking.vehicle_name) {
      return Response.json({ skipped: true, reason: 'no vehicle reference on booking' });
    }

    // Try to find a matching SiteAsset by vehicle name/registration
    let asset = null;
    if (booking.vehicle_name) {
      const assets = await base44.asServiceRole.entities.SiteAsset.filter({
        name: booking.vehicle_name
      });
      if (assets.length > 0) asset = assets[0];
    }

    if (!asset && booking.vehicle_id) {
      // Try matching by the vehicle's registration as serial_number
      const vehicles = await base44.asServiceRole.entities.Vehicle.filter({ id: booking.vehicle_id });
      if (vehicles.length > 0 && vehicles[0].registration_number) {
        const byReg = await base44.asServiceRole.entities.SiteAsset.filter({
          serial_number: vehicles[0].registration_number
        });
        if (byReg.length > 0) asset = byReg[0];
      }
    }

    if (!asset) {
      return Response.json({ skipped: true, reason: 'no matching SiteAsset found' });
    }

    // Determine the new compliance status and next service date based on booking type
    const today = new Date();
    const nextServiceDate = new Date(today);
    nextServiceDate.setMonth(nextServiceDate.getMonth() + 6); // Default 6-month interval

    let complianceStatus = 'compliant';
    if (booking.booking_type === 'mot') {
      complianceStatus = 'compliant';
      nextServiceDate.setMonth(today.getMonth() + 12); // MOT = 12 months
    } else if (booking.booking_type === 'service') {
      complianceStatus = 'compliant';
      nextServiceDate.setMonth(today.getMonth() + 6);
    } else if (booking.booking_type === 'breakdown' || booking.booking_type === 'repair') {
      // Repairs don't reset compliance dates, but mark as compliant if it was expired
      complianceStatus = asset.compliance_status === 'expired' ? 'compliant' : (asset.compliance_status || 'compliant');
      // Don't override next_service_date for repairs
    }

    const updates = {
      compliance_status: complianceStatus,
      compliance_last_checked: today.toISOString(),
      last_service_date: booking.completed_at ? booking.completed_at.split('T')[0] : today.toISOString().split('T')[0],
    };

    // Only update next_service_date for MOT/service/inspection
    if (['mot', 'service', 'inspection'].includes(booking.booking_type)) {
      updates.next_service_date = nextServiceDate.toISOString().split('T')[0];
      updates.compliance_expiry_date = nextServiceDate.toISOString().split('T')[0];
      updates.maintenance_status = 'ok';
    }

    // Copy service notes from the booking if present
    if (booking.notes) {
      updates.service_notes = booking.notes;
    }

    await base44.asServiceRole.entities.SiteAsset.update(asset.id, updates);

    return Response.json({
      success: true,
      asset_id: asset.id,
      asset_name: asset.name,
      updates_applied: Object.keys(updates),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}