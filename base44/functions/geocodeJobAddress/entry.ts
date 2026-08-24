import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { geocodeAddress } from '../../shared/ukGeocoder.ts';

/**
 * geocodeJobAddress — returns accurate lat/lng for a UK job address.
 * Used by the job wizard's "Auto-fill" geocode button.
 *
 * Payload: { address: string }
 * Returns: { lat, lng, source } or { error } (404 when nothing resolves).
 */
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const address = typeof body?.address === 'string' ? body.address.trim() : '';
    if (!address) return Response.json({ error: 'Address is required' }, { status: 400 });

    const result = await geocodeAddress(address);
    if (!result) return Response.json({ error: 'Could not geocode this address' }, { status: 404 });

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}