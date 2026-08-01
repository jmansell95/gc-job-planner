import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// syncGeotabFleet — pulls live vehicle locations from the
// Geotab API and stores them as VehicleLocationLog entries.
// ============================================================
// Geotab uses a JSON-RPC API. Authentication:
//   POST https://<server>.geotab.com/apiv1
//   { method: "Authenticate", params: { username, password, database } }
//   → returns credentials { sessionId, userName, database }
//
// Then GetFeed with typeName "DeviceStatusInfo" returns current
// vehicle status (lat, lng, speed, ignition, odometer).
//
// Config is stored in AppSetting key 'geotab_config':
//   { server, username, password, database, webhook_secret,
//     sync_enabled, auto_sync_enabled, last_sync_at, ... }
//
// Payload: { action: "test" | "sync" | "scheduled" }

interface GeotabCredentials {
  sessionId: string;
  userName: string;
  database: string;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== 'admin') {
      return Response.json({ ok: false, error: 'Forbidden — admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'sync';

    // Load config
    const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: 'geotab_config' });
    const cfg = settings[0]?.value || {};

    if (action === 'scheduled' && cfg.auto_sync_enabled === false) {
      return Response.json({ ok: true, skipped: true, reason: 'geotab auto-sync disabled' });
    }

    if (!cfg.username || !cfg.password || !cfg.database) {
      return Response.json({ ok: false, error: 'Geotab credentials not configured. Add them in Settings → Geotab GPS Sync.' });
    }

    const server = cfg.server || 'my.geotab.com';
    const apiUrl = `https://${server.replace(/^https?:\/\//, '')}/apiv1`;

    // ── Authenticate with Geotab ──
    const authRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'Authenticate',
        params: {
          username: cfg.username,
          password: cfg.password,
          database: cfg.database,
        },
      }),
    }).catch(() => null);

    if (!authRes || !authRes.ok) {
      const errText = authRes ? await authRes.text().catch(() => '') : 'Network error';
      return Response.json({ ok: false, error: `Geotab authentication failed: ${errText.slice(0, 200)}` });
    }

    const authJson = await authRes.json().catch(() => null);
    const creds: GeotabCredentials | null = authJson?.result;
    if (!creds || !creds.sessionId) {
      return Response.json({ ok: false, error: 'Geotab authentication returned no session. Check username, password and database.' });
    }

    if (action === 'test') {
      return Response.json({ ok: true, message: `Connected to Geotab (${cfg.database}) as ${creds.userName}. Session active.` });
    }

    // ── Fetch device list (vehicles with registration) ──
    const deviceRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'Get',
        params: {
          typeName: 'Device',
          credentials: creds,
          resultsLimit: 1000,
        },
      }),
    }).catch(() => null);

    const deviceJson = deviceRes ? await deviceRes.json().catch(() => null) : null;
    const devices: any[] = deviceJson?.result || [];

    // ── Fetch current device status (live locations) ──
    const statusRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'GetFeed',
        params: {
          typeName: 'DeviceStatusInfo',
          credentials: creds,
          resultsLimit: 1000,
        },
      }),
    }).catch(() => null);

    const statusJson = statusRes ? await statusRes.json().catch(() => null) : null;
    const statuses: any[] = statusJson?.result || [];

    // ── Match to local Vehicle records by registration ──
    const vehicles = await base44.asServiceRole.entities.Vehicle.list('-created_date', 500);
    const regMap: Record<string, any> = {};
    const geotabIdMap: Record<string, any> = {};
    for (const v of vehicles) {
      if (v.registration_number) {
        regMap[v.registration_number.toUpperCase().replace(/\s+/g, '')] = v;
      }
    }
    // Build a Geotab device ID → Vehicle map from the device list
    const deviceRegMap: Record<string, string> = {};
    for (const d of devices) {
      const vehicleId = d.id;
      const plate = (d.licensePlate || d.licenseNumber || d.serialNumber || '').toString().toUpperCase().replace(/\s+/g, '');
      if (plate) deviceRegMap[vehicleId] = plate;
    }

    let stored = 0;
    let unmatched = 0;
    const now = new Date().toISOString();

    for (const st of statuses) {
      const deviceId = st.device?.id || st.deviceId;
      const reg = deviceRegMap[deviceId] || '';
      const vehicle = reg ? regMap[reg] : null;

      const lat = Number(st.latitude ?? st.lat);
      const lng = Number(st.longitude ?? st.lng);
      if (isNaN(lat) || isNaN(lng)) continue;

      if (!vehicle) {
        unmatched++;
        continue;
      }

      await base44.asServiceRole.entities.VehicleLocationLog.create({
        vehicle_id: vehicle.id,
        registration_number: vehicle.registration_number,
        vehicle_name: vehicle.name,
        lat: Math.round(lat * 1e6) / 1e6,
        lng: Math.round(lng * 1e6) / 1e6,
        speed_kph: Number(st.speed) || 0,
        heading: Number(st.heading) || 0,
        ignition_on: st.isDriving || st.ignitionOn || false,
        odometer_km: Number(st.odometer?.meters ? st.odometer.meters / 1000 : st.odometerKm) || 0,
        driver_name: st.driver?.name || st.driverName || '',
        timestamp: st.dateTime || now,
        source: 'geotab_sync',
        geotab_device_id: deviceId || '',
      });
      stored++;
    }

    // Update sync metadata
    if (settings[0]) {
      try {
        await base44.asServiceRole.entities.AppSetting.update(settings[0].id, {
          value: {
            ...cfg,
            last_sync_at: now,
            last_sync_status: 'ok',
            last_sync_summary: `${stored} locations synced, ${unmatched} unmatched`,
          },
        });
      } catch (_) {}
    }

    return Response.json({
      ok: true,
      message: `Synced ${stored} vehicle location${stored === 1 ? '' : 's'} from Geotab${unmatched > 0 ? ` (${unmatched} unmatched)` : ''}.`,
      synced: stored,
      unmatched,
      total_devices: devices.length,
      total_statuses: statuses.length,
    });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}