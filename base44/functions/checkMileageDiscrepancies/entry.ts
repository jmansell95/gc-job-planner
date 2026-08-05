import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// checkMileageDiscrepancies — compares Geotab odometer readings
// against Holman mileage for vehicles synced from both sources.
// Flags discrepancies > 50 miles that indicate a sync issue or
// potential odometer tampering.
// ============================================================

const KM_TO_MILES = 0.621371;
const DISCREPANCY_THRESHOLD_MILES = 50;

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const vehicles = await base44.asServiceRole.entities.Vehicle.list('-created_date', 500);

    // Get latest Geotab odometer reading per vehicle from location logs.
    // Logs are sorted by -timestamp so the first log per vehicle is the most recent.
    const allLogs = await base44.asServiceRole.entities.VehicleLocationLog.list('-timestamp', 2000);
    const latestGeotabOdo: Record<string, number> = {};
    for (const log of allLogs) {
      if (!log.vehicle_id || log.odometer_km == null) continue;
      if (latestGeotabOdo[log.vehicle_id] != null) continue; // already have the latest
      latestGeotabOdo[log.vehicle_id] = Math.round(Number(log.odometer_km) * KM_TO_MILES);
    }

    const discrepancies: any[] = [];
    const synced: any[] = [];

    for (const v of vehicles) {
      const geotabSynced = v.geotab_sync_status === 'synced' || !!v.geotab_device_id;
      const holmanSynced = v.holman_sync_status === 'synced' || !!v.holman_vehicle_id;

      if (!geotabSynced || !holmanSynced) continue;

      const geotabMiles = latestGeotabOdo[v.id] ?? null;
      const holmanMiles = v.current_mileage ?? null;

      if (geotabMiles == null || holmanMiles == null) continue;

      const diff = Math.abs(geotabMiles - holmanMiles);
      const entry = {
        vehicle_id: v.id,
        registration_number: v.registration_number,
        vehicle_name: v.name,
        geotab_miles: geotabMiles,
        holman_miles: holmanMiles,
        difference: diff,
        source: diff > DISCREPANCY_THRESHOLD_MILES ? 'discrepancy' : 'matched',
      };

      if (diff > DISCREPANCY_THRESHOLD_MILES) {
        discrepancies.push(entry);
      } else {
        synced.push(entry);
      }
    }

    return Response.json({
      ok: true,
      checked: discrepancies.length + synced.length,
      discrepancy_count: discrepancies.length,
      matched_count: synced.length,
      threshold_miles: DISCREPANCY_THRESHOLD_MILES,
      discrepancies: discrepancies.sort((a, b) => b.difference - a.difference),
      matched: synced,
    });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ error: msg }, { status: 500 });
  }
}