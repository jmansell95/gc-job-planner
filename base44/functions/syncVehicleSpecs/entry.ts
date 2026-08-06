import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getAppSettingValue } from '../../shared/appSettings.ts';

const DVLA_VES_URL = 'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles';
const DVLA_VES_UAT_URL = 'https://uat.driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles';
const DVLA_MOT_HISTORY_URL = 'https://history-mot.api.gov.uk/v1/trade/vehicles/registration';

/**
 * Syncs vehicle compliance data (MOT status, tax status, MOT history, colour,
 * emissions) by looking up each vehicle's registration number against the
 * official DVLA Vehicle Enquiry Service and MOT History API.
 *
 * Vehicle specs (make, model, year, fuel type, vehicle type) are pulled from
 * Geotab during the Geotab fleet sync — this function does NOT overwrite
 * those fields. DVLA is the authority for MOT, tax, colour, engine capacity,
 * CO2 emissions, and first used date only.
 *
 * Batch mode: processes a small batch per call (default 3) and returns progress.
 * The frontend calls repeatedly until `done` is true.
 *
 * Payload:
 *   { vehicle_id?: string,    // single-vehicle synchronous mode
 *     offset?: number,        // start index (default 0)
 *     batch_size?: number,    // vehicles per call (default 3, max 5)
 *     geotab_only?: boolean,  // only look up Geotab-synced vehicles (default false)
 *     force?: boolean,        // overwrite even a later existing MOT (default false)
 *     include_mot_history?: boolean, // call the MOT History API too
 *     test_mode?: boolean }   // use the UAT/test VES endpoint
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
    const includeMotHistory = body?.include_mot_history !== false;
    const testMode = body?.test_mode === true;

    // Read the DVLA API config from AppSetting
    const config = await getAppSettingValue(base44, 'dvla_ves_config', {});

    if (!config.api_key) {
      return Response.json({
        ok: false,
        error: 'DVLA VES API key not configured. Add it in Settings → Integrations Hub → Vehicle Data API.',
      }, { status: 400 });
    }

    // Single-vehicle mode: synchronous, returns results
    if (singleVehicleId) {
      const vehicle = await base44.asServiceRole.entities.Vehicle.get(singleVehicleId);
      if (!vehicle?.registration_number) {
        return Response.json({ ok: false, error: 'No registration number' }, { status: 400 });
      }
      const result = await lookupDvla(base44, vehicle, config, force, testMode, includeMotHistory);
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
        const r = await lookupDvla(base44, vehicle, config, force, testMode, includeMotHistory);
        results.push({
          reg: r.reg, ok: true, updated: r.updated, notFound: r.notFound,
          motTests: r.motTests, model: r.model, make: r.make,
        });
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

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function titleCase(s: string): string {
  if (!s) return s;
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function mapMotStatus(status: string): string {
  if (!status) return 'unknown';
  const s = status.toLowerCase();
  if (s.includes('valid') || s.includes('pass')) return 'valid';
  if (s.includes('not valid') || s.includes('fail') || s.includes('expired')) return 'not_valid';
  if (s.includes('no details') || s.includes('no results')) return 'no_details';
  return 'unknown';
}

function mapTaxStatus(status: string): string {
  if (!status) return 'unknown';
  const s = status.toLowerCase();
  if (s.includes('sorn')) return 'sorn';
  if (s.includes('taxed') || s.includes('valid')) return 'taxed';
  if (s.includes('untaxed') || s.includes('not taxed') || s.includes('expired')) return 'untaxed';
  return 'unknown';
}

function mapTestResult(result: string): string {
  if (!result) return 'unknown';
  const r = result.toUpperCase();
  if (r === 'PASSED' || r === 'PASS') return 'pass';
  if (r === 'FAILED' || r === 'FAIL') return 'fail';
  if (r === 'PRS') return 'prs';
  if (r.includes('ADVISORY')) return 'advisory';
  return 'unknown';
}

/** Converts a DVLA MOT History date "2025.01.19" → ISO "2025-01-19". */
function motDateToIso(dotDate: string): string | null {
  if (!dotDate) return null;
  const m = dotDate.match(/^(\d{4})\.(\d{2})\.(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(dotDate);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

// ─────────────────────────────────────────────────────────────────────
// DVLA lookup — official DVLA VES + MOT History
// ─────────────────────────────────────────────────────────────────────

async function lookupDvla(
  base44: any,
  vehicle: any,
  config: any,
  force: boolean,
  testMode: boolean,
  includeMotHistory: boolean,
): Promise<any> {
  const vesApiKey = config.api_key;
  const motHistoryApiKey = config.mot_history_api_key;
  const reg = vehicle.registration_number.replace(/\s+/g, '').toUpperCase();
  const vesUrl = testMode ? DVLA_VES_UAT_URL : DVLA_VES_URL;

  // --- 1. VES lookup (tax + MOT status + colour + emissions) ---
  const vesRes = await fetch(vesUrl, {
    method: 'POST',
    headers: { 'x-api-key': vesApiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ registrationNumber: reg }),
  });

  let motTestsRecorded = 0;
  let modelFromHistory: string | null = null;

  if (vesRes.status === 404) {
    const update: any = {
      mot_status: 'not_found',
      tax_status: 'not_found',
      spec_lookup_confidence: 'low',
      last_dvla_sync: new Date().toISOString(),
    };
    await base44.asServiceRole.entities.Vehicle.update(vehicle.id, update);
    return { reg, updated: Object.keys(update), make: null, model: null, motTests: 0, notFound: true };
  }

  if (!vesRes.ok) {
    const errBody = await vesRes.text().catch(() => '');
    throw new Error(`DVLA VES API ${vesRes.status}: ${errBody.slice(0, 200)}`);
  }

  const vesData = await vesRes.json() as any;

  const colour = vesData.colour ? titleCase(vesData.colour) : null;
  const motStatus = mapMotStatus(vesData.motStatus);
  const taxStatus = mapTaxStatus(vesData.taxStatus);
  let motExpiry = vesData.motExpiryDate || null;
  const taxDueDate = vesData.taxDueDate || null;
  const engineCapacity = vesData.engineCapacity ? Number(vesData.engineCapacity) : null;
  const co2Emissions = vesData.co2Emissions ? Number(vesData.co2Emissions) : null;

  const todayStr = new Date().toISOString().slice(0, 10);
  let motValid = false;
  if (motExpiry && /^\d{4}-\d{2}-\d{2}$/.test(motExpiry)) {
    if (motStatus === 'valid' && motExpiry > todayStr) {
      motValid = true;
    } else {
      motExpiry = null;
    }
  } else {
    motExpiry = null;
  }

  const update: any = { last_dvla_sync: new Date().toISOString() };

  // DVLA is the authority for colour, emissions, engine capacity
  if (colour) update.color = colour;
  if (engineCapacity) update.engine_capacity_cc = engineCapacity;
  if (co2Emissions) update.co2_emissions_g_km = co2Emissions;

  // MOT + tax status
  update.mot_status = motStatus;
  update.tax_status = taxStatus;
  if (taxDueDate && /^\d{4}-\d{2}-\d{2}$/.test(taxDueDate)) update.tax_due_date = taxDueDate;
  if (motValid && motExpiry) {
    if (force || !vehicle.mot_expiry || motExpiry > vehicle.mot_expiry) {
      update.mot_expiry = motExpiry;
    }
  }

  // Make, year, fuel type — only as a fallback for vehicles without Geotab.
  // Geotab is the authoritative source for these (see syncGeotabFleet).
  if (vesData.make && !vehicle.make) update.make = titleCase(vesData.make);
  if (vesData.yearOfManufacture && !vehicle.year) update.year = Number(vesData.yearOfManufacture);
  const fuelType = mapFuelType(vesData.fuelType);
  if (fuelType !== 'unknown' && (vehicle.fuel_type === 'unknown' || !vehicle.fuel_type)) {
    update.fuel_type = fuelType;
  }

  update.spec_lookup_confidence = 'high';

  // --- 2. MOT History lookup (full test history + model + first used date) ---
  if (includeMotHistory && motHistoryApiKey) {
    try {
      const motRes = await fetch(`${DVLA_MOT_HISTORY_URL}/${reg}`, {
        method: 'GET',
        headers: { 'x-api-key': motHistoryApiKey },
      });
      if (motRes.ok) {
        const motData = await motRes.json() as any;
        // Model — only as a fallback (Geotab is authoritative)
        if (motData.model && !vehicle.model) {
          modelFromHistory = titleCase(motData.model);
          update.model = modelFromHistory;
        }
        if (motData.firstUsedDate) {
          const firstUsed = motDateToIso(motData.firstUsedDate);
          if (firstUsed) update.first_used_date = firstUsed;
        }
        if (!motValid && motData.motTestExpiryDate) {
          const histExpiry = motDateToIso(motData.motTestExpiryDate);
          if (histExpiry && (force || !vehicle.mot_expiry || histExpiry > vehicle.mot_expiry)) {
            update.mot_expiry = histExpiry;
            update.mot_status = histExpiry > todayStr ? 'valid' : 'not_valid';
          }
        }
        if (Array.isArray(motData.motTests)) {
          for (const test of motData.motTests) {
            try {
              const testNumber = test.motTestNumber || null;
              const completedDate = motDateToIso(test.completedDate);
              if (!completedDate) continue;
              const dedupQuery: any = { vehicle_id: vehicle.id, test_date: completedDate };
              if (testNumber) dedupQuery.test_number = testNumber;
              const existing = await base44.asServiceRole.entities.VehicleMOTHistory.filter(dedupQuery);
              if (existing.length > 0) continue;

              const result = mapTestResult(test.testResult);
              const odometer = test.odometerValue ? Number(test.odometerValue) : null;
              const expiryDate = motDateToIso(test.motTestExpiryDate);

              let advisoryNotes = '';
              if (Array.isArray(test.rfrAndAdvisoryDetails) && test.rfrAndAdvisoryDetails.length > 0) {
                advisoryNotes = test.rfrAndAdvisoryDetails
                  .map((rfr: any) => `${rfr.rfrType || 'NOTE'}: ${rfr.rfrDesc || ''}`.trim())
                  .filter((s: string) => s)
                  .join(' | ');
              }

              await base44.entities.VehicleMOTHistory.create({
                vehicle_id: vehicle.id,
                registration_number: reg,
                test_date: completedDate,
                result,
                expiry_date: expiryDate,
                odometer: odometer && !isNaN(odometer) ? odometer : null,
                test_number: testNumber,
                advisory_notes: advisoryNotes || undefined,
                source: 'dvla_lookup',
              });
              motTestsRecorded++;

              if (odometer && !isNaN(odometer) && (!vehicle.current_mileage || odometer > vehicle.current_mileage)) {
                update.current_mileage = odometer;
              }
            } catch (_) { /* skip individual test failures */ }
          }
        }
      } else if (motRes.status !== 404) {
        console.warn(`MOT History API ${motRes.status} for ${reg}`);
      }
    } catch (e) {
      console.warn(`MOT History lookup failed for ${reg}: ${e.message}`);
    }
  }

  if (Object.keys(update).length > 1 || update.last_dvla_sync) {
    await base44.asServiceRole.entities.Vehicle.update(vehicle.id, update);
  }

  return {
    reg,
    updated: Object.keys(update),
    make: update.make || null,
    model: modelFromHistory,
    motTests: motTestsRecorded,
    notFound: false,
  };
}

function mapFuelType(fuel: string): string {
  if (!fuel) return 'unknown';
  const f = fuel.toUpperCase();
  if (f.includes('HYBRID')) return 'hybrid';
  if (f.includes('ELECTRIC') || f.includes('EV')) return 'electric';
  if (f.includes('PETROL')) return 'petrol';
  if (f.includes('DIESEL')) return 'diesel';
  if (f.includes('LPG')) return 'lpg';
  if (f.includes('CNG')) return 'cng';
  return 'unknown';
}