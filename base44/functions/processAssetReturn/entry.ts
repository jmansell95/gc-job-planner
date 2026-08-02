import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Processes asset returns scanned by crew during decommissioning.
// - Resolves manifest QR codes to their constituent asset IDs
// - Updates JobAssetAssignment records to 'returned'
// - Updates SiteAsset stock_level to 'in_stock'
// - Creates an AssetReturnLog audit record
// - Pushes stock-level updates to Asset Panda (best-effort, non-blocking)
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { job_id, staff_id, staff_name, job_name, scanned_asset_ids, scanned_manifest_ids, notes } = body;

    if (!job_id || !staff_id) {
      return Response.json({ error: 'job_id and staff_id are required' }, { status: 400 });
    }

    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    // --- Resolve manifest IDs to their constituent asset IDs ---
    const allAssetIds = new Set(scanned_asset_ids || []);
    const scannedItems = [];
    const pandaIdsToUpdate = new Set();

    // Track individually-scanned assets
    for (const assetId of (scanned_asset_ids || [])) {
      scannedItems.push({
        asset_id: assetId,
        scan_type: 'individual',
      });
    }

    // Resolve manifests
    if (scanned_manifest_ids && scanned_manifest_ids.length > 0) {
      const manifests = await base44.entities.AssetManifest.filter({
        manifest_code: { $in: scanned_manifest_ids },
        is_active: true,
      });
      for (const manifest of manifests) {
        for (const assetId of (manifest.asset_ids || [])) {
          allAssetIds.add(assetId);
          scannedItems.push({
            asset_id: assetId,
            scan_type: 'manifest',
            manifest_id: manifest.id,
            manifest_name: manifest.name,
          });
        }
        for (const pandaId of (manifest.panda_asset_ids || [])) {
          pandaIdsToUpdate.add(pandaId);
        }
      }
    }

    // --- Fetch the actual SiteAsset records to get names + panda IDs ---
    const assetIdArray = Array.from(allAssetIds);
    let assets = [];
    if (assetIdArray.length > 0) {
      assets = await base44.entities.SiteAsset.filter({ id: { $in: assetIdArray } });
    }

    // Enrich scanned items with names and panda IDs
    const assetMap = {};
    for (const a of assets) {
      assetMap[a.id] = a;
      if (a.panda_asset_id) pandaIdsToUpdate.add(a.panda_asset_id);
    }
    for (const item of scannedItems) {
      const a = assetMap[item.asset_id];
      if (a) {
        item.asset_name = a.name;
        item.panda_asset_id = a.panda_asset_id || '';
      }
    }

    // --- Update JobAssetAssignment records to 'returned' ---
    let assignmentsUpdated = 0;
    if (assetIdArray.length > 0) {
      const assignments = await base44.entities.JobAssetAssignment.filter({
        job_id,
        asset_id: { $in: assetIdArray },
        status: { $ne: 'returned' },
      });
      if (assignments.length > 0) {
        const updates = assignments.map(a => ({
          id: a.id,
          status: 'returned',
          returned_date: today,
        }));
        await base44.entities.JobAssetAssignment.bulkUpdate(updates);
        assignmentsUpdated = assignments.length;
      }
    }

    // --- Update SiteAsset stock_level to 'in_stock' ---
    let assetsUpdated = 0;
    if (assetIdArray.length > 0) {
      const updates = assetIdArray.map(id => ({
        id,
        stock_level: 'in_stock',
        sync_status: 'pending',
      }));
      await base44.entities.SiteAsset.bulkUpdate(updates);
      assetsUpdated = assetIdArray.length;
    }

    // --- Create the AssetReturnLog audit record ---
    const returnLog = await base44.entities.AssetReturnLog.create({
      job_id,
      job_name: job_name || '',
      staff_id,
      staff_name: staff_name || '',
      return_date: today,
      returned_at: now,
      scanned_items: scannedItems,
      total_items: scannedItems.length,
      notes: notes || '',
      synced_to_panda: false,
    });

    // --- Best-effort push to Asset Panda (non-blocking) ---
    let pandaResult = { attempted: false };
    if (pandaIdsToUpdate.size > 0) {
      try {
        pandaResult = await pushToAssetPanda(base44, Array.from(pandaIdsToUpdate));
        if (pandaResult.success) {
          await base44.entities.AssetReturnLog.update(returnLog.id, {
            synced_to_panda: true,
            synced_at: new Date().toISOString(),
          });
        } else {
          await base44.entities.AssetReturnLog.update(returnLog.id, {
            sync_error: pandaResult.error || 'Unknown push error',
          });
        }
      } catch (pandaErr) {
        pandaResult = { attempted: true, success: false, error: pandaErr.message };
        await base44.entities.AssetReturnLog.update(returnLog.id, {
          sync_error: pandaErr.message,
        });
      }
    }

    return Response.json({
      success: true,
      assets_returned: assetsUpdated,
      assignments_updated: assignmentsUpdated,
      return_log_id: returnLog.id,
      panda_push: pandaResult,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// --- Push stock-level updates to Asset Panda ---
// Updates each asset's status field to 'In Stock' via the Asset Panda REST API.
async function pushToAssetPanda(base44, pandaAssetIds) {
  const configs = await base44.asServiceRole.entities.AssetPandaConfig.filter({ key: 'global' });
  const config = configs && configs[0];
  if (!config || !config.group_id) {
    return { attempted: false, reason: 'Asset Panda not configured' };
  }

  const baseUrl = (config.base_url || 'https://api.assetpanda.com').replace(/\/+$/, '');
  let token = config.api_token || '';

  if (!token && config.email && config.password) {
    const tokenRes = await fetch(`${baseUrl}/v3/session/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: config.email, password: config.password }),
    });
    if (!tokenRes.ok) return { attempted: true, success: false, error: 'Auth failed' };
    const tokenJson = await tokenRes.json();
    token = tokenJson.token || tokenJson.access_token || tokenJson.accessToken || '';
  }
  if (!token) return { attempted: false, reason: 'No token' };

  const authHeaders = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  const stockField = config.field_stock_status || '';
  let updated = 0;
  const errors = [];

  for (const pandaId of pandaAssetIds) {
    try {
      const updateBody = {};
      if (stockField) updateBody[stockField] = 'In Stock';
      const res = await fetch(`${baseUrl}/v3/groups/${config.group_id}/objects/${pandaId}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify(updateBody),
      });
      if (res.ok) updated++;
      else errors.push(`${pandaId}: HTTP ${res.status}`);
    } catch (e) {
      errors.push(`${pandaId}: ${e.message}`);
    }
  }

  // Cache the token for the next sync run
  if (config.id && token) {
    try {
      await base44.asServiceRole.entities.AssetPandaConfig.update(config.id, { api_token: token });
    } catch (_) {}
  }

  return {
    attempted: true,
    success: errors.length === 0,
    updated,
    errors: errors.length > 0 ? errors : undefined,
  };
}