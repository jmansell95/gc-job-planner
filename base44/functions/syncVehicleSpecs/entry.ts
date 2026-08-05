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
    const withReg = allVehicles.filter((v: any) => v.registration_number);
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

  const prompt = `Look up the UK vehicle with registration plate "${reg}". 
Search for this vehicle's details on public vehicle check websites (like DVLA vehicle enquiry, vehicle smart, or similar UK vehicle databases).
Return the following information if available:
- make: the vehicle manufacturer
- model: the vehicle model name
- fuelType: the fuel type (diesel, petrol, hybrid, electric, lpg, cng)
- colour: the vehicle's registered colour
- motExpiryDate: the MOT expiry date in YYYY-MM-DD format (or null if not available)
- year: the year of manufacture (number, or null)

If you cannot find the vehicle or any specific field, return null for that field. Only return data you are confident about from the search results.`;

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
        year: { type: 'number' },
      },
    },
  });

  const data = (llmRes as any)?.data ?? llmRes;
  const make = data?.make || null;
  const model = data?.model || null;
  const fuelRaw = (data?.fuelType || 'unknown').toLowerCase();
  const colour = data?.colour || null;
  const motExpiry = data?.motExpiryDate || null;
  const year = data?.year || null;

  const fuelMap: Record<string, string> = {
    diesel: 'diesel', petrol: 'petrol', hybrid: 'hybrid',
    electric: 'electric', lpg: 'lpg', cng: 'cng',
    'petrol/electric': 'hybrid', 'diesel/electric': 'hybrid',
    unknown: 'unknown', '': 'unknown',
  };
  const fuelType = fuelMap[fuelRaw] || 'unknown';

  // LLM web search results take priority over VIN-decoded values
  const update: any = {};
  if (make) update.make = make;
  if (model) update.model = model;
  if (fuelType && fuelType !== 'unknown') update.fuel_type = fuelType;
  if (colour) update.color = colour;
  if (motExpiry) update.mot_expiry = motExpiry;
  if (year) update.year = year;

  if (Object.keys(update).length > 0) {
    await base44.asServiceRole.entities.Vehicle.update(vehicle.id, update);
  }

  // Record MOT history when a new MOT expiry is detected that differs from
  // the previous one — this builds a pass/fail timeline over time. We treat
  // a newly-discovered expiry as a "pass" (the vehicle has a valid MOT).
  if (motExpiry && motExpiry !== vehicle.mot_expiry) {
    try {
      // Check if we already have a history record for this expiry date
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

  return { reg, updated: Object.keys(update), make, model, fuelType, colour, motExpiry, year };
}