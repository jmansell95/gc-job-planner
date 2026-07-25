import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    // --- Read configuration ---
    const configs = await base44.asServiceRole.entities.AssetPandaConfig.filter({ key: 'global' });
    const config = configs && configs[0];
    if (!config) {
      return Response.json({ error: 'No Asset Panda configuration found. Add your API details in Settings → Asset Panda Sync Data.' }, { status: 400 });
    }

    const baseUrl = (config.base_url || 'https://api.assetpanda.com').replace(/\/+$/, '');
    const groupId = config.group_id;
    if (!groupId) {
      return Response.json({ error: 'No Asset Panda group ID configured. Enter the group ID in Settings → Asset Panda Sync Data.' }, { status: 400 });
    }

    // --- Resolve a bearer token ---
    let token = config.api_token || '';
    if (!token && config.email && config.password) {
      const tokenRes = await fetch(`${baseUrl}/v3/session/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: config.email, password: config.password }),
      });
      if (!tokenRes.ok) {
        const errBody = await tokenRes.text();
        return Response.json({ error: 'Asset Panda authentication failed', details: errBody }, { status: 402 });
      }
      const tokenJson = await tokenRes.json();
      token = tokenJson.token || tokenJson.access_token || tokenJson.accessToken || (typeof tokenJson === 'string' ? tokenJson : '');
      if (!token) {
        return Response.json({ error: 'Asset Panda did not return a session token. Check your email/password.' }, { status: 402 });
      }
    }
    if (!token) {
      return Response.json({ error: 'No API token configured. Enter your Asset Panda token (or email + password) in Settings → Asset Panda Sync Data.' }, { status: 400 });
    }

    const authHeaders = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

    // --- Fetch group field definitions to auto-map field keys when not explicitly set ---
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
        const fieldsRes = await fetch(`${baseUrl}/v3/groups/${groupId}/fields`, { headers: authHeaders });
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
      } catch (fieldsErr) {
        console.error('Could not fetch group fields:', fieldsErr.message);
      }
    }

    // --- Paginate through all objects in the group ---
    let offset = 0;
    const limit = 100;
    let allObjects = [];
    let pages = 0;
    while (true) {
      const url = `${baseUrl}/v3/groups/${groupId}/search/objects?limit=${limit}&offset=${offset}`;
      const objRes = await fetch(url, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ view_archived: 'all' }),
      });
      if (!objRes.ok) {
        const errBody = await objRes.text();
        return Response.json({ error: 'Asset Panda search failed', details: errBody, status: objRes.status }, { status: 502 });
      }
      const objJson = await objRes.json();
      const page = Array.isArray(objJson) ? objJson : (objJson.objects || objJson.data || objJson.results || []);
      allObjects = allObjects.concat(page);
      pages++;
      if (page.length < limit) break;
      offset += limit;
      if (pages > 50) break; // safety cap
    }

    // --- Helpers ---
    const fieldValue = (obj, key) => {
      if (!key) return '';
      const v = obj[key];
      if (v == null) return '';
      if (typeof v === 'object') return String(v.value ?? v.name ?? v.label ?? '').trim();
      return String(v).trim();
    };

    const detectAssetType = (rawType, name) => {
      const raw = `${rawType} ${name}`.toLowerCase();
      if (raw.includes('rig') || raw.includes('drill') || raw.includes('percuss') || raw.includes('rotary')) return 'rig';
      if (raw.includes('trailer')) return 'trailer';
      if (raw.includes('lift') || raw.includes('shackle') || raw.includes('sling') || raw.includes('chain') || raw.includes('hook') || raw.includes('hoist') || raw.includes('rigging')) return 'lifting';
      if (raw.includes('machine') || raw.includes('excav') || raw.includes('digger') || raw.includes('grout') || raw.includes('mixer')) return 'machinery';
      if (raw.includes('vehicle') || raw.includes('van') || raw.includes('truck')) return 'vehicle';
      return 'machinery';
    };

    const detectRigType = (rawType, name) => {
      const raw = `${rawType} ${name}`.toLowerCase();
      if (raw.includes('rotary')) return 'rotary';
      if (raw.includes('cp') || raw.includes('percuss') || raw.includes('cable')) return 'cp';
      return 'n/a';
    };

    const detectStockLevel = (raw) => {
      if (!raw) return 'unknown';
      const r = String(raw).toLowerCase();
      if (r.includes('service') || r.includes('repair') || r.includes('maintenance')) return 'needs_service';
      if (r.includes('out') || r.includes('unavailable') || r.includes('broken') || r.includes('faulty')) return 'out_of_stock';
      if (r.includes('low') || r.includes('limited')) return 'low_stock';
      if (r.includes('in stock') || r.includes('available') || r.includes('good') || r.includes('ok')) return 'in_stock';
      return 'unknown';
    };

    const parseRate = (raw) => {
      if (!raw) return null;
      const num = Number(String(raw).replace(/[^0-9.]/g, ''));
      return isNaN(num) ? null : num;
    };

    // --- Load existing SiteAssets for matching — exclude demo assets so sync
    // never touches or deactivates showcase data created by the Demo Data Manager.
    const allExisting = await base44.asServiceRole.entities.SiteAsset.list('-created_date', 500);
    const existing = allExisting.filter(a => !a.is_demo_data);
    const byPandaId = {};
    const bySerial = {};
    const byName = {};
    for (const a of existing) {
      if (a.panda_asset_id) byPandaId[a.panda_asset_id] = a;
      if (a.serial_number) bySerial[String(a.serial_number).toLowerCase().trim()] = a;
      if (a.name) byName[String(a.name).toLowerCase().trim()] = a;
    }

    const now = new Date().toISOString();
    const autoDeactivate = config.auto_deactivate !== false;
    let synced = 0;
    let created = 0;
    let deactivated = 0;
    const errors = [];

    const toUpdate = [];
    const toCreate = [];

    for (const obj of allObjects) {
      try {
        const pandaId = obj.id || obj.object_id || obj._id || '';
        const name = fieldValue(obj, fieldMap.name) || obj.name || 'Unnamed Asset';
        const serial = fieldValue(obj, fieldMap.serial) || obj.serial_number || '';
        const rawType = fieldValue(obj, fieldMap.asset_type) || '';
        const rawStock = fieldValue(obj, fieldMap.stock_status) || '';
        const rate = parseRate(fieldValue(obj, fieldMap.daily_rate));
        const assetType = detectAssetType(rawType, name);
        const isRig = assetType === 'rig';
        const rigType = isRig ? detectRigType(rawType, name) : 'n/a';
        const stockLevel = detectStockLevel(rawStock);
        const shouldDeactivate = autoDeactivate && (stockLevel === 'out_of_stock' || stockLevel === 'needs_service');

        let match = pandaId ? byPandaId[pandaId] : null;
        if (!match && serial) match = bySerial[serial.toLowerCase().trim()];
        if (!match) match = byName[name.toLowerCase().trim()];

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
          is_active: shouldDeactivate ? false : (match ? (match.is_active !== false) : true),
        };

        if (match) {
          toUpdate.push({ id: match.id, ...payload });
          synced++;
        } else {
          toCreate.push({
            ...payload,
            compliance_status: 'unknown',
            notes: '',
          });
          created++;
        }
        if (shouldDeactivate && match && match.is_active !== false) deactivated++;
      } catch (itemErr) {
        errors.push(`Object ${obj.id || '?'}: ${itemErr.message}`);
      }
    }

    // Apply updates in batches
    if (toUpdate.length > 0) {
      const chunks = [];
      for (let i = 0; i < toUpdate.length; i += 100) chunks.push(toUpdate.slice(i, i + 100));
      for (const chunk of chunks) {
        try {
          await base44.asServiceRole.entities.SiteAsset.bulkUpdate(chunk);
        } catch (bulkErr) {
          console.error('bulkUpdate error:', bulkErr.message);
        }
      }
    }
    if (toCreate.length > 0) {
      const chunks = [];
      for (let i = 0; i < toCreate.length; i += 100) chunks.push(toCreate.slice(i, i + 100));
      for (const chunk of chunks) {
        try {
          await base44.asServiceRole.entities.SiteAsset.bulkCreate(chunk);
        } catch (bulkErr) {
          console.error('bulkCreate error:', bulkErr.message);
        }
      }
    }

    const summary = `${created} new, ${synced} updated, ${deactivated} deactivated (${allObjects.length} pulled).`;
    const status = errors.length === 0 ? 'success' : (errors.length < allObjects.length ? 'success' : 'failed');

    // Persist sync outcome on the config record
    try {
      const updateData = {
        last_sync_at: now,
        last_sync_summary: summary + (errors.length ? ` ${errors.length} errors.` : ''),
        last_sync_status: status,
        api_token: token, // cache the (possibly freshly-generated) token for next run
      };
      if (config.id) {
        await base44.asServiceRole.entities.AssetPandaConfig.update(config.id, updateData);
      }
    } catch (cfgErr) {
      console.error('Could not update config:', cfgErr.message);
    }

    return Response.json({
      success: true,
      pulled: allObjects.length,
      created,
      synced,
      deactivated,
      errors,
      summary,
      field_map: fieldMap,
      synced_at: now,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});