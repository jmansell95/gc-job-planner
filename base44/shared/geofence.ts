// ============================================================
// geofence.ts — shared geofence detection logic
// ============================================================
// Used by geotabWebhook and syncGeotabFleet to detect when a
// vehicle enters or leaves a geofence around a job site or
// supplier yard. Creates GeofenceEvent records and optionally
// auto-triggers arrived_on_site_at on the matching rota
// assignment.
//
// Config is stored in AppSetting key 'geofence_config'.
// ============================================================

const EARTH_RADIUS_METERS = 6371000;

/** Haversine distance between two lat/lng points, in metres. */
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

export interface GeofenceConfig {
  enabled: boolean;
  default_radius_meters: number;
  notify_on_arrival: boolean;
  notify_on_departure: boolean;
  auto_arrival_on_rota: boolean;
}

export const DEFAULT_GEOFENCE_CONFIG: GeofenceConfig = {
  enabled: true,
  default_radius_meters: 100,
  notify_on_arrival: true,
  notify_on_departure: false,
  auto_arrival_on_rota: true,
};

export interface GeofenceTarget {
  type: 'job' | 'supplier';
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius_override?: number;
}

export interface GeofencePreload {
  suppliers?: any[];
  jobs?: any[];
}

/**
 * Check a single vehicle position against all relevant geofence targets
 * and create arrival/departure events as needed.
 *
 * Targets checked:
 *  - Jobs the vehicle is assigned to TODAY (via RotaAssignment.vehicle_id)
 *  - Jobs the vehicle is delivering to TODAY (via DeliveryLeg.vehicle_id)
 *  - All suppliers with lat/lng (yards, depots, maintenance providers)
 *
 * Only jobs with site_lat/site_lng set are checked. Only suppliers with
 * lat/lng set are checked.
 *
 * Returns a summary of events created.
 */
