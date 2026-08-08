// Shared Asset Panda push logic — used by processAssetReturn (real-time)
// and retryAssetReturnSync (scheduled retry of failed pushes).
// Updates each asset's stock-status field to 'In Stock' via the Asset Panda REST API.

export async function pushToAssetPanda(base44, pandaAssetIds) {
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

/**
 * Generic push — creates a new object or updates an existing one in Asset Panda.
 * Used when assets are created on-site (Add to Inventory) or when service/repair
 * records are logged and need to sync back.
 *
 * @param base44    - base44 SDK client (asServiceRole)
 * @param asset_id  - the SiteAsset ID to push
 * @param action    - 'create' (new asset → POST) | 'update' (existing → PUT)
 * @returns { attempted, success, panda_id?, error? }
 */
export async function pushAssetUpdateToPanda(base44, asset_id, action = 'update') {
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

  // Load the asset
  const assets = await base44.asServiceRole.entities.SiteAsset.list('-created_date', 500);
  const asset = assets.find(a => a.id === asset_id);
  if (!asset) return { attempted: false, reason: 'Asset not found' };

  // Build the field payload using the configured field keys
  const body = {};
  if (config.field_name) body[config.field_name] = asset.name || '';
  if (config.field_serial) body[config.field_serial] = asset.serial_number || '';
  if (config.field_asset_type) body[config.field_asset_type] = asset.asset_type || '';
  // Map stock level / maintenance status to the stock-status field
  if (config.field_stock_status) {
    let status = 'In Stock';
    if (asset.maintenance_status === 'overdue' || asset.compliance_status === 'expired') status = 'Needs Service';
    else if (!asset.is_active) status = 'Out of Stock';
    else if (asset.stock_level === 'needs_service') status = 'Needs Service';
    else if (asset.stock_level === 'out_of_stock') status = 'Out of Stock';
    body[config.field_stock_status] = status;
  }

  try {
    if (action === 'create' && !asset.panda_asset_id) {
      // POST a new object to the group
      const res = await fetch(`${baseUrl}/v3/groups/${config.group_id}/objects`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.text();
        return { attempted: true, success: false, error: `Create failed: HTTP ${res.status} ${errBody}` };
      }
      const json = await res.json();
      const pandaId = json.id || json.object_id || json._id || '';
      // Save the panda_asset_id back to the SiteAsset
      if (pandaId) {
        await base44.asServiceRole.entities.SiteAsset.update(asset_id, {
          panda_asset_id: pandaId,
          sync_status: 'synced',
          last_sync_timestamp: new Date().toISOString(),
        });
      }
      // Cache token
      if (config.id && token) {
        try { await base44.asServiceRole.entities.AssetPandaConfig.update(config.id, { api_token: token }); } catch (_) {}
      }
      return { attempted: true, success: true, panda_id: pandaId };
    } else {
      // PUT update to existing object
      if (!asset.panda_asset_id) {
        return { attempted: false, reason: 'Asset has no panda_asset_id — cannot update' };
      }
      const res = await fetch(`${baseUrl}/v3/groups/${config.group_id}/objects/${asset.panda_asset_id}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.text();
        return { attempted: true, success: false, error: `Update failed: HTTP ${res.status} ${errBody}` };
      }
      // Update sync timestamp
      await base44.asServiceRole.entities.SiteAsset.update(asset_id, {
        sync_status: 'synced',
        last_sync_timestamp: new Date().toISOString(),
      });
      // Cache token
      if (config.id && token) {
        try { await base44.asServiceRole.entities.AssetPandaConfig.update(config.id, { api_token: token }); } catch (_) {}
      }
      return { attempted: true, success: true, panda_id: asset.panda_asset_id };
    }
  } catch (e) {
    return { attempted: true, success: false, error: e.message };
  }
}