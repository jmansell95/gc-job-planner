import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getAppSettingValue } from '../../shared/appSettings.ts';

const DVLA_VES_URL = 'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles';
const DVLA_VES_UAT_URL = 'https://uat.driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles';
const DVLA_MOT_HISTORY_URL = 'https://history-mot.api.gov.uk/v1/trade/vehicles/registration';

/**
 * Syncs vehicle specification data by looking up each vehicle's registration
 * number against two official DVLA APIs — the authoritative UK source of truth.
 *
 * 1. Vehicle Enquiry Service (VES) — returns make, year, fuel type, colour,
 *    MOT status/expiry, tax status/due date, engine capacity, CO2 emissions.
 *    NOTE: VES does NOT return the model name.
 *
 * 2. MOT History Service — returns the full MOT test history (every test with
 *    pass/fail/PRS result, odometer reading, advisory & failure notes) AND the
 *    model name (which VES lacks). This populates the VehicleMOTHistory entity.
 *
 * Both APIs use the registration number as the lookup key — exactly like the
 * public "check MOT and tax" service on the DVLA website.
 *
 * Requires DVLA API keys stored in an AppSetting record (key: 'dvla_ves_config'):
 *   - api_key            → VES API key (x-api-key header)
 *   - mot_history_api_key → MOT History API key (x-api-key header, separate key)
 *
 * Batch mode: processes a small batch per call (default 3) and returns progress.
 * The frontend calls repeatedly until `done` is true. This avoids timeouts on
 * the published site (no waitUntil/background processing needed).
 *
 * Payload:
 *   { vehicle_id?: string,    // single-vehicle synchronous mode
 *     offset?: number,        // start index (default 0)
 *     batch_size?: number,    // vehicles per call (default 3, max 5)
 *     geotab_only?: boolean,  // only look up Geotab-synced vehicles (default false)
 *     force?: boolean,        // overwrite even a later existing MOT (default false)
 *     include_mot_history?: boolean, // call the MOT History API too (default true)
 *     test_mode?: boolean }   // use the DVLA UAT/test VES endpoint (default false)
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
    const includeMotHistory = body?.include_mot_history !== false; // default true
    const testMode = body?.test_mode === true;

    // Read the DVLA API keys from AppSetting
    const config = await getAppSettingValue(base44, 'dvla_ves_config', {});
    const vesApiKey = config?.api_key;
    const motHistoryApiKey = config?.mot_history_api_key;
    if (!vesApiKey) {
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
      const result = await lookupAndSync(base44, vehicle, vesApiKey, motHistoryApiKey, force, testMode, includeMotHistory);
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
        const r = await lookupAndSync(base44, vehicle, vesApiKey, motHistoryApiKey, force, testMode, includeMotHistory);
        results.push({ reg: r.reg, ok: true, updated: r.updated, notFound: r.notFound, motTests: r.motTests, model: r.model });
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

function mapMotStatus(dvlaMotStatus: string): string {
  if (!dvlaMotStatus) return 'unknown';
  const s = dvlaMotStatus.toLowerCase();
  if (s.includes('valid')) return 'valid';
  if (s.includes('not valid')) return 'not_valid';
  if (s.includes('no details')) return 'no_details';
  if (s.includes('no results')) return 'no_details';
  return 'unknown';
}

function mapTaxStatus(dvlaTaxStatus: string): string {
  if (!dvlaTaxStatus) return 'unknown';
  const s = dvlaTaxStatus.toLowerCase();
  if (s.includes('sorn')) return 'sorn';
  if (s.includes('taxed') || s.includes('valid')) return 'taxed';
  if (s.includes('untaxed') || s.includes('not taxed')) return 'untaxed';
  return 'unknown';
}

/** Converts a DVLA MOT History date "2025.01.19" → ISO "2025-01-19". */
function motDateToIso(dotDate: string): string | null {
  if (!dotDate) return null;
  const m = dotDate.match(/^(\d{4})\.(\d{2})\.(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // Already ISO or another format — try a direct parse
  const d = new Date(dotDate);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function mapTestResult(dvlaResult: string): string {
  if (!dvlaResult) return 'unknown';
  const r = dvlaResult.toUpperCase();
  if (r === 'PASSED') return 'pass';
  if (r === 'FAILED') return 'fail';
  if (r === 'PRS') return 'prs';
  return 'unknown';
}

/**
 * Looks up a single vehicle by registration via the DVLA VES API (specs + tax)
 * and the DVLA MOT History API (full test history + model), then updates the record.
 * DVLA is the authoritative source for make, year, fuel type, colour, MOT & tax.
 */
async function lookupAndSync(
  base44: any,
  vehicle: any,
  vesApiKey: string,
  motHistoryApiKey: string | null,
  force: boolean,
  testMode: boolean,
  includeMotHistory: boolean,
): Promise<any> {
  const reg = vehicle.registration_number.replace(/\s+/g, '').toUpperCase();
  const vesUrl = testMode ? DVLA_VES_UAT_URL : DVLA_VES_URL;

  // --- 1. VES lookup (specs + tax + MOT status) ---
  const vesRes = await fetch(vesUrl, {
    method: 'POST',
    headers: {
      'x-api-key': vesApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ registrationNumber: reg }),
  });

  let motTestsRecorded = 0;
  let modelFromHistory: string | null = null;

  if (vesRes.status === 404) {
    // Vehicle not found in DVLA — mark as not found but still try MOT history if we have a key
    const update: any = {
      mot_status: 'not_found',
      tax_status: 'not_found',
      spec_lookup_confidence: 'low',
      last_dvla_sync: new Date().toISOString(),
    };
    await base44.asServiceRole.entities.Vehicle.update(vehicle.id, update);
    return { reg, updated: Object.keys(update), make: null, fuelType: null, colour: null, motExpiry: null, motStatus: 'not_found', taxStatus: 'not_found', year: null, model: null, motTests: 0, notFound: true };
  }

  if (!vesRes.ok) {
    const errBody = await vesRes.text().catch(() => '');
    throw new Error(`DVLA VES API ${vesRes.status}: ${errBody.slice(0, 200)}`);
  }

  const vesData = await vesRes.json() as any;

  const make = vesData.make ? titleCase(vesData.make) : null;
  const year = vesData.yearOfManufacture || null;
  const fuelType = mapFuelType(vesData.fuelType);
  const colour = vesData.colour ? titleCase(vesData.colour) : null;
  const motStatus = mapMotStatus(vesData.motStatus);
  const taxStatus = mapTaxStatus(vesData.taxStatus);
  let motExpiry = vesData.motExpiryDate || null;
  const taxDueDate = vesData.taxDueDate || null;
  const engineCapacity = vesData.engineCapacity ? Number(vesData.engineCapacity) : null;
  const co2Emissions = vesData.co2Emissions ? Number(vesData.co2Emissions) : null;

  // Only accept MOT expiry if DVLA confirms the MOT is Valid and the date is in the future
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

  // DVLA is the authoritative source — always update make/fuel/colour/year/tax.
  // Model is NOT returned by VES — we pull it from the MOT History API below.
  const update: any = { last_dvla_sync: new Date().toISOString() };
  if (make) update.make = make;
  if (fuelType && fuelType !== 'unknown') update.fuel_type = fuelType;
  if (colour) update.color = colour;
  if (year) update.year = year;
  update.mot_status = motStatus;
  update.tax_status = taxStatus;
  if (taxDueDate && /^\d{4}-\d{2}-\d{2}$/.test(taxDueDate)) update.tax_due_date = taxDueDate;
  if (engineCapacity) update.engine_capacity_cc = engineCapacity;
  if (co2Emissions) update.co2_emissions_g_km = co2Emissions;
  if (motValid && motExpiry) {
    if (force || !vehicle.mot_expiry || motExpiry > vehicle.mot_expiry) {
      update.mot_expiry = motExpiry;
    }
  }
  // Successful DVLA VES lookup = high confidence (authoritative source)
  update.spec_lookup_confidence = 'high';

  // --- 2. MOT History lookup (full test history + model) ---
  if (includeMotHistory && motHistoryApiKey) {
    try {
      const motRes = await fetch(`${DVLA_MOT_HISTORY_URL}/${reg}`, {
        method: 'GET',
        headers: { 'x-api-key': motHistoryApiKey },
      });
      if (motRes.ok) {
        const motData = await motRes.json() as any;
        // MOT History API returns the model (VES does not)
        if (motData.model) {
          modelFromHistory = titleCase(motData.model);
          update.model = modelFromHistory;
        }
        if (motData.firstUsedDate) {
          const firstUsed = motDateToIso(motData.firstUsedDate);
          if (firstUsed) update.first_used_date = firstUsed;
        }
        // Use the MOT History expiry date as a fallback if VES didn't give a valid one
        if (!motValid && motData.motTestExpiryDate) {
          const histExpiry = motDateToIso(motData.motTestExpiryDate);
          if (histExpiry && (force || !vehicle.mot_expiry || histExpiry > vehicle.mot_expiry)) {
            update.mot_expiry = histExpiry;
            update.mot_status = histExpiry > todayStr ? 'valid' : 'not_valid';
          }
        }
        // Record every MOT test into VehicleMOTHistory (de-duplicated by test number)
        if (Array.isArray(motData.motTests)) {
          for (const test of motData.motTests) {
            try {
              const testNumber = test.motTestNumber || null;
              const completedDate = motDateToIso(test.completedDate);
              if (!completedDate) continue;
              // De-duplicate: skip if we already have this test (by test_number or date+result)
              const dedupQuery: any = { vehicle_id: vehicle.id, test_date: completedDate };
              if (testNumber) dedupQuery.test_number = testNumber;
              const existing = await base44.asServiceRole.entities.VehicleMOTHistory.filter(dedupQuery);
              if (existing.length > 0) continue;

              const result = mapTestResult(test.testResult);
              const odometer = test.odometerValue ? Number(test.odometerValue) : null;
              const expiryDate = motDateToIso(test.motTestExpiryDate);

              // Build advisory / failure notes from rfrAndAdvisoryDetails
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

              // Update current_mileage from the most recent test with an odometer reading
              if (odometer && !isNaN(odometer) && (!vehicle.current_mileage || odometer > vehicle.current_mileage)) {
                update.current_mileage = odometer;
              }
            } catch (_) { /* don't fail the whole sync if one test record fails */ }
          }
        }
      } else if (motRes.status !== 404) {
        // Log but don't fail — MOT history is a bonus on top of VES
        console.warn(`MOT History API ${motRes.status} for ${reg}`);
      }
    } catch (e) {
      // MOT history failure should not fail the VES sync
      console.warn(`MOT History lookup failed for ${reg}: ${e.message}`);
    }
  }

  if (Object.keys(update).length > 1 || update.last_dvla_sync) {
    await base44.asServiceRole.entities.Vehicle.update(vehicle.id, update);
  }

  return {
    reg,
    updated: Object.keys(update),
    make,
    fuelType,
    colour,
    motExpiry: update.mot_expiry || motExpiry,
    motStatus: update.mot_status || motStatus,
    taxStatus,
    taxDueDate,
    year,
    model: modelFromHistory,
    motTests: motTestsRecorded,
    notFound: false,
  };
}