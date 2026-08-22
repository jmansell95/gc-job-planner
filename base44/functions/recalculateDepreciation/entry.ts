import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { calculateDepreciation } from '../../shared/depreciation.ts';

/**
 * Recalculates depreciation for a single SiteAsset (or all assets with
 * acquisition data when no asset_id is given) and persists the computed
 * current_book_value, annual_depreciation, and accumulated_depreciation.
 *
 * Supports three methods: straight_line, reducing_balance, units_of_production.
 * The calculation logic lives in base44/shared/depreciation.ts so the frontend
 * live-preview and this backend function always agree.
 *
 * Also auto-applies the matching DepreciationProfile when an asset has no
 * method set yet (auto-seeding on first calculation).
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const assetId = body.asset_id || null;
    const e = base44.asServiceRole.entities;

    // Load profiles for auto-seeding
    const profiles = await e.DepreciationProfile.list('-created_date', 100);
    const defaultProfileByType = {};
    profiles.forEach(p => {
      if (p.is_default && !defaultProfileByType[p.asset_type]) {
        defaultProfileByType[p.asset_type] = p;
      }
    });

    // Load target asset(s)
    let assets;
    if (assetId) {
      const a = await e.SiteAsset.get(assetId);
      assets = a ? [a] : [];
    } else {
      assets = await e.SiteAsset.list('-acquisition_date', 1000);
      // Only process assets with acquisition cost
      assets = assets.filter(a => a.acquisition_cost && a.acquisition_date);
    }

    const updates = [];
    const progress = [];

    for (const asset of assets) {
      if (!asset.acquisition_cost || !asset.acquisition_date) {
        continue;
      }

      // Auto-seed method from profile if not set
      let method = asset.depreciation_method || 'straight_line';
      let usefulLife = asset.depreciation_years;
      let salvage = asset.salvage_value || 0;
      let rate = asset.depreciation_rate;
      let unitsTotal = asset.units_estimated_total;
      let profileId = asset.depreciation_profile_id;

      if (!asset.depreciation_method && defaultProfileByType[asset.asset_type]) {
        const prof = defaultProfileByType[asset.asset_type];
        method = prof.method;
        if (!usefulLife) usefulLife = prof.useful_life_years;
        if (!salvage) salvage = (asset.acquisition_cost * (prof.salvage_percentage || 0)) / 100;
        if (prof.method === 'reducing_balance' && !rate) rate = prof.depreciation_rate;
        if (prof.method === 'units_of_production' && !unitsTotal) unitsTotal = prof.units_estimated_total;
        profileId = prof.id;
      }

      const result = calculateDepreciation({
        method,
        acquisition_cost: asset.acquisition_cost,
        acquisition_date: asset.acquisition_date,
        salvage_value: salvage,
        useful_life_years: usefulLife,
        depreciation_rate: rate,
        units_estimated_total: unitsTotal,
        units_produced_to_date: asset.units_produced_to_date || asset.operating_hours || 0,
      });

      if (!result.configured) {
        continue;
      }

      updates.push({
        id: asset.id,
        depreciation_method: method,
        depreciation_years: usefulLife,
        salvage_value: salvage,
        depreciation_rate: rate,
        units_estimated_total: unitsTotal,
        units_produced_to_date: asset.units_produced_to_date || asset.operating_hours || 0,
        cost_per_unit: result.cost_per_unit,
        annual_depreciation: result.annual_depreciation,
        accumulated_depreciation: result.accumulated_depreciation,
        current_book_value: result.current_book_value,
        depreciation_profile_id: profileId,
      });

      progress.push(`${asset.name}: ${method} → book value £${Math.round(result.current_book_value).toLocaleString()}`);
    }

    // Bulk update
    if (updates.length > 0) {
      await e.SiteAsset.bulkUpdate(updates);
    }

    return Response.json({
      success: true,
      assets_processed: updates.length,
      progress,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}