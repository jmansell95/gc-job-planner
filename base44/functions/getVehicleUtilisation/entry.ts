import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// getVehicleUtilisation — calculates driving/idle/parked time
// per vehicle from cached Geotab location logs for a date range.
// Returns per-vehicle percentages and a fleet aggregate.
// ============================================================
// Payload: { from_date?: string, to_date?: string, vehicle_id?: string }

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const toDate = body.to_date ? new Date(body.to_date + 'T23:59:59') : new Date();
    const fromDate = body.from_date ? new Date(body.from_date + 'T00:00:00') : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const vehicles = await base44.asServiceRole.entities.Vehicle.list('-created_date', 500);

    // Load location logs — enough to cover the date range
    const allLogs = await base44.asServiceRole.entities.VehicleLocationLog.list('-timestamp', 5000);

    // Group logs by vehicle and filter by date range
    const byVehicle: Record<string, any[]> = {};
    for (const log of allLogs) {
      if (!log.vehicle_id) continue;
      const ts = new Date(log.timestamp);
      if (ts < fromDate || ts > toDate) continue;
      if (!byVehicle[log.vehicle_id]) byVehicle[log.vehicle_id] = [];
      byVehicle[log.vehicle_id].push(log);
    }

    const results: any[] = [];
    let fleetDrivingMs = 0, fleetIdleMs = 0, fleetParkedMs = 0;

    for (const v of vehicles) {
      const logs = (byVehicle[v.id] || []).sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
      if (logs.length < 2) continue;

      let drivingMs = 0, idleMs = 0, parkedMs = 0;
      for (let i = 1; i < logs.length; i++) {
        const prev = logs[i - 1];
        const curr = logs[i];
        const gapMs = new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime();
        // Skip gaps > 1 hour (vehicle likely offline, not parked on site)
        if (gapMs > 3600000) continue;

        const speed = Number(curr.speed_kph) || 0;
        const ignition = curr.ignition_on;

        if (speed > 0) {
          drivingMs += gapMs;
        } else if (ignition) {
          idleMs += gapMs;
        } else {
          parkedMs += gapMs;
        }
      }

      const totalMs = drivingMs + idleMs + parkedMs;
      if (totalMs === 0) continue;

      fleetDrivingMs += drivingMs;
      fleetIdleMs += idleMs;
      fleetParkedMs += parkedMs;

      results.push({
        vehicle_id: v.id,
        registration_number: v.registration_number,
        vehicle_name: v.name,
        driving_hours: Math.round((drivingMs / 3600000) * 10) / 10,
        idle_hours: Math.round((idleMs / 3600000) * 10) / 10,
        parked_hours: Math.round((parkedMs / 3600000) * 10) / 10,
        total_hours: Math.round((totalMs / 3600000) * 10) / 10,
        driving_pct: Math.round((drivingMs / totalMs) * 100),
        idle_pct: Math.round((idleMs / totalMs) * 100),
        parked_pct: Math.round((parkedMs / totalMs) * 100),
        log_count: logs.length,
      });
    }

    results.sort((a, b) => b.driving_hours - a.driving_hours);

    const fleetTotal = fleetDrivingMs + fleetIdleMs + fleetParkedMs;
    const fleet = {
      driving_pct: fleetTotal > 0 ? Math.round((fleetDrivingMs / fleetTotal) * 100) : 0,
      idle_pct: fleetTotal > 0 ? Math.round((fleetIdleMs / fleetTotal) * 100) : 0,
      parked_pct: fleetTotal > 0 ? Math.round((fleetParkedMs / fleetTotal) * 100) : 0,
      driving_hours: Math.round((fleetDrivingMs / 3600000) * 10) / 10,
      idle_hours: Math.round((fleetIdleMs / 3600000) * 10) / 10,
      parked_hours: Math.round((fleetParkedMs / 3600000) * 10) / 10,
    };

    return Response.json({
      ok: true,
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      vehicle_count: results.length,
      fleet,
      vehicles: results,
    });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ error: msg }, { status: 500 });
  }
}