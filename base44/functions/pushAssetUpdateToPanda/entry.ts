import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { pushAssetUpdateToPanda } from '../../shared/assetPandaPush.ts';

/**
 * Pushes a SiteAsset change back to Asset Panda.
 * Payload: { asset_id: string, action: 'create' | 'update' }
 *  - 'create' = new asset added on-site → POST a new object to Asset Panda
 *  - 'update' = service/repair/status change → PUT update to the existing object
 * Requires admin auth. Returns { success, panda_id?, error? }.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json();
    const asset_id = body?.asset_id;
    const action = body?.action === 'create' ? 'create' : 'update';

    if (!asset_id) return Response.json({ error: 'asset_id is required' }, { status: 400 });

    const result = await pushAssetUpdateToPanda(base44, asset_id, action);

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});