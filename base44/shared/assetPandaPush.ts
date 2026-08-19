// ---------------------------------------------------------------------------
// assetPandaPush — bidirectional push-back logic for the Asset Panda integration.
// Used by: processAssetReturn (book-in), pushSignOutToPanda (book-out),
// pushAssetUpdateToPanda (admin edits), retryAssetReturnSync (scheduled retry).
//
// All pushes resolve the correct Asset Panda group PER ASSET using the asset's
// panda_group_label → matched against config.groups. Falls back to the legacy
// single config.group_id. Uses buildFullFieldMap for field keys so custom
// mappings are respected.
// ---------------------------------------------------------------------------

import { resolvePandaToken, buildFullFieldMap } from './assetPandaClient.ts';

/**
 * Resolve the Asset Panda group ID for a given asset.
 * Multi-group: match the asset's panda_group_label against config.groups.
 * Legacy: fall back to config.group_id.
 */
function resolveGroupIdForAsset(config: any, asset: any): string {
  if (Array.isArray(config.groups) && config.groups.length > 0 && asset?.panda_group_label) {
    const match = config.groups.find((g: any) => g.label === asset.panda_group_label);
    if (match?.group_id) return match.group_id;
  }
  // Fall back to first group if multi-group but no label match
  if (Array.isArray(config.groups) && config.groups.length > 0) {
    return config.groups[0].group_id;
  }
  return config.group_id || '';
}

/**
 * Resolve the group ID for a panda object ID by looking up the matching SiteAsset.
 * Used by book-in/book-out flows that only have panda IDs, not the full asset.
 */
async function resolveGroupIdForPandaId(base44: any, config: any, pandaId: string): Promise<string> {
  if (Array.isArray(config.groups) && config.groups.length > 0) {
    try {
      const assets = await base44.asServiceRole.entities.SiteAsset.filter({ panda_asset_id: pandaId });
      if (assets && assets.length > 0) {
        const gid = resolveGroupIdForAsset(config, assets[0]);
        if (gid) return gid;
      }
    } catch (_) { /* fall through to default */ }
    return config.groups[0].group_id;
  }
  return config.group_id || '';
}

/**
 * Book-in: mark assets as 'In Stock' in Asset Panda.
 * Called by processAssetReturn after crew scan-returns gear to the yard.
 */
