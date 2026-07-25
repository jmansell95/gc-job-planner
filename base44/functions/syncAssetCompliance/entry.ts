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

    // Fetch all SiteAssets in this app — exclude demo assets so sync never
    // touches or purges showcase data created by the Demo Data Manager.
    const allSiteAssets = await base44.asServiceRole.entities.SiteAsset.list('-created_date', 500);
    const siteAssets = allSiteAssets.filter(a => !a.is_demo_data);

    // === Helpers for Equipment records ===

    // GC Compliance Manager stores expiry dates in inconsistent formats
    // (ISO "2026-10-01", DD/MM/YYYY "28/11/2026", DD-MM-YYYY "05-09-2026",
    // and truncated month names like "26 Decembe"). The native Date constructor
    // returns Invalid Date for most of these, which silently made every item
    // "unknown" — so the expired/expiring counts on the settings page read 0.
    // This parser handles all the formats GC actually emits.
    const parseFlexibleDate = (raw) => {
      if (!raw) return null;
      const s = String(raw).trim();
      if (!s || /^null$/i.test(s)) return null;
      // DD/MM/YYYY or DD/MM/YY
      const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
      if (m) {
        let [, d, mo, y] = m;
        if (y.length === 2) y = '20' + y;
        const dt = new Date(`${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}T00:00:00`);
        return isNaN(dt.getTime()) ? null : dt;
      }
      // DD-MM-YYYY
      const m2 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
      if (m2) {
        let [, d, mo, y] = m2;
        if (y.length === 2) y = '20' + y;
        const dt = new Date(`${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}T00:00:00`);
        return isNaN(dt.getTime()) ? null : dt;
      }
      // Truncated month name — "26 Decembe" -> pad to "26 December"
      const monthShort = s.match(/^(\d{1,2})\s+([A-Za-z]{3,})/);
      if (monthShort && !s.match(/^\d{4}-/)) {
        const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        const partial = monthShort[2].toLowerCase();
        const fullMonth = months.find(mn => mn.toLowerCase().startsWith(partial));
        if (fullMonth) {
          const yearMatch = s.match(/(\d{4})/);
          const y = yearMatch ? yearMatch[1] : String(new Date().getFullYear());
          const mo = String(months.indexOf(fullMonth) + 1).padStart(2, '0');
          const dt = new Date(`${y}-${mo}-${monthShort[1].padStart(2, '0')}T00:00:00`);
          return isNaN(dt.getTime()) ? null : dt;
        }
      }
      // ISO or anything Date can parse
      const dt = new Date(s);
      return isNaN(dt.getTime()) ? null : dt;
    };

    const extractExpiry = (e) => {
      return e.expiry_date || e.compliance_expiry_date || e.next_inspection_date || e.next_service_date || e.nextTestDate || e.inspection_due_date || e.loler_expiry || e.test_due_date || '';
    };

    // Status is driven by the expiry/inspection date (the source of truth), not
    // the raw status text — GC sometimes marks items "compliant" even when the
    // expiry date has already passed. If a valid date exists, it wins.
    const extractEquipmentStatus = (e) => {
      const raw = e.status || e.compliance_status || e.complianceStatus || '';
      const expiryRaw = extractExpiry(e);
      const expiryDate = parseFlexibleDate(expiryRaw);
      if (expiryDate) {
        const now = new Date();
        const daysUntil = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        if (daysUntil < 0) return 'expired';
        if (daysUntil < 30) return 'expiring';
        return 'compliant';
      }
      // No usable date — fall back to the raw status text
      if (raw) {
        const lower = String(raw).toLowerCase();
        if (lower.includes('compliant') && !lower.includes('non')) return 'compliant';
        if (lower.includes('expir')) return 'expiring';
        if (lower.includes('expired') || lower.includes('lapsed') || lower.includes('non')) return 'expired';
        if (lower.includes('unknown') || lower.includes('pending')) return 'unknown';
      }
      return 'unknown';
    };

    const extractSerial = (e) => {
      return e.serial_number || e.serialNumber || e.serial || e.registration_number || '';
    };

    const extractEquipmentType = (e) => {
      return String(e.equipment_type || e.type_name || e.type || '').trim();
    };

    // Raw category value copied verbatim from the GC Compliance Manager record.
    // Kept separate from equipment_type so the original GC grouping is preserved exactly.
    const extractCategory = (e) => {
      return String(e.category || e.asset_type || e.equipment_category || e.group || e.category_label || '').trim();
    };

    const extractToolingNotes = (e) => {
      return String(e.tooling_notes || e.tooling || e.casing_sizes || e.augers || e.core_barrels || e.specifications || e.tooling || '').trim();
    };

    const extractResponsiblePerson = (e) => {
      return String(e.responsible_person || e.responsiblePerson || e.owner || e.assigned_to || e.person_responsible || e.operator || e.manager || e.inspector || e.tested_by || e.examiner || '').trim();
    };

    // === Maintenance / Service data (GC Compliance Manager) ===
    // GC stores service history as "last test" (LOLER/PUWER inspection) data:
    // last_test_date = when the asset was last inspected/serviced,
    // inspection_interval_months = the re-test cadence (e.g. 6 or 12 months),
    // expiry_date = the next inspection due date. We compute next_service_date
    // from last_test_date + interval when possible, falling back to expiry_date.
    // Repair info comes from decommissioned_reason / decommissioned_date.
    const toDateStr = (dt) => (dt instanceof Date && !isNaN(dt.getTime())) ? dt.toISOString().slice(0, 10) : null;

    const addMonths = (dt, months) => {
      if (!dt || !months) return null;
      const d = new Date(dt.getTime());
      d.setMonth(d.getMonth() + Number(months));
      return d;
    };

    const extractLastServiceDate = (e) => {
      const raw = e.last_test_date || e.lastTestDate || e.issue_date || e.date_last_serviced || '';
      return parseFlexibleDate(raw);
    };

    const extractNextServiceDate = (e) => {
      const lastTest = parseFlexibleDate(e.last_test_date || e.lastTestDate);
      const interval = Number(e.inspection_interval_months || e.inspectionIntervalMonths) || 0;
      if (lastTest && interval) {
        const computed = addMonths(lastTest, interval);
        if (computed) return computed;
      }
      // Fall back to the compliance expiry date (which IS the next inspection due)
      return parseFlexibleDate(e.expiry_date || e.next_inspection_date || e.next_service_date || '');
    };

    const extractServiceNotes = (e) => {
      const parts = [
        e.last_test_notes && `Notes: ${e.last_test_notes}`,
        e.last_test_result && `Result: ${e.last_test_result}`,
        e.last_test_company && `Tested by: ${e.last_test_company}`,
        e.inspector && `Inspector: ${e.inspector}`,
      ].filter(Boolean);
      return parts.join(' · ').trim();
    };

    const extractRepairNotes = (e) => {
      const parts = [
        e.decommissioned_reason && `Decommissioned: ${e.decommissioned_reason}`,
        e.decommissioned_date && `Date: ${e.decommissioned_date}`,
      ].filter(Boolean);
      return parts.join(' · ').trim();
    };

    const deriveMaintenanceStatus = (nextServiceDate) => {
      if (!nextServiceDate) return 'unknown';
      const now = new Date();
      const daysUntil = (nextServiceDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      if (daysUntil < 0) return 'overdue';
      if (daysUntil < 30) return 'due_soon';
      return 'ok';
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

      // Match STRICTLY by the GC compliance record ID. The previous serial and
      // name fallbacks silently re-linked orphaned assets (whose original GC
      // record had been deleted) to a DIFFERENT GC record that happened to
      // share a serial or name — overwriting external_compliance_id and
      // hiding the orphan from the purge, so phantom assets not in the real
      // GC app kept appearing. ID-only matching keeps the link honest; true
      // orphans now fall through to the purge below.
      let match = null;
      if (asset.external_compliance_id) {
        match = equipmentRecords.find(e => e.id === asset.external_compliance_id);
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
        compliance_category: extractCategory(match) || asset.compliance_category || '',
        responsible_person: extractResponsiblePerson(match),
        tooling_notes: extractToolingNotes(match) || asset.tooling_notes || '',
        notes: match.notes || match.last_test_notes || asset.notes || '',
        last_service_date: toDateStr(extractLastServiceDate(match)),
        next_service_date: toDateStr(extractNextServiceDate(match)),
        service_notes: extractServiceNotes(match),
        repair_notes: extractRepairNotes(match),
        maintenance_status: deriveMaintenanceStatus(extractNextServiceDate(match)),
      });
      synced++;
    }

    // === Create new SiteAssets from unmatched Equipment records ===
    // Skip any demo-tagged assets that may have matched — they must never be
    // overwritten by the sync. (siteAssets list already excludes demo records,
    // so matchedEquipmentIds only contains real assets.)
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
        compliance_category: extractCategory(eq),
        rig_type: 'n/a',
        serial_number: serial,
        external_compliance_id: eq.id,
        compliance_status: extractEquipmentStatus(eq),
        compliance_expiry_date: (assetType === 'machinery' || assetType === 'trailer') ? null : (extractExpiry(eq) || null),
        compliance_last_checked: now,
        responsible_person: extractResponsiblePerson(eq),
        tooling_notes: extractToolingNotes(eq),
        is_active: true,
        notes: eq.notes || eq.last_test_notes || '',
        last_service_date: toDateStr(extractLastServiceDate(eq)),
        next_service_date: toDateStr(extractNextServiceDate(eq)),
        service_notes: extractServiceNotes(eq),
        repair_notes: extractRepairNotes(eq),
        maintenance_status: deriveMaintenanceStatus(extractNextServiceDate(eq)),
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

      // Strict ID-only matching (see equipment loop comment above).
      let match = null;
      if (asset.external_compliance_id) {
        match = rigRecords.find(r => r.id === asset.external_compliance_id);
      }

      if (!match) {
        // Rig no longer in compliance app — leave it for the purge below.
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
        compliance_category: extractCategory(match) || asset.compliance_category || '',
        responsible_person: extractResponsiblePerson(match),
        tooling_notes: extractToolingNotes(match) || asset.tooling_notes || '',
        notes: match.notes || asset.notes || '',
        is_rig: true,
        last_service_date: toDateStr(extractLastServiceDate(match)),
        next_service_date: toDateStr(extractNextServiceDate(match)),
        service_notes: extractServiceNotes(match),
        repair_notes: extractRepairNotes(match),
        maintenance_status: deriveMaintenanceStatus(extractNextServiceDate(match)),
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
        compliance_category: extractCategory(rig),
        responsible_person: extractResponsiblePerson(rig),
        tooling_notes: extractToolingNotes(rig),
        is_active: true,
        notes: rig.notes || '',
        last_service_date: toDateStr(extractLastServiceDate(rig)),
        next_service_date: toDateStr(extractNextServiceDate(rig)),
        service_notes: extractServiceNotes(rig),
        repair_notes: extractRepairNotes(rig),
        maintenance_status: deriveMaintenanceStatus(extractNextServiceDate(rig)),
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

    // === Purge SiteAssets not in GC Compliance Manager ===
    // GC Compliance Manager is the single source of truth for the asset list.
    // Any non-demo SiteAsset that was NOT matched to a current GC record is
    // removed — both orphans (external_compliance_id pointing to a deleted GC
    // record) and assets that originated elsewhere — so the dashboard only
    // ever shows what actually exists in GC right now.
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