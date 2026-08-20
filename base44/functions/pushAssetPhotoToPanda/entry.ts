import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolvePandaToken, resolveGroupIdForAsset, fetchPandaImages } from '../../shared/assetPandaClient.ts';

// ============================================================
// pushAssetPhotoToPanda — upload a new photo to an Asset Panda
// object, or delete an existing attachment. After either action
// the function re-fetches the image list and re-caches it on the
// SiteAsset so the gallery refreshes instantly.
// ============================================================
// Upload:  POST /v3/group/objects/{panda_asset_id}/attachments
//          (multipart form-data: file + type=Image)
// Delete:  DELETE /v3/attachments
//          (multipart form-data: attachment_ids=<id>)
//
// Payload:
//   { site_asset_id, action: 'upload', file_url }   — upload a file already staged on our storage
//   { site_asset_id, action: 'delete', attachment_id } — delete an attachment

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
    const action = body?.action === 'delete' ? 'delete' : 'upload';
    if (!siteAssetId) return Response.json({ error: 'site_asset_id is required' }, { status: 400 });

    const asset = await base44.asServiceRole.entities.SiteAsset.get(siteAssetId);
    if (!asset) return Response.json({ error: 'Asset not found' }, { status: 404 });
    const pandaId = String(asset.panda_asset_id || '').trim();
    if (!pandaId) return Response.json({ error: 'Asset has no Asset Panda ID' }, { status: 400 });

    const configs = await base44.asServiceRole.entities.AssetPandaConfig.filter({ key: 'global' });
    const config = configs[0];
    if (!config) return Response.json({ error: 'Asset Panda not configured' }, { status: 400 });
    const baseUrl = String(config.base_url || 'https://api.assetpanda.com').replace(/\/+$/, '');

    const tokenRes = await resolvePandaToken(config, baseUrl);
    if (tokenRes.error && !tokenRes.token) return Response.json({ error: tokenRes.error }, { status: 402 });
    const token = tokenRes.token!;

    let actionError = '';
    if (action === 'upload') {
      const fileUrl = String(body?.file_url || '').trim();
      if (!fileUrl) return Response.json({ error: 'file_url is required for upload' }, { status: 400 });
      try {
        // Download the staged file, then re-upload it to Asset Panda as multipart.
        const fileRes = await fetch(fileUrl);
        if (!fileRes.ok) return Response.json({ error: `Could not download staged file (HTTP ${fileRes.status})` }, { status: 422 });
        const blob = await fileRes.blob();
        const fileName = String(body?.file_name || `photo-${Date.now()}.jpg`);
        const form = new FormData();
        form.append('file', blob, fileName);
        form.append('type', 'Image');
        const res = await fetch(`${baseUrl}/v3/group/objects/${encodeURIComponent(pandaId)}/attachments`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        if (!res.ok) {
          const errBody = await res.text().catch(() => '');
          actionError = `Upload failed (HTTP ${res.status}): ${errBody.slice(0, 200)}`;
        }
      } catch (e: any) {
        actionError = `Upload failed: ${e.message}`;
      }
    } else {
      const attachmentId = String(body?.attachment_id || '').trim();
      if (!attachmentId) return Response.json({ error: 'attachment_id is required for delete' }, { status: 400 });
      try {
        const form = new FormData();
        form.append('attachment_ids', attachmentId);
        const res = await fetch(`${baseUrl}/v3/attachments`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        if (!res.ok) {
          const errBody = await res.text().catch(() => '');
          actionError = `Delete failed (HTTP ${res.status}): ${errBody.slice(0, 200)}`;
        }
      } catch (e: any) {
        actionError = `Delete failed: ${e.message}`;
      }
    }

    // --- Re-fetch and re-cache the image list regardless (so the gallery reflects the change) ---
    let images: any[] = [];
    try {
      images = await fetchPandaImages(baseUrl, token, pandaId);
    } catch (e: any) {
      images = Array.isArray(asset.panda_image_urls) ? asset.panda_image_urls : [];
    }
    const now = new Date().toISOString();
    try {
      await base44.asServiceRole.entities.SiteAsset.update(siteAssetId, {
        panda_image_urls: images,
        panda_images_cached_at: now,
        last_sync_timestamp: now,
      });
    } catch (e) { /* best-effort */ }

    if (actionError) return Response.json({ success: false, error: actionError, images });

    return Response.json({
      success: true,
      action,
      images,
      image_count: images.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}