export async function checkGeofencePresence(
  base44: any,
  vehicleId: string,
  vehicleName: string,
  registrationNumber: string,
  lat: number,
  lng: number,
  timestamp: string,
  config: GeofenceConfig,
  preload?: GeofencePreload,
): Promise<{ arrivals: number; departures: number; autoArrivals: number }> {
  if (!config.enabled) return { arrivals: 0, departures: 0, autoArrivals: 0 };
  if (isNaN(lat) || isNaN(lng)) return { arrivals: 0, departures: 0, autoArrivals: 0 };

  const today = timestamp.slice(0, 10);

  // Load per-vehicle data + shared data (use preload if provided)
  const [rotas, legs, suppliers, jobs] = await Promise.all([
    base44.asServiceRole.entities.RotaAssignment.filter(
      { vehicle_id: vehicleId, assigned_date: today },
      '-created_date',
      100,
    ),
    base44.asServiceRole.entities.DeliveryLeg.filter(
      { vehicle_id: vehicleId, scheduled_date: today },
      '-created_date',
      100,
    ),
    preload?.suppliers
      ? Promise.resolve(preload.suppliers)
      : base44.asServiceRole.entities.Supplier.list('-created_date', 500),
    preload?.jobs
      ? Promise.resolve(preload.jobs)
      : base44.asServiceRole.entities.Job.list('-created_date', 500),
  ]);

  const jobMap = new Map<string, any>();
  for (const j of jobs) jobMap.set(j.id, j);

  // Build target list from rota assignments (today's jobs for this vehicle)
  const targets: GeofenceTarget[] = [];
  const rotaByJobId = new Map<string, any>();
  for (const r of rotas) {
    if (r.job_id) rotaByJobId.set(r.job_id, r);
    const job = r.job_id ? jobMap.get(r.job_id) : null;
    if (job && job.site_lat && job.site_lng) {
      targets.push({
        type: 'job',
        id: job.id,
        name: job.name,
        lat: job.site_lat,
        lng: job.site_lng,
        radius_override: job.geofence_radius_override,
      });
    }
  }

  // Add targets from delivery legs (today's deliveries for this vehicle)
  for (const leg of legs) {
    if (!leg.job_id) continue;
    if (targets.find((t) => t.type === 'job' && t.id === leg.job_id)) continue;
    const job = jobMap.get(leg.job_id);
    if (job && job.site_lat && job.site_lng) {
      targets.push({
        type: 'job',
        id: job.id,
        name: job.name,
        lat: job.site_lat,
        lng: job.site_lng,
        radius_override: job.geofence_radius_override,
      });
    }
  }

  // Add all suppliers with coordinates (yards, depots, maintenance providers)
  for (const s of suppliers) {
    if (s.lat && s.lng) {
      targets.push({
        type: 'supplier',
        id: s.id,
        name: s.name,
        lat: s.lat,
        lng: s.lng,
        radius_override: s.geofence_radius_override,
      });
    }
  }

  if (targets.length === 0) return { arrivals: 0, departures: 0, autoArrivals: 0 };

  // Load recent geofence events for this vehicle to determine current in/out state
  const recentEvents = await base44.asServiceRole.entities.GeofenceEvent.filter(
    { vehicle_id: vehicleId },
    '-created_date',
    200,
  );
  // Map: targetKey → last event type ('arrival' | 'departure')
  // recentEvents is sorted newest-first, so the first occurrence of each
  // target key is the most recent event.
  const lastEventByTarget = new Map<string, string>();
  for (const e of recentEvents) {
    const key = `${e.target_type}|${e.target_id}`;
    if (!lastEventByTarget.has(key)) {
      lastEventByTarget.set(key, e.event_type);
    }
  }

  let arrivals = 0;
  let departures = 0;
  let autoArrivals = 0;

  for (const target of targets) {
    const distance = haversineMeters(lat, lng, target.lat, target.lng);
    const radius = target.radius_override || config.default_radius_meters;
    const isInside = distance <= radius;
    const key = `${target.type}|${target.id}`;
    const lastEvent = lastEventByTarget.get(key);

    if (isInside && lastEvent !== 'arrival') {
      // New arrival
      const rota = target.type === 'job' ? rotaByJobId.get(target.id) : null;
      const event = await base44.asServiceRole.entities.GeofenceEvent.create({
        vehicle_id: vehicleId,
        vehicle_name: vehicleName,
        registration_number: registrationNumber,
        target_type: target.type,
        target_id: target.id,
        target_name: target.name,
        event_type: 'arrival',
        lat: Math.round(lat * 1e6) / 1e6,
        lng: Math.round(lng * 1e6) / 1e6,
        distance_meters: Math.round(distance),
        radius_meters: radius,
        timestamp,
        notified: false,
        rota_assignment_id: rota?.id || '',
        auto_arrival_triggered: false,
      });
      arrivals++;

      // Auto-trigger arrived_on_site_at on the rota assignment
      if (config.auto_arrival_on_rota && rota && !rota.arrived_on_site_at) {
        try {
          await base44.asServiceRole.entities.RotaAssignment.update(rota.id, {
            arrived_on_site_at: timestamp,
          });
          await base44.asServiceRole.entities.GeofenceEvent.update(event.id, {
            auto_arrival_triggered: true,
          });
          autoArrivals++;
        } catch (_) {}
      }

      lastEventByTarget.set(key, 'arrival');
    } else if (!isInside && lastEvent === 'arrival') {
      // Departure — vehicle was inside, now outside
      await base44.asServiceRole.entities.GeofenceEvent.create({
        vehicle_id: vehicleId,
        vehicle_name: vehicleName,
        registration_number: registrationNumber,
        target_type: target.type,
        target_id: target.id,
        target_name: target.name,
        event_type: 'departure',
        lat: Math.round(lat * 1e6) / 1e6,
        lng: Math.round(lng * 1e6) / 1e6,
        distance_meters: Math.round(distance),
        radius_meters: radius,
        timestamp,
        notified: false,
        rota_assignment_id: '',
        auto_arrival_triggered: false,
      });
      departures++;
      lastEventByTarget.set(key, 'departure');
    }
  }

  return { arrivals, departures, autoArrivals };
}

/** Load the geofence config from AppSetting, falling back to defaults. */
export async function loadGeofenceConfig(base44: any): Promise<{ config: GeofenceConfig; settingId?: string }> {
  const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: 'geofence_config' });
  const stored = settings[0];
  const config: GeofenceConfig = {
    ...DEFAULT_GEOFENCE_CONFIG,
    ...(stored?.value || {}),
  };
  return { config, settingId: stored?.id };
}