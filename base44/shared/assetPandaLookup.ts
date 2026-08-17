// Shared Asset Panda QR lookup logic — used by resolveAssetByQR (scanner)
// and any other function that needs to resolve a scanned QR code to a live
// asset record. Tries Asset Panda first (live source of truth), then falls
// back to the local SiteAsset database.
//
// Returns: { asset, source: 'panda'|'local'|'none', created, updated, error }

export async function resolveAssetByQR(base44, scannedValue) {
  const q = String(scannedValue || '').trim().toLowerCase();
  if (!q) return { source: 'none', error: 'Empty scan' };

  // --- Read Asset Panda config ---
  const configs = await base44.asServiceRole.entities.AssetPandaConfig.filter({ key: 'global' });
  const config = configs && configs[0];

  // If Panda isn't configured, go straight to local fallback.
  if (!config || !config.group_id) {
    return localFallback(base44, q);
  }

  const baseUrl = (config.base_url || 'https://api.assetpanda.com').replace(/\/+$/, '');
  let token = config.api_token || '';

  // Resolve a bearer token (cached token, or email/password login)
  if (!token && config.email && config.password) {
    try {
      const tokenRes = await fetch(`${baseUrl}/v3/session/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: config.email, password: config.password }),
      });
      if (tokenRes.ok) {
        const tokenJson = await tokenRes.json();
        token = tokenJson.token || tokenJson.access_token || tokenJson.accessToken || '';
        // Cache the fresh token for the next run
        if (config.id && token) {
          try { await base44.asServiceRole.entities.AssetPandaConfig.update(config.id, { api_token: token }); } catch (_) {}
        }
      }
    } catch (_) { /* fall through to local */ }
  }

  if (!token) {
    // No token — can't hit Panda, fall back to local
    return localFallback(base44, q);
  }

  const authHeaders = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  // --- Resolve field keys (auto-detect if not set) ---
  let fieldMap = {
    name: config.field_name || '',
    serial: config.field_serial || '',
    daily_rate: config.field_daily_rate || '',
    stock_status: config.field_stock_status || '',
    asset_type: config.field_asset_type || '',
  };

  const missingMappings = Object.values(fieldMap).some(v => !v);
  if (missingMappings) {
    try {
      const fieldsRes = await fetch(`${baseUrl}/v3/groups/${config.group_id}/fields`, { headers: authHeaders });
      if (fieldsRes.ok) {
        const fieldsJson = await fieldsRes.json();
        const fields = Array.isArray(fieldsJson) ? fieldsJson : (fieldsJson.fields || fieldsJson.data || []);
        const findByLabel = (keywords) => {
          const f = fields.find(f => {
            const label = String(f.label || f.name || '').toLowerCase();
            return keywords.some(k => label.includes(k));
          });
          return f ? (f.key || f.id || f.field_key || '') : '';
        };
        if (!fieldMap.name) fieldMap.name = findByLabel(['name', 'title', 'asset name']);
        if (!fieldMap.serial) fieldMap.serial = findByLabel(['serial', 'asset tag', 'tag', 'registration', 'reg']);
        if (!fieldMap.daily_rate) fieldMap.daily_rate = findByLabel(['rate', 'billing', 'cost', 'price', 'day rate']);
        if (!fieldMap.stock_status) fieldMap.stock_status = findByLabel(['stock', 'condition', 'status', 'availability']);
        if (!fieldMap.asset_type) fieldMap.asset_type = findByLabel(['type', 'category', 'class', 'group type']);
      }
    } catch (_) { /* non-fatal */ }
  }

  // --- Search Asset Panda for the scanned value ---
  // The QR sticker may contain the Panda object ID, the serial, or the name.
  // We search the group's objects and match against all three.
  let pandaMatch = null;
  try {
    // First, try a direct object GET if the scan looks like a Panda ID
    // (Panda IDs are typically UUIDs or numeric). This is the fastest path.
    if (q.length > 8 && /^[a-z0-9\-]+$/.test(q)) {
      const directRes = await fetch(`${baseUrl}/v3/groups/${config.group_id}/objects/${q}`, { headers: authHeaders });
      if (directRes.ok) {
        const directJson = await directRes.json();
        pandaMatch = directJson;
      }
    }

    // If no direct hit, paginate through the group and match by serial/name
    if (!pandaMatch) {
      let offset = 0;
      const limit = 100;
      let pages = 0;
      while (true) {
        const url = `${baseUrl}/v3/groups/${config.group_id}/search/objects?limit=${limit}&offset=${offset}`;
        const objRes = await fetch(url, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ view_archived: 'all' }),
        });
        if (!objRes.ok) break;
        const objJson = await objRes.json();
        const page = Array.isArray(objJson) ? objJson : (objJson.objects || objJson.data || objJson.results || []);
        if (!page.length) break;

        for (const obj of page) {
          const pandaId = String(obj.id || obj.object_id || obj._id || '').toLowerCase();
          const serial = String(fieldValue(obj, fieldMap.serial) || obj.serial_number || '').toLowerCase().trim();
          const name = String(fieldValue(obj, fieldMap.name) || obj.name || '').toLowerCase().trim();
          if (pandaId === q || serial === q || name === q ||
              (serial && serial.includes(q)) || (name && name.includes(q))) {
            pandaMatch = obj;
            break;
          }
        }
        if (pandaMatch) break;
        if (page.length < limit) break;
        offset += limit;
        if (pages++ > 30) break; // safety cap — 3000 objects
      }
    }
  } catch (e) {
    // Panda API error — fall back to local
    return localFallback(base44, q, `Panda API error: ${e.message}`);
  }

  if (!pandaMatch) {
    // Not found in Panda — fall back to local
    return localFallback(base44, q);
  }

  // --- Found in Panda — upsert the local SiteAsset with live data ---
  const pandaId = String(pandaMatch.id || pandaMatch.object_id || pandaMatch._id || '');
  const name = fieldValue(pandaMatch, fieldMap.name) || pandaMatch.name || 'Unnamed Asset';
  const serial = fieldValue(pandaMatch, fieldMap.serial) || pandaMatch.serial_number || '';
  const rawType = fieldValue(pandaMatch, fieldMap.asset_type) || '';
  const rawStock = fieldValue(pandaMatch, fieldMap.stock_status) || '';
  const rate = parseRate(fieldValue(pandaMatch, fieldMap.daily_rate));
  const assetType = detectAssetType(rawType, name);
  const isRig = assetType === 'rig';
  const rigType = isRig ? detectRigType(rawType, name) : 'n/a';
  const stockLevel = detectStockLevel(rawStock);
  const shouldDeactivate = config.auto_deactivate !== false && (stockLevel === 'out_of_stock' || stockLevel === 'needs_service');
  const now = new Date().toISOString();

  const payload = {
    name,
    serial_number: serial,
    panda_asset_id: pandaId,
    asset_type: assetType,
    is_rig: isRig,
    rig_type: rigType,
    stock_level: stockLevel,
    daily_billing_rate: rate != null ? rate : null,
    sync_status: 'synced',
    last_sync_timestamp: now,
    is_active: shouldDeactivate ? false : true,
  };

  // Find an existing local asset to update
  const allLocal = await base44.asServiceRole.entities.SiteAsset.list('-created_date', 500);
  let local = null;
  if (pandaId) local = allLocal.find(a => a.panda_asset_id === pandaId);
  if (!local && serial) local = allLocal.find(a => String(a.serial_number || '').toLowerCase().trim() === serial.toLowerCase().trim());
  if (!local) local = allLocal.find(a => String(a.name || '').toLowerCase().trim() === name.toLowerCase().trim());

  let assetId;
  let created = false;
  if (local) {
    await base44.asServiceRole.entities.SiteAsset.update(local.id, payload);
    assetId = local.id;
  } else {
    const createdRec = await base44.asServiceRole.entities.SiteAsset.create({
      ...payload,
      compliance_status: 'unknown',
      notes: '',
    });
    assetId = createdRec.id;
    created = true;
  }

  // Return the merged asset (local fields + live Panda data)
  const asset = { ...(local || {}), ...payload, id: assetId, panda_asset_id: pandaId };

  return {
    asset,
    source: 'panda',
    created,
    updated: !created,
    live: true,
    panda_id: pandaId,
  };
}

// --- Helpers (mirrored from syncAssetPanda for consistency) ---
function fieldValue(obj, key) {
  if (!key) return '';
  const v = obj[key];
  if (v == null) return '';
  if (typeof v === 'object') return String(v.value ?? v.name ?? v.label ?? '').trim();
  return String(v).trim();
}

function detectAssetType(rawType, name) {
  const raw = `${rawType} ${name}`.toLowerCase();
  if (raw.includes('rig') || raw.includes('drill') || raw.includes('percuss') || raw.includes('rotary')) return 'rig';
  if (raw.includes('trailer')) return 'trailer';
  if (raw.includes('lift') || raw.includes('shackle') || raw.includes('sling') || raw.includes('chain') || raw.includes('hook') || raw.includes('hoist') || raw.includes('rigging')) return 'lifting';
  if (raw.includes('pat') || raw.includes('appliance') || raw.includes('110v') || raw.includes('transformer') || raw.includes('power tool') || raw.includes('lead') || raw.includes('extension') || raw.includes('rcd') || raw.includes('charger') || raw.includes('kettle') || raw.includes('microwave') || raw.includes('porter')) return 'portable_appliance';
  if (raw.includes('machine') || raw.includes('excav') || raw.includes('digger') || raw.includes('grout') || raw.includes('mixer')) return 'machinery';
  if (raw.includes('vehicle') || raw.includes('van') || raw.includes('truck')) return 'vehicle';
  return 'machinery';
}

function detectRigType(rawType, name) {
  const raw = `${rawType} ${name}`.toLowerCase();
  if (raw.includes('rotary')) return 'rotary';
  if (raw.includes('cp') || raw.includes('percuss') || raw.includes('cable')) return 'cp';
  return 'n/a';
}

function detectStockLevel(raw) {
  if (!raw) return 'unknown';
  const r = String(raw).toLowerCase();
  if (r.includes('service') || r.includes('repair') || r.includes('maintenance')) return 'needs_service';
  if (r.includes('out') || r.includes('unavailable') || r.includes('broken') || r.includes('faulty')) return 'out_of_stock';
  if (r.includes('low') || r.includes('limited')) return 'low_stock';
  if (r.includes('in stock') || r.includes('available') || r.includes('good') || r.includes('ok')) return 'in_stock';
  return 'unknown';
}

function parseRate(raw) {
  if (!raw) return null;
  const num = Number(String(raw).replace(/[^0-9.]/g, ''));
  return isNaN(num) ? null : num;
}

// --- Local fallback — used when Panda is unconfigured, unreachable, or has no match ---
async function localFallback(base44, q, warning) {
  const allLocal = await base44.asServiceRole.entities.SiteAsset.list('-created_date', 500);
  const found = allLocal.find(a => {
    const sn = String(a.serial_number || '').toLowerCase().trim();
    const nm = String(a.name || '').toLowerCase().trim();
    const pid = String(a.panda_asset_id || '').toLowerCase().trim();
    const equip = String(a.equipment_type || '').toLowerCase().trim();
    return sn === q || nm === q || pid === q ||
      (sn && sn.includes(q)) || (nm && nm.includes(q)) || (equip && equip.includes(q));
  });
  if (!found) return { source: 'none', warning };
  return { asset: found, source: 'local', live: false, warning };
}