export async function pushToAssetPanda(base44, pandaAssetIds) {
  const configs = await base44.asServiceRole.entities.AssetPandaConfig.filter({ key: 'global' });
  const config = configs && configs[0];
  if (!config) return { attempted: false, reason: 'Asset Panda not configured' };

  const baseUrl = (config.base_url || 'https://api.assetpanda.com').replace(/\/+$/, '');
  const { token, error, skipped } = await resolvePandaToken(config, baseUrl);
  if (skipped) return { attempted: false, reason: error };
  if (error) return { attempted: true, success: false, error };
  if (!token) return { attempted: false, reason: 'No token' };

  const authHeaders = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  const fieldMap = buildFullFieldMap(config);
  const stockField = fieldMap.stock_level || config.field_stock_status || '';
  let updated = 0;
  const errors = [];

  for (const pandaId of pandaAssetIds) {
    if (!pandaId) continue;
    try {
      const groupId = await resolveGroupIdForPandaId(base44, config, pandaId);
      if (!groupId) { errors.push(`${pandaId}: no group resolved`); continue; }
      const updateBody = {};
      if (stockField) updateBody[stockField] = 'In Stock';
      const res = await fetch(`${baseUrl}/v3/groups/${groupId}/objects/${pandaId}`, {
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

  if (config.id && token) {
    try { await base44.asServiceRole.entities.AssetPandaConfig.update(config.id, { api_token: token }); } catch (_) {}
  }

  return {
    attempted: true,
    success: errors.length === 0,
    updated,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Book-out: mark assets as 'Out on Job' in Asset Panda so the yard dashboard
 * shows where the gear is. Called by the Equipment Sign-Out flow.
 */
export async function pushSignOutToPanda(base44, pandaIds, jobName) {
  const configs = await base44.asServiceRole.entities.AssetPandaConfig.filter({ key: 'global' });
  const config = configs && configs[0];
  if (!config) return { attempted: false, reason: 'Asset Panda not configured' };

  const baseUrl = (config.base_url || 'https://api.assetpanda.com').replace(/\/+$/, '');
  const { token, error, skipped } = await resolvePandaToken(config, baseUrl);
  if (skipped) return { attempted: false, reason: error };
  if (error) return { attempted: true, success: false, error };
  if (!token) return { attempted: false, reason: 'No token' };

  const authHeaders = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  const fieldMap = buildFullFieldMap(config);
  const stockField = fieldMap.stock_level || config.field_stock_status || '';
  let updated = 0;
  const errors = [];

  for (const pandaId of pandaIds) {
    if (!pandaId) continue;
    try {
      const groupId = await resolveGroupIdForPandaId(base44, config, pandaId);
      if (!groupId) { errors.push(`${pandaId}: no group resolved`); continue; }
      const updateBody = {};
      if (stockField) {
        updateBody[stockField] = jobName ? `Out on Job: ${jobName}` : 'Out on Job';
      }
      const res = await fetch(`${baseUrl}/v3/groups/${groupId}/objects/${pandaId}`, {
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

  if (config.id && token) {
    try { await base44.asServiceRole.entities.AssetPandaConfig.update(config.id, { api_token: token }); } catch (_) {}
  }

  return {
    attempted: true,
    success: errors.length === 0,
    updated,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Generic push — creates a new object or updates an existing one in Asset Panda.
 * Used when assets are created on-site (Add to Inventory) or when admin edits
 * (stock level, status, compliance) need to sync back so Asset Panda stays
 * the source of truth bidirectionally.
 */
export async function pushAssetUpdateToPanda(base44, asset_id, action = 'update') {
  const configs = await base44.asServiceRole.entities.AssetPandaConfig.filter({ key: 'global' });
  const config = configs && configs[0];
  if (!config) return { attempted: false, reason: 'Asset Panda not configured' };

  const baseUrl = (config.base_url || 'https://api.assetpanda.com').replace(/\/+$/, '');
  const { token, error, skipped } = await resolvePandaToken(config, baseUrl);
  if (skipped) return { attempted: false, reason: error };
  if (error) return { attempted: true, success: false, error };
  if (!token) return { attempted: false, reason: 'No token' };

  const authHeaders = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  // Load the asset
  const assets = await base44.asServiceRole.entities.SiteAsset.list('-created_date', 500);
  const asset = assets.find((a: any) => a.id === asset_id);
  if (!asset) return { attempted: false, reason: 'Asset not found' };

  const groupId = resolveGroupIdForAsset(config, asset);
  if (!groupId) return { attempted: false, reason: 'No Asset Panda group configured for this asset' };

  // Build the field payload using the full field map (custom + legacy)
  const fieldMap = buildFullFieldMap(config);
  const body: any = {};
  if (fieldMap.name) body[fieldMap.name] = asset.name || '';
  if (fieldMap.serial_number) body[fieldMap.serial_number] = asset.serial_number || '';
  if (fieldMap.asset_type) body[fieldMap.asset_type] = asset.asset_type || '';
  if (fieldMap.stock_level || config.field_stock_status) {
    const stockField = fieldMap.stock_level || config.field_stock_status;
    let status = 'In Stock';
    if (asset.maintenance_status === 'overdue' || asset.compliance_status === 'expired') status = 'Needs Service';
    else if (!asset.is_active) status = 'Out of Stock';
    else if (asset.stock_level === 'needs_service') status = 'Needs Service';
    else if (asset.stock_level === 'out_of_stock') status = 'Out of Stock';
    else if (asset.stock_level === 'low_stock') status = 'Low Stock';
    body[stockField] = status;
  }
  // Push cost/charge-out if mapped
  if (fieldMap.cost_price && asset.cost_price != null) body[fieldMap.cost_price] = asset.cost_price;
  if (fieldMap.charge_out_price && asset.charge_out_price != null) body[fieldMap.charge_out_price] = asset.charge_out_price;
  // Push storage location / responsible person if mapped
  if (fieldMap.storage_location && asset.storage_location) body[fieldMap.storage_location] = asset.storage_location;
  if (fieldMap.responsible_person && asset.responsible_person) body[fieldMap.responsible_person] = asset.responsible_person;

  try {
    if (action === 'create' && !asset.panda_asset_id) {
      const res = await fetch(`${baseUrl}/v3/groups/${groupId}/objects`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.text();
        return { attempted: true, success: false, error: `Create failed: HTTP ${res.status} ${errBody}` };
      }
      const json: any = await res.json();
      const pandaId = json.id || json.object_id || json._id || '';
      if (pandaId) {
        await base44.asServiceRole.entities.SiteAsset.update(asset_id, {
          panda_asset_id: pandaId,
          sync_status: 'synced',
          last_sync_timestamp: new Date().toISOString(),
        });
      }
      if (config.id && token) {
        try { await base44.asServiceRole.entities.AssetPandaConfig.update(config.id, { api_token: token }); } catch (_) {}
      }
      return { attempted: true, success: true, panda_id: pandaId };
    } else {
      if (!asset.panda_asset_id) {
        return { attempted: false, reason: 'Asset has no panda_asset_id — cannot update' };
      }
      const res = await fetch(`${baseUrl}/v3/groups/${groupId}/objects/${asset.panda_asset_id}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.text();
        return { attempted: true, success: false, error: `Update failed: HTTP ${res.status} ${errBody}` };
      }
      await base44.asServiceRole.entities.SiteAsset.update(asset_id, {
        sync_status: 'synced',
        last_sync_timestamp: new Date().toISOString(),
      });
      if (config.id && token) {
        try { await base44.asServiceRole.entities.AssetPandaConfig.update(config.id, { api_token: token }); } catch (_) {}
      }
      return { attempted: true, success: true, panda_id: asset.panda_asset_id };
    }
  } catch (e: any) {
    return { attempted: true, success: false, error: e.message };
  }
}