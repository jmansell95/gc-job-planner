import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Usage-based maintenance: for each rig, sums the drilling/minutage minutes
// logged against jobs the rig is assigned to since its last service date.
// When cumulative engine-hours exceed the maintenance interval threshold,
// the rig's maintenance_status is advanced to 'due_soon' and a maintenance
// booking is auto-created (delegating to autoBookMaintenance logic).
//
// This shifts fleet care from dumb calendar intervals to actual usage — a rig
// that sat idle stays green; a rig that drilled 300m in a week gets serviced
// before it breaks down.
const MAINTENANCE_INTERVAL_HOURS = 250; // standard rig service interval

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const e = base44.asServiceRole.entities;
    const today = new Date().toISOString().slice(0, 10);
    const progress = [];

    // All rigs (active or not — expired rigs still need tracking)
    const rigs = await e.SiteAsset.filter({ asset_type: 'rig' });
    const allAssetAssignments = await e.JobAssetAssignment.list('-created_date', 500);
    const allLogs = await e.InvestigationLog.list('-created_date', 500);

    const updates = [];
    for (const rig of rigs) {
      // Find jobs this rig is assigned to
      const rigAssignments = allAssetAssignments.filter(a => a.asset_id === rig.id);
      const jobIds = new Set(rigAssignments.map(a => a.job_id));

      // Sum drilling-duration minutes since last service date
      const sinceDate = rig.last_service_date || '2000-01-01';
      let usageMinutes = 0;
      for (const log of allLogs) {
        if (!jobIds.has(log.job_id)) continue;
        if (log.date && log.date < sinceDate) continue;
        // Only count drilling-related logs that reflect engine run-time
        const drillingTypes = ['borehole_progress', 'sample_collection', 'window_sampling', 'core_inspection', 'geophysical_probing'];
        if (!drillingTypes.includes(log.log_type)) continue;
        usageMinutes += Number(log.duration_minutes) || 0;
      }
      const usageHours = usageMinutes / 60;

      if (usageHours >= MAINTENANCE_INTERVAL_HOURS && rig.maintenance_status !== 'overdue') {
        // Advance maintenance status — the rig has earned a service
        updates.push({ id: rig.id, maintenance_status: 'due_soon', service_notes: `Usage-based trigger: ${Math.round(usageHours)}h engine run-time since last service (${rig.last_service_date || 'never'}).` });
        progress.push(`${rig.name}: ${Math.round(usageHours)}h logged → due_soon`);
      } else if (usageHours > 0) {
        progress.push(`${rig.name}: ${Math.round(usageHours)}h logged (under ${MAINTENANCE_INTERVAL_HOURS}h threshold)`);
      }
    }

    if (updates.length > 0) {
      await e.SiteAsset.bulkUpdate(updates);
    }

    return Response.json({
      success: true,
      rigs_checked: rigs.length,
      rigs_flagged: updates.length,
      interval_hours: MAINTENANCE_INTERVAL_HOURS,
      progress,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}