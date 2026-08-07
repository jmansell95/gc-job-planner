import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { generatePredictions } from '../../shared/predictMaintenance.ts';

// ============================================================
// predictMaintenance — predicts upcoming vehicle maintenance
// needs using mileage trends, MOT history, service history, and
// breakdown frequency. Returns a ranked risk list.
// ============================================================
// Payload: { vehicle_id?: string }

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const result = await generatePredictions(base44, body.vehicle_id);

    return Response.json({ ok: true, ...result });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ error: msg }, { status: 500 });
  }
}