import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getAppSettingValue } from '../../shared/appSettings.ts';

const DVLA_VES_URL = 'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles';
const DVLA_VES_UAT_URL = 'https://uat.driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles';
const DVLA_MOT_HISTORY_URL = 'https://history-mot.api.gov.uk/v1/trade/vehicles/registration';

/**
 * Syncs vehicle specification data by looking up each vehicle's registration
 * number against a configurable vehicle data provider.
 *
 * Supports two providers (selected in Settings → Integrations Hub):
 *
 * 1. "rapidapi" — Any RapidAPI vehicle data endpoint. The user provides:
 *    - api_key      → x-rapidapi-key header
 *    - request_url  → full URL with {reg} placeholder (e.g. https://...?reg={reg})
 *    - host         → x-rapidapi-host header (auto-derived from request_url if blank)
 *    The response is mapped flexibly to handle common UK vehicle data API shapes
 *    (flat fields, nested mot/tax objects, or arrays).
 *
 * 2. "dvla" — Official DVLA Vehicle Enquiry Service + MOT History Service.
 *    Requires DVLA-issued API keys (currently closed to new registrations).
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
 *     include_mot_history?: boolean, // DVLA only — call the MOT History API too
 *     test_mode?: boolean }   // DVLA only — use the UAT/test VES endpoint
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

    // Read the vehicle data API config from AppSetting
    const config = await getAppSettingValue(base44, 'dvla_ves_config', {});
    const provider = (config.provider || 'rapidapi').toLowerCase();

    if (provider === 'rapidapi') {
      if (!config.api_key || !config.request_url) {
        return Response.json({
          ok: false,
          error: 'Vehicle Data API not configured. Add your RapidAPI key and request URL in Settings → Integrations Hub → Vehicle Data API.',
        }, { status: 400 });
      }
    } else {
      // DVLA provider
      if (!config.api_key) {
        return Response.json({
          ok: false,
          error: 'DVLA VES API key not configured. Add it in Settings → Integrations Hub → Vehicle Data API.',
        }, { status: 400 });
      }
    }

    // Single-vehicle mode: synchronous, returns results
    if (singleVehicleId) {
      const vehicle = await base44.asServiceRole.entities.Vehicle.get(singleVehicleId);
      if (!vehicle?.registration_number) {
        return Response.json({ ok: false, error: 'No registration number' }, { status: 400 });
      }
      const result = provider === 'rapidapi'
        ? await lookupRapidAPI(base44, vehicle, config, force)
        : await lookupDvla(base44, vehicle, config, force, testMode, includeMotHistory);
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
        const r = provider === 'rapidapi'
          ? await lookupRapidAPI(base44, vehicle, config, force)
          : await lookupDvla(base44, vehicle, config, force, testMode, includeMotHistory);
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

/** Case-insensitive lookup of a value on an object by any of the given key names.
 *  Handles APIs that return PascalCase (Make, MotStatus), camelCase (make, motStatus),
 *  or snake_case (mot_status) — all without the caller listing every variant. */
function getField(obj: any, ...keys: string[]): any {
  if (!obj || typeof obj !== 'object') return null;
  const lower = keys.map(k => k.toLowerCase());
  for (const k of Object.keys(obj)) {
    if (lower.includes(k.toLowerCase())) return obj[k];
  }
  return null;
}

