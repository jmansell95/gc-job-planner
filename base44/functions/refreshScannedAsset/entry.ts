import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  resolvePandaToken,
  resolveGroupIdForAsset,
  fetchPandaGroupFields,
  fetchPandaImages,
  fetchPandaObject,
} from '../../shared/assetPandaClient.ts';
import {
  fieldValue, detectStockLevel, deriveComplianceStatus,
} from '../../shared/assetPandaLookup.ts';
import { findRawByKeywords, parseQty } from '../../shared/assetPandaRawFields.ts';

// ============================================================
// refreshScannedAsset — lightweight single-asset background
// refresh fired by the scanner after showing the local record.
// Pulls the live Asset Panda object + images for one asset and
// updates the cached SiteAsset in place so the scan result card
// reflects the latest stock / compliance / images without making
// the user wait. Any authenticated user can call this (field staff).
// ============================================================

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const siteAssetId = String(body?.site_asset_id || '').trim();
    if (!siteAssetId) return Response.json({ error: 'site_asset_id is required' }, { status: 400 });

    let asset;
    try {
      asset = await base44.asServiceRole.entities.SiteAsset.get(siteAssetId);
    } catch (_) {
      return Response.json({ error: 'Asset not found' }, { status: 404 });
    }
    const pandaId = String(asset.panda_asset_id || '').trim();
    if (!pandaId) return Response.json({ asset, refreshed: false, reason: 'No Asset Panda ID' });

    const configs = await base44.asServiceRole.entities.AssetPandaConfig.filter({ key: 'global' });
    const config = configs[0];
    if (!config) return Response.json({ asset, refreshed: false, reason: 'Asset Panda not configured' });
    const baseUrl = String(config.base_url || 'https://api.assetpanda.com').replace(/\/+$/, '');

    const tokenRes = await resolvePandaToken(config, baseUrl);
    if (!tokenRes.token) return Response.json({ asset, refreshed: false, reason: tokenRes.error || 'No token' });
    const token = tokenRes.token;

    const groupId = resolveGroupIdForAsset(config, asset);
    if (!groupId) return Response.json({ asset, refreshed: false, reason: 'No group configured' });

    // --- Fetch the live object + its field definitions in parallel ---
    let rawFields: Record<string, string> = {};
    let obj: any = null;
    try {
      const [liveObj, groupFields] = await Promise.all([
        fetchPandaObject(baseUrl, token, groupId, pandaId),
        fetchPandaGroupFields(baseUrl, token, groupId).catch(() => [] as any[]),
      ]);
      obj = liveObj;
      const keyToLabel: Record<string, string> = {};
      for (const f of groupFields) { if (f.key && f.label) keyToLabel[f.key] = f.label; }
      const skipKeys = new Set(['id', '_id', 'object_id', 'group_id', 'created_at', 'updated_at', 'archived', 'created_by', 'modified_at', 'modified_by', 'archived_at', 'display_name']);
      const allKeys = new Set([...Object.keys(obj || {}), ...Object.keys(obj?.data || {})]);
      for (const key of allKeys) {
        if (skipKeys.has(key)) continue;
        const v = fieldValue(obj, key);
        if (!v) continue;
        const label = keyToLabel[key] || key;
        rawFields[label] = v;
      }
    } catch (_) { /* best-effort — return the cached asset */ }

    // --- Fetch image attachments ---
    let images: any[] = [];
    try {
      images = await fetchPandaImages(baseUrl, token, pandaId);
    } catch (_) {
      images = Array.isArray(asset.panda_image_urls) ? asset.panda_image_urls : [];
    }

    const now = new Date().toISOString();
    const updateData: any = {
      panda_image_urls: images,
      panda_images_cached_at: now,
      last_sync_timestamp: now,
      sync_status: 'synced' as const,
    };
    if (Object.keys(rawFields).length > 0) updateData.panda_raw_fields = rawFields;

    // Re-sync quantity owned/available + stock level + compliance from raw fields
    try {
      const findRaw = (keywords: string[]) => findRawByKeywords(rawFields, keywords);
      const qo = parseQty(findRaw(['quantity owned', 'qty owned', 'owned']));
      const qa = parseQty(findRaw(['quantity available', 'qty available', 'quantity avail', 'available']));
      if (qo !== null) updateData.quantity_owned = qo;
      if (qa !== null) updateData.quantity_available = qa;

      const stockRaw = findRaw(['stock', 'condition', 'status']);
      if (stockRaw) updateData.stock_level = detectStockLevel(stockRaw);

      // Compliance expiry — detect from inspection/expiry labelled fields
      const expiryRaw = findRaw(['next inspection', 'expiry', 'loler', 'puwer', 'pat expiry', 'expires', 'next test', 'next service', 'next loler', 'next pat']);
      if (expiryRaw) {
        const d = new Date(expiryRaw);
        if (!isNaN(d.getTime())) {
          updateData.compliance_expiry_date = d.toISOString().split('T')[0];
          updateData.compliance_status = deriveComplianceStatus(updateData.compliance_expiry_date);
          updateData.compliance_last_checked = now;
        }
      }
    } catch (_) { /* best-effort */ }

    try {
      await base44.asServiceRole.entities.SiteAsset.update(siteAssetId, updateData);
    } catch (_) { /* best-effort cache */ }

    const updatedAsset = { ...asset, ...updateData, id: siteAssetId };
    return Response.json({ asset: updatedAsset, refreshed: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}