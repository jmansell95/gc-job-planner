import { createClientFromRequest, createClient } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    // Connect to the GC Compliance Manager app (requires the app to be public or Equipment entity publicly readable)
    const complianceApp = createClient({ appId: "6a3be07293b53789beb4f09e" });

    // Fetch all Equipment records from the compliance app
    let equipmentRecords = [];
    try {
      equipmentRecords = await complianceApp.entities.Equipment.list('-created_date', 500);
    } catch (fetchErr) {
      return Response.json({
        error: 'Failed to fetch from Compliance Manager app',
        details: fetchErr.message,
        hint: 'Ensure the Equipment entity in the GC Compliance Manager app allows read access.'
      }, { status: 502 });
    }

    // Fetch all SiteAssets in this app
    const siteAssets = await base44.asServiceRole.entities.SiteAsset.list();

    // Helper: extract compliance status from an Equipment record
    const extractStatus = (e) => {
      const raw = e.compliance_status || e.complianceStatus || e.status || '';
      if (!raw) return 'unknown';
      const lower = String(raw).toLowerCase();
      if (lower.includes('compliant') && !lower.includes('non')) return 'compliant';
      if (lower.includes('expir')) return 'expiring';
      if (lower.includes('expired') || lower.includes('lapsed') || lower.includes('non')) return 'expired';
      if (lower.includes('unknown') || lower.includes('pending')) return 'unknown';
      return 'unknown';
    };

    // Helper: extract expiry date from an Equipment record
    const extractExpiry = (e) => {
      return e.compliance_expiry_date || e.complianceExpiryDate || e.expiry_date || e.expiryDate || e.next_inspection_date || e.nextInspectionDate || e.next_service_date || '';
    };

    // Helper: extract serial number from an Equipment record
    const extractSerial = (e) => {
      return e.serial_number || e.serialNumber || e.serial || e.registration_number || e.registrationNumber || '';
    };

    // Helper: extract asset type from an Equipment record
    const extractAssetType = (e) => {
      const raw = String(e.asset_type || e.type || e.equipment_type || e.category || '').toLowerCase();
      if (raw.includes('rig')) return 'rig';
      if (raw.includes('trailer')) return 'trailer';
      if (raw.includes('machine') || raw.includes('excav') || raw.includes('digger')) return 'machinery';
      if (raw.includes('vehicle') || raw.includes('van') || raw.includes('truck')) return 'vehicle';
      return 'machinery'; // default
    };

    // Helper: extract rig type
    const extractRigType = (e) => {
      const raw = String(e.rig_type || e.drilling_type || '').toLowerCase();
      if (raw.includes('cp') || raw.includes('cable') || raw.includes('percussion')) return 'cp';
      if (raw.includes('rotary')) return 'rotary';
      return 'n/a';
    };

    let synced = 0;
    let unmatched = 0;
    let created = 0;
    const unmatchedAssets = [];
    const matchedEquipmentIds = new Set();

    for (const asset of siteAssets) {
      let match = null;

      // 1. Match by external_compliance_id if set
      if (asset.external_compliance_id) {
        match = equipmentRecords.find(e => e.id === asset.external_compliance_id);
      }

      // 2. Fall back to serial_number
      if (!match && asset.serial_number) {
        const assetSerial = String(asset.serial_number).toLowerCase().trim();
        match = equipmentRecords.find(e => {
          const eSerial = String(extractSerial(e)).toLowerCase().trim();
          return eSerial && eSerial === assetSerial;
        });
      }

      // 3. Fall back to name
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
      const status = extractStatus(match);
      const expiryDate = extractExpiry(match);

      await base44.asServiceRole.entities.SiteAsset.update(asset.id, {
        compliance_status: status,
        compliance_expiry_date: expiryDate || null,
        compliance_last_checked: new Date().toISOString(),
        external_compliance_id: match.id,
      });
      synced++;
    }

    // Create new SiteAsset records for Equipment records that didn't match any local asset
    const now = new Date().toISOString();
    const newAssets = [];
    for (const eq of equipmentRecords) {
      if (matchedEquipmentIds.has(eq.id)) continue;
      const name = eq.name || eq.title || 'Unnamed Equipment';
      const serial = extractSerial(eq);
      // Skip if a local asset with same name already exists (already unmatched above)
      const assetType = extractAssetType(eq);
      const rigType = assetType === 'rig' ? extractRigType(eq) : 'n/a';
      const status = extractStatus(eq);
      const expiryDate = extractExpiry(eq);

      newAssets.push({
        name,
        asset_type: assetType,
        rig_type: rigType,
        serial_number: serial,
        external_compliance_id: eq.id,
        compliance_status: status,
        compliance_expiry_date: expiryDate || null,
        compliance_last_checked: now,
        is_active: true,
        notes: eq.notes || eq.description || '',
      });
    }

    if (newAssets.length > 0) {
      try {
        await base44.asServiceRole.entities.SiteAsset.bulkCreate(newAssets);
        created = newAssets.length;
      } catch (createErr) {
        // log but don't fail the whole sync
        console.error('Error creating new assets:', createErr.message);
      }
    }

    return Response.json({
      success: true,
      total_assets: siteAssets.length,
      total_equipment_records: equipmentRecords.length,
      synced,
      unmatched,
      created,
      unmatched_assets: unmatchedAssets,
      synced_at: now,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});