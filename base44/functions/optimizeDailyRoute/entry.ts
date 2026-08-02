import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getAppSettingValue } from '../../shared/appSettings.ts';

/**
 * Route Optimisation Engine
 *
 * Takes a driver's deliveries for a given date, sends the waypoints to the
 * Google Maps Directions API with `optimize_waypoints=true`, and writes back
 * the recommended stop order, traffic-aware leg durations, distances, and
 * estimated arrival times to each DeliveryLog record.
 *
 * Payload: { driver_staff_id: string, date: string (yyyy-MM-dd), start_time?: string (HH:MM, default 08:00) }
 * Returns:  { optimized_count, total_duration_minutes, total_distance_miles, route: [...] }
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { driver_staff_id, date, start_time } = body;
    if (!driver_staff_id || !date) {
      return Response.json({ error: 'driver_staff_id and date are required' }, { status: 400 });
    }

    // Load Google Maps API key from AppSetting
    const mapsConfig = await getAppSettingValue(base44, 'google_maps_config', {});
    const apiKey = mapsConfig.api_key;
    if (!apiKey) {
      return Response.json({ error: 'Google Maps API key not configured. Add it in Settings → Google Maps Platform.' }, { status: 400 });
    }

    // Fetch all pending + in_progress deliveries for this driver on this date
    const allDeliveries = await base44.asServiceRole.entities.DeliveryLog.filter({
      driver_staff_id,
      scheduled_date: date
    });

    const active = allDeliveries.filter(d => d.status === 'pending' || d.status === 'in_progress');

    if (active.length === 0) {
      return Response.json({ error: 'No active deliveries to optimise for this date.' }, { status: 400 });
    }

    if (active.length === 1) {
      // Single stop — no optimisation needed, just clear previous route data
      const d = active[0];
      await base44.asServiceRole.entities.DeliveryLog.update(d.id, {
        optimized_sequence_index: 1,
        optimized_eta: null,
        leg_duration_minutes: 0,
        leg_distance_miles: 0,
        route_optimized_at: new Date().toISOString()
      });
      return Response.json({
        optimized_count: 1,
        total_duration_minutes: 0,
        total_distance_miles: 0,
        route: [{ delivery_id: d.id, sequence: 1, address: getWaypointAddress(d) }]
      });
    }

    // Build waypoint addresses — for collections the stop is the pickup,
    // for deliveries/handovers the stop is the delivery address.
    const waypoints = active.map(d => ({
      delivery_id: d.id,
      address: getWaypointAddress(d),
      delivery: d
    }));

    // Filter out stops with no address — they can't be routed
    const routable = waypoints.filter(w => w.address && w.address.trim().length > 0);
    if (routable.length < 2) {
      return Response.json({ error: 'At least 2 deliveries with addresses are needed to optimise a route.' }, { status: 400 });
    }

    // Google Maps Directions API: origin = first stop, destination = last stop,
    // middle stops as optimisable waypoints.
    const origin = routable[0].address;
    const destination = routable[routable.length - 1].address;
    const middleWaypoints = routable.slice(1, -1).map(w => w.address);

    const directionsUrl = new URL('https://maps.googleapis.com/maps/api/directions/json');
    directionsUrl.searchParams.set('origin', origin);
    directionsUrl.searchParams.set('destination', destination);
    directionsUrl.searchParams.set('key', apiKey);
    directionsUrl.searchParams.set('departure_time', 'now');
    directionsUrl.searchParams.set('traffic_model', 'best_guess');
    if (middleWaypoints.length > 0) {
      directionsUrl.searchParams.set('waypoints', `optimize:true|${middleWaypoints.join('|')}`);
    }

    const mapsRes = await fetch(directionsUrl.toString());
    const mapsData = await mapsRes.json();

    if (mapsData.status !== 'OK') {
      return Response.json({
        error: `Google Maps API error: ${mapsData.status} — ${mapsData.error_message || 'check your API key and enabled APIs (Directions API required)'}`
      }, { status: 502 });
    }

    const route = mapsData.routes[0];
    const waypointOrder = route.waypoint_order || []; // indices into middleWaypoints

    // Reconstruct the full optimised order:
    // [origin (index 0), ...reordered middle waypoints, destination (last)]
    const orderedIndices = [0];
    for (const wpIdx of waypointOrder) {
      orderedIndices.push(wpIdx + 1); // +1 because middleWaypoints starts at routable[1]
    }
    orderedIndices.push(routable.length - 1);

    // Build the ordered route with leg data
    const legs = route.legs || [];
    const now = new Date();
    // Start time: the provided start_time, or current time if it's already later, or 08:00 if early morning
    const [sh, sm] = (start_time || '08:00').split(':').map(Number);
    const todayStart = new Date(date + 'T00:00:00');
    todayStart.setHours(sh, sm, 0, 0);
    const startTime = now > todayStart ? now : todayStart;

    let cumulativeMinutes = 0;
    let cumulativeMiles = 0;
    const updates = [];
    const routeResult = [];

    for (let i = 0; i < orderedIndices.length; i++) {
      const routableIdx = orderedIndices[i];
      const wp = routable[routableIdx];
      const leg = legs[i]; // leg[i] is the leg FROM stop i TO stop i+1... actually legs[i] goes from stop i to stop i+1

      // The leg arriving AT this stop is legs[i-1] (for i > 0)
      let legDurationMin = 0;
      let legDistanceMi = 0;
      if (i > 0 && legs[i - 1]) {
        // Use traffic-aware duration if available, else static
        const durationSec = (legs[i - 1].duration_in_traffic?.value) || legs[i - 1].duration?.value || 0;
        legDurationMin = Math.round(durationSec / 60);
        legDistanceMi = Math.round((legs[i - 1].distance?.value || 0) / 1609.34 * 10) / 10;
        cumulativeMinutes += legDurationMin;
        cumulativeMiles += legDistanceMi;
      }

      const eta = new Date(startTime.getTime() + cumulativeMinutes * 60000);

      updates.push({
        id: wp.delivery_id,
        optimized_sequence_index: i + 1,
        optimized_eta: eta.toISOString(),
        leg_duration_minutes: legDurationMin,
        leg_distance_miles: legDistanceMi,
        route_optimized_at: new Date().toISOString()
      });

      routeResult.push({
        delivery_id: wp.delivery_id,
        sequence: i + 1,
        address: wp.address,
        job_name: wp.delivery.job_name,
        delivery_type: wp.delivery.delivery_type,
        eta: eta.toISOString(),
        leg_duration_minutes: legDurationMin,
        leg_distance_miles: legDistanceMi
      });
    }

    // Also clear route data on any non-routable deliveries (no address)
    const unroutable = active.filter(d => {
      const addr = getWaypointAddress(d);
      return !addr || addr.trim().length === 0;
    });
    for (const d of unroutable) {
      updates.push({
        id: d.id,
        optimized_sequence_index: null,
        optimized_eta: null,
        leg_duration_minutes: null,
        leg_distance_miles: null,
        route_optimized_at: new Date().toISOString()
      });
    }

    await base44.asServiceRole.entities.DeliveryLog.bulkUpdate(updates);

    return Response.json({
      optimized_count: routable.length,
      total_duration_minutes: Math.round(cumulativeMinutes),
      total_distance_miles: Math.round(cumulativeMiles * 10) / 10,
      route: routeResult
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

function getWaypointAddress(delivery) {
  if (delivery.delivery_type === 'supplier_collection') {
    return delivery.pickup_address || '';
  }
  return delivery.delivery_address || '';
}