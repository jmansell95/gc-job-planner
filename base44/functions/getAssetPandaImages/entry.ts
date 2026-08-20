import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolvePandaToken } from '../../shared/assetPandaClient.ts';

// ============================================================
// getAssetPandaImages — fetch the image attachments stored
// against an asset in Asset Panda and cache them on the
// SiteAsset record so the asset detail page gallery loads
// instantly on repeat views.
// ============================================================
// Calls GET /v3/attachments?entity_object_id=<panda_asset_id>&type=Image
// which returns direct S3 URLs (thumb / medium / large / url) per image.
// On any API failure, falls back to the previously-cached panda_image_urls.

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // Admin-only: the asset detail page is manager/admin-facing and the
    // function writes the cache back to the SiteAsset record (admin-only update).
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.is_enterprise_admin !== true) {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const siteAssetId = String(body?.site_asset_id || '').trim();
    if (!siteAssetId) {
      return Response.json({ error: 'site_asset_id is required' }, { status: 400 });
    }

    // Load the asset (service role — the function runs as admin so RLS is fine,
    // but asServiceRole avoids any token-forwarding issues on the published site).
    const asset = await base44.asServiceRole.entities.SiteAsset.get(siteAssetId);
    if (!asset) {
      return Response.json({ error: 'Asset not found' }, { status: 404 });
    }
    const pandaId = String(asset.panda_asset_id || '').trim();
    if (!pandaId) {
      return Response.json({ images: [], cached: false, reason: 'no_panda_asset_id' });
    }

    // Load the Asset Panda config to resolve a bearer token.
    const configs = await base44.asServiceRole.entities.AssetPandaConfig.filter({ key: 'global' });
    const config = configs[0];
    if (!config) {
      // No config — fall back to any previously cached images.
      return Response.json({
        images: Array.isArray(asset.panda_image_urls) ? asset.panda_image_urls : [],
        cached: true,
        reason: 'no_config',
      });
    }
    const baseUrl = String(config.base_url || 'https://api.assetpanda.com').replace(/\/$/, '');

    const tokenRes = await resolvePandaToken(config, baseUrl);
    if (tokenRes.error && !tokenRes.token) {
      // Auth failed — fall back to cached images so the gallery still shows
      // the last known photos instead of going blank.
      return Response.json({
        images: Array.isArray(asset.panda_image_urls) ? asset.panda_image_urls : [],
        cached: true,
        reason: tokenRes.skipped ? 'no_credentials' : 'auth_failed',
        error: tokenRes.error,
      });
    }
    const token = tokenRes.token!;

    // Fetch image attachments for this Asset Panda object.
    let images: any[] = [];
    let apiError = '';
    try {
      const url = `${baseUrl}/v3/attachments?entity_object_id=${encodeURIComponent(pandaId)}&type=Image&limit=100`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        apiError = `Asset Panda attachments request failed (HTTP ${res.status})`;
      } else {
        const json: any = await res.json();
        const raw = Array.isArray(json?.attachments?.images)
          ? json.attachments.images
          : Array.isArray(json?.images)
            ? json.images
            : Array.isArray(json) ? json : [];
        images = raw.map((img: any) => ({
          id: String(img.id || img.attachment_id || img._id || ''),
          url: String(img.url || img.large || img.medium || img.thumb || ''),
          thumb: String(img.thumb || img.medium || img.url || ''),
          medium: String(img.medium || img.large || img.url || ''),
          large: String(img.large || img.url || img.medium || ''),
          name: String(img.name || ''),
        })).filter((img: any) => img.url);
      }
    } catch (e: any) {
      apiError = `Asset Panda attachments request failed: ${e.message}`;
    }

    // Cache the fresh image list on the SiteAsset record (best-effort).
    if (!apiError) {
      try {
        await base44.asServiceRole.entities.SiteAsset.update(siteAssetId, {
          panda_image_urls: images,
          panda_images_cached_at: new Date().toISOString(),
        });
      } catch (e) { /* cache write is best-effort — never block the response */ }
    }

    // If the live fetch failed, fall back to the previously cached images.
    if (apiError && Array.isArray(asset.panda_image_urls) && asset.panda_image_urls.length > 0) {
      return Response.json({
        images: asset.panda_image_urls,
        cached: true,
        reason: 'api_failed_fallback',
        error: apiError,
      });
    }

    return Response.json({
      images,
      cached: false,
      reason: apiError ? 'api_failed_no_cache' : 'ok',
      error: apiError || undefined,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}