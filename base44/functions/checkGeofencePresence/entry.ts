import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { checkGeofencePresence, loadGeofenceConfig } from '../../shared/geofence.ts';

// ============================================================
// checkGeofencePresence — checks a vehicle's current GPS
// position against job site and supplier yard geofences.
// ============================================================
// Can be called two ways:
//
// 1. Single check (from the frontend or a manual test):
//    POST { vehicle_id, lat, lng, timestamp }
//    → checks one vehicle position and returns the events created
//
// 2. Batch check (processes the latest location log for every
//    vehicle — useful for a scheduled catch-up run):
//    POST { action: 'batch' }
//    → iterates all vehicles, reads their most recent
//    VehicleLocationLog, and runs the geofence check
//
// The real-time integration is done inside geotabWebhook and
// syncGeotabFleet, which call the shared checkGeofencePresence
// helper directly after storing a location log. This function
// exists for manual testing and scheduled batch processing.
// ============================================================

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== 'admin') {
      return Response.json({ ok: false, error: 'Forbidden — admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { config } = await loadGeofenceConfig(base44);

    // ── Batch mode: process latest location for every vehicle ──
    if (body.action === 'batch') {
      const [vehicles, logs, suppliers, jobs] = await Promise.all([
        base44.asServiceRole.entities.Vehicle.list('-created_date', 500),
        base44.asServiceRole.entities.VehicleLocationLog.list('-created_date', 2000),
        base44.asServiceRole.entities.Supplier.list('-created_date', 500),
        base44.asServiceRole.entities.Job.list('-created_date', 500),
      ]);

      // Find the latest log per vehicle
      const latestLogByVehicle = new Map<string, any>();
      for (const log of logs) {
        if (!log.vehicle_id) continue;
        if (!latestLogByVehicle.has(log.vehicle_id)) {
          latestLogByVehicle.set(log.vehicle_id, log);
        }
      }

      const preload = { suppliers, jobs };
      let totalArrivals = 0;
      let totalDepartures = 0;
      let totalAutoArrivals = 0;
      let vehiclesChecked = 0;

      for (const vehicle of vehicles) {
        const log = latestLogByVehicle.get(vehicle.id);
        if (!log || isNaN(log.lat) || isNaN(log.lng)) continue;
        const result = await checkGeofencePresence(
          base44,
          vehicle.id,
          vehicle.name,
          vehicle.registration_number || '',
          log.lat,
          log.lng,
          log.timestamp || new Date().toISOString(),
          config,
          preload,
        );
        totalArrivals += result.arrivals;
        totalDepartures += result.departures;
        totalAutoArrivals += result.autoArrivals;
        vehiclesChecked++;
      }

      return Response.json({
        ok: true,
        mode: 'batch',
        vehicles_checked: vehiclesChecked,
        arrivals: totalArrivals,
        departures: totalDepartures,
        auto_arrivals: totalAutoArrivals,
      });
    }

    // ── Single check ──
    const { vehicle_id, lat, lng, timestamp } = body;
    if (!vehicle_id || isNaN(Number(lat)) || isNaN(Number(lng))) {
      return Response.json({ ok: false, error: 'vehicle_id, lat and lng are required' }, { status: 400 });
    }

    const vehicle = await base44.asServiceRole.entities.Vehicle.get(vehicle_id).catch(() => null);
    if (!vehicle) {
      return Response.json({ ok: false, error: 'Vehicle not found' }, { status: 404 });
    }

    const ts = timestamp || new Date().toISOString();
    const result = await checkGeofencePresence(
      base44,
      vehicle.id,
      vehicle.name,
      vehicle.registration_number || '',
      Number(lat),
      Number(lng),
      ts,
      config,
    );

    return Response.json({
      ok: true,
      mode: 'single',
      vehicle: vehicle.name,
      position: { lat: Number(lat), lng: Number(lng) },
      timestamp: ts,
      ...result,
    });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}