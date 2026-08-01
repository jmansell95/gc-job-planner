import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// getVehicleLocationHistory — returns location data for reports
// and the live map on the Vehicles page.
// ============================================================
// Payload:
//   { mode: "live" | "history" | "report",
//     vehicle_id?: string,
//     registration_number?: string,
//     from_date?: string (ISO),
//     to_date?: string (ISO),
//     limit?: number }
//
// "live"   → latest reading per vehicle (for the map view)
// "history" → all readings for one vehicle (timeline)
// "report"  → aggregated trip/distance summary per vehicle

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const mode = body.mode || 'live';
    const limit = Math.min(Number(body.limit) || 500, 2000);

    // Load all vehicles for display enrichment
    const vehicles = await base44.asServiceRole.entities.Vehicle.list('-created_date', 500);
    const vehicleMap: Record<string, any> = {};
    for (const v of vehicles) vehicleMap[v.id] = v;

    if (mode === 'live') {
      // Get the latest location log per vehicle
      const allLogs = await base44.asServiceRole.entities.VehicleLocationLog.list('-timestamp', limit);
      const latestByVehicle: Record<string, any> = {};
      for (const log of allLogs) {
        const vid = log.vehicle_id;
        if (!vid) continue;
        if (!latestByVehicle[vid] || (log.timestamp || '') > (latestByVehicle[vid].timestamp || '')) {
          latestByVehicle[vid] = log;
        }
      }
      const results = Object.values(latestByVehicle).map((log: any) => ({
        vehicle_id: log.vehicle_id,
        registration_number: log.registration_number,
        vehicle_name: log.vehicle_name || vehicleMap[log.vehicle_id]?.name || '',
        lat: log.lat,
        lng: log.lng,
        speed_kph: log.speed_kph,
        heading: log.heading,
        ignition_on: log.ignition_on,
        odometer_km: log.odometer_km,
        driver_name: log.driver_name,
        timestamp: log.timestamp,
        assigned_staff_name: vehicleMap[log.vehicle_id]?.assigned_staff_id || '',
      }));
      return Response.json({ ok: true, mode: 'live', count: results.length, vehicles: results });
    }

    if (mode === 'history') {
      const vehicleId = body.vehicle_id;
      if (!vehicleId) return Response.json({ error: 'vehicle_id is required for history mode' }, { status: 400 });
      const fromDate = body.from_date;
      const toDate = body.to_date;

      let logs: any[];
      if (fromDate && toDate) {
        logs = await base44.asServiceRole.entities.VehicleLocationLog.filter({ vehicle_id: vehicleId }, '-timestamp', limit);
        logs = logs.filter(l => l.timestamp >= fromDate && l.timestamp <= toDate);
      } else {
        logs = await base44.asServiceRole.entities.VehicleLocationLog.filter({ vehicle_id: vehicleId }, '-timestamp', limit);
      }
      return Response.json({
        ok: true,
        mode: 'history',
        vehicle_id: vehicleId,
        registration_number: logs[0]?.registration_number || '',
        count: logs.length,
        points: logs.map(l => ({
          lat: l.lat, lng: l.lng, speed_kph: l.speed_kph, heading: l.heading,
          ignition_on: l.ignition_on, odometer_km: l.odometer_km, driver_name: l.driver_name,
          timestamp: l.timestamp,
        })),
      });
    }

    if (mode === 'report') {
      // Aggregated report: per-vehicle summary with total readings, distance,
      // last seen, and current status
      const allLogs = await base44.asServiceRole.entities.VehicleLocationLog.list('-timestamp', limit);
      const byVehicle: Record<string, any[]> = {};
      for (const log of allLogs) {
        const vid = log.vehicle_id || log.registration_number;
        if (!byVehicle[vid]) byVehicle[vid] = [];
        byVehicle[vid].push(log);
      }

      const report = Object.entries(byVehicle).map(([vid, logs]) => {
        const sorted = logs.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
        const latest = sorted[0];
        const first = sorted[sorted.length - 1];
        const distanceKm = (Number(latest.odometer_km) || 0) - (Number(first.odometer_km) || 0);
        return {
          vehicle_id: latest.vehicle_id || vid,
          registration_number: latest.registration_number,
          vehicle_name: latest.vehicle_name || vehicleMap[latest.vehicle_id]?.name || '',
          total_readings: logs.length,
          first_seen: first.timestamp,
          last_seen: latest.timestamp,
          last_lat: latest.lat,
          last_lng: latest.lng,
          last_speed_kph: latest.speed_kph,
          last_ignition_on: latest.ignition_on,
          last_driver_name: latest.driver_name,
          distance_km: Math.max(0, Math.round(distanceKm * 100) / 100),
        };
      });

      return Response.json({ ok: true, mode: 'report', count: report.length, vehicles: report });
    }

    return Response.json({ error: 'Invalid mode. Use "live", "history" or "report".' }, { status: 400 });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ error: msg }, { status: 500 });
  }
}