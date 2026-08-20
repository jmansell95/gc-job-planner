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

import { resolvePandaToken, buildFullFieldMap, resolveGroupIdForAsset, fetchPandaGroupFields } from './assetPandaClient.ts';

// ---------------------------------------------------------------------------
// Editable system fields that the asset detail editor can change and push
// back to Asset Panda. Each entry lists the Asset Panda field-label keywords
// used to auto-detect the field key when the admin hasn't explicitly mapped it
// in the field_map. This mirrors the label-based detection the sync uses, so
// push-back works symmetrically even for fields only auto-detected on import.
// ---------------------------------------------------------------------------
const EDITABLE_FIELD_LABELS: Record<string, string[]> = {
  make: ['make', 'manufacturer', 'brand'],
  model: ['model'],
  fleet_number: ['fleet number', 'faa', 'fleet no', 'fleet'],
  fuel_type: ['fuel type', 'fuel'],
  condition: ['condition'],
  hours_used: ['hours used', 'hour meter', 'hourmeter', 'hours'],
  length: ['length'],
  storage_location: ['storage location', 'site location', 'home location', 'yard location', 'yard'],
  responsible_person: ['responsible person', 'assigned to', 'custodian', 'owner'],
  compliance_expiry_date: ['next inspection', 'expiry', 'loler', 'pat', 'next test', 'due date', 'inspection due', 'test due', 'next loler', 'next pat', 'inspection date'],
  next_service_date: ['next service', 'service due', 'next service due', 'service date', 'next maintenance'],
  last_service_date: ['last service', 'last inspected', 'date of last', 'last inspection', 'last service date', 'last maintenance'],
  service_notes: ['service notes', 'service note', 'maintenance notes'],
  repair_notes: ['repair notes', 'fault notes', 'damage notes'],
  cost_price: ['cost price', 'purchase cost', 'internal cost', 'purchase price', 'cost'],
  charge_out_price: ['charge out', 'charge-out', 'sell', 'sale price', 'selling price', 'charge'],
  notes: ['notes', 'comments', 'remarks'],
  quantity_owned: ['quantity owned', 'qty owned', 'owned'],
  quantity_available: ['quantity available', 'qty available', 'quantity avail', 'available'],
  barcode: ['barcode', 'asset tag', 'tag id'],
};

/**
 * Resolve panda field keys for every editable system field, combining the
 * explicit field_map with label-based auto-detection against the group's
 * field definitions. Returns system_field -> panda_field_key for everything
 * that can be resolved, plus the list of system fields that couldn't be mapped.
 */
