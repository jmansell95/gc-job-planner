import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  resolvePandaToken,
  resolveGroupIdForAsset,
  fetchPandaGroupFields,
  fetchPandaImages,
  fetchPandaObject,
} from '../../shared/assetPandaClient.ts';

// ============================================================
// getAssetPandaObject — pull the FULL live object (all fields) +
// image attachments for an asset from Asset Panda and cache them
// on the SiteAsset record. Called by the "Refresh from Panda"
// button on the asset detail page so managers see the freshest
// data without waiting for the next scheduled sync.
// ============================================================
// Caches panda_raw_fields (label → value), panda_image_urls and
// last_sync_timestamp. Does NOT overwrite the mapped system fields
// (those are reconciled by the full syncAssetPanda run) so any
// in-progress local edits are never clobbered by a refresh.

function fieldValue(obj: any, key: string): string {
  if (!key) return '';
  let v = obj ? obj[key] : undefined;
  if (v == null && obj?.data) v = obj.data[key];
  if (v == null) return '';
  if (typeof v === 'object') return String((v as any).value ?? (v as any).name ?? (v as any).label ?? '').trim();
  return String(v).trim();
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.is_enterprise_admin !== true) {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const siteAssetId = String(body?.site_asset_id || '').trim();
    if (!siteAssetId) return Response.json({ error: 'site_asset_id is required' }, { status: 400 });

    const asset = await base44.asServiceRole.entities.SiteAsset.get(siteAssetId);
    if (!asset) return Response.json({ error: 'Asset not found' }, { status: 404 });
    const pandaId = String(asset.panda_asset_id || '').trim();
    if (!pandaId) return Response.json({ error: 'Asset has no Asset Panda ID', cached: false });

    const configs = await base44.asServiceRole.entities.AssetPandaConfig.filter({ key: 'global' });
    const config = configs[0];
    if (!config) return Response.json({ error: 'Asset Panda not configured', cached: false });
    const baseUrl = String(config.base_url || 'https://api.assetpanda.com').replace(/\/+$/, '');

    const tokenRes = await resolvePandaToken(config, baseUrl);
    if (tokenRes.error && !tokenRes.token) {
      return Response.json({ error: tokenRes.error, cached: true });
    }
    const token = tokenRes.token!;

    const groupId = resolveGroupIdForAsset(config, asset);
    if (!groupId) return Response.json({ error: 'No Asset Panda group configured for this asset', cached: true });

    // --- Fetch the live object + its field definitions ---
    let rawFields: Record<string, string> = {};
    let objectError = '';
    try {
      const [obj, groupFields] = await Promise.all([
        fetchPandaObject(baseUrl, token, groupId, pandaId),
        fetchPandaGroupFields(baseUrl, token, groupId).catch(() => [] as any[]),
      ]);
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
    } catch (e: any) {
      objectError = `Could not fetch live object: ${e.message}`;
    }

    // --- Fetch image attachments ---
    let images: any[] = [];
    let imageError = '';
    try {
      images = await fetchPandaImages(baseUrl, token, pandaId);
    } catch (e: any) {
      imageError = e.message;
      images = Array.isArray(asset.panda_image_urls) ? asset.panda_image_urls : [];
    }

    const now = new Date().toISOString();
    const updateData: any = {
      panda_image_urls: images,
      panda_images_cached_at: now,
      last_sync_timestamp: now,
      sync_status: 'synced',
    };
    if (Object.keys(rawFields).length > 0) updateData.panda_raw_fields = rawFields;

    // Re-sync Quantity Owned & Available from the cached raw fields so the
    // card and detail view reflect Asset Panda's current stock numbers.
    try {
      const findRaw = (keywords: string[]): string => {
        for (const k of keywords) {
          for (const [label, val] of Object.entries(rawFields)) {
            if (label.toLowerCase().includes(k)) return val;
          }
        }
        return '';
      };
      const parseQty = (s: string): number | null => {
        if (!s) return null;
        const n = Number(String(s).replace(/[^0-9.]/g, ''));
        return isNaN(n) ? null : n;
      };
      const qo = parseQty(findRaw(['quantity owned', 'qty owned', 'owned']));
      const qa = parseQty(findRaw(['quantity available', 'qty available', 'quantity avail', 'available']));
      if (qo !== null) updateData.quantity_owned = qo;
      if (qa !== null) updateData.quantity_available = qa;
    } catch (_) { /* best-effort */ }

    try {
      await base44.asServiceRole.entities.SiteAsset.update(siteAssetId, updateData);
    } catch (e) { /* best-effort cache */ }

    return Response.json({
      success: true,
      raw_fields: rawFields,
      raw_field_count: Object.keys(rawFields).length,
      images,
      image_count: images.length,
      last_sync_timestamp: now,
      object_error: objectError || undefined,
      image_error: imageError || undefined,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}