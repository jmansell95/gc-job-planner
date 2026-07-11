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
    const siteAssets = await base44.asServiceRole.entities.SiteAsset.list();

    // === Helpers for Equipment records ===

    const extractEquipmentStatus = (e) => {
      const raw = e.status || e.compliance_status || '';
      if (!raw) return 'unknown';
      const lower = String(raw).toLowerCase();
      if (lower.includes('compliant') && !lower.includes('non')) return 'compliant';
      if (lower.includes('expir')) return 'expiring';
      if (lower.includes('expired') || lower.includes('lapsed') || lower.includes('non')) return 'expired';
      if (lower.includes('unknown') || lower.includes('pending')) return 'unknown';
      return 'unknown';
    };

    const extractExpiry = (e) => {
      return e.expiry_date || e.compliance_expiry_date || e.next_inspection_date || e.next_service_date || '';
    };

    const extractSerial = (e) => {
      return e.serial_number || e.serialNumber || e.serial || e.registration_number || '';
    };

    const extractEquipmentAssetType = (e) => {
      const raw = String(e.category || e.equipment_type || e.asset_type || e.type || '').toLowerCase();
      if (raw.includes('trailer')) return 'trailer';
      if (raw.includes('lift') || raw.includes('shackle') || raw.includes('sling') || raw.includes('chain') || raw.includes('rope') || raw.includes('hook') || raw.includes('hoist') || raw.includes('crane') || raw.includes('rigging')) return 'lifting';
      if (raw.includes('machine') || raw.includes('excav') || raw.includes('digger') || raw.includes('grout') || raw.includes('mixer')) return 'machinery';
      if (raw.includes('vehicle') || raw.includes('van') || raw.includes('truck')) return 'vehicle';
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
      const status = extractEquipmentStatus(match);
      const expiryDate = extractExpiry(match);
      const assetType = extractEquipmentAssetType(match);

      await base44.asServiceRole.entities.SiteAsset.update(asset.id, {
        compliance_status: status,
        compliance_expiry_date: expiryDate || null,
        compliance_last_checked: now,
        external_compliance_id: match.id,
        asset_type: assetType,
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
        rig_type: 'n/a',
        serial_number: serial,
        external_compliance_id: eq.id,
        compliance_status: extractEquipmentStatus(eq),
        compliance_expiry_date: extractExpiry(eq) || null,
        compliance_last_checked: now,
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
      await base44.asServiceRole.entities.SiteAsset.update(asset.id, {
        compliance_status: extractRigStatus(match),
        compliance_last_checked: now,
        external_compliance_id: match.id,
        rig_type: extractRigType(match),
        serial_number: match.registration_number || asset.serial_number || '',
        notes: match.notes || asset.notes || '',
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
        rig_type: extractRigType(rig),
        serial_number: rig.registration_number || '',
        external_compliance_id: rig.id,
        compliance_status: extractRigStatus(rig),
        compliance_expiry_date: null,
        compliance_last_checked: now,
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

    return Response.json({
      success: true,
      total_equipment_records: equipmentRecords.length,
      total_rig_records: rigRecords.length,
      equipment_synced: synced,
      equipment_created: created,
      equipment_unmatched: unmatched,
      rigs_synced: rigsSynced,
      rigs_created: rigsCreated,
      unmatched_assets: unmatchedAssets,
      synced_at: now,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});