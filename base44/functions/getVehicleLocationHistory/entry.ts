import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// getVehicleLocationHistory — returns location data for reports
// and the live map on the Vehicles page.
// ============================================================
// Payload:
//   { mode: "live" | "history" | "report" | "geotab_history",
//     vehicle_id?: string,
//     registration_number?: string,
//     from_date?: string (ISO),
//     to_date?: string (ISO),
//     limit?: number }
//
// "live"           → latest reading per vehicle (for the map view)
// "history"        → all cached readings for one vehicle (timeline)
// "report"         → aggregated trip/distance summary per vehicle
// "geotab_history" → pulls trip history DIRECTLY from Geotab API
//                    by registration number (not cached data)

interface GeotabCredentials {
  sessionId: string;
  userName: string;
  database: string;
}

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

    // ── GEOTAB DIRECT HISTORY MODE ──
    // Pulls trip history directly from the Geotab API (not cached data).
    // Matches the vehicle by registration number or vehicle_id, then
    // queries Geotab's Trip endpoint for the date range.
    if (mode === 'geotab_history') {
      const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: 'geotab_config' });
      const cfg = settings[0]?.value || {};
      if (!cfg.username || !cfg.password || !cfg.database) {
        return Response.json({ ok: false, error: 'Geotab credentials not configured. Add them in Settings → Geotab GPS Sync.' });
      }

      // Find the vehicle by reg or vehicle_id
      let vehicle: any = null;
      if (body.vehicle_id) {
        vehicle = vehicleMap[body.vehicle_id];
      } else if (body.registration_number) {
        const regNorm = body.registration_number.toUpperCase().replace(/\s+/g, '');
        vehicle = vehicles.find((v: any) => (v.registration_number || '').toUpperCase().replace(/\s+/g, '') === regNorm);
      }
      if (!vehicle) {
        return Response.json({ ok: false, error: 'Vehicle not found. Provide a valid vehicle_id or registration_number.' });
      }
      if (!vehicle.geotab_device_id) {
        return Response.json({ ok: false, error: 'This vehicle has no Geotab device linked. Sync from Geotab first.' });
      }

      const server = cfg.server || 'my.geotab.com';
      const apiUrl = `https://${server.replace(/^https?:\/\//, '')}/apiv1`;

      // Authenticate
      const authRes = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'Authenticate',
          params: { userName: cfg.username, password: cfg.password, database: cfg.database },
        }),
      }).catch(() => null);

      if (!authRes || !authRes.ok) {
        return Response.json({ ok: false, error: 'Geotab authentication failed' });
      }
      const authJson = await authRes.json().catch(() => null);
      const creds: GeotabCredentials | null = authJson?.result?.credentials || null;
      if (!creds?.sessionId) {
        return Response.json({ ok: false, error: 'Geotab authentication returned no session' });
      }

      // Build date range (default: last 7 days)
      const toDate = body.to_date ? new Date(body.to_date) : new Date();
      const fromDate = body.from_date ? new Date(body.from_date) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Fetch Trip records from Geotab
      const tripRes = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'Get',
          params: {
            typeName: 'Trip',
            credentials: creds,
            search: {
              deviceSearch: { id: vehicle.geotab_device_id },
              fromDate: fromDate.toISOString(),
              toDate: toDate.toISOString(),
            },
            resultsLimit: Math.min(limit, 500),
          },
        }),
      }).catch(() => null);

      const tripJson = tripRes ? await tripRes.json().catch(() => null) : null;
      const trips: any[] = Array.isArray(tripJson?.result) ? tripJson.result : [];

      // Also fetch LogRecord breadcrumbs for route detail (limited)
      const logRes = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'Get',
          params: {
            typeName: 'LogRecord',
            credentials: creds,
            search: {
              deviceSearch: { id: vehicle.geotab_device_id },
              fromDate: fromDate.toISOString(),
              toDate: toDate.toISOString(),
            },
            resultsLimit: Math.min(limit * 4, 2000),
          },
        }),
      }).catch(() => null);

      const logJson = logRes ? await logRes.json().catch(() => null) : null;
      const logs: any[] = Array.isArray(logJson?.result) ? logJson.result : [];

      // Format log breadcrumbs (defined first — trips reference these for coordinates)
      const formattedLogs = logs.map((l: any) => ({
        lat: l.latitude ? Number(l.latitude) : null,
        lng: l.longitude ? Number(l.longitude) : null,
        speed_kph: l.speed ? Math.round(Number(l.speed)) : 0,
        heading: l.heading ? Number(l.heading) : 0,
        timestamp: l.dateTime,
      })).filter((l: any) => l.lat !== null && l.lng !== null)
         .sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));

      // Parse Geotab duration: either a time string "HH:MM:SS.fffffff" or milliseconds
      function parseDuration(val: any): number {
        if (val == null) return 0;
        if (typeof val === 'number') return Math.round(val / 60000);
        const s = String(val);
        const parts = s.split(':');
        if (parts.length < 3) return 0;
        const h = parseInt(parts[0], 10) || 0;
        const m = parseInt(parts[1], 10) || 0;
        const sec = parseFloat(parts[2]) || 0;
        return Math.round(h * 60 + m + sec / 60);
      }

      const sortedLogs = formattedLogs;

      // Format trips — Geotab Trip fields (verified from live API):
      //   distance: KILOMETERS (not meters!)
      //   drivingDuration: time string "HH:MM:SS.fffffff" (not ms)
      //   idlingDuration: time string
      //   maximumSpeed: km/h (not maxSpeed)
      //   odometer: meters
      //   No startPoint/endPoint — coordinates come from LogRecord breadcrumbs
      // Reverse geocode helper — uses free Nominatim (OpenStreetMap) API.
      // Returns a short location label like "M1, Luton" or "High Street, Dartford".
      // Cached per-request to avoid repeated lookups for the same coordinates.
      const geocodeCache: Record<string, string> = {};
      async function reverseGeocode(lat: number, lng: number): Promise<string> {
        if (lat == null || lng == null) return 'Unknown location';
        const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
        if (geocodeCache[key]) return geocodeCache[key];
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lng=${lng}&format=json&zoom=14&addressdetails=1`,
            { headers: { 'User-Agent': 'GC-Mission-Control/1.0' } }
          ).catch(() => null);
          if (res && res.ok) {
            const json = await res.json().catch(() => null);
            const addr = json?.address || {};
            // Build a short, human-readable label from the address components
            const road = addr.road || addr.pedestrian || addr.path || '';
            const suburb = addr.suburb || addr.neighbourhood || addr.hamlet || '';
            const town = addr.town || addr.city || addr.village || addr.county || '';
            const parts = [road, suburb, town].filter(Boolean);
            const label = parts.length > 0 ? parts.join(', ') : (json?.display_name?.split(',').slice(0, 2).join(',') || 'Unknown location');
            geocodeCache[key] = label;
            return label;
          }
        } catch (_) {}
        geocodeCache[key] = 'Unknown location';
        return 'Unknown location';
      }

      // Detect stops within a trip — periods where speed = 0 for >= 2 minutes.
      // Returns an array of stop events with location, duration, and arrival/departure times.
      function detectStops(crumbs: any[], tripStart: string, tripEnd: string): any[] {
        const stops: any[] = [];
        let stopStart: any = null;
        for (let i = 0; i < crumbs.length; i++) {
          const crumb = crumbs[i];
          const isStopped = (crumb.speed_kph || 0) === 0;
          if (isStopped && !stopStart) {
            stopStart = crumb;
          } else if (!isStopped && stopStart) {
            const durationMs = new Date(crumb.timestamp).getTime() - new Date(stopStart.timestamp).getTime();
            if (durationMs >= 120000) { // 2+ minutes = a real stop
              stops.push({
                lat: stopStart.lat,
                lng: stopStart.lng,
                arrival_time: stopStart.timestamp,
                departure_time: crumb.timestamp,
                duration_minutes: Math.round(durationMs / 60000),
              });
            }
            stopStart = null;
          }
        }
        // Handle a stop at the end of the trip
        if (stopStart) {
          const durationMs = new Date(tripEnd).getTime() - new Date(stopStart.timestamp).getTime();
          if (durationMs >= 120000) {
            stops.push({
              lat: stopStart.lat,
              lng: stopStart.lng,
              arrival_time: stopStart.timestamp,
              departure_time: tripEnd,
              duration_minutes: Math.round(durationMs / 60000),
            });
          }
        }
        return stops;
      }

      // Format trips with stop detection + reverse geocoding for start/end/stops.
      // Geocoding is limited to the first/last point + detected stops to keep
      // the request count reasonable (Nominatim rate-limits to 1 req/sec).
      const formattedTrips: any[] = [];
      for (const t of trips) {
        const startTime = t.start;
        const endTime = t.stop;
        const tripCrumbs = sortedLogs.filter(b => {
          const ts = b.timestamp;
          return ts >= startTime && ts <= endTime;
        });
        const startCrumb = tripCrumbs[0];
        const endCrumb = tripCrumbs[tripCrumbs.length - 1];

        // Detect stops within the trip
        const stops = detectStops(tripCrumbs, startTime, endTime);

        // Reverse geocode start, end, and each stop (limited to keep API calls reasonable)
        let startLocation = 'Unknown location';
        let endLocation = 'Unknown location';
        if (startCrumb?.lat != null) startLocation = await reverseGeocode(startCrumb.lat, startCrumb.lng);
        if (endCrumb?.lat != null) endLocation = await reverseGeocode(endCrumb.lat, endCrumb.lng);

        // Geocode stops (max 3 per trip to respect rate limits)
        const geocodedStops: any[] = [];
        for (let i = 0; i < Math.min(stops.length, 3); i++) {
          const s = stops[i];
          const label = s.lat != null ? await reverseGeocode(s.lat, s.lng) : 'Unknown location';
          geocodedStops.push({ ...s, location: label });
        }
        // Remaining stops without geocoding
        for (let i = 3; i < stops.length; i++) {
          geocodedStops.push({ ...stops[i], location: 'Unknown location' });
        }

        formattedTrips.push({
          trip_id: t.id,
          start_time: startTime,
          end_time: endTime,
          start_lat: startCrumb?.lat ?? null,
          start_lng: startCrumb?.lng ?? null,
          end_lat: endCrumb?.lat ?? null,
          end_lng: endCrumb?.lng ?? null,
          start_location: startLocation,
          end_location: endLocation,
          stops: geocodedStops,
          stop_count: geocodedStops.length,
          distance_km: t.distance != null ? Number(t.distance) : 0,
          duration_minutes: parseDuration(t.drivingDuration),
          max_speed_kph: t.maximumSpeed != null ? Math.round(Number(t.maximumSpeed)) : (t.maxSpeed != null ? Math.round(Number(t.maxSpeed)) : 0),
          idle_minutes: parseDuration(t.idlingDuration),
          odometer_km: t.odometer != null ? Number(t.odometer) / 1000 : null,
          average_speed_kph: t.averageSpeed != null ? Math.round(Number(t.averageSpeed)) : null,
        });
      }
      formattedTrips.sort((a, b) => (b.start_time || '').localeCompare(a.start_time || ''));

      return Response.json({
        ok: true,
        mode: 'geotab_history',
        vehicle_id: vehicle.id,
        registration_number: vehicle.registration_number,
        vehicle_name: vehicle.name,
        date_range: { from: fromDate.toISOString(), to: toDate.toISOString() },
        trips: formattedTrips,
        trip_count: formattedTrips.length,
        breadcrumbs: formattedLogs,
        breadcrumb_count: formattedLogs.length,
        total_distance_km: formattedTrips.reduce((sum: number, t: any) => sum + (t.distance_km || 0), 0),
      });
    }

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
        registration_number: log.registration_number || vehicleMap[log.vehicle_id]?.registration_number || vehicleMap[log.vehicle_id]?.name || '',
        vehicle_name: log.vehicle_name || vehicleMap[log.vehicle_id]?.name || '',
        lat: log.lat,
        lng: log.lng,
        speed_kph: log.speed_kph,
        heading: log.heading,
        ignition_on: log.ignition_on,
        odometer_km: log.odometer_km,
        driver_name: log.driver_name,
        timestamp: log.timestamp,
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

    return Response.json({ error: 'Invalid mode. Use "live", "history", "report" or "geotab_history".' }, { status: 400 });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ error: msg }, { status: 500 });
  }
}