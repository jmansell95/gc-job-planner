import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ---------------------------------------------------------------------------
// confirmAssetPandaLink — persists an admin's decision on a proposed rate-card
// link for an Asset Panda asset.
//
// Payload:
//   asset_id         — the SiteAsset ID
//   rate_card_item_id — the RateCardItem ID to link (empty = unlink)
//   action           — 'confirm' | 'skip' | 'unlink'
//
// 'confirm' sets rate_card_link_status = 'confirmed' with the given rate card item.
// 'skip'   sets rate_card_link_status = 'skipped' (use Asset Panda cost as fallback).
// 'unlink' clears the link entirely (rate_card_link_status = 'unmatched').
//
// Admin only. Logs a SystemAuditLog entry for traceability.
// ---------------------------------------------------------------------------
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { asset_id, rate_card_item_id, action } = body || {};

    if (!asset_id) return Response.json({ error: 'asset_id is required' }, { status: 400 });
    const act = String(action || 'confirm').toLowerCase();
    if (!['confirm', 'skip', 'unlink'].includes(act)) {
      return Response.json({ error: 'action must be confirm, skip, or unlink' }, { status: 400 });
    }

    const sr = base44.asServiceRole;
    const asset = await sr.entities.SiteAsset.get(asset_id);
    if (!asset) return Response.json({ error: 'Asset not found' }, { status: 404 });

    let update: any = {};
    let auditNote = '';

    if (act === 'confirm') {
      if (!rate_card_item_id) return Response.json({ error: 'rate_card_item_id is required to confirm' }, { status: 400 });
      update = {
        rate_card_item_id,
        rate_card_link_status: 'confirmed',
      };
      auditNote = `Confirmed rate-card link for "${asset.name}"`;
    } else if (act === 'skip') {
      update = {
        rate_card_link_status: 'skipped',
      };
      auditNote = `Skipped rate-card link for "${asset.name}" — using Asset Panda cost as fallback`;
    } else {
      // unlink
      update = {
        rate_card_item_id: '',
        rate_card_link_status: 'unmatched',
      };
      auditNote = `Unlinked rate-card for "${asset.name}"`;
    }

    await sr.entities.SiteAsset.update(asset_id, update);

    // Audit log
    try {
      await sr.entities.SystemAuditLog.create({
        entity_name: 'SiteAsset',
        entity_id: asset_id,
        action: 'update',
        changed_fields: ['rate_card_item_id', 'rate_card_link_status'],
        record_summary: auditNote,
        actor_name: user.full_name || user.email || 'Admin',
        source: 'asset-panda-link-review',
      });
    } catch {
      // best-effort
    }

    return Response.json({ success: true, asset_id, action: act, update });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}