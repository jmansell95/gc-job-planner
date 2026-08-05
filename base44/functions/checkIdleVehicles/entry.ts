import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// checkIdleVehicles — finds vehicles with no GPS activity or
// rota assignments in the last N days, flagging them for
// review (potential decommissioning or disposal).
// ============================================================
// Payload: { idle_threshold_days?: number (default 30) }

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const thresholdDays = Number(body.idle_threshold_days) || 30;
    const cutoff = new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000);

    const vehicles = await base44.asServiceRole.entities.Vehicle.list('-created_date', 500);

    // Latest GPS log per vehicle
    const allLogs = await base44.asServiceRole.entities.VehicleLocationLog.list('-timestamp', 2000);
    const latestLogByVehicle: Record<string, string> = {};
    for (const log of allLogs) {
      if (!log.vehicle_id) continue;
      if (!latestLogByVehicle[log.vehicle_id]) {
        latestLogByVehicle[log.vehicle_id] = log.timestamp; // logs are sorted -timestamp
      }
    }

    // Recent rota assignments by vehicle
    const assignments = await base44.asServiceRole.entities.RotaAssignment.list('-assigned_date', 1000);
    const recentAssignmentByVehicle: Record<string, string> = {};
    for (const a of assignments) {
      if (!a.vehicle_id) continue;
      const d = a.assigned_date || '';
      if (d >= cutoff.toISOString().slice(0, 10)) {
        if (!recentAssignmentByVehicle[a.vehicle_id] || d > recentAssignmentByVehicle[a.vehicle_id]) {
          recentAssignmentByVehicle[a.vehicle_id] = d;
        }
      }
    }

    const idle: any[] = [];
    const active: any[] = [];

    for (const v of vehicles) {
      const lastLog = latestLogByVehicle[v.id] ? new Date(latestLogByVehicle[v.id]) : null;
      const lastAssignment = recentAssignmentByVehicle[v.id] || null;

      const hasRecentGps = lastLog && lastLog >= cutoff;
      const hasRecentAssignment = !!lastAssignment;

      if (hasRecentGps || hasRecentAssignment) {
        active.push({
          vehicle_id: v.id,
          registration_number: v.registration_number,
          vehicle_name: v.name,
          last_gps: lastLog?.toISOString() || null,
          last_assignment: lastAssignment,
        });
        continue;
      }

      const daysSinceGps = lastLog ? Math.floor((Date.now() - lastLog.getTime()) / (24 * 60 * 60 * 1000)) : null;
      idle.push({
        vehicle_id: v.id,
        registration_number: v.registration_number,
        vehicle_name: v.name,
        geotab_synced: v.geotab_sync_status === 'synced',
        last_gps: lastLog?.toISOString() || null,
        days_idle: daysSinceGps ?? 999,
        recommendation: daysSinceGps === null ? 'No GPS data ever recorded' : `${daysSinceGps} days since last GPS activity`,
      });
    }

    idle.sort((a, b) => b.days_idle - a.days_idle);

    return Response.json({
      ok: true,
      threshold_days: thresholdDays,
      idle_count: idle.length,
      active_count: active.length,
      total: vehicles.length,
      idle,
      active,
    });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ error: msg }, { status: 500 });
  }
}