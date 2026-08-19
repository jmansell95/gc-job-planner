import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { pushAssetUpdateToPanda } from '../../shared/assetPandaPush.ts';

// ---------------------------------------------------------------------------
// pushAllToAssetPanda — batch push of all locally-changed SiteAssets back to
// Asset Panda. Selects assets whose sync_status is not 'synced' OR whose
// updated_date is newer than their last_sync_timestamp, then pushes each one
// (create or update) via the shared pushAssetUpdateToPanda helper.
//
// Processes in batches to respect serverless execution limits. Returns a
// summary { pushed, created, updated, failed, errors[] }.
//
// Admin only.
// ---------------------------------------------------------------------------
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    // Load candidate assets: anything not synced, or updated since last sync.
    // Pull a generous window then filter in-memory to catch both conditions.
    const candidates = await base44.asServiceRole.entities.SiteAsset.list('-updated_date', 500);

    const needsPush = (a: any) => {
      if (a.sync_status && a.sync_status !== 'synced') return true;
      if (a.updated_date && a.last_sync_timestamp) {
        return new Date(a.updated_date).getTime() > new Date(a.last_sync_timestamp).getTime();
      }
      // Never synced but has been created/edited locally
      if (!a.last_sync_timestamp && a.panda_asset_id) return true;
      return false;
    };

    const queue = (candidates || []).filter(needsPush);

    let pushed = 0, created = 0, updated = 0, failed = 0;
    const errors: string[] = [];

    // Batch in groups of 25 to stay within execution time limits.
    const BATCH = 25;
    for (let i = 0; i < queue.length; i += BATCH) {
      const slice = queue.slice(i, i + BATCH);
      await Promise.all(slice.map(async (asset: any) => {
        try {
          const action = asset.panda_asset_id ? 'update' : 'create';
          const result = await pushAssetUpdateToPanda(base44, asset.id, action);
          if (result?.success) {
            pushed++;
            if (action === 'create') created++; else updated++;
          } else if (result?.attempted === false) {
            // Not a hard failure (e.g. no group configured for this asset) — skip quietly
          } else {
            failed++;
            errors.push(`${asset.name || asset.id}: ${result?.error || 'push failed'}`);
          }
        } catch (e: any) {
          failed++;
          errors.push(`${asset.name || asset.id}: ${e.message}`);
        }
      }));
    }

    return Response.json({
      success: true,
      pushed,
      created,
      updated,
      failed,
      errors: errors.length > 0 ? errors.slice(0, 20) : undefined,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}