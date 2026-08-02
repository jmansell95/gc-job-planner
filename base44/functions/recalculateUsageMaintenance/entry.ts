import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Usage-based maintenance engine — Phase 1 of the operational roadmap.
//
// For each rig and plant asset with a service_interval_hours set, sums the
// drilling/minutage minutes logged against jobs the asset is assigned to
// since its last service date. Stores the accumulated operating hours on
// the asset record and advances maintenance_status when the hours-since-
// last-service exceeds the asset's service interval threshold.
//
// This shifts fleet care from dumb calendar intervals to actual usage:
//   - A rig that sat idle stays green (0 hours accumulated)
//   - A rig that drilled 300m in a week gets serviced before it breaks down
//   - Each asset can have its own interval (250h for CP rigs, 500h for rotary)
//
// Also auto-creates a VehicleMaintenanceBooking-style service request when
// an asset crosses the threshold, so the office knows to book it in.

const DEFAULT_INTERVAL_HOURS = {
  rig: 250,
  machinery: 500,
};

// Drilling-related log types that reflect engine run-time
const DRILLING_LOG_TYPES = [
  'borehole_progress',
  'sample_collection',
  'window_sampling',
  'core_inspection',
  'geophysical_probing',
  'pit_excavation',
  'installation',
];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const e = base44.asServiceRole.entities;
    const now = new Date().toISOString();
    const progress = [];

    // All rigs and machinery (assets that use hours-based maintenance)
    const rigs = await e.SiteAsset.filter({ asset_type: 'rig' });
    const machinery = await e.SiteAsset.filter({ asset_type: 'machinery' });
    const hoursBasedAssets = [...rigs, ...machinery];

    // Fetch all assignments and logs in bulk
    const allAssetAssignments = await e.JobAssetAssignment.list('-created_date', 500);
    const allLogs = await e.InvestigationLog.list('-created_date', 500);

    // Fetch existing open maintenance bookings to avoid duplicates
    const existingBookings = await e.VehicleMaintenanceBooking.list('-booking_date', 500);
    const openBookingKeys = new Set();
    existingBookings.forEach(b => {
      if (b.status === 'requested' || b.status === 'booked' || b.status === 'in_progress') {
        openBookingKeys.add(`${b.vehicle_id}|usage_service`);
      }
    });

    const updates = [];
    const newBookings = [];

    for (const asset of hoursBasedAssets) {
      const interval = asset.service_interval_hours || DEFAULT_INTERVAL_HOURS[asset.asset_type] || 250;

      // Find jobs this asset is assigned to
      const assetAssignments = allAssetAssignments.filter(a => a.asset_id === asset.id);
      const jobIds = new Set(assetAssignments.map(a => a.job_id));

      // Sum drilling-duration minutes since last service date
      const sinceDate = asset.last_service_date || '2000-01-01';
      let usageMinutes = 0;
      for (const log of allLogs) {
        if (!jobIds.has(log.job_id)) continue;
        if (log.date && log.date < sinceDate) continue;
        if (!DRILLING_LOG_TYPES.includes(log.log_type)) continue;
        usageMinutes += Number(log.duration_minutes) || 0;
      }
      const usageHours = usageMinutes / 60;

      // Calculate hours since last service
      const hoursAtLastService = asset.hours_at_last_service || 0;
      const hoursSinceLastService = Math.max(0, usageHours - hoursAtLastService);

      // Determine maintenance status based on usage hours
      const thresholdPercent = hoursSinceLastService / interval;
      let newStatus = asset.maintenance_status || 'unknown';

      if (hoursSinceLastService >= interval) {
        newStatus = 'due_soon';
        if (thresholdPercent >= 1.1) newStatus = 'overdue';
      } else if (thresholdPercent >= 0.8) {
        newStatus = 'due_soon'; // 80% of interval — flag as due soon
      } else if (usageHours > 0) {
        newStatus = 'ok';
      }

      const update = {
        id: asset.id,
        operating_hours: Math.round(usageHours * 10) / 10,
        hours_since_last_service: Math.round(hoursSinceLastService * 10) / 10,
        maintenance_status: newStatus,
        last_usage_calc_at: now,
      };

      // Only update service_notes if status changed to due_soon/overdue
      if ((newStatus === 'due_soon' || newStatus === 'overdue') && asset.maintenance_status !== newStatus) {
        update.service_notes = `Usage-based trigger: ${Math.round(hoursSinceLastService)}h since last service (interval: ${interval}h, ${Math.round(thresholdPercent * 100)}% utilised).`;
        progress.push(`${asset.name}: ${Math.round(hoursSinceLastService)}h / ${interval}h → ${newStatus}`);

        // Auto-create a maintenance booking if none exists
        const bookingKey = `${asset.id}|usage_service`;
        if (!openBookingKeys.has(bookingKey)) {
          newBookings.push({
            vehicle_id: asset.id,
            vehicle_name: asset.name,
            booking_type: 'service',
            status: 'requested',
            booking_date: now.slice(0, 10),
            notes: `Auto-booked by usage-based maintenance — ${Math.round(hoursSinceLastService)}h engine run-time since last service (interval: ${interval}h).`,
            report_source: 'admin',
          });
          openBookingKeys.add(bookingKey);
        }
      } else if (usageHours > 0) {
        progress.push(`${asset.name}: ${Math.round(hoursSinceLastService)}h / ${interval}h (${Math.round(thresholdPercent * 100)}%) → ${newStatus}`);
      }

      updates.push(update);
    }

    // Bulk update all assets with new hours data
    if (updates.length > 0) {
      await e.SiteAsset.bulkUpdate(updates);
    }

    // Create maintenance bookings for assets that crossed the threshold
    for (const booking of newBookings) {
      try {
        await e.VehicleMaintenanceBooking.create(booking);
      } catch (err) {
        // continue on per-booking error
      }
    }

    return Response.json({
      success: true,
      assets_checked: hoursBasedAssets.length,
      assets_flagged: updates.filter(u => u.maintenance_status === 'due_soon' || u.maintenance_status === 'overdue').length,
      bookings_created: newBookings.length,
      progress,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}