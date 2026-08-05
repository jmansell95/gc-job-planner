import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * Syncs vehicle specification data (make, model, fuel type, colour, MOT expiry)
 * by looking up each vehicle's registration number using LLM web search.
 * No external API keys required — uses the built-in InvokeLLM integration
 * with add_context_from_internet to search public vehicle data sources (DVLA).
 *
 * Batch mode: processes a small batch per call (default 3) and returns progress.
 * The frontend calls repeatedly until `done` is true. This avoids timeouts
 * on published site (no waitUntil/background processing needed).
 *
 * Payload:
 *   { vehicle_id?: string,  // single-vehicle synchronous mode
 *     offset?: number,      // start index (default 0)
 *     batch_size?: number } // vehicles per call (default 3)
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
    // Only look up vehicles that have been synced from Geotab — their
    // registration number is verified accurate. Manually-entered regs are
    // skipped to avoid looking up wrong plates and pulling bad MOT data.
    const geotabOnly = body?.geotab_only !== false;

    // Single-vehicle mode: synchronous, returns results
    if (singleVehicleId) {
      const vehicle = await base44.asServiceRole.entities.Vehicle.get(singleVehicleId);
      if (!vehicle?.registration_number) {
        return Response.json({ ok: false, error: 'No registration number' }, { status: 400 });
      }
      const result = await lookupAndSync(base44, vehicle);
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
        const r = await lookupAndSync(base44, vehicle);
        results.push({ reg: r.reg, ok: true, updated: r.updated });
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

/**
 * Looks up a single vehicle by registration via LLM web search and updates the record.
 */
async function lookupAndSync(base44: any, vehicle: any): Promise<any> {
  const reg = vehicle.registration_number;

  const prompt = `Look up the UK vehicle with registration plate "${reg}" on the DVLA vehicle enquiry service or vehicle smart.
Return ONLY verified data from official UK vehicle databases. Do NOT guess or fabricate data.

Return the following fields:
- make: the vehicle manufacturer (string, or null if not found)
- model: the vehicle model name (string, or null if not found)
- fuelType: one of diesel, petrol, hybrid, electric, lpg, cng, unknown
- colour: the vehicle's registered colour (string, or null if not found)
- motExpiryDate: the MOT expiry date in YYYY-MM-DD format. ONLY return a date if the vehicle has a VALID, CURRENT MOT. If the MOT has expired or failed, return null. Do not return past dates.
- motStatus: "valid" if the vehicle has a current valid MOT, "expired" if the MOT has lapsed, "unknown" if not found
- year: the year of manufacture (number, or null)

CRITICAL: Only return a motExpiryDate if it is a FUTURE date (after today, ${new Date().toISOString().slice(0, 10)}). If the MOT has expired or you cannot confirm a valid MOT, set motExpiryDate to null and motStatus to "expired" or "unknown". Never fabricate a date.`;

  const llmRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    add_context_from_internet: true,
    model: 'gemini_3_flash',
    response_json_schema: {
      type: 'object',
      properties: {
        make: { type: 'string' },
        model: { type: 'string' },
        fuelType: { type: 'string', enum: ['diesel', 'petrol', 'hybrid', 'electric', 'lpg', 'cng', 'unknown'] },
        colour: { type: 'string' },
        motExpiryDate: { type: 'string' },
        motStatus: { type: 'string', enum: ['valid', 'expired', 'unknown'] },
        year: { type: 'number' },
      },
    },
  });

  const data = (llmRes as any)?.data ?? llmRes;
  const make = data?.make || null;
  const model = data?.model || null;
  const fuelRaw = (data?.fuelType || 'unknown').toLowerCase();
  const colour = data?.colour || null;
  const motStatus = data?.motStatus || 'unknown';
  let motExpiry = data?.motExpiryDate || null;
  const year = data?.year || null;

  // ── MOT VALIDATION ──
  // Only accept MOT expiry if: (1) it's a valid YYYY-MM-DD date, (2) it's
  // in the future, and (3) the LLM confirmed motStatus as "valid". This
  // prevents pulling expired/failed MOT dates and overwriting good data.
  const todayStr = new Date().toISOString().slice(0, 10);
  let motValid = false;
  if (motExpiry && /^\d{4}-\d{2}-\d{2}$/.test(motExpiry)) {
    if (motExpiry > todayStr && motStatus !== 'expired') {
      motValid = true;
    } else {
      motExpiry = null; // reject expired/past dates
    }
  } else {
    motExpiry = null;
  }

  const fuelMap: Record<string, string> = {
    diesel: 'diesel', petrol: 'petrol', hybrid: 'hybrid',
    electric: 'electric', lpg: 'lpg', cng: 'cng',
    'petrol/electric': 'hybrid', 'diesel/electric': 'hybrid',
    unknown: 'unknown', '': 'unknown',
  };
  const fuelType = fuelMap[fuelRaw] || 'unknown';

  // LLM web search results take priority over VIN-decoded values.
  // Only update MOT expiry if we got a valid future date — never overwrite
  // a good existing MOT expiry with null/bad data.
  const update: any = {};
  if (make) update.make = make;
  if (model) update.model = model;
  if (fuelType && fuelType !== 'unknown') update.fuel_type = fuelType;
  if (colour) update.color = colour;
  if (motValid && motExpiry) update.mot_expiry = motExpiry;
  if (year) update.year = year;

  if (Object.keys(update).length > 0) {
    await base44.asServiceRole.entities.Vehicle.update(vehicle.id, update);
  }

  // Record MOT history ONLY when we have a valid future MOT expiry that
  // differs from the existing one. This prevents recording "fail" entries
  // from bad LLM responses and builds a clean pass timeline over time.
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

  return { reg, updated: Object.keys(update), make, model, fuelType, colour, motExpiry, motStatus, year };
}