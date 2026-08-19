import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolvePandaToken, fetchPandaGroupFields } from '../../shared/assetPandaClient.ts';

// ---------------------------------------------------------------------------
// getAssetPandaGroupFields — returns the live field list for the configured
// Asset Panda group, so the Settings → Asset Panda field-mapping UI can offer
// real field names instead of asking the admin to type field keys by hand.
//
// Payload (optional):
//   group_id — override the configured group ID
//   sample   — when true, also fetch one sample object from the group so the
//              UI can preview how the current field map maps a real record.
//
// Admin only.
// ---------------------------------------------------------------------------
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));

    const configs = await base44.asServiceRole.entities.AssetPandaConfig.filter({ key: 'global' });
    const config = configs && configs[0];
    if (!config) {
      return Response.json({ error: 'No Asset Panda configuration found. Save your credentials first.' }, { status: 400 });
    }

    const baseUrl = (config.base_url || 'https://api.assetpanda.com').replace(/\/+$/, '');
    const groupId = body?.group_id || config.group_id;
    if (!groupId) {
      return Response.json({ error: 'No group ID configured. Enter your Asset Panda group ID first.' }, { status: 400 });
    }

    const { token, error: tokenError, skipped: tokenSkipped } = await resolvePandaToken(config, baseUrl);
    if (tokenSkipped) return Response.json({ error: tokenError }, { status: 400 });
    if (tokenError) return Response.json({ error: tokenError }, { status: 402 });

    const fields = await fetchPandaGroupFields(baseUrl, token, groupId);

    // Optionally fetch one sample object for the mapping preview.
    let sample = null;
    if (body?.sample) {
      try {
        const sampleRes = await fetch(`${baseUrl}/v3/groups/${groupId}/search/objects?limit=1&offset=0`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ view_archived: 'all' }),
        });
        if (sampleRes.ok) {
          const sampleJson: any = await sampleRes.json();
          const page = Array.isArray(sampleJson)
            ? sampleJson
            : sampleJson.objects || sampleJson.data || sampleJson.results || [];
          sample = page[0] || null;
        }
      } catch {
        sample = null;
      }
    }

    return Response.json({ fields, sample });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}