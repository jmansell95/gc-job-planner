import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ---------------------------------------------------------------------------
// getAssetPandaLinkReview — returns the current rate-card link status for all
// synced Asset Panda assets, so the Settings → Asset Panda → Review Links
// screen can show proposed matches for admin confirmation.
//
// Returns:
//   confirmed: [{ asset, rateCardItem }]  — already confirmed links
//   proposed: [{ asset, rateCardItem }]  — auto-matched, awaiting confirmation
//   unmatched: [{ asset }]               — no rate card match found
//   skipped: [{ asset }]                  — admin chose to skip the proposed match
//
// Admin only.
// ---------------------------------------------------------------------------
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    // Load all synced assets (have a panda_asset_id), exclude demo
    const assets = await base44.asServiceRole.entities.SiteAsset.list('-created_date', 500);
    const synced = assets.filter((a: any) => !a.is_demo_data && a.panda_asset_id);

    // Load all our-company rate card items for enrichment
    const rateCardItems = await base44.asServiceRole.entities.RateCardItem.list('-created_date', 500);
    const rcById: Record<string, any> = {};
    for (const r of rateCardItems) {
      rcById[r.id] = r;
    }

    const confirmed: any[] = [];
    const proposed: any[] = [];
    const unmatched: any[] = [];
    const skipped: any[] = [];

    for (const asset of synced) {
      const entry: any = {
        asset: {
          id: asset.id,
          name: asset.name,
          serial_number: asset.serial_number,
          asset_type: asset.asset_type,
          panda_group_label: asset.panda_group_label,
          cost_price: asset.cost_price,
          charge_out_price: asset.charge_out_price,
          division_id: asset.division_id,
        },
      };
      if (asset.rate_card_item_id && rcById[asset.rate_card_item_id]) {
        const rc = rcById[asset.rate_card_item_id];
        entry.rateCardItem = {
          id: rc.id,
          description: rc.description,
          price: rc.price,
          cost_price: rc.cost_price,
          unit: rc.unit,
          subcategory: rc.subcategory,
        };
      }
      const status = asset.rate_card_link_status || 'unmatched';
      if (status === 'confirmed') confirmed.push(entry);
      else if (status === 'proposed') proposed.push(entry);
      else if (status === 'skipped') skipped.push(entry);
      else unmatched.push(entry);
    }

    return Response.json({
      confirmed,
      proposed,
      unmatched,
      skipped,
      counts: {
        confirmed: confirmed.length,
        proposed: proposed.length,
        unmatched: unmatched.length,
        skipped: skipped.length,
        total: synced.length,
      },
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}