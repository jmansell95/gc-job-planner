import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolvePandaToken, buildFullFieldMap, fetchPandaGroupFields, fetchPandaObject } from '../../shared/assetPandaClient.ts';
import { pushAssetUpdateToPanda } from '../../shared/assetPandaPush.ts';
import {
  fieldValue, detectAssetType, detectRigType, detectStockLevel, parseRate, normalizeDate, deriveComplianceStatus,
} from '../../shared/assetPandaLookup.ts';

// ---------------------------------------------------------------------------
// confirmPandaScanLink — creates a local SiteAsset from a scanned Asset Panda
// barcode, after the user confirms the "New from Asset Panda" prompt in the
// scanner. Re-fetches the live Panda object, builds the local record with the
// mapped fields, creates it linked to the Panda object, then pushes the new
// local record back to Asset Panda so both systems carry the link.
//
// Payload: { panda_id, group_id, barcode }
// Returns: { success, asset, push_result }
//
// Any authenticated user can call this — field staff confirm scans from the
// scanner page. The created record is a normal SiteAsset (admin can edit it
// afterwards).
// ---------------------------------------------------------------------------
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { panda_id, group_id, barcode } = body || {};
    if (!panda_id) return Response.json({ error: 'panda_id is required' }, { status: 400 });
    if (!group_id) return Response.json({ error: 'group_id is required' }, { status: 400 });

    const sr = base44.asServiceRole;
    const configs = await sr.entities.AssetPandaConfig.filter({ key: 'global' });
    const config = configs && configs[0];
    if (!config) return Response.json({ error: 'Asset Panda not configured' }, { status: 400 });

    const baseUrl = (config.base_url || 'https://api.assetpanda.com').replace(/\/+$/, '');
    const { token, error, skipped } = await resolvePandaToken(config, baseUrl);
    if (skipped || !token) return Response.json({ error: error || 'No Asset Panda token' }, { status: 402 });

    // Re-fetch the live Panda object (don't trust client-passed field data)
    const obj = await fetchPandaObject(baseUrl, token, group_id, panda_id);
    if (!obj) return Response.json({ error: 'Asset Panda object not found' }, { status: 404 });

    // Resolve field keys (explicit map + label auto-detect)
    const fieldMap = buildFullFieldMap(config);
    let groupFields: { key: string; label: string }[] = [];
    try { groupFields = await fetchPandaGroupFields(baseUrl, token, group_id); } catch (_) {}
    const findByLabel = (keywords: string[]) => {
      const f = groupFields.find((fld) => keywords.some((k) => String(fld.label || '').toLowerCase().includes(k)));
      return f?.key || '';
    };
    const nameKey = fieldMap.name || findByLabel(['name', 'title', 'asset name', 'description']);
    const serialKey = fieldMap.serial_number || findByLabel(['serial', 'asset tag', 'tag', 'registration', 'reg']);
    const typeKey = fieldMap.asset_type || findByLabel(['type', 'category', 'class', 'group type', 'asset type']);
    const stockKey = fieldMap.stock_level || findByLabel(['stock', 'condition', 'status', 'availability', 'state']);
    const barcodeKey = fieldMap.barcode || findByLabel(['barcode', 'asset tag', 'tag id']);
    const costKey = fieldMap.cost_price || findByLabel(['cost', 'cost price', 'purchase cost', 'internal cost', 'purchase price']);
    const makeKey = fieldMap.make || findByLabel(['make', 'manufacturer', 'brand']);
    const modelKey = fieldMap.model || findByLabel(['model']);
    const fleetKey = fieldMap.fleet_number || findByLabel(['fleet number', 'faa', 'fleet no', 'fleet']);
    const fuelKey = fieldMap.fuel_type || findByLabel(['fuel type', 'fuel']);
    const condKey = fieldMap.condition || findByLabel(['condition']);
    const hoursKey = fieldMap.hours_used || findByLabel(['hours used', 'hour meter', 'hourmeter', 'hours']);
    const lengthKey = fieldMap.length || findByLabel(['length']);
    const qtyOwnedKey = fieldMap.quantity_owned || findByLabel(['quantity owned', 'qty owned', 'owned']);
    const qtyAvailKey = fieldMap.quantity_available || findByLabel(['quantity available', 'qty available', 'available']);
    const locKey = fieldMap.storage_location || findByLabel(['storage location', 'site location', 'home location', 'yard location', 'yard']);
    const expKey = fieldMap.compliance_expiry_date || findByLabel(['next inspection', 'expiry', 'loler', 'pat', 'next test', 'due date', 'inspection due', 'test due']);
    const nextSvcKey = fieldMap.next_service_date || findByLabel(['next service', 'service due', 'next maintenance']);
    const lastSvcKey = fieldMap.last_service_date || findByLabel(['last service', 'last inspected', 'last inspection']);

    const name = fieldValue(obj, nameKey) || obj.name || 'Unnamed Asset';
    const serial = fieldValue(obj, serialKey) || obj.serial_number || '';
    const barcodeVal = barcode || (barcodeKey ? fieldValue(obj, barcodeKey) : '');
    const rawType = fieldValue(obj, typeKey) || '';
    const rawStock = fieldValue(obj, stockKey) || '';
    const assetType = detectAssetType(rawType, name);
    const isRig = assetType === 'rig';
    const stockLevel = detectStockLevel(rawStock);
    const groupLabel = (Array.isArray(config.groups) ? (config.groups.find((g: any) => g.group_id === group_id)?.label) : null) || 'Asset Panda';

    const payload: any = {
      name,
      serial_number: serial,
      panda_asset_id: panda_id,
      panda_group_label: groupLabel,
      barcode: barcodeVal,
      asset_type: assetType,
      is_rig: isRig,
      rig_type: isRig ? detectRigType(rawType, name) : 'n/a',
      stock_level: stockLevel,
      sync_status: 'synced',
      last_sync_timestamp: new Date().toISOString(),
      compliance_status: 'unknown',
      rate_card_link_status: 'unmatched',
      notes: '',
    };

    const setNum = (key: string, val: string) => { const n = parseRate(val); if (n != null) payload[key] = n; };
    const setStr = (key: string, val: string) => { if (val) payload[key] = val; };
    const setDate = (key: string, val: string) => { const d = normalizeDate(val); if (d) payload[key] = d; };
    setStr('make', fieldValue(obj, makeKey));
    setStr('model', fieldValue(obj, modelKey));
    setStr('fleet_number', fieldValue(obj, fleetKey));
    setStr('fuel_type', fieldValue(obj, fuelKey));
    setStr('condition', fieldValue(obj, condKey));
    setStr('storage_location', fieldValue(obj, locKey));
    setStr('equipment_type', rawType);
    setNum('hours_used', fieldValue(obj, hoursKey));
    setNum('length', fieldValue(obj, lengthKey));
    setNum('cost_price', fieldValue(obj, costKey));
    setNum('quantity_owned', fieldValue(obj, qtyOwnedKey));
    setNum('quantity_available', fieldValue(obj, qtyAvailKey));
    setDate('compliance_expiry_date', fieldValue(obj, expKey));
    setDate('next_service_date', fieldValue(obj, nextSvcKey));
    setDate('last_service_date', fieldValue(obj, lastSvcKey));
    if (payload.quantity_owned != null && payload.quantity_available == null) {
      payload.quantity_available = payload.quantity_owned;
    }
    if (payload.compliance_expiry_date) payload.compliance_status = deriveComplianceStatus(payload.compliance_expiry_date);

    // Create the local SiteAsset linked to the Panda object
    const created = await sr.entities.SiteAsset.create(payload);

    // Push the new local record back to Asset Panda so both systems carry the link
    let pushResult: any = null;
    try { pushResult = await pushAssetUpdateToPanda(base44, created.id, 'update'); } catch (e: any) {
      pushResult = { attempted: true, success: false, error: e.message };
    }

    const asset = await sr.entities.SiteAsset.get(created.id);
    return Response.json({ success: true, asset, push_result: pushResult });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}