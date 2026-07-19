import { createClientFromRequest, createClient } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    // Connect to the GC Compliance Manager app using the current user's token
    const authHeader = req.headers.get('authorization') || '';
    const userToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const complianceApp = createClient({ appId: "6a3be07293b53789beb4f09e", token: userToken });

    // Fetch all Equipment records from the compliance app
    let equipmentRecords = [];
    try {
      equipmentRecords = await complianceApp.entities.Equipment.list('-created_date', 500);
    } catch (fetchErr) {
      return Response.json({
        error: 'Failed to fetch from Compliance Manager app',
        details: fetchErr.message,
        hint: 'Ensure your Base44 account has access to the GC Compliance Manager app, or set that app to Public.'
      }, { status: 502 });
    }

    // Fetch all Rig records from the compliance app
    let rigRecords = [];
    try {
      rigRecords = await complianceApp.entities.Rig.list('-created_date', 500);
    } catch (rigFetchErr) {
      // Rigs entity might not exist yet — continue with equipment only
      console.error('Could not fetch Rig records:', rigFetchErr.message);
    }

    // Fetch all SiteAssets in this app
    const siteAssets = await base44.asServiceRole.entities.SiteAsset.list('-created_date', 500);

    // === Helpers for Equipment records ===

    const extractEquipmentStatus = (e) => {
      const raw = e.status || e.compliance_status || e.complianceStatus || '';
      if (raw) {
        const lower = String(raw).toLowerCase();
        if (lower.includes('compliant') && !lower.includes('non')) return 'compliant';
        if (lower.includes('expir')) return 'expiring';
        if (lower.includes('expired') || lower.includes('lapsed') || lower.includes('non')) return 'expired';
        if (lower.includes('unknown') || lower.includes('pending')) return 'unknown';
      }
      // Fall back to computing status from expiry / inspection date
      const expiry = e.expiry_date || e.compliance_expiry_date || e.next_inspection_date || e.next_service_date || e.nextTestDate || e.inspection_due_date || e.loler_expiry || e.test_due_date || '';
      if (expiry) {
        const now = new Date();
        const expiryDate = new Date(expiry);
        if (isNaN(expiryDate.getTime())) return 'unknown';
        const daysUntil = (expiryDate - now) / (1000 * 60 * 60 * 24);
        if (daysUntil < 0) return 'expired';
        if (daysUntil < 30) return 'expiring';
        return 'compliant';
      }
      return 'unknown';
    };

    const extractExpiry = (e) => {
      return e.expiry_date || e.compliance_expiry_date || e.next_inspection_date || e.next_service_date || e.nextTestDate || e.inspection_due_date || e.loler_expiry || e.test_due_date || '';
    };

    const extractSerial = (e) => {
      return e.serial_number || e.serialNumber || e.serial || e.registration_number || '';
    };

    const extractEquipmentType = (e) => {
      return String(e.equipment_type || e.type || e.category || e.type_name || e.category_label || '').trim();
    };

    const extractResponsiblePerson = (e) => {
      return String(e.responsible_person || e.responsiblePerson || e.owner || e.assigned_to || e.person_responsible || e.operator || e.manager || e.inspector || e.tested_by || e.examiner || '').trim();
    };

    const extractEquipmentAssetType = (e) => {
      // Build a combined string from equipment_type, name, and category —
      // some lifting gear has equipment_type "Other" but the asset NAME contains
      // the real type (e.g. "Tipping Hook", "Sinker Bar"). Checking the name
      // catches these where the type field alone doesn't.
      const typeRaw = String(e.equipment_type || e.type_name || e.type || '').toLowerCase();
      const nameRaw = String(e.name || e.title || '').toLowerCase();
      const catRaw = String(e.category || e.asset_type || '').toLowerCase();
      const combined = `${typeRaw} ${nameRaw} ${catRaw}`;
      const liftingKeywords = ['lift', 'shackle', 'sling', 'chain', 'rope', 'hook', 'hoist', 'crane', 'rigging', 'swl', 'lever', 'pull', 'beam', 'spreader', 'thimble', 'ferrule', 'sheave', 'sleeve', 'eyebolt', 'eye bolt', 'd-shackle', 'bow shackle', 'wire rope', 'sinker', 'clevis', 'tipping hook', 'winch'];
      if (combined.includes('trailer')) return 'trailer';
      if (liftingKeywords.some(kw => combined.includes(kw))) return 'lifting';
      if (combined.includes('machine') || combined.includes('excav') || combined.includes('digger') || combined.includes('grout') || combined.includes('mixer')) return 'machinery';
      if (combined.includes('vehicle') || combined.includes('van') || combined.includes('truck')) return 'vehicle';
      return 'machinery';
    };

    // === Helpers for Rig records ===

    const extractRigType = (r) => {
      const raw = String(r.rig_type || r.drilling_type || '').toLowerCase();
      if (raw.includes('rotary')) return 'rotary';
      if (raw.includes('cp') || raw.includes('cable') || raw.includes('percussion')) return 'cp';
      return 'n/a';
    };

    const extractRigStatus = (r) => {
      const raw = String(r.status || '').toLowerCase();
      if (!raw) return 'unknown';
      if (raw.includes('active') || raw.includes('compliant') || raw.includes('deploy')) return 'compliant';
      if (raw.includes('decommission') || raw.includes('inactive') || raw.includes('expired') || raw.includes('non')) return 'expired';
      if (raw.includes('expir')) return 'expiring';
      return 'unknown';
    };

    const now = new Date().toISOString();
    let synced = 0;
    let unmatched = 0;
    let created = 0;
    let rigsSynced = 0;
    let rigsCreated = 0;
    const unmatchedAssets = [];
    const matchedEquipmentIds = new Set();
    const matchedRigIds = new Set();
    const matchedSiteAssetIds = new Set();

    // === Sync Equipment records (existing assets) ===
    for (const asset of siteAssets) {
      // Skip assets that are rigs — they'll be matched against rig records below
      if (asset.asset_type === 'rig') continue;

      let match = null;

      if (asset.external_compliance_id) {
        match = equipmentRecords.find(e => e.id === asset.external_compliance_id);
      }

      if (!match && asset.serial_number) {
        const assetSerial = String(asset.serial_number).toLowerCase().trim();
        match = equipmentRecords.find(e => {
          const eSerial = String(extractSerial(e)).toLowerCase().trim();
          return eSerial && eSerial === assetSerial;
        });
      }

      if (!match && asset.name) {
        const assetName = String(asset.name).toLowerCase().trim();
        match = equipmentRecords.find(e => {
          const eName = String(e.name || '').toLowerCase().trim();
          return eName && eName === assetName;
        });
      }

      if (!match) {
        unmatched++;
        unmatchedAssets.push({ id: asset.id, name: asset.name, serial: asset.serial_number });
        continue;
      }

      matchedEquipmentIds.add(match.id);
      matchedSiteAssetIds.add(asset.id);
      const status = extractEquipmentStatus(match);
      const assetType = extractEquipmentAssetType(match);
      // Machinery & trailers: CoC lasts the lifetime of the equipment — no expiry date
      const expiryDate = (assetType === 'machinery' || assetType === 'trailer') ? null : (extractExpiry(match) || null);

      await base44.asServiceRole.entities.SiteAsset.update(asset.id, {
        compliance_status: status,
        compliance_expiry_date: expiryDate,
        compliance_last_checked: now,
        external_compliance_id: match.id,
        asset_type: assetType,
        equipment_type: extractEquipmentType(match) || asset.equipment_type || '',
        responsible_person: extractResponsiblePerson(match),
        notes: match.notes || match.last_test_notes || asset.notes || '',
      });
      synced++;
    }

    // === Create new SiteAssets from unmatched Equipment records ===
    const newEquipmentAssets = [];
    for (const eq of equipmentRecords) {
      if (matchedEquipmentIds.has(eq.id)) continue;
      const name = eq.name || eq.title || 'Unnamed Equipment';
      const serial = extractSerial(eq);
      const assetType = extractEquipmentAssetType(eq);

      newEquipmentAssets.push({
        name,
        asset_type: assetType,
        is_rig: false,
        equipment_type: extractEquipmentType(eq),
        rig_type: 'n/a',
        serial_number: serial,
        external_compliance_id: eq.id,
        compliance_status: extractEquipmentStatus(eq),
        compliance_expiry_date: (assetType === 'machinery' || assetType === 'trailer') ? null : (extractExpiry(eq) || null),
        compliance_last_checked: now,
        responsible_person: extractResponsiblePerson(eq),
        is_active: true,
        notes: eq.notes || eq.last_test_notes || '',
      });
    }

    if (newEquipmentAssets.length > 0) {
      try {
        await base44.asServiceRole.entities.SiteAsset.bulkCreate(newEquipmentAssets);
        created = newEquipmentAssets.length;
      } catch (createErr) {
        console.error('Error creating new equipment assets:', createErr.message);
      }
    }

    // === Sync Rig records ===
    for (const asset of siteAssets) {
      // Only process rig-type assets against rig records
      if (asset.asset_type !== 'rig') continue;

      let match = null;

      if (asset.external_compliance_id) {
        match = rigRecords.find(r => r.id === asset.external_compliance_id);
      }

      if (!match && asset.serial_number) {
        const assetSerial = String(asset.serial_number).toLowerCase().trim();
        match = rigRecords.find(r => {
          const rSerial = String(r.registration_number || '').toLowerCase().trim();
          return rSerial && rSerial === assetSerial;
        });
      }

      if (!match && asset.name) {
        const assetName = String(asset.name).toLowerCase().trim();
        match = rigRecords.find(r => {
          const rName = String(r.name || '').toLowerCase().trim();
          return rName && rName === assetName;
        });
      }

      if (!match) {
        // Rig no longer in compliance app — keep it but mark unknown
        continue;
      }

      matchedRigIds.add(match.id);
      matchedSiteAssetIds.add(asset.id);
      await base44.asServiceRole.entities.SiteAsset.update(asset.id, {
        compliance_status: extractRigStatus(match),
        compliance_last_checked: now,
        external_compliance_id: match.id,
        rig_type: extractRigType(match),
        serial_number: match.registration_number || asset.serial_number || '',
        responsible_person: extractResponsiblePerson(match),
        notes: match.notes || asset.notes || '',
        is_rig: true,
      });
      rigsSynced++;
    }

    // === Create new SiteAssets from unmatched Rig records ===
    const newRigAssets = [];
    for (const rig of rigRecords) {
      if (matchedRigIds.has(rig.id)) continue;
      newRigAssets.push({
        name: rig.name || 'Unnamed Rig',
        asset_type: 'rig',
        is_rig: true,
        rig_type: extractRigType(rig),
        serial_number: rig.registration_number || '',
        external_compliance_id: rig.id,
        compliance_status: extractRigStatus(rig),
        compliance_expiry_date: null,
        compliance_last_checked: now,
        responsible_person: extractResponsiblePerson(rig),
        is_active: true,
        notes: rig.notes || '',
      });
    }

    if (newRigAssets.length > 0) {
      try {
        await base44.asServiceRole.entities.SiteAsset.bulkCreate(newRigAssets);
        rigsCreated = newRigAssets.length;
      } catch (createErr) {
        console.error('Error creating new rig assets:', createErr.message);
      }
    }

    // === Purge SiteAssets no longer in GC Compliance Manager ===
    let purged = 0;
    let jobAssignmentsRemoved = 0;
    let jobCostItemsRemoved = 0;
    const orphanedAssetIds = siteAssets
      .filter(a => !matchedSiteAssetIds.has(a.id))
      .map(a => a.id);

    if (orphanedAssetIds.length > 0) {
      // Remove job asset assignments pointing to orphaned assets
      try {
        const assignments = await base44.asServiceRole.entities.JobAssetAssignment.list('-created_date', 500);
        const staleAssignments = assignments.filter(a => orphanedAssetIds.includes(a.asset_id));
        for (const sa of staleAssignments) {
          await base44.asServiceRole.entities.JobAssetAssignment.delete(sa.id);
        }
        jobAssignmentsRemoved = staleAssignments.length;
      } catch (e) { console.error('Error cleaning job asset assignments:', e.message); }

      // Remove job cost items pointing to orphaned assets
      try {
        const costItems = await base44.asServiceRole.entities.JobCostItem.list('-created_date', 500);
        const staleCostItems = costItems.filter(c => orphanedAssetIds.includes(c.site_asset_id));
        for (const sc of staleCostItems) {
          await base44.asServiceRole.entities.JobCostItem.delete(sc.id);
        }
        jobCostItemsRemoved = staleCostItems.length;
      } catch (e) { console.error('Error cleaning job cost items:', e.message); }

      // Delete the orphaned SiteAssets
      try {
        for (const id of orphanedAssetIds) {
          await base44.asServiceRole.entities.SiteAsset.delete(id);
        }
        purged = orphanedAssetIds.length;
      } catch (e) { console.error('Error purging orphaned assets:', e.message); }
    }

    // === Sync linked equipment — group equipment records by rig_id ===
    const freshSiteAssets = await base44.asServiceRole.entities.SiteAsset.list('-created_date', 500);
    let linksUpdated = 0;

    const equipmentByRigId = {};
    for (const eq of equipmentRecords) {
      const rigId = eq.rig_id || eq.rigId || eq.linked_rig_id || '';
      if (rigId && String(rigId) !== 'null') {
        const key = String(rigId);
        if (!equipmentByRigId[key]) equipmentByRigId[key] = [];
        equipmentByRigId[key].push(eq.id);
      }
    }

    for (const [complianceRigId, eqIds] of Object.entries(equipmentByRigId)) {
      const rigAsset = freshSiteAssets.find(a => a.asset_type === 'rig' && a.external_compliance_id === complianceRigId);
      if (!rigAsset) continue;

      const siteAssetLinkedIds = eqIds
        .map(eqId => {
          const eqAsset = freshSiteAssets.find(a => a.external_compliance_id === eqId);
          return eqAsset ? eqAsset.id : null;
        })
        .filter(Boolean);

      if (siteAssetLinkedIds.length === 0) continue;

      const current = new Set(rigAsset.linked_equipment_ids || []);
      const needsUpdate = siteAssetLinkedIds.some(id => !current.has(id)) || siteAssetLinkedIds.length !== current.size;
      if (needsUpdate) {
        await base44.asServiceRole.entities.SiteAsset.update(rigAsset.id, {
          linked_equipment_ids: siteAssetLinkedIds,
        });
        linksUpdated++;
      }
    }

    // === Auto-provision EquipmentCatalogue entries for SiteAssets not yet in the catalogue ===
    let catalogueCreated = 0;
    let catalogueLinksUpdated = 0;

    const existingCatalogue = await base44.asServiceRole.entities.EquipmentCatalogue.list('-created_date', 500);
    const catByAssetId = {};
    for (const c of existingCatalogue) {
      if (c.site_asset_id) catByAssetId[c.site_asset_id] = c;
    }

    const importableTypes = ['rig', 'machinery', 'trailer', 'lifting'];
    const newCatalogueEntries = [];
    for (const a of freshSiteAssets) {
      if (a.is_active === false) continue;
      if (!importableTypes.includes(a.asset_type)) continue;
      if (catByAssetId[a.id]) continue;
      newCatalogueEntries.push({
        description: a.name,
        category: 'internal_equipment',
        default_supplier_id: '',
        default_unit_cost: 0,
        default_unit_label: 'day',
        default_vat_exempt: false,
        reference_number: a.serial_number || '',
        responsible_person: a.responsible_person || '',
        site_asset_id: a.id,
        is_active: true,
      });
    }

    let allCatalogue = existingCatalogue;
    if (newCatalogueEntries.length > 0) {
      try {
        const createdCat = await base44.asServiceRole.entities.EquipmentCatalogue.bulkCreate(newCatalogueEntries);
        catalogueCreated = createdCat.length;
        allCatalogue = [...existingCatalogue, ...createdCat];
      } catch (catCreateErr) {
        console.error('Error creating catalogue entries:', catCreateErr.message);
      }
    }

    // Rebuild map with any newly created entries
    const catByAssetIdFresh = {};
    for (const c of allCatalogue) {
      if (c.site_asset_id) catByAssetIdFresh[c.site_asset_id] = c;
    }

    // === Sync linked_catalogue_ids on rig catalogue items from SiteAsset linked_equipment_ids ===
    for (const a of freshSiteAssets) {
      if (a.asset_type !== 'rig') continue;
      if (!a.linked_equipment_ids || a.linked_equipment_ids.length === 0) continue;
      const rigCat = catByAssetIdFresh[a.id];
      if (!rigCat) continue;

      const linkedCatIds = a.linked_equipment_ids
        .map(lid => catByAssetIdFresh[lid]?.id)
        .filter(Boolean);

      const current = rigCat.linked_catalogue_ids || [];
      const currentSet = new Set(current);
      const needsUpdate = linkedCatIds.some(id => !currentSet.has(id)) || linkedCatIds.length !== current.length;
      if (needsUpdate && linkedCatIds.length > 0) {
        await base44.asServiceRole.entities.EquipmentCatalogue.update(rigCat.id, {
          linked_catalogue_ids: linkedCatIds,
        });
        catalogueLinksUpdated++;
      }
    }

    // === Auto-link rig catalogue entries to Our Rate Card items and set day rate ===
    let rateCardLinksSet = 0;
    let rateCardCostsSet = 0;
    const rateCardItems = await base44.asServiceRole.entities.RateCardItem.filter({ category: 'labour' });

    const matchRigRateCard = (rigCat, asset) => {
      // 1. Explicit link already set — respect it
      if (rigCat.rate_card_item_id) {
        const linked = rateCardItems.find(r => r.id === rigCat.rate_card_item_id);
        if (linked) return linked;
      }
      const rigType = asset?.rig_type;
      const desc = String(rigCat.description || '').toLowerCase();
      const isCutdown = /cut\s*down|cutdown/i.test(desc);

      // 2. CP rigs — rate card entries have no model numbers, match by type
      const looksCp = rigType === 'cp' || ((!rigType || rigType === 'n/a') && (isCutdown || /dando|percussive|cable/i.test(desc)));
      if (looksCp) {
        if (isCutdown) {
          const isElectric = /electric/i.test(desc);
          const cutdown = rateCardItems.find(r =>
            r.subcategory === 'Cable Percussive Crews' &&
            /cutdown/i.test(r.description) &&
            !/enabling/i.test(r.description) &&
            (isElectric ? /electric/i.test(r.description) : /diesel/i.test(r.description))
          );
          if (cutdown) return cutdown;
          // Fallback to any cutdown crew
          const anyCutdown = rateCardItems.find(r =>
            r.subcategory === 'Cable Percussive Crews' &&
            /cutdown/i.test(r.description) &&
            !/enabling/i.test(r.description)
          );
          if (anyCutdown) return anyCutdown;
        }
        // Standard CP crew (exact: "Cable Percussive Crew")
        const cpCrew = rateCardItems.find(r =>
          r.subcategory === 'Cable Percussive Crews' &&
          /^cable percussive crew$/i.test(String(r.description || '').trim())
        );
        if (cpCrew) return cpCrew;
      }

      // 3. Rotary rigs — match by model number in description
      const numMatch = desc.match(/(\d{2,4})/);
      if (numMatch) {
        const num = numMatch[1];
        const match = rateCardItems.find(r =>
          r.category === 'labour' &&
          r.subcategory === 'Rotary Crews' &&
          (r.description || '').includes(num) &&
          !/additional|3rd|enabling/i.test(r.description || '')
        );
        if (match) return match;
      }

      return null;
    };

    for (const c of allCatalogue) {
      const asset = c.site_asset_id ? freshSiteAssets.find(a => a.id === c.site_asset_id) : null;
      if (!asset || asset.asset_type !== 'rig') continue;

      const rateCardItem = matchRigRateCard(c, asset);
      if (rateCardItem) {
        const needsLink = c.rate_card_item_id !== rateCardItem.id;
        const needsCost = (Number(c.default_unit_cost) || 0) === 0;
        if (needsLink || needsCost) {
          const update = {};
          if (needsLink) { update.rate_card_item_id = rateCardItem.id; rateCardLinksSet++; }
          if (needsCost) { update.default_unit_cost = Number(rateCardItem.price) || 0; rateCardCostsSet++; }
          await base44.asServiceRole.entities.EquipmentCatalogue.update(c.id, update);
        }
      }
    }

    return Response.json({
      success: true,
      total_equipment_records: equipmentRecords.length,
      total_rig_records: rigRecords.length,
      equipment_synced: synced,
      equipment_created: created,
      equipment_unmatched: unmatched,
      rigs_synced: rigsSynced,
      rigs_created: rigsCreated,
      links_updated: linksUpdated,
      catalogue_created: catalogueCreated,
      catalogue_links_updated: catalogueLinksUpdated,
      rate_card_links_set: rateCardLinksSet,
      rate_card_costs_set: rateCardCostsSet,
      unmatched_assets: unmatchedAssets,
      purged,
      job_assignments_removed: jobAssignmentsRemoved,
      job_cost_items_removed: jobCostItemsRemoved,
      synced_at: now,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});