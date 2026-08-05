import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// syncGeotabFleet — pulls live vehicle locations AND full
// vehicle details (make, model, VIN, year, fuel type) from the
// Geotab API. Auto-creates Vehicle records for any Geotab
// device that doesn't match an existing local record, and
// updates the details on matched records.
// ============================================================
// Geotab uses a JSON-RPC API. Authentication:
//   POST https://<server>.geotab.com/apiv1
//   { method: "Authenticate", params: { username, password, database } }
//   → returns credentials { sessionId, userName, database }
//
// Device (typeName: "Device") — the vehicle record in Geotab:
//   { id, name, licensePlate, vehicleIdentificationNumber,
//     serialNumber, comment, vehicleType: {id}, ... }
//
// VehicleType (typeName: "VehicleType") — make/model/year info:
//   { id, name, make, model, year, fuelType, ... }
//
// DeviceStatusInfo — live GPS position for a device.
//
// Config is stored in AppSetting key 'geotab_config'.

interface GeotabCredentials {
  sessionId: string;
  userName: string;
  database: string;
}

function normalizeReg(reg: string): string {
  return (reg || '').toString().toUpperCase().replace(/\s+/g, '');
}

function mapFuelType(raw: string | number | undefined): string {
  if (raw === undefined || raw === null) return 'unknown';
  const s = String(raw).toLowerCase();
  if (s.includes('diesel')) return 'diesel';
  if (s.includes('petrol') || s.includes('gasoline')) return 'petrol';
  if (s.includes('hybrid')) return 'hybrid';
  if (s.includes('electric') || s.includes('ev')) return 'electric';
  if (s.includes('lpg')) return 'lpg';
  if (s.includes('cng')) return 'cng';
  return 'unknown';
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
    // Geotab's API uses "userName" (camelCase), NOT "username".
    // The server can be auto-discovered: if authentication against the default
    // server fails with IncorrectServerException, Geotab returns the correct
    // server name in the error data. We retry against that server automatically.
    const serverHint = cfg.server || 'my.geotab.com';

    async function authenticate(server: string): Promise<{ creds?: GeotabCredentials; error?: string; redirectServer?: string }> {
      const url = `https://${server.replace(/^https?:\/\//, '')}/apiv1`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'Authenticate',
          params: {
            userName: cfg.username,
            password: cfg.password,
            database: cfg.database,
          },
        }),
      }).catch(() => null);

      if (!res || !res.ok) {
        const errText = res ? await res.text().catch(() => '') : 'Network error';
        return { error: `Geotab authentication failed: ${errText.slice(0, 200)}` };
      }

      const json = await res.json().catch(() => null);
      if (json?.error) {
        const errMsg = json.error.message || JSON.stringify(json.error);
        // IncorrectServerException → Geotab tells us the correct server
        if (json.error.data?.errors?.some((e: any) => e.name === 'IncorrectServerException') || /IncorrectServer/i.test(errMsg)) {
          // The correct server is sometimes in the error message or data
          const redirect = json.error.data?.path || '';
          if (redirect) return { error: errMsg, redirectServer: redirect };
        }
        return { error: errMsg };
      }
      // Geotab's Authenticate returns a LoginResult: { credentials: { sessionId, database, userName }, path }
      // The "credentials" nested object is what we pass to subsequent API calls.
      const loginResult = json?.result;
      const creds: GeotabCredentials | null = loginResult?.credentials || null;
      if (!creds || !creds.sessionId) {
        return { error: 'Authentication returned no session. Check username, password and database.' };
      }
      return { creds };
    }

    let authResult = await authenticate(serverHint);

    // If the server was wrong and Geotab returned a redirect, retry on the correct server
    if (!authResult.creds && authResult.redirectServer && authResult.redirectServer !== serverHint) {
      authResult = await authenticate(authResult.redirectServer);
      // If the redirect worked, persist the correct server so future syncs skip the redirect
      if (authResult.creds && settings[0]) {
        try {
          await base44.asServiceRole.entities.AppSetting.update(settings[0].id, {
            value: { ...cfg, server: authResult.redirectServer },
          });
        } catch (_) {}
      }
    }

    if (!authResult.creds) {
      return Response.json({ ok: false, error: authResult.error || 'Geotab authentication failed' });
    }
    const creds: GeotabCredentials = authResult.creds;

    if (action === 'test') {
      return Response.json({ ok: true, message: `Connected to Geotab (${cfg.database}) as ${creds.userName}. Session active.` });
    }

    // ── Fetch device list (vehicles with registration, VIN, etc.) ──
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
    const devices: any[] = Array.isArray(deviceJson?.result) ? deviceJson.result : [];

    // ── Fetch VehicleType entities (make, model, year, fuel type) ──
    const vehicleTypeIds = new Set<string>();
    for (const d of devices) {
      if (d.vehicleType?.id) vehicleTypeIds.add(d.vehicleType.id);
    }
    const vehicleTypeMap: Record<string, any> = {};
    if (vehicleTypeIds.size > 0) {
      const vtRes = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'Get',
          params: {
            typeName: 'VehicleType',
            credentials: creds,
            resultsLimit: 1000,
          },
        }),
      }).catch(() => null);
      const vtJson = vtRes ? await vtRes.json().catch(() => null) : null;
      const vtList: any[] = Array.isArray(vtJson?.result) ? vtJson.result : [];
      for (const vt of vtList) {
        vehicleTypeMap[vt.id] = vt;
      }
    }

    // ── Fetch current device status (live locations) ──
    // Use "Get" (not "GetFeed") for current-state queries — GetFeed is for
    // checkpointed change streams and returns a different wrapper structure.
    const statusRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'Get',
        params: {
          typeName: 'DeviceStatusInfo',
          credentials: creds,
          resultsLimit: 1000,
        },
      }),
    }).catch(() => null);

    const statusJson = statusRes ? await statusRes.json().catch(() => null) : null;
    const statuses: any[] = Array.isArray(statusJson?.result) ? statusJson.result : [];

    // ── Load local vehicles and build lookup maps ──
    const vehicles = await base44.asServiceRole.entities.Vehicle.list('-created_date', 500);
    const regMap: Record<string, any> = {};
    const geotabIdMap: Record<string, any> = {};
    const vinMap: Record<string, any> = {};
    for (const v of vehicles) {
      if (v.registration_number) regMap[normalizeReg(v.registration_number)] = v;
      if (v.geotab_device_id) geotabIdMap[v.geotab_device_id] = v;
      if (v.vin) vinMap[v.vin.toUpperCase()] = v;
    }

    const now = new Date().toISOString();
    let vehiclesCreated = 0;
    let vehiclesUpdated = 0;
    const deviceRegMap: Record<string, string> = {};
    const deviceVehicleMap: Record<string, any> = {};

    // ── Sync vehicle details (create/update Vehicle records) ──
    for (const d of devices) {
      const deviceId = d.id;
      const reg = normalizeReg(d.licensePlate || d.licenseNumber || '');
      const vin = (d.vehicleIdentificationNumber || '').toString().trim();
      const vt = d.vehicleType?.id ? vehicleTypeMap[d.vehicleType.id] : null;

      deviceRegMap[deviceId] = reg;

      // Try to match: by geotab_device_id, then by reg, then by VIN
      let vehicle = geotabIdMap[deviceId] || (reg ? regMap[reg] : null) || (vin ? vinMap[vin.toUpperCase()] : null);

      const detailUpdate: any = {
        geotab_device_id: deviceId,
        geotab_device_serial: d.serialNumber || '',
        geotab_sync_status: 'synced',
        last_geotab_sync: now,
      };

      // Pull details from Geotab Device + VehicleType
      if (vt) {
        if (vt.make) detailUpdate.make = vt.make;
        if (vt.model) detailUpdate.model = vt.model;
        if (vt.year) detailUpdate.year = Number(vt.year) || undefined;
        if (vt.fuelType !== undefined) detailUpdate.fuel_type = mapFuelType(vt.fuelType);
        if (vt.name) detailUpdate.vehicle_type = vt.name;
      }
      if (vin) detailUpdate.vin = vin;
      // Use Geotab device name as the vehicle name if local name is empty or generic
      if (d.name && (!vehicle || !vehicle.name)) {
        detailUpdate.name = d.name;
      }
      // If reg is present on Geotab but missing locally, fill it
      if (reg && (!vehicle || !vehicle.registration_number)) {
        detailUpdate.registration_number = d.licensePlate || d.licenseNumber || '';
      }

      if (!vehicle) {
        // Auto-create a new Vehicle record from this Geotab device
        const createPayload: any = {
          name: d.name || reg || `Geotab Vehicle ${deviceId.slice(0, 8)}`,
          registration_number: d.licensePlate || d.licenseNumber || reg || '',
          geotab_device_id: deviceId,
          geotab_device_serial: d.serialNumber || '',
          geotab_sync_status: 'synced',
          last_geotab_sync: now,
        };
        if (vin) createPayload.vin = vin;
        if (vt) {
          if (vt.make) createPayload.make = vt.make;
          if (vt.model) createPayload.model = vt.model;
          if (vt.year) createPayload.year = Number(vt.year) || undefined;
          if (vt.fuelType !== undefined) createPayload.fuel_type = mapFuelType(vt.fuelType);
          if (vt.name) createPayload.vehicle_type = vt.name;
        }
        try {
          const created = await base44.entities.Vehicle.create(createPayload);
          if (created) {
            geotabIdMap[deviceId] = created;
            if (reg) regMap[reg] = created;
            deviceVehicleMap[deviceId] = created;
            vehiclesCreated++;
          }
        } catch (_) {
          // skip creation failure
        }
      } else {
        // Update existing record with latest Geotab details
        try {
          await base44.asServiceRole.entities.Vehicle.update(vehicle.id, detailUpdate);
          // refresh maps so location sync below uses updated record
          if (reg) regMap[reg] = vehicle;
          geotabIdMap[deviceId] = vehicle;
          deviceVehicleMap[deviceId] = vehicle;
          vehiclesUpdated++;
        } catch (_) {}
      }
    }

    // ── Store live location logs ──
    let stored = 0;
    let unmatched = 0;

    for (const st of statuses) {
      const deviceId = st.device?.id || st.deviceId;
      const reg = deviceRegMap[deviceId] || '';
      const vehicle = deviceVehicleMap[deviceId] || geotabIdMap[deviceId] || (reg ? regMap[reg] : null);

      const lat = Number(st.latitude ?? st.lat);
      const lng = Number(st.longitude ?? st.lng);
      if (isNaN(lat) || isNaN(lng)) continue;

      if (!vehicle) {
        unmatched++;
        continue;
      }

      const odometerKm = Number(st.odometer?.meters ? st.odometer.meters / 1000 : st.odometerKm) || 0;

      await base44.asServiceRole.entities.VehicleLocationLog.create({
        vehicle_id: vehicle.id,
        registration_number: vehicle.registration_number,
        vehicle_name: vehicle.name,
        lat: Math.round(lat * 1e6) / 1e6,
        lng: Math.round(lng * 1e6) / 1e6,
        speed_kph: Number(st.speed) || 0,
        heading: Number(st.heading) || 0,
        ignition_on: st.isDriving || st.ignitionOn || false,
        odometer_km: odometerKm,
        driver_name: st.driver?.name || st.driverName || '',
        timestamp: st.dateTime || now,
        source: 'geotab_sync',
        geotab_device_id: deviceId || '',
      });

      // Update current_mileage on the vehicle record (km → miles)
      if (odometerKm > 0) {
        try {
          await base44.asServiceRole.entities.Vehicle.update(vehicle.id, {
            current_mileage: Math.round(odometerKm * 0.621371),
          });
        } catch (_) {}
      }
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
            last_sync_summary: `${stored} locations synced · ${vehiclesCreated} vehicles created · ${vehiclesUpdated} updated`,
          },
        });
      } catch (_) {}
    }

    return Response.json({
      ok: true,
      message: `Synced ${stored} location${stored === 1 ? '' : 's'} from Geotab · ${vehiclesCreated} new vehicle${vehiclesCreated === 1 ? '' : 's'} created · ${vehiclesUpdated} updated.`,
      synced: stored,
      unmatched,
      vehicles_created: vehiclesCreated,
      vehicles_updated: vehiclesUpdated,
      total_devices: devices.length,
      total_statuses: statuses.length,
    });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}