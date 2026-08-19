// ---------------------------------------------------------------------------
// assetPandaRateMatcher — shared fuzzy name-matching logic that links Asset
// Panda assets to Master Price List (RateCardItem) entries.
//
// Used by: syncAssetPanda (propose links during sync), getAssetPandaLinkReview
// (return proposed matches for admin confirmation), assetPandaWebhook
// (re-match on cost change).
//
// Matching priority (fuzzy, division-scoped):
//   1. Exact description === asset name (case-insensitive, trimmed)
//   2. Exact description === asset equipment_type
//   3. Rate card description contains the asset name
//   4. Asset name contains the rate card description
// Only rate card items with a non-null price (or cost_price) are considered,
// from 'our_company' rate cards (not supplier rate cards).
// ---------------------------------------------------------------------------

export interface RateCardItemLike {
  id: string;
  description: string;
  price: number | null;
  cost_price?: number | null;
  unit?: string;
  rate_card_source?: string;
  is_active?: boolean;
  division_id?: string;
}

export interface AssetLike {
  id: string;
  name: string;
  equipment_type?: string;
  asset_type?: string;
  is_rig?: boolean;
  division_id?: string;
  rate_card_item_id?: string;
  rate_card_link_status?: string;
}

/**
 * Normalise a string for comparison: lowercase, trimmed, collapse whitespace.
 */
function norm(s: string | undefined | null): string {
  return String(s || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Find the best rate card match for a single asset by fuzzy name matching.
 * Returns the matching RateCardItem or null.
 *
 * @param asset        the SiteAsset to match
 * @param rateCardItems all rate card items (will be filtered to our_company + active)
 * @param divisionId   optional division scope — when set, prefers division-scoped
 *                     rate card items, then falls back to global (no division_id)
 */
export function findBestRateCardMatch(
  asset: AssetLike,
  rateCardItems: RateCardItemLike[],
  divisionId?: string
): RateCardItemLike | null {
  if (!asset || !rateCardItems || rateCardItems.length === 0) return null;

  const ourRates = rateCardItems.filter(
    (r) => r.is_active !== false && r.rate_card_source !== 'supplier'
  );
  if (ourRates.length === 0) return null;

  // Division-scoped first, then global fallback
  const divisionScoped = divisionId
    ? ourRates.filter((r) => r.division_id === divisionId)
    : [];
  const globalRates = ourRates.filter((r) => !r.division_id);
  const pool = divisionScoped.length > 0 ? [...divisionScoped, ...globalRates] : ourRates;

  const name = norm(asset.name);
  const eqType = norm(asset.equipment_type);

  // 1. Exact description === asset name
  if (name) {
    const exact = pool.find((r) => norm(r.description) === name);
    if (exact && (exact.price != null || exact.cost_price != null)) return exact;
  }
  // 2. Exact description === equipment_type
  if (eqType) {
    const exactType = pool.find((r) => norm(r.description) === eqType);
    if (exactType && (exactType.price != null || exactType.cost_price != null)) return exactType;
  }
  // 3. Rate card description contains the asset name
  if (name) {
    const contains = pool.find((r) => {
      const d = norm(r.description);
      return d && d.includes(name) && (r.price != null || r.cost_price != null);
    });
    if (contains) return contains;
  }
  // 4. Asset name contains the rate card description
  if (name) {
    const contained = pool.find((r) => {
      const d = norm(r.description);
      return d && name.includes(d) && (r.price != null || r.cost_price != null);
    });
    if (contained) return contained;
  }

  return null;
}

/**
 * Propose rate-card links for a batch of synced assets.
 * Does NOT overwrite assets that already have a 'confirmed' or 'skipped' link.
 * Returns a map of assetId -> { rate_card_item_id, rate_card_link_status, rate_card_description, rate_card_price }.
 */
export function proposeLinks(
  assets: AssetLike[],
  rateCardItems: RateCardItemLike[]
): Record<string, {
  rate_card_item_id: string;
  rate_card_link_status: 'proposed';
  rate_card_description: string;
  rate_card_price: number | null;
  rate_card_cost_price: number | null;
}> {
  const result: Record<string, any> = {};
  for (const asset of assets) {
    // Never overwrite a confirmed or skipped link
    if (asset.rate_card_link_status === 'confirmed' || asset.rate_card_link_status === 'skipped') {
      continue;
    }
    const match = findBestRateCardMatch(asset, rateCardItems, asset.division_id);
    if (match) {
      result[asset.id] = {
        rate_card_item_id: match.id,
        rate_card_link_status: 'proposed',
        rate_card_description: match.description,
        rate_card_price: match.price,
        rate_card_cost_price: match.cost_price ?? null,
      };
    }
  }
  return result;
}