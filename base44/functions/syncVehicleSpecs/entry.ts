import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getAppSettingValue } from '../../shared/appSettings.ts';

const DVLA_VES_URL = 'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles';
const DVLA_VES_UAT_URL = 'https://uat.driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles';

/**
 * Syncs vehicle specification data (make, year, fuel type, colour, MOT expiry)
 * by looking up each vehicle's registration number via the official DVLA
 * Vehicle Enquiry Service (VES) API — the authoritative UK source of truth.
 *
 * Requires a DVLA VES API key stored in an AppSetting record (key: 'dvla_ves_config').
 * Register at https://developer-portal.driver-vehicle-licensing.api.gov.uk/
 *
 * Batch mode: processes a small batch per call (default 3) and returns progress.
 * The frontend calls repeatedly until `done` is true. This avoids timeouts
 * on published site (no waitUntil/background processing needed).
 *
 * Payload:
 *   { vehicle_id?: string,   // single-vehicle synchronous mode
 *     offset?: number,       // start index (default 0)
 *     batch_size?: number,   // vehicles per call (default 3)
 *     geotab_only?: boolean,  // only look up Geotab-synced vehicles (default false)
 *     force?: boolean,       // overwrite even a later existing MOT (default false)
 *     test_mode?: boolean }  // use the DVLA UAT/test endpoint (default false)
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({})) as any;
    const batchSize = Math.min(Number(body?.batch_size) || 3, 5);
    const offset = Number(body?.offset) || 0;
    const singleVehicleId = body?.vehicle_id || null;
    const geotabOnly = body?.geotab_only === true;
    const force = body?.force === true;
    const testMode = body?.test_mode === true;

    // Read the DVLA API key from AppSetting
    const config = await getAppSettingValue(base44, 'dvla_ves_config', {});
    const apiKey = config?.api_key;
    if (!apiKey) {
      return Response.json({
        ok: false,
        error: 'DVLA VES API key not configured. Add it in Settings → Integrations Hub → DVLA Vehicle Enquiry.',
      }, { status: 400 });
    }

    // Single-vehicle mode: synchronous, returns results
    if (singleVehicleId) {
      const vehicle = await base44.asServiceRole.entities.Vehicle.get(singleVehicleId);
      if (!vehicle?.registration_number) {
        return Response.json({ ok: false, error: 'No registration number' }, { status: 400 });
      }
      const result = await lookupAndSync(base44, vehicle, apiKey, force, testMode);
      return Response.json({ ok: true, result, done: true });
    }

    // Batch mode — process N vehicles starting from offset
    const allVehicles = await base44.asServiceRole.entities.Vehicle.list('-created_date', 500);
    const withReg = allVehicles.filter((v: any) => {
      if (!v.registration_number) return false;
      if (geotabOnly && v.geotab_sync_status !== 'synced' && !v.geotab_device_id) return false;
      return true;
    });
    const batch = withReg.slice(offset, offset + batchSize);

    const results: any[] = [];
    for (const vehicle of batch) {
      try {
        const r = await lookupAndSync(base44, vehicle, apiKey, force, testMode);
        results.push({ reg: r.reg, ok: true, updated: r.updated, notFound: r.notFound });
      } catch (e: any) {
        results.push({ reg: vehicle.registration_number, ok: false, error: e.message });
      }
    }

    const newOffset = offset + batch.length;
    const remaining = Math.max(0, withReg.length - newOffset);
    const successCount = results.filter(r => r.ok).length;

    return Response.json({
      ok: true,
      processed: results.length,
      success: successCount,
      offset: newOffset,
      remaining,
      total: withReg.length,
      done: remaining === 0,
      results,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

function titleCase(s: string): string {
  if (!s) return s;
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function mapFuelType(dvlaFuel: string): string {
  if (!dvlaFuel) return 'unknown';
  const f = dvlaFuel.toUpperCase();
  if (f.includes('HYBRID')) return 'hybrid';
  if (f.includes('ELECTRIC')) return 'electric';
  if (f.includes('PETROL')) return 'petrol';
  if (f.includes('DIESEL')) return 'diesel';
  if (f.includes('LPG')) return 'lpg';
  if (f.includes('CNG')) return 'cng';
  return 'unknown';
}

/**
 * Looks up a single vehicle by registration via the DVLA VES API and updates the record.
 * DVLA is the authoritative source for make, year, fuel type, colour and MOT expiry.
 * The DVLA VES API does NOT return model — model is never overwritten here.
 */
async function lookupAndSync(base44: any, vehicle: any, apiKey: string, force: boolean, testMode: boolean): Promise<any> {
  const reg = vehicle.registration_number.replace(/\s+/g, '').toUpperCase();
  const url = testMode ? DVLA_VES_UAT_URL : DVLA_VES_URL;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ registrationNumber: reg }),
  });

  if (res.status === 404) {
    // Vehicle not found in DVLA — skip without failing the batch
    return { reg, updated: [], make: null, fuelType: null, colour: null, motExpiry: null, motStatus: 'not_found', year: null, notFound: true };
  }

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`DVLA API ${res.status}: ${errBody.slice(0, 200)}`);
  }

  const data = await res.json() as any;

  const make = data.make ? titleCase(data.make) : null;
  const year = data.yearOfManufacture || null;
  const fuelType = mapFuelType(data.fuelType);
  const colour = data.colour ? titleCase(data.colour) : null;
  const motStatus = data.motStatus || null; // "Valid" | "Not valid" | "No details held by DVLA" | "No results returned"
  let motExpiry = data.motExpiryDate || null;

  // Only accept MOT expiry if DVLA confirms the MOT is Valid and the date is in the future
  const todayStr = new Date().toISOString().slice(0, 10);
  let motValid = false;
  if (motExpiry && /^\d{4}-\d{2}-\d{2}$/.test(motExpiry)) {
    if (motStatus === 'Valid' && motExpiry > todayStr) {
      motValid = true;
    } else {
      motExpiry = null;
    }
  } else {
    motExpiry = null;
  }

  // DVLA is the authoritative source — always update make/fuel/colour/year.
  // Model is NOT returned by DVLA, so we never touch it.
  const update: any = {};
  if (make) update.make = make;
  if (fuelType && fuelType !== 'unknown') update.fuel_type = fuelType;
  if (colour) update.color = colour;
  if (year) update.year = year;
  if (motValid && motExpiry) {
    // Don't overwrite a later existing MOT with an earlier one unless forced
    if (force || !vehicle.mot_expiry || motExpiry > vehicle.mot_expiry) {
      update.mot_expiry = motExpiry;
    }
  }
  // Successful DVLA lookup = high confidence (authoritative source)
  update.spec_lookup_confidence = 'high';

  if (Object.keys(update).length > 0) {
    await base44.asServiceRole.entities.Vehicle.update(vehicle.id, update);
  }

  // Record MOT history when we have a valid future MOT that differs from existing
  if (motValid && motExpiry && motExpiry !== vehicle.mot_expiry) {
    try {
      const existing = await base44.asServiceRole.entities.VehicleMOTHistory.filter({
        vehicle_id: vehicle.id,
        expiry_date: motExpiry,
      });
      if (existing.length === 0) {
        await base44.entities.VehicleMOTHistory.create({
          vehicle_id: vehicle.id,
          registration_number: reg,
          test_date: new Date().toISOString().slice(0, 10),
          result: 'pass',
          expiry_date: motExpiry,
          source: 'dvla_lookup',
        });
      }
    } catch (_) { /* don't fail the sync if history recording fails */ }
  }

  return { reg, updated: Object.keys(update), make, fuelType, colour, motExpiry, motStatus, year, notFound: false };
}