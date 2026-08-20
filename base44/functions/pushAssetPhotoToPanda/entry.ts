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
// Input — accepts two content types:
//   multipart/form-data  (preferred for upload — file sent directly,
//                         avoids the UploadFile integration which is
//                         unreliable on the published site):
//     file, site_asset_id, action ('upload'), [file_name]
//   application/json:
//     { site_asset_id, action: 'upload', file_url, file_name }   — upload a staged file
//     { site_asset_id, action: 'delete', attachment_id }         — delete an attachment

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.is_enterprise_admin !== true) {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const contentType = req.headers.get('content-type') || '';
    let siteAssetId = '';
    let action: 'upload' | 'delete' = 'upload';
    let attachmentId = '';
    let fileUrl = '';
    let fileName = '';
    let uploadFile: File | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      siteAssetId = String(formData.get('site_asset_id') || '').trim();
      action = String(formData.get('action') || 'upload') === 'delete' ? 'delete' : 'upload';
      attachmentId = String(formData.get('attachment_id') || '').trim();
      fileUrl = String(formData.get('file_url') || '').trim();
      fileName = String(formData.get('file_name') || '').trim();
      const f = formData.get('file');
      if (f instanceof File) uploadFile = f;
    } else {
      const body = await req.json().catch(() => ({}));
      siteAssetId = String(body?.site_asset_id || '').trim();
      action = body?.action === 'delete' ? 'delete' : 'upload';
      attachmentId = String(body?.attachment_id || '').trim();
      fileUrl = String(body?.file_url || '').trim();
      fileName = String(body?.file_name || '').trim();
    }

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
      try {
        // Prefer the directly-uploaded file (multipart). Fall back to a staged
        // file_url (JSON) for callers that can't post multipart.
        let blob: Blob;
        if (uploadFile) {
          blob = uploadFile;
          if (!fileName) fileName = uploadFile.name || `photo-${Date.now()}.jpg`;
        } else if (fileUrl) {
          const fileRes = await fetch(fileUrl);
          if (!fileRes.ok) {
            actionError = `Could not download staged file (HTTP ${fileRes.status})`;
          } else {
            blob = await fileRes.blob();
            if (!fileName) fileName = `photo-${Date.now()}.jpg`;
          }
        } else {
          actionError = 'No file provided for upload (send a multipart file or a file_url)';
        }
        if (!actionError && blob) {
          if (!fileName) fileName = `photo-${Date.now()}.jpg`;
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
        }
      } catch (e: any) {
        actionError = `Upload failed: ${e.message}`;
      }
    } else {
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