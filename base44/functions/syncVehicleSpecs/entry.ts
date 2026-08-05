import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { waitUntil } from 'base44:runtime';

/**
 * Syncs vehicle specification data (make, model, fuel type, colour, MOT expiry)
 * by looking up each vehicle's registration number using LLM web search.
 * No external API keys required — uses the built-in InvokeLLM integration
 * with add_context_from_internet to search public vehicle data sources (DVLA).
 *
 * Processes in the background via waitUntil so the function returns immediately.
 * Pass vehicle_id to sync a single vehicle synchronously (returns results).
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({})) as any;
    const singleVehicleId = body?.vehicle_id || null;

    // Single-vehicle mode: synchronous, returns results
    if (singleVehicleId) {
      const vehicle = await base44.asServiceRole.entities.Vehicle.get(singleVehicleId);
      if (!vehicle?.registration_number) {
        return Response.json({ ok: false, error: 'No registration number' }, { status: 400 });
      }
      const result = await lookupAndSync(base44, vehicle);
      return Response.json({ ok: true, result });
    }

    // Batch mode: kick off background processing, return immediately
    const vehicles = await base44.asServiceRole.entities.Vehicle.list('-created_date', 500);
    const withReg = vehicles.filter((v: any) => v.registration_number);

    if (withReg.length === 0) {
      return Response.json({ ok: true, message: 'No vehicles with registration numbers.', synced: 0 });
    }

    // Process in background — 3 at a time to respect LLM rate limits
    waitUntil((async () => {
      const concurrency = 3;
      let idx = 0;
      const workers = Array.from({ length: concurrency }, async () => {
        while (idx < withReg.length) {
          const i = idx++;
          try {
            await lookupAndSync(base44, withReg[i]);
          } catch (_) { /* swallow — background */ }
        }
      });
      await Promise.all(workers);
    })());

    return Response.json({
      ok: true,
      message: `Started background spec sync for ${withReg.length} vehicles. Check back in a few minutes — data will appear as vehicles are updated.`,
      total: withReg.length,
      background: true,
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

  return { reg, updated: Object.keys(update), make, model, fuelType, colour, motExpiry, year };
}