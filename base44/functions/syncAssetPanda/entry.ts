import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { resolvePandaToken, buildFullFieldMap, fetchAllPandaGroups, fetchPandaGroupFields } from '../../shared/assetPandaClient.ts';
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

    // --- Resolve a bearer token (shared helper) ---
    const { token, error: tokenError, skipped: tokenSkipped } = await resolvePandaToken(config, baseUrl);
    if (tokenSkipped) return Response.json({ skipped: true, reason: tokenError });
    if (tokenError) return Response.json({ error: tokenError, details: tokenError }, { status: 402 });

    const authHeaders = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

    // --- Build the list of groups to sync ---
    // ALWAYS auto-discover ALL groups in the account via GET /v3/groups so the
    // sync pulls in every asset regardless of manual configuration. Any
    // manually-configured groups (with labels / type hints / field overrides)
    // are merged on top by group_id, so admin customisations are preserved.
    let groups: Array<{ group_id: string; label: string; asset_type_hint?: string; field_map_overrides?: any[] }> = [];
    let autoDiscovered = false;
    const configuredByGroupId: Record<string, any> = {};
    if (Array.isArray(config.groups)) {
      for (const g of config.groups) {
        if (g?.group_id) configuredByGroupId[String(g.group_id)] = g;
      }
    }

    try {
      const allGroups = await fetchAllPandaGroups(baseUrl, token);
      if (allGroups.length === 0) {
        return Response.json({ skipped: true, reason: 'No groups found in your Asset Panda account.' });
      }
      // Reference-table groups (Operators, Customers, Locations, Asset Types,
      // etc.) are not physical equipment — default them to is_asset_group=false
      // so they don't pollute the inventory. Admins can override per-group.
      const REFERENCE_KEYWORDS = ['operator', 'line manager', 'manager', 'customer', 'location', 'asset type', 'service location', 'staff', 'employee', 'supplier', 'vendor', 'contact', 'people', 'personnel', 'team', 'user'];
      const isReferenceGroup = (label: string) => {
        const l = String(label || '').toLowerCase();
        return REFERENCE_KEYWORDS.some((k) => l.includes(k));
      };
      groups = allGroups.map((g) => {
        const cfg = configuredByGroupId[g.id] || configuredByGroupId[g.key];
        const refByDefault = isReferenceGroup(g.name);
        return {
          group_id: g.id,
          label: cfg?.label || g.name,
          asset_type_hint: cfg?.asset_type_hint || 'auto',
          field_map_overrides: Array.isArray(cfg?.field_map_overrides) ? cfg.field_map_overrides : [],
          is_asset_group: cfg?.is_asset_group != null ? cfg.is_asset_group : !refByDefault,
        };
      });
      autoDiscovered = true;
    } catch (discErr) {
      // Fall back to manually configured groups if auto-discovery fails
      if (Array.isArray(config.groups) && config.groups.length > 0) {
        groups = config.groups.map((g: any) => ({
          group_id: String(g.group_id),
          label: g.label || g.group_id,
          asset_type_hint: g.asset_type_hint || 'auto',
          field_map_overrides: Array.isArray(g.field_map_overrides) ? g.field_map_overrides : [],
          is_asset_group: g.is_asset_group !== false,
        }));
      } else if (config.group_id) {
        groups = [{ group_id: String(config.group_id), label: 'Asset Panda', asset_type_hint: 'auto', field_map_overrides: [] }];
      }
      if (groups.length === 0) {
        return Response.json({ error: `Could not auto-discover groups: ${(discErr as Error).message}. Add group IDs manually in Settings → Asset Panda → Groups.` }, { status: 500 });
      }
    }

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

    // Core system fields + direct-copy fields
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
    const discoveredGroupConfigs: any[] = [];

    // --- Iterate each group ---
    for (const group of groups) {
      const groupId = group.group_id;
      const groupLabel = group.label;
      const typeHint = group.asset_type_hint;
      const isAssetGroup = group.is_asset_group !== false;

      // --- Always fetch the group's field definitions for auto-mapping ---
      let groupFields: { key: string; label: string }[] = [];
      try {
        groupFields = await fetchPandaGroupFields(baseUrl, token, groupId);
      } catch (fieldsErr) {
        console.error(`Could not fetch fields for group "${groupLabel}":`, (fieldsErr as Error).message);
      }

      // Build the field map for this group: start with legacy fixed fields, then
      // auto-detect from the group's field labels, then apply custom overrides.
      let fieldMap: Record<string, string> = {
        name: config.field_name || '',
        serial: config.field_serial || '',
        daily_rate: config.field_daily_rate || '',
        stock_status: config.field_stock_status || '',
        asset_type: config.field_asset_type || '',
        cost_price: '',
        charge_out_price: '',
      };

      // Auto-detect from field labels (now always runs, not just when missing)
      if (groupFields.length > 0) {
        const findByLabel = (keywords: string[]) => {
          const f = groupFields.find((f) => {
            const label = String(f.label || '').toLowerCase();
            return keywords.some((k) => label.includes(k));
          });
          return f ? String(f.key || '') : '';
        };
        if (!fieldMap.name) fieldMap.name = findByLabel(['name', 'title', 'asset name', 'description']);
        if (!fieldMap.serial) fieldMap.serial = findByLabel(['serial', 'asset tag', 'tag', 'registration', 'reg']);
        if (!fieldMap.daily_rate) fieldMap.daily_rate = findByLabel(['rate', 'billing', 'day rate', 'daily rate']);
        if (!fieldMap.stock_status) fieldMap.stock_status = findByLabel(['stock', 'condition', 'status', 'availability', 'state']);
        if (!fieldMap.asset_type) fieldMap.asset_type = findByLabel(['type', 'category', 'class', 'group type', 'asset type']);
        if (!fieldMap.cost_price) fieldMap.cost_price = findByLabel(['cost', 'cost price', 'purchase cost', 'internal cost', 'purchase price']);
        if (!fieldMap.charge_out_price) fieldMap.charge_out_price = findByLabel(['charge', 'charge out', 'sell', 'sale price', 'charge-out', 'price']);
      }

      // --- Sample-object validation & fallback ---
      // Fetch one real object to (a) validate the label-detected name field is
      // actually populated on real data, and (b) fall back to picking the first
      // non-empty, non-id string field if label detection picked an empty/wrong
      // field. Also infers serial if still missing.
      try {
        const sampleRes = await fetch(`${baseUrl}/v3/groups/${groupId}/search/objects?limit=1&offset=0`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ view_archived: 'all' }),
        });
        if (sampleRes.ok) {
          const sampleJson: any = await sampleRes.json();
          const sampleObjs = Array.isArray(sampleJson) ? sampleJson : (sampleJson.objects || sampleJson.data || sampleJson.results || sampleJson.group_objects || []);
          const sample = sampleObjs[0];
          if (sample) {
            const idKeys = new Set(['id', '_id', 'object_id', 'group_id', 'created_at', 'updated_at', 'archived', 'created_by', 'modified_at', 'modified_by']);
            // Validate: is the detected name field actually populated on a real object?
            const currentNameVal = fieldMap.name ? fieldValue(sample, fieldMap.name) : '';
            if (!currentNameVal) {
              // Label detection missed or picked an empty field — pick the first
              // non-empty, non-id string field from labelled fields, then any key.
              let picked = '';
              for (const f of groupFields) {
                if (idKeys.has(f.key) || f.key === fieldMap.name) continue;
                const v = fieldValue(sample, f.key);
                if (v && v.length >= 2 && v.length <= 120) { picked = f.key; break; }
              }
              if (!picked) {
                for (const key of Object.keys(sample)) {
                  if (idKeys.has(key) || key === fieldMap.name) continue;
                  const v = fieldValue(sample, key);
                  if (v && v.length >= 2 && v.length <= 120) { picked = key; break; }
                }
              }
              if (picked) fieldMap.name = picked;
            }
            // Infer serial if still missing
            if (!fieldMap.serial) {
              for (const f of groupFields) {
                if (idKeys.has(f.key) || f.key === fieldMap.name) continue;
                const v = fieldValue(sample, f.key);
                if (v && v.length >= 2 && v.length <= 60 && /[a-z0-9]/i.test(v)) { fieldMap.serial = f.key; break; }
              }
            }
          }
        }
      } catch (sampleErr) {
        console.error(`Sample fallback failed for group "${groupLabel}":`, (sampleErr as Error).message);
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

      // Record the discovered group config for saving
      discoveredGroupConfigs.push({
        group_id: groupId,
        label: groupLabel,
        asset_type_hint: typeHint || 'auto',
        field_map_overrides: group.field_map_overrides || [],
        is_asset_group: isAssetGroup,
      });

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
          allErrors.push(`Group "${groupLabel}" search failed (HTTP ${objRes.status}): ${errBody.slice(0, 200)}`);
          break;
        }
        const objJson: any = await objRes.json();
        const page = Array.isArray(objJson) ? objJson : (objJson.objects || objJson.data || objJson.results || objJson.group_objects || []);
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
          } else if (isAssetGroup) {
            // Only create new records for asset groups — reference-table groups
            // (Operators, Customers, etc.) update existing matches in place
            // but don't create new inventory records.
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

      // Deduplicate by ID — multiple panda objects can match the same existing
      // record (e.g. by name when many were "Unnamed Asset"), which produces
      // duplicate IDs that bulkUpdate rejects.
      const seenIds = new Set<string>();
      const dedupedUpdate = toUpdate.filter((u: any) => {
        if (seenIds.has(u.id)) return false;
        seenIds.add(u.id);
        return true;
      });
      // Apply updates in batches
      if (dedupedUpdate.length > 0) {
        for (let i = 0; i < dedupedUpdate.length; i += 100) {
          try {
            await base44.asServiceRole.entities.SiteAsset.bulkUpdate(dedupedUpdate.slice(i, i + 100));
          } catch (bulkErr) {
            console.error('bulkUpdate error:', (bulkErr as Error).message);
            allErrors.push(`bulkUpdate batch failed: ${(bulkErr as Error).message}`);
          }
        }
      }
      if (toCreate.length > 0) {
        for (let i = 0; i < toCreate.length; i += 100) {
          try {
            await base44.asServiceRole.entities.SiteAsset.bulkCreate(toCreate.slice(i, i + 100));
          } catch (bulkErr) {
            console.error('bulkCreate error:', (bulkErr as Error).message);
            allErrors.push(`bulkCreate batch failed: ${(bulkErr as Error).message}`);
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
        fields_detected: groupFields.length,
        field_map: { ...fieldMap, ...extraMap },
      });
    }

    // --- Propose rate-card links for unmatched/proposed assets ---
    let proposedCount = 0;
    try {
      const rateCardItems = await base44.asServiceRole.entities.RateCardItem.list('-created_date', 500);
      const ourRates = rateCardItems.filter((r: any) => r.is_active !== false && r.rate_card_source !== 'supplier');

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

    const summary = `${totalCreated} new, ${totalSynced} updated, ${totalDeactivated} deactivated, ${proposedCount} links proposed (${groups.length} groups${autoDiscovered ? ' auto-discovered' : ''}).`;
    const status = allErrors.length === 0 ? 'success' : 'success';

    // --- Persist sync outcome on the config record (per-group + global) ---
    try {
      const updateData: any = {
        last_sync_at: now,
        last_sync_summary: summary + (allErrors.length ? ` ${allErrors.length} errors.` : ''),
        last_sync_status: status,
        api_token: token,
      };
      // If auto-discovered, save the discovered groups so they show in Settings
      if (autoDiscovered && discoveredGroupConfigs.length > 0) {
        updateData.groups = discoveredGroupConfigs.map((g) => ({
          group_id: g.group_id,
          label: g.label,
          asset_type_hint: g.asset_type_hint,
          field_map_overrides: g.field_map_overrides || [],
          is_asset_group: g.is_asset_group,
        }));
      } else if (Array.isArray(config.groups) && config.groups.length > 0) {
        updateData.groups = config.groups.map((g: any) => {
          const gr = groupResults.find((r) => r.group_id === String(g.group_id));
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
      auto_discovered: autoDiscovered,
      errors: allErrors,
      summary,
      synced_at: now,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});