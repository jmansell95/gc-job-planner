import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { resolvePandaToken, buildFullFieldMap } from '../../shared/assetPandaClient.ts';
import { findBestRateCardMatch } from '../../shared/assetPandaRateMatcher.ts';

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
      return Response.json({ skipped: true, reason: 'No Asset Panda configuration found. Add your API details in Settings → Asset Panda Sync Data.' });
    }

    const baseUrl = (config.base_url || 'https://api.assetpanda.com').replace(/\/+$/, '');

    // --- Build the list of groups to sync ---
    // Multi-group: config.groups array. Legacy: single config.group_id.
    let groups: Array<{ group_id: string; label: string; asset_type_hint?: string; field_map_overrides?: any[] }> = [];
    if (Array.isArray(config.groups) && config.groups.length > 0) {
      groups = config.groups.map((g: any) => ({
        group_id: g.group_id,
        label: g.label || g.group_id,
        asset_type_hint: g.asset_type_hint || 'auto',
        field_map_overrides: Array.isArray(g.field_map_overrides) ? g.field_map_overrides : [],
      }));
    } else if (config.group_id) {
      groups = [{ group_id: config.group_id, label: 'Asset Panda', asset_type_hint: 'auto', field_map_overrides: [] }];
    }
    if (groups.length === 0) {
      return Response.json({ skipped: true, reason: 'No Asset Panda groups configured. Add at least one group in Settings → Asset Panda → Groups.' });
    }

    // --- Resolve a bearer token (shared helper) ---
    const { token, error: tokenError, skipped: tokenSkipped } = await resolvePandaToken(config, baseUrl);
    if (tokenSkipped) return Response.json({ skipped: true, reason: tokenError });
    if (tokenError) return Response.json({ error: tokenError, details: tokenError }, { status: 402 });

    const authHeaders = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

    // --- Helpers ---
    const fieldValue = (obj: any, key: string) => {
      if (!key) return '';
      const v = obj[key];
      if (v == null) return '';
      if (typeof v === 'object') return String(v.value ?? v.name ?? v.label ?? '').trim();
      return String(v).trim();
    };

    const detectAssetType = (rawType: string, name: string, hint?: string) => {
      if (hint && hint !== 'auto') return hint;
      const raw = `${rawType} ${name}`.toLowerCase();
      if (raw.includes('rig') || raw.includes('drill') || raw.includes('percuss') || raw.includes('rotary')) return 'rig';
      if (raw.includes('trailer')) return 'trailer';
      if (raw.includes('lift') || raw.includes('shackle') || raw.includes('sling') || raw.includes('chain') || raw.includes('hook') || raw.includes('hoist') || raw.includes('rigging')) return 'lifting';
      if (raw.includes('pat') || raw.includes('appliance') || raw.includes('110v') || raw.includes('transformer') || raw.includes('power tool') || raw.includes('lead') || raw.includes('ext lead') || raw.includes('extension') || raw.includes('rcd') || raw.includes('charger') || raw.includes('kettle') || raw.includes('microwave') || raw.includes('porter')) return 'portable_appliance';
      if (raw.includes('machine') || raw.includes('excav') || raw.includes('digger') || raw.includes('grout') || raw.includes('mixer')) return 'machinery';
      if (raw.includes('vehicle') || raw.includes('van') || raw.includes('truck')) return 'vehicle';
      return 'machinery';
    };

    const detectRigType = (rawType: string, name: string) => {
      const raw = `${rawType} ${name}`.toLowerCase();
      if (raw.includes('rotary')) return 'rotary';
      if (raw.includes('cp') || raw.includes('percuss') || raw.includes('cable')) return 'cp';
      return 'n/a';
    };

    const detectStockLevel = (raw: string) => {
      if (!raw) return 'unknown';
      const r = String(raw).toLowerCase();
      if (r.includes('service') || r.includes('repair') || r.includes('maintenance')) return 'needs_service';
      if (r.includes('out') || r.includes('unavailable') || r.includes('broken') || r.includes('faulty')) return 'out_of_stock';
      if (r.includes('low') || r.includes('limited')) return 'low_stock';
      if (r.includes('in stock') || r.includes('available') || r.includes('good') || r.includes('ok')) return 'in_stock';
      return 'unknown';
    };

    const parseRate = (raw: string) => {
      if (!raw) return null;
      const num = Number(String(raw).replace(/[^0-9.]/g, ''));
      return isNaN(num) ? null : num;
    };

    // Core system fields + direct-copy fields (now includes cost_price, charge_out_price)
    const CORE_FIELDS = new Set(['name', 'serial_number', 'daily_billing_rate', 'stock_level', 'asset_type', 'cost_price', 'charge_out_price']);
    const DIRECT_COPY_FIELDS = new Set([
      'storage_location', 'responsible_person', 'compliance_expiry_date', 'next_service_date',
      'last_service_date', 'service_notes', 'repair_notes', 'colour', 'equipment_type',
      'tooling_notes', 'notes',
    ]);

    // --- Load existing SiteAssets for matching (exclude demo) ---
    const allExisting = await base44.asServiceRole.entities.SiteAsset.list('-created_date', 500);
    const existing = allExisting.filter((a: any) => !a.is_demo_data);
    const byPandaId: Record<string, any> = {};
    const bySerial: Record<string, any> = {};
    const byName: Record<string, any> = {};
    for (const a of existing) {
      if (a.panda_asset_id) byPandaId[a.panda_asset_id] = a;
      if (a.serial_number) bySerial[String(a.serial_number).toLowerCase().trim()] = a;
      if (a.name) byName[String(a.name).toLowerCase().trim()] = a;
    }

    const now = new Date().toISOString();
    const autoDeactivate = config.auto_deactivate !== false;
    let totalSynced = 0;
    let totalCreated = 0;
    let totalDeactivated = 0;
    const allErrors: string[] = [];
    const groupResults: any[] = [];

    // --- Iterate each group ---
    for (const group of groups) {
      const groupId = group.group_id;
      const groupLabel = group.label;
      const typeHint = group.asset_type_hint;

      // Build the field map for this group: global field_map merged with per-group overrides
      let fieldMap: Record<string, string> = {
        name: config.field_name || '',
        serial: config.field_serial || '',
        daily_rate: config.field_daily_rate || '',
        stock_status: config.field_stock_status || '',
        asset_type: config.field_asset_type || '',
        cost_price: '',
        charge_out_price: '',
      };

      // Auto-detect unmapped core fields from the group's field labels
      const missingMappings = Object.values(fieldMap).some((v) => !v);
      if (missingMappings) {
        try {
          const fieldsRes = await fetch(`${baseUrl}/v3/groups/${groupId}/fields`, { headers: authHeaders });
          if (fieldsRes.ok) {
            const fieldsJson: any = await fieldsRes.json();
            const fields = Array.isArray(fieldsJson) ? fieldsJson : (fieldsJson.fields || fieldsJson.data || []);
            const findByLabel = (keywords: string[]) => {
              const f = fields.find((f: any) => {
                const label = String(f.label || f.name || '').toLowerCase();
                return keywords.some((k) => label.includes(k));
              });
              return f ? String(f.key || f.id || f.field_key || '') : '';
            };
            if (!fieldMap.name) fieldMap.name = findByLabel(['name', 'title', 'asset name']);
            if (!fieldMap.serial) fieldMap.serial = findByLabel(['serial', 'asset tag', 'tag', 'registration', 'reg']);
            if (!fieldMap.daily_rate) fieldMap.daily_rate = findByLabel(['rate', 'billing', 'day rate']);
            if (!fieldMap.stock_status) fieldMap.stock_status = findByLabel(['stock', 'condition', 'status', 'availability']);
            if (!fieldMap.asset_type) fieldMap.asset_type = findByLabel(['type', 'category', 'class', 'group type']);
            if (!fieldMap.cost_price) fieldMap.cost_price = findByLabel(['cost', 'cost price', 'purchase cost', 'internal cost']);
            if (!fieldMap.charge_out_price) fieldMap.charge_out_price = findByLabel(['charge', 'charge out', 'sell', 'sale price', 'charge-out']);
          }
        } catch (fieldsErr) {
          console.error('Could not fetch group fields:', (fieldsErr as Error).message);
        }
      }

      // Merge the custom field_map (global) + per-group overrides into the core map
      const globalFullMap = buildFullFieldMap(config);
      const mergedMap = { ...globalFullMap };
      if (group.field_map_overrides && group.field_map_overrides.length > 0) {
        for (const entry of group.field_map_overrides) {
          if (entry?.system_field && entry?.panda_field_key) {
            mergedMap[entry.system_field] = entry.panda_field_key;
          }
        }
      }
      // Apply merged custom map over the auto-detected core fields
      for (const [sysField, pandaKey] of Object.entries(mergedMap)) {
        if (CORE_FIELDS.has(sysField)) {
          if (sysField === 'serial_number') fieldMap.serial = pandaKey;
          else if (sysField === 'daily_billing_rate') fieldMap.daily_rate = pandaKey;
          else if (sysField === 'stock_level') fieldMap.stock_status = pandaKey;
          else if (sysField === 'asset_type') fieldMap.asset_type = pandaKey;
          else if (sysField === 'cost_price') fieldMap.cost_price = pandaKey;
          else if (sysField === 'charge_out_price') fieldMap.charge_out_price = pandaKey;
          else fieldMap[sysField] = pandaKey;
        }
      }

      // Extra direct-copy fields from the merged map
      const extraMap: Record<string, string> = {};
      for (const [sysField, pandaKey] of Object.entries(mergedMap)) {
        if (!CORE_FIELDS.has(sysField) && DIRECT_COPY_FIELDS.has(sysField) && pandaKey) {
          extraMap[sysField] = pandaKey;
        }
      }

      // --- Paginate through all objects in this group ---
      let offset = 0;
      const limit = 100;
      let allObjects: any[] = [];
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
          allErrors.push(`Group "${groupLabel}" search failed: ${errBody}`);
          break;
        }
        const objJson: any = await objRes.json();
        const page = Array.isArray(objJson) ? objJson : (objJson.objects || objJson.data || objJson.results || []);
        allObjects = allObjects.concat(page);
        pages++;
        if (page.length < limit) break;
        offset += limit;
        if (pages > 50) break;
      }

      const toUpdate: any[] = [];
      const toCreate: any[] = [];
      let groupSynced = 0;
      let groupCreated = 0;
      let groupDeactivated = 0;

      for (const obj of allObjects) {
        try {
          const pandaId = obj.id || obj.object_id || obj._id || '';
          const name = fieldValue(obj, fieldMap.name) || obj.name || 'Unnamed Asset';
          const serial = fieldValue(obj, fieldMap.serial) || obj.serial_number || '';
          const rawType = fieldValue(obj, fieldMap.asset_type) || '';
          const rawStock = fieldValue(obj, fieldMap.stock_status) || '';
          const rate = parseRate(fieldValue(obj, fieldMap.daily_rate));
          const costPrice = parseRate(fieldValue(obj, fieldMap.cost_price));
          const chargeOut = parseRate(fieldValue(obj, fieldMap.charge_out_price));
          const assetType = detectAssetType(rawType, name, typeHint);
          const isRig = assetType === 'rig';
          const rigType = isRig ? detectRigType(rawType, name) : 'n/a';
          const stockLevel = detectStockLevel(rawStock);
          const shouldDeactivate = autoDeactivate && (stockLevel === 'out_of_stock' || stockLevel === 'needs_service');

          let match = pandaId ? byPandaId[pandaId] : null;
          if (!match && serial) match = bySerial[serial.toLowerCase().trim()];
          if (!match) match = byName[name.toLowerCase().trim()];

          const payload: any = {
            name,
            serial_number: serial,
            panda_asset_id: pandaId,
            panda_group_label: groupLabel,
            asset_type: assetType,
            is_rig: isRig,
            rig_type: rigType,
            stock_level: stockLevel,
            daily_billing_rate: rate != null ? rate : null,
            cost_price: costPrice != null ? costPrice : null,
            charge_out_price: chargeOut != null ? chargeOut : null,
            sync_status: 'synced',
            last_sync_timestamp: now,
            is_active: shouldDeactivate ? false : match ? match.is_active !== false : true,
          };

          // Apply extended (direct-copy) mapped fields
          for (const [sysField, pandaKey] of Object.entries(extraMap)) {
            const val = fieldValue(obj, pandaKey);
            if (val) payload[sysField] = val;
          }

          if (match) {
            // Preserve a confirmed/skipped rate-card link — never overwrite it
            if (match.rate_card_link_status === 'confirmed' || match.rate_card_link_status === 'skipped') {
              payload.rate_card_item_id = match.rate_card_item_id;
              payload.rate_card_link_status = match.rate_card_link_status;
            }
            toUpdate.push({ id: match.id, ...payload });
            groupSynced++;
          } else {
            toCreate.push({
              ...payload,
              rate_card_link_status: 'unmatched',
              compliance_status: 'unknown',
              notes: '',
            });
            groupCreated++;
          }
          if (shouldDeactivate && match && match.is_active !== false) groupDeactivated++;
        } catch (itemErr) {
          allErrors.push(`Object ${obj.id || '?'} in "${groupLabel}": ${(itemErr as Error).message}`);
        }
      }

      // Apply updates in batches
      if (toUpdate.length > 0) {
        for (let i = 0; i < toUpdate.length; i += 100) {
          try {
            await base44.asServiceRole.entities.SiteAsset.bulkUpdate(toUpdate.slice(i, i + 100));
          } catch (bulkErr) {
            console.error('bulkUpdate error:', (bulkErr as Error).message);
          }
        }
      }
      if (toCreate.length > 0) {
        for (let i = 0; i < toCreate.length; i += 100) {
          try {
            await base44.asServiceRole.entities.SiteAsset.bulkCreate(toCreate.slice(i, i + 100));
          } catch (bulkErr) {
            console.error('bulkCreate error:', (bulkErr as Error).message);
          }
        }
      }

      totalSynced += groupSynced;
      totalCreated += groupCreated;
      totalDeactivated += groupDeactivated;
      groupResults.push({
        group_id: groupId,
        label: groupLabel,
        pulled: allObjects.length,
        created: groupCreated,
        updated: groupSynced,
        deactivated: groupDeactivated,
      });
    }

    // --- Propose rate-card links for unmatched/proposed assets ---
    // Load all rate card items (our company, active) and re-load synced assets.
    let proposedCount = 0;
    try {
      const rateCardItems = await base44.asServiceRole.entities.RateCardItem.list('-created_date', 500);
      const ourRates = rateCardItems.filter((r: any) => r.is_active !== false && r.rate_card_source !== 'supplier');

      // Re-load assets to get the freshly created/updated ones with their IDs
      const refreshed = await base44.asServiceRole.entities.SiteAsset.list('-created_date', 500);
      const needsProposal = refreshed.filter(
        (a: any) =>
          !a.is_demo_data &&
          a.panda_asset_id &&
          a.rate_card_link_status !== 'confirmed' &&
          a.rate_card_link_status !== 'skipped'
      );

      const toLinkUpdate: any[] = [];
      for (const asset of needsProposal) {
        const match = findBestRateCardMatch(asset, ourRates, asset.division_id);
        if (match && match.id !== asset.rate_card_item_id) {
          toLinkUpdate.push({
            id: asset.id,
            rate_card_item_id: match.id,
            rate_card_link_status: 'proposed',
          });
          proposedCount++;
        } else if (!match && asset.rate_card_link_status === 'proposed') {
          // Previously proposed but no longer matches — reset to unmatched
          toLinkUpdate.push({
            id: asset.id,
            rate_card_item_id: '',
            rate_card_link_status: 'unmatched',
          });
        }
      }
      if (toLinkUpdate.length > 0) {
        for (let i = 0; i < toLinkUpdate.length; i += 100) {
          try {
            await base44.asServiceRole.entities.SiteAsset.bulkUpdate(toLinkUpdate.slice(i, i + 100));
          } catch (bulkErr) {
            console.error('link bulkUpdate error:', (bulkErr as Error).message);
          }
        }
      }
    } catch (linkErr) {
      console.error('Link proposal failed:', (linkErr as Error).message);
    }

    const summary = `${totalCreated} new, ${totalSynced} updated, ${totalDeactivated} deactivated, ${proposedCount} links proposed (${groups.length} groups).`;
    const status = allErrors.length === 0 ? 'success' : 'success';

    // --- Persist sync outcome on the config record (per-group + global) ---
    try {
      const updateData: any = {
        last_sync_at: now,
        last_sync_summary: summary + (allErrors.length ? ` ${allErrors.length} errors.` : ''),
        last_sync_status: status,
        api_token: token,
      };
      // Update per-group last_sync fields
      if (Array.isArray(config.groups) && config.groups.length > 0) {
        updateData.groups = config.groups.map((g: any) => {
          const gr = groupResults.find((r) => r.group_id === g.group_id);
          return {
            ...g,
            last_sync_at: now,
            last_sync_summary: gr
              ? `${gr.created} new, ${gr.updated} updated, ${gr.deactivated} deactivated (${gr.pulled} pulled)`
              : g.last_sync_summary,
          };
        });
      }
      if (config.id) {
        await base44.asServiceRole.entities.AssetPandaConfig.update(config.id, updateData);
      }
    } catch (cfgErr) {
      console.error('Could not update config:', (cfgErr as Error).message);
    }

    return Response.json({
      success: true,
      groups: groupResults,
      pulled: groupResults.reduce((s: number, g: any) => s + g.pulled, 0),
      created: totalCreated,
      synced: totalSynced,
      deactivated: totalDeactivated,
      proposedLinks: proposedCount,
      errors: allErrors,
      summary,
      synced_at: now,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});