import { createClientFromRequest, createClient } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    // Connect to the GC Compliance Manager app using the current user's token
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    const complianceApp = createClient({ appId: "6a3be07293b53789beb4f09e", token });

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

    let synced = 0;
    let unmatched = 0;
    const unmatchedAssets = [];

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

    return Response.json({
      success: true,
      total_assets: siteAssets.length,
      total_equipment_records: equipmentRecords.length,
      synced,
      unmatched,
      unmatched_assets: unmatchedAssets,
      synced_at: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});