export async function resolveEditableFieldKeys(
  config: any,
  asset: any
): Promise<{ keys: Record<string, string>; unmapped: string[] }> {
  const explicit = buildFullFieldMap(config);
  const keys: Record<string, string> = { ...explicit };
  const unmapped: string[] = [];

  // Fetch the group's field definitions for label matching (best-effort).
  const baseUrl = String(config.base_url || 'https://api.assetpanda.com').replace(/\/+$/, '');
  const tokenRes = await resolvePandaToken(config, baseUrl);
  let groupFields: { key: string; label: string }[] = [];
  if (tokenRes.token) {
    const groupId = resolveGroupIdForAsset(config, asset);
    if (groupId) {
      try { groupFields = await fetchPandaGroupFields(baseUrl, tokenRes.token, groupId); } catch (_) { /* leave empty */ }
    }
  }

  for (const [sysField, keywords] of Object.entries(EDITABLE_FIELD_LABELS)) {
    if (keys[sysField]) continue; // explicitly mapped — keep it
    const f = groupFields.find((fld) => {
      const label = String(fld.label || '').toLowerCase();
      return keywords.some((k) => label.includes(k));
    });
    if (f?.key) keys[sysField] = f.key;
    else unmapped.push(sysField);
  }
  return { keys, unmapped };
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
 * Resolve the Asset Panda field key for 'Quantity Available' for a group,
 * using the explicit field_map first, then label-based auto-detection.
 * Cached per group within a single push call so multi-asset sign-outs don't
 * re-fetch the group field definitions for every object.
 */
async function detectQtyAvailableKey(
  baseUrl: string,
  token: string,
  config: any,
  groupId: string,
  cache: Record<string, string>
): Promise<string> {
  const explicit = buildFullFieldMap(config);
  if (explicit.quantity_available) return explicit.quantity_available;
  if (!groupId || !token) return '';
  if (cache[groupId] !== undefined) return cache[groupId];
  let key = '';
  try {
    const fields = await fetchPandaGroupFields(baseUrl, token, groupId);
    const f = fields.find((fld) => {
      const label = String(fld.label || '').toLowerCase();
      return ['quantity available', 'qty available', 'quantity avail', 'available'].some((k) => label.includes(k));
    });
    key = f?.key || '';
  } catch (_) { /* leave empty */ }
  cache[groupId] = key;
  return key;
}

/**
 * Book-in: mark assets as 'In Stock' in Asset Panda and increment the
 * Quantity Available (capped at Quantity Owned). Called by processAssetReturn
 * after crew scan-returns gear to the yard.
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
  const qtyCache: Record<string, string> = {};
  let updated = 0;
  const errors = [];

  for (const pandaId of pandaAssetIds) {
    if (!pandaId) continue;
    try {
      let asset: any = null;
      try {
        const found = await base44.asServiceRole.entities.SiteAsset.filter({ panda_asset_id: pandaId });
        if (found && found.length > 0) asset = found[0];
      } catch (_) { /* leave null */ }
      const groupId = asset ? resolveGroupIdForAsset(config, asset) : await resolveGroupIdForPandaId(base44, config, pandaId);
      if (!groupId) { errors.push(`${pandaId}: no group resolved`); continue; }

      const updateBody: any = {};
      if (stockField) updateBody[stockField] = 'In Stock';
      // Increment Quantity Available by 1, capped at Quantity Owned.
      const qtyKey = await detectQtyAvailableKey(baseUrl, token, config, groupId, qtyCache);
      let newQty: number | null = null;
      if (qtyKey && asset) {
        const cur = Number(asset.quantity_available ?? 0);
        const owned = Number(asset.quantity_owned ?? cur);
        const safeCur = isNaN(cur) ? 0 : cur;
        const safeOwned = isNaN(owned) ? safeCur : owned;
        newQty = Math.min(safeOwned, safeCur + 1);
        updateBody[qtyKey] = newQty;
      }
      const res = await fetch(`${baseUrl}/v3/groups/${groupId}/objects/${pandaId}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify(updateBody),
      });
      if (res.ok) {
        updated++;
        if (asset && newQty !== null) {
          try { await base44.asServiceRole.entities.SiteAsset.update(asset.id, { quantity_available: newQty }); } catch (_) {}
        }
      } else {
        errors.push(`${pandaId}: HTTP ${res.status}`);
      }
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
  const qtyCache: Record<string, string> = {};
  let updated = 0;
  const errors = [];

  for (const pandaId of pandaIds) {
    if (!pandaId) continue;
    try {
      let asset: any = null;
      try {
        const found = await base44.asServiceRole.entities.SiteAsset.filter({ panda_asset_id: pandaId });
        if (found && found.length > 0) asset = found[0];
      } catch (_) { /* leave null */ }
      const groupId = asset ? resolveGroupIdForAsset(config, asset) : await resolveGroupIdForPandaId(base44, config, pandaId);
      if (!groupId) { errors.push(`${pandaId}: no group resolved`); continue; }

      const updateBody: any = {};
      if (stockField) {
        updateBody[stockField] = jobName ? `Out on Job: ${jobName}` : 'Out on Job';
      }
      // Decrement Quantity Available by 1, floored at 0.
      const qtyKey = await detectQtyAvailableKey(baseUrl, token, config, groupId, qtyCache);
      let newQty: number | null = null;
      if (qtyKey && asset) {
        const cur = Number(asset.quantity_available ?? 0);
        const safeCur = isNaN(cur) ? 0 : cur;
        newQty = Math.max(0, safeCur - 1);
        updateBody[qtyKey] = newQty;
      }
      const res = await fetch(`${baseUrl}/v3/groups/${groupId}/objects/${pandaId}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify(updateBody),
      });
      if (res.ok) {
        updated++;
        if (asset && newQty !== null) {
          try { await base44.asServiceRole.entities.SiteAsset.update(asset.id, { quantity_available: newQty }); } catch (_) {}
        }
      } else {
        errors.push(`${pandaId}: HTTP ${res.status}`);
      }
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

  // Build the field payload using the full field map (custom + legacy) PLUS
  // label-based auto-detection for the editable spec/status/compliance/pricing
  // fields, so the app is a full bidirectional peer with Asset Panda even when
  // the admin hasn't explicitly mapped every field.
  const { keys: fieldMap, unmapped } = await resolveEditableFieldKeys(config, asset);
  const body: any = {};
  const pushedFields: string[] = [];

  // Special handling for the stock-level field (derived status string).
  if (fieldMap.stock_level || config.field_stock_status) {
    const stockField = fieldMap.stock_level || config.field_stock_status;
    let status = 'In Stock';
    if (asset.maintenance_status === 'overdue' || asset.compliance_status === 'expired') status = 'Needs Service';
    else if (!asset.is_active) status = 'Out of Stock';
    else if (asset.stock_level === 'needs_service') status = 'Needs Service';
    else if (asset.stock_level === 'out_of_stock') status = 'Out of Stock';
    else if (asset.stock_level === 'low_stock') status = 'Low Stock';
    body[stockField] = status;
    pushedFields.push('stock_level');
  }

  // Generic push: every other resolved system field is copied straight across
  // when the asset has a non-null value for it. This covers name, serial,
  // asset_type, make, model, condition, storage_location, responsible_person,
  // compliance_expiry_date, service dates, cost/charge prices and any custom
  // field the admin has mapped.
  for (const [systemField, pandaKey] of Object.entries(fieldMap)) {
    if (systemField === 'stock_level') continue; // handled above
    const value = (asset as any)[systemField];
    if (value === undefined || value === null || value === '') continue;
    body[pandaKey] = value;
    pushedFields.push(systemField);
  }

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
      return { attempted: true, success: true, panda_id: pandaId, pushed_fields: pushedFields, unmapped_fields: unmapped };
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
      return { attempted: true, success: true, panda_id: asset.panda_asset_id, pushed_fields: pushedFields, unmapped_fields: unmapped };
    }
  } catch (e: any) {
    return { attempted: true, success: false, error: e.message };
  }
}