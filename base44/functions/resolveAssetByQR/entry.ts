import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { resolveAssetByQR } from '../../shared/assetPandaLookup.ts';

/**
 * Resolve a scanned QR code to a live asset record.
 * Tries Asset Panda first (live source of truth), falls back to the local
 * SiteAsset database if Panda is unconfigured, unreachable, or has no match.
 *
 * Payload: { scan: string }
 * Returns: { asset, source: 'panda'|'local'|'none', created, updated, live, warning }
 *
 * Any authenticated user can call this — field staff need it to scan gear.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const scan = body?.scan;
    if (!scan || typeof scan !== 'string') {
      return Response.json({ error: 'scan is required' }, { status: 400 });
    }

    const result = await resolveAssetByQR(base44, scan);
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});