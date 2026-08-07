import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// Holman Fleet Management webhook receiver
// ============================================================
// Receives fleet events from Holman (MOT expiry, service due,
// odometer updates, vehicle status changes). Validates the shared
// webhook secret against the holman_config AppSetting, then matches
// the incoming vehicle identifier (registration or Holman fleet ID)
// to a local Vehicle record and updates MOT/service dates & mileage.

function num(v: any): number | null {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? null : n;
}

function deepGet(obj: any, ...paths: string[]): any {
  for (const p of paths) {
    const parts = p.split('.');
    let cur: any = obj;
    let ok = true;
    for (const part of parts) {
      if (cur == null || typeof cur !== 'object' || !(part in cur)) { ok = false; break; }
      cur = cur[part];
    }
    if (ok && cur != null && cur !== '') return cur;
  }
  return '';
}

function toDateStr(v: any): string | null {
  if (!v) return null;
  const s = String(v);
  // Already ISO date
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    const url = new URL(req.url);
    const secret =
      url.searchParams.get('webhook_secret') ||
      req.headers.get('x-webhook-secret') ||
      req.headers.get('x-holman-secret') ||
      '';

    // Load Holman config from AppSetting
    let config: any = null;
    try {
      const configs = await base44.asServiceRole.entities.AppSetting.filter({ key: 'holman_config' });
      config = configs && configs[0];
    } catch (e) { /* entity may not exist yet */ }

    if (!config) {
      return Response.json({ error: 'Holman is not configured.' }, { status: 422 });
    }

    const cfg = config.value || {};
    if (cfg.sync_enabled === false) {
      return Response.json({ error: 'Holman webhook is disabled.' }, { status: 403 });
    }
    if (!secret || (cfg.webhook_secret && secret !== cfg.webhook_secret)) {
      return Response.json({ error: 'Invalid webhook secret.' }, { status: 401 });
    }

    const body = await req.json();

    // Extract common vehicle identifiers — Holman payloads vary by event type
    const registration = String(deepGet(body, 'registration', 'registration_number', 'vehicle.registration', 'vehicle.plate', 'vrn', 'license_plate') || '').toUpperCase().replace(/\s/g, '');
    const holmanId = String(deepGet(body, 'vehicle_id', 'fleet_id', 'holman_id', 'vehicle.id', 'vehicle.fleet_id', 'asset_id') || '');
    const vin = String(deepGet(body, 'vin', 'vehicle.vin', 'chassis_number') || '');

    // Extract fleet event data
    const eventType = String(deepGet(body, 'event_type', 'type', 'event', 'action') || '').toLowerCase();
    const motExpiry = toDateStr(deepGet(body, 'mot_expiry', 'mot_expiry_date', 'vehicle.mot_expiry', 'mot.due_date', 'next_mot_date'));
    const serviceDue = toDateStr(deepGet(body, 'service_due', 'service_due_date', 'vehicle.service_due', 'next_service_date', 'service.next_due'));
    const lastService = toDateStr(deepGet(body, 'last_service_date', 'service_completed', 'last_service', 'service.last_completed'));
    const mileage = num(deepGet(body, 'mileage', 'odometer', 'vehicle.mileage', 'odometer_reading', 'current_mileage'));
    const vehicleStatus = String(deepGet(body, 'status', 'vehicle.status', 'fleet_status') || '');
    const driverName = String(deepGet(body, 'driver_name', 'driver.name', 'assigned_driver', 'vehicle.driver') || '');

    if (!registration && !holmanId && !vin) {
      return Response.json({ error: 'No vehicle identifier found in payload (registration, vehicle_id, or vin required).' }, { status: 422 });
    }

    // Match a local Vehicle record by registration, Holman ID, or VIN
    let vehicle: any = null;
    const allVehicles = await base44.asServiceRole.entities.Vehicle.list('-created_date', 500);

    if (registration) {
      vehicle = allVehicles.find((v: any) =>
        (v.registration_number || '').toUpperCase().replace(/\s/g, '') === registration
      );
    }
    if (!vehicle && holmanId) {
      vehicle = allVehicles.find((v: any) => v.holman_vehicle_id === holmanId);
    }
    if (!vehicle && vin) {
      vehicle = allVehicles.find((v: any) => v.vin === vin);
    }

    if (!vehicle) {
      // Update config with last webhook summary (unmatched)
      try {
        await base44.asServiceRole.entities.AppSetting.update(config.id, {
          value: {
            ...cfg,
            last_webhook_at: new Date().toISOString(),
            last_webhook_status: 'unmatched',
            last_webhook_summary: `Unmatched vehicle: ${registration || holmanId || vin}`,
          },
        });
      } catch (e) { /* non-fatal */ }
      return Response.json({ status: 'unmatched', message: `No local vehicle found for ${registration || holmanId || vin}.` });
    }

    // Build update payload from event data
    const update: any = {
      last_holman_sync: new Date().toISOString(),
      holman_sync_status: 'synced',
    };
    if (holmanId) update.holman_vehicle_id = holmanId;
    if (vin) update.vin = vin;
    if (motExpiry) {
      update.mot_expiry = motExpiry;
      // Derive mot_status from the expiry date so stale DVLA-era values
      // don't contradict the current Holman MOT data.
      const today = new Date().toISOString().slice(0, 10);
      update.mot_status = motExpiry >= today ? 'valid' : 'not_valid';
    }
    if (serviceDue) update.service_due_date = serviceDue;
    if (lastService) update.last_service_date = lastService;
    if (mileage != null) update.current_mileage = mileage;

    await base44.asServiceRole.entities.Vehicle.update(vehicle.id, update);

    // If the event looks like a maintenance booking (MOT, service, breakdown,
    // windscreen, repair, inspection, appointment), auto-create a
    // VehicleMaintenanceBooking so it shows on the admin Vehicles page under
    // this registration — same as a staff phone booking.
    const bookingKeywords = ['mot', 'service', 'breakdown', 'windscreen', 'repair', 'inspection', 'appointment', 'booking', 'maintenance_due'];
    const looksLikeBooking = bookingKeywords.some(k => eventType.includes(k)) ||
      !!deepGet(body, 'booking_date', 'appointment_date', 'next_service_date', 'next_mot_date', 'service.next_due', 'mot.due_date');

    if (looksLikeBooking) {
      try {
        const d = new Date();
        const todayStr = d.toISOString().slice(0, 10);
        const bookingDateStr = toDateStr(deepGet(body, 'booking_date', 'appointment_date', 'next_mot_date', 'next_service_date', 'mot.due_date', 'service.next_due')) || todayStr;
        let bookingType = 'other';
        if (eventType.includes('mot')) bookingType = 'mot';
        else if (eventType.includes('windscreen') || eventType.includes('glass')) bookingType = 'windscreen';
        else if (eventType.includes('breakdown') || eventType.includes('recovery')) bookingType = 'breakdown';
        else if (eventType.includes('service')) bookingType = 'service';
        else if (eventType.includes('repair')) bookingType = 'repair';
        else if (eventType.includes('inspection')) bookingType = 'inspection';

        await base44.asServiceRole.entities.VehicleMaintenanceBooking.create({
          vehicle_id: vehicle.id,
          vehicle_name: `${vehicle.name} (${vehicle.registration_number})`,
          booking_type: bookingType,
          status: 'booked',
          booking_date: bookingDateStr,
          supplier_name: 'Holman',
          supplier_phone: '0344 800 5626',
          notes: `Auto-created from Holman webhook event: ${eventType || 'maintenance'}`,
          reported_at: new Date().toISOString(),
          report_source: 'holman_sync',
        });
      } catch (e) { /* non-fatal — vehicle was still updated */ }
    }

    // Update config status
    const summary = `${eventType || 'Event'} for ${vehicle.name} (${vehicle.registration_number})${motExpiry ? ` · MOT: ${motExpiry}` : ''}${serviceDue ? ` · Service: ${serviceDue}` : ''}${mileage != null ? ` · ${mileage} mi` : ''}`;
    try {
      await base44.asServiceRole.entities.AppSetting.update(config.id, {
        value: {
          ...cfg,
          last_webhook_at: new Date().toISOString(),
          last_webhook_status: 'success',
          last_webhook_summary: summary,
        },
      });
    } catch (e) { /* non-fatal */ }

    return Response.json({
      status: 'success',
      vehicle_id: vehicle.id,
      vehicle_name: vehicle.name,
      registration: vehicle.registration_number,
      updated_fields: Object.keys(update).filter(k => k !== 'last_holman_sync' && k !== 'holman_sync_status'),
    });
  } catch (error) {
    // Record failure on the config if reachable
    try {
      const base44 = createClientFromRequest(req);
      const configs = await base44.asServiceRole.entities.AppSetting.filter({ key: 'holman_config' });
      if (configs && configs[0]) {
        const cfg = configs[0].value || {};
        await base44.asServiceRole.entities.AppSetting.update(configs[0].id, {
          value: {
            ...cfg,
            last_webhook_at: new Date().toISOString(),
            last_webhook_status: 'failed',
            last_webhook_summary: 'Error: ' + (error.message || 'Unknown'),
          },
        });
      }
    } catch (e) { /* swallow */ }
    return Response.json({ error: error.message }, { status: 500 });
  }
}