/** Safely extracts a date string and normalises to ISO YYYY-MM-DD. */
function normaliseDate(val: any): string | null {
  if (!val) return null;
  const s = String(val);
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // DVLA dot format
  const dot = motDateToIso(s);
  if (dot) return dot;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

// ─────────────────────────────────────────────────────────────────────
// RapidAPI provider — flexible lookup for any RapidAPI vehicle data endpoint
// ─────────────────────────────────────────────────────────────────────

/**
 * Looks up a single vehicle via a configurable RapidAPI endpoint.
 * The request_url contains a {reg} placeholder which is replaced with the
 * registration number. Headers x-rapidapi-key and x-rapidapi-host are added.
 * The response is mapped flexibly to handle common UK vehicle data API shapes.
 */
async function lookupRapidAPI(base44: any, vehicle: any, config: any, force: boolean): Promise<any> {
  const reg = vehicle.registration_number.replace(/\s+/g, '').toUpperCase();

  // Build the URL — replace {reg} placeholder if present
  let url = (config.request_url || '').trim();
  if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
  const hasRegPlaceholder = url.includes('{reg}');
  if (!hasRegPlaceholder && config.method !== 'POST') {
    // GET with no placeholder — append registration as a query param
    url += (url.includes('?') ? '&' : '?') + 'registration={reg}';
  }
  url = url.replace('{reg}', encodeURIComponent(reg));

  // Derive host from the URL if not explicitly set
  let host = config.host;
  if (!host) {
    try { host = new URL(url).host; } catch (_) { host = ''; }
  }

  const headers: Record<string, string> = {
    'x-rapidapi-key': config.api_key,
  };
  if (host) headers['x-rapidapi-host'] = host;

  // POST APIs (e.g. UK Vehicle Data) send the VRM in a JSON body.
  const method = (config.method || 'GET').toUpperCase();
  const fetchOpts: any = { method, headers };
  if (method === 'POST') {
    headers['Content-Type'] = 'application/json';
    const bodyTpl = config.body_template || '{"vrm": "{reg}"}';
    fetchOpts.body = bodyTpl.replace('{reg}', reg);
  }

  const res = await fetch(url, fetchOpts);

  if (res.status === 404) {
    const update: any = {
      mot_status: 'not_found',
      tax_status: 'not_found',
      spec_lookup_confidence: 'low',
      last_dvla_sync: new Date().toISOString(),
    };
    await base44.asServiceRole.entities.Vehicle.update(vehicle.id, update);
    return { reg, updated: Object.keys(update), make: null, model: null, motTests: 0, notFound: true };
  }

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${errBody.slice(0, 200)}`);
  }

  const raw = await res.json() as any;
  // Some APIs wrap the data in an array or a nested object — unwrap it.
  // UK Vehicle Data wraps in { data: { ... } }; others return flat or arrays.
  let data: any = raw;
  if (Array.isArray(raw)) {
    data = raw[0];
  } else if (raw && typeof raw === 'object') {
    // Look for the first object-valued property that looks like vehicle data
    // (contains a make/model/registration-ish field), falling back to raw.data.
    const wrapperKeys = ['data', 'vehicle', 'result', 'items', 'response'];
    for (const wk of wrapperKeys) {
      const inner = raw[wk];
      if (Array.isArray(inner)) { data = inner[0]; break; }
      if (inner && typeof inner === 'object') { data = inner; break; }
    }
  }

  const update: any = { last_dvla_sync: new Date().toISOString() };

  // ── Map fields (case-insensitive — handles PascalCase, camelCase, snake_case) ──
  const make = getField(data, 'make', 'manufacturer', 'makeName');
  if (make) update.make = titleCase(String(make));

  const model = getField(data, 'model', 'modelName', 'modelVariant', 'derivative');
  if (model) update.model = titleCase(String(model));

  const year = getField(data, 'year', 'yearOfManufacture', 'registrationYear', 'manufactureYear');
  if (year) update.year = Number(year);

  const fuel = getField(data, 'fuelType', 'fuel', 'fuelTypeDescription');
  if (fuel) update.fuel_type = mapFuelType(String(fuel));

  const colour = getField(data, 'colour', 'color');
  if (colour) update.color = titleCase(String(colour));

  const engineCap = getField(data, 'engineCapacity', 'engineCc', 'cc', 'cubicCapacity');
  if (engineCap) update.engine_capacity_cc = Number(engineCap);

  const co2 = getField(data, 'co2Emissions', 'co2', 'emissions', 'co2Emission');
  if (co2) update.co2_emissions_g_km = Number(co2);

  // MOT — could be flat or nested in a mot/MOT object
  const motObj = getField(data, 'mot', 'MOT') || {};
  const motStatusRaw = getField(data, 'motStatus', 'mot_status') || getField(motObj, 'status', 'motStatus');
  const motExpiryRaw = getField(data, 'motExpiryDate', 'mot_expiry', 'motExpiry', 'motDueDate')
    || getField(motObj, 'expiryDate', 'expiry', 'dueDate');
  if (motStatusRaw) update.mot_status = mapMotStatus(String(motStatusRaw));
  const motExpiry = normaliseDate(motExpiryRaw);
  if (motExpiry) {
    const todayStr = new Date().toISOString().slice(0, 10);
    if (force || !vehicle.mot_expiry || motExpiry > vehicle.mot_expiry) {
      update.mot_expiry = motExpiry;
    }
    if (!update.mot_status) update.mot_status = motExpiry > todayStr ? 'valid' : 'not_valid';
  }

  // Tax — could be flat or nested in a tax object
  const taxObj = getField(data, 'tax', 'ved') || {};
  const taxStatusRaw = getField(data, 'taxStatus', 'tax_status', 'vedStatus')
    || getField(taxObj, 'status', 'taxStatus');
  const taxDueRaw = getField(data, 'taxDueDate', 'tax_due_date', 'taxDue', 'vedDueDate')
    || getField(taxObj, 'dueDate', 'due');
  if (taxStatusRaw) update.tax_status = mapTaxStatus(String(taxStatusRaw));
  const taxDue = normaliseDate(taxDueRaw);
  if (taxDue && /^\d{4}-\d{2}-\d{2}$/.test(taxDue)) update.tax_due_date = taxDue;

  // First used / registration date
  const firstUsed = getField(data, 'firstUsedDate', 'first_used_date', 'firstRegistrationDate', 'dateOfFirstRegistration', 'firstRegDate');
  const firstUsedIso = normaliseDate(firstUsed);
  if (firstUsedIso) update.first_used_date = firstUsedIso;

  // Mileage / odometer
  const odometer = getField(data, 'odometer', 'mileage', 'currentMileage', 'odometerValue', 'odometerReading');
  if (odometer && !isNaN(Number(odometer))) {
    const odo = Number(odometer);
    if (!vehicle.current_mileage || odo > vehicle.current_mileage) {
      update.current_mileage = odo;
    }
  }

  // Vehicle type / body
  const vType = getField(data, 'vehicleType', 'type', 'bodyType', 'bodyStyle', 'vehicleClass');
  if (vType) update.vehicle_type = String(vType);

  // VIN / chassis (some APIs return it)
  const vin = getField(data, 'vin', 'chassisNumber', 'chassis');
  if (vin && !vehicle.vin) update.vin = String(vin).toUpperCase();

  // ── MOT test history (if the API returns it) ──
  let motTestsRecorded = 0;
  const motTests = getField(data, 'motTests', 'motHistory', 'MOTTests', 'motTestList') || getField(motObj, 'tests', 'history');
  if (Array.isArray(motTests)) {
    for (const test of motTests) {
      try {
        const testNumber = getField(test, 'motTestNumber', 'testNumber', 'testNumberFull');
        const completedDate = normaliseDate(getField(test, 'completedDate', 'testDate', 'date', 'completedDate'));
        if (!completedDate) continue;
        const dedupQuery: any = { vehicle_id: vehicle.id, test_date: completedDate };
        if (testNumber) dedupQuery.test_number = testNumber;
        const existing = await base44.asServiceRole.entities.VehicleMOTHistory.filter(dedupQuery);
        if (existing.length > 0) continue;

        const result = mapTestResult(getField(test, 'testResult', 'result', 'status'));
        const testOdo = getField(test, 'odometerValue', 'odometer', 'mileage', 'odometerReading');
        const expiryDate = normaliseDate(getField(test, 'motTestExpiryDate', 'expiryDate', 'expiryDateTest'));

        let advisoryNotes = '';
        const rfrs = getField(test, 'rfrAndAdvisoryDetails', 'advisories', 'advisoryNotes', 'reasonsForFailure', 'defects');
        if (Array.isArray(rfrs) && rfrs.length > 0) {
          advisoryNotes = rfrs
            .map((rfr: any) => typeof rfr === 'string' ? rfr : `${getField(rfr, 'rfrType', 'type') || 'NOTE'}: ${getField(rfr, 'rfrDesc', 'description') || ''}`.trim())
            .filter((s: string) => s)
            .join(' | ');
        }

        await base44.entities.VehicleMOTHistory.create({
          vehicle_id: vehicle.id,
          registration_number: reg,
          test_date: completedDate,
          result,
          expiry_date: expiryDate,
          odometer: testOdo && !isNaN(Number(testOdo)) ? Number(testOdo) : null,
          test_number: testNumber,
          advisory_notes: advisoryNotes || undefined,
          source: 'dvla_lookup',
        });
        motTestsRecorded++;
      } catch (_) { /* skip individual test failures */ }
    }
  }

  update.spec_lookup_confidence = 'high';

  await base44.asServiceRole.entities.Vehicle.update(vehicle.id, update);

  return {
    reg,
    updated: Object.keys(update),
    make: update.make || null,
    model: update.model || null,
    motTests: motTestsRecorded,
    notFound: false,
  };
}

// ─────────────────────────────────────────────────────────────────────
// DVLA provider — official DVLA VES + MOT History (existing logic preserved)
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

  // --- 1. VES lookup (specs + tax + MOT status) ---
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
        if (motData.model) {
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
    make,
    model: modelFromHistory,
    motTests: motTestsRecorded,
    notFound: false,
  };
}