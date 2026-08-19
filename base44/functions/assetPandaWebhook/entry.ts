import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ---------------------------------------------------------------------------
// assetPandaWebhook — receives flow events from Asset Panda and applies them
// to the matching SiteAsset record in this system.
//
// Authentication: a shared secret (configured in Settings → Asset Panda → Flow
// Webhook) is sent as the `secret` query param or x-assetpanda-secret header.
// Every request is verified against the stored webhook_secret — no user auth.
//
// Payload (Asset Panda flow webhook — flexible):
//   object_id / id / asset_id / data.id  — the Asset Panda object id
//   serial_number / serial               — fallback match by serial
//   action / event / flow_action / type  — the flow action (deactivate,
//                                           activate, compliance, etc.)
//   stock_level / status                 — new stock / condition status
//   compliance_status                    — compliance flag to apply
//
// The function resolves the SiteAsset by panda_asset_id → serial, applies the
// recognised action (stock-level change, deactivation, compliance flag), and
// logs a SystemAuditLog entry so the change is traceable on the Assets Hub.
// ---------------------------------------------------------------------------
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;

    // --- Authenticate via shared secret ---
    const url = new URL(req.url);
    const providedSecret =
      url.searchParams.get('secret') || req.headers.get('x-assetpanda-secret') || '';

    const configs = await sr.entities.AssetPandaConfig.filter({ key: 'global' });
    const config = configs && configs[0];
    if (!config?.webhook_secret) {
      return Response.json(
        { error: 'Webhook secret not configured. Set it in Settings → Asset Panda → Flow Webhook.' },
        { status: 401 }
      );
    }
    if (!providedSecret || providedSecret !== config.webhook_secret) {
      return Response.json({ error: 'Invalid webhook secret' }, { status: 403 });
    }

    const payload: any = await req.json().catch(() => ({}));

    // --- Resolve the matching SiteAsset ---
    const pandaId =
      payload.object_id || payload.id || payload.asset_id || payload.data?.id || '';
    const serial =
      payload.serial_number || payload.serial || payload.data?.serial_number || '';

    let asset = null;
    if (pandaId) {
      const matches = await sr.entities.SiteAsset.filter({ panda_asset_id: pandaId }, null, 1);
      asset = matches[0];
    }
    if (!asset && serial) {
      const matches = await sr.entities.SiteAsset.filter({ serial_number: serial }, null, 1);
      asset = matches[0];
    }
    if (!asset) {
      return Response.json({
        skipped: true,
        reason: 'No matching SiteAsset found for this flow event.',
        pandaId,
        serial,
      });
    }

    // --- Apply the flow action ---
    const action = String(
      payload.action || payload.event || payload.flow_action || payload.type || ''
    ).toLowerCase();
    const newStock = payload.stock_level || payload.status || payload.data?.stock_level || '';
    const newCompliance = payload.compliance_status || payload.data?.compliance_status || '';

    const update: any = {
      last_sync_timestamp: new Date().toISOString(),
      sync_status: 'synced',
    };
    const changes: string[] = ['last_sync_timestamp', 'sync_status'];
    let auditNote = `Asset Panda flow event: ${action || 'update'}`;

    // Stock / condition status change
    if (newStock) {
      const r = String(newStock).toLowerCase();
      let level = 'unknown';
      if (r.includes('service') || r.includes('repair') || r.includes('maintenance')) level = 'needs_service';
      else if (r.includes('out') || r.includes('unavailable') || r.includes('broken') || r.includes('faulty')) level = 'out_of_stock';
      else if (r.includes('low') || r.includes('limited')) level = 'low_stock';
      else if (r.includes('in stock') || r.includes('available') || r.includes('good') || r.includes('ok')) level = 'in_stock';
      update.stock_level = level;
      changes.push('stock_level');
      auditNote += ` → stock: ${level}`;
    }

    // Deactivation / retirement
    if (
      action.includes('deactivate') ||
      action.includes('retire') ||
      action.includes('archive') ||
      action.includes('scrap') ||
      action.includes('dispose')
    ) {
      update.is_active = false;
      changes.push('is_active');
      auditNote += ' → deactivated';
    }
    // Reactivation
    if (
      action.includes('activate') ||
      action.includes('reactivate') ||
      action.includes('restore') ||
      action.includes('return')
    ) {
      update.is_active = true;
      changes.push('is_active');
      auditNote += ' → activated';
    }

    // Compliance flag
    if (newCompliance) {
      update.compliance_status = String(newCompliance);
      changes.push('compliance_status');
      auditNote += ` → compliance: ${newCompliance}`;
    } else if (
      action.includes('compliance') ||
      action.includes('cert') ||
      action.includes('loler') ||
      action.includes('pat') ||
      action.includes('inspect')
    ) {
      update.compliance_status = 'expiring';
      changes.push('compliance_status');
      auditNote += ' → compliance: expiring';
    }

    await sr.entities.SiteAsset.update(asset.id, update);

    // --- Audit log entry ---
    try {
      await sr.entities.SystemAuditLog.create({
        entity_name: 'SiteAsset',
        entity_id: asset.id,
        action: 'update',
        changed_fields: changes,
        record_summary: `${asset.name} — ${auditNote}`,
        actor_name: 'Asset Panda Flow',
        source: 'webhook',
      });
    } catch {
      // audit logging is best-effort — don't fail the webhook
    }

    return Response.json({
      success: true,
      asset_id: asset.id,
      asset_name: asset.name,
      applied: update,
      note: auditNote,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}