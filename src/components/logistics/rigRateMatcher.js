/**
 * Shared rig-to-rate-card matching logic.
 * Used by RigGearPickerModal and JobLogisticsHub.
 *
 * Accepts a SiteAsset rig (asset_type === 'rig', is_rig === true) and matches it
 * against RateCardItem entries from "Our Rate Card" (rate_card_source === 'our_company').
 *
 * Rig crew day rates all live under subcategory 'Labour' in the Master Price List.
 *
 * Priority:
 * 1. Window Sampling rigs — matched by name keywords (modular, tracked, terrier)
 * 2. CP rigs — matched by type (cutdown electric/diesel vs standard Cable Percussive Crew)
 * 3. Rotary rigs — matched by model number in name (205, 300, 405), else first Rotary Crew
 * 4. Falls back to null (no price — Asset Panda is for inventory only, not pricing)
 */
export function findRigRateCardItem(rigAsset, rateCardItems = [], projectId = null) {
  if (!rigAsset) return null;

  const rigType = rigAsset.rig_type;
  const desc = String(rigAsset.name || '').toLowerCase();
  const isCutdown = /cut\s*down|cutdown/i.test(desc);

  // Project-scoped rates take precedence — when a job belongs to a project with
  // its own rate card (e.g. EWR), prefer those items, then fall back to the
  // global Master Price List so unmatched rigs still resolve.
  const projectItems = projectId
    ? (rateCardItems || []).filter((r) => r.project_id === projectId && r.price != null && !Number.isNaN(Number(r.price)))
    : [];
  const globalLabour = (rateCardItems || []).filter(
    (r) => !r.project_id && r.rate_card_source !== 'supplier' &&
           String(r.subcategory || '').toLowerCase() === 'labour' &&
           r.price != null && !Number.isNaN(Number(r.price))
  );
  const labourRates = projectItems.length > 0 ? [...projectItems, ...globalLabour] : globalLabour;

  // 1. Window Sampling rigs (Modular / Tracked / Terrier) — checked BEFORE CP,
  //    since "Dando Terrier" contains "dando" which would otherwise match CP.
  if (/modular/i.test(desc)) {
    const modular = labourRates.find(r =>
      /modular/i.test(r.description) && /window\s*sampling/i.test(r.description) && !/additional/i.test(r.description));
    if (modular) return modular;
  }
  if (/tracked|terrier/i.test(desc)) {
    const tracked = labourRates.find(r =>
      /tracked/i.test(r.description) && /window\s*sampling/i.test(r.description));
    if (tracked) return tracked;
  }
  if (/window\s*sampling/i.test(desc)) {
    const generic = labourRates.find(r =>
      /window\s*sampling/i.test(r.description) && !/additional/i.test(r.description));
    if (generic) return generic;
  }

  // 2. CP rigs — cutdown (electric vs diesel) or standard Cable Percussive Crew.
  const looksCp = rigType === 'cp' ||
    ((!rigType || rigType === 'n/a') && (isCutdown || /dando|percussive|cable/i.test(desc)));
  if (looksCp) {
    if (isCutdown) {
      const isElectric = /electric/i.test(desc);
      const cutdown = labourRates.find(r =>
        /cutdown/i.test(r.description) &&
        /cable\s*percussive/i.test(r.description) &&
        !/additional/i.test(r.description) &&
        (isElectric ? /electric/i.test(r.description) : /diesel/i.test(r.description)));
      if (cutdown) return cutdown;
      const anyCutdown = labourRates.find(r =>
        /cutdown/i.test(r.description) &&
        /cable\s*percussive/i.test(r.description) &&
        !/additional/i.test(r.description));
      if (anyCutdown) return anyCutdown;
    }
    const cpCrew = labourRates.find(r =>
      /^cable percussive crew$/i.test(String(r.description || '').trim()));
    if (cpCrew) return cpCrew;
  }

  // 3. Rotary rigs — match by model number in the rig name (e.g. 205, 300, 405),
  //    falling back to the first Rotary Crew entry for unmatched rotary rigs.
  if (rigType === 'rotary' || /rotary/i.test(desc)) {
    const numMatch = desc.match(/(\d{2,4})/);
    if (numMatch) {
      const num = numMatch[1];
      const match = labourRates.find(r =>
        /rotary\s*crew/i.test(r.description) &&
        String(r.description || '').includes(num) &&
        !/additional|3rd/i.test(r.description));
      if (match) return match;
    }
    const anyRotary = labourRates.find(r =>
      /rotary\s*crew/i.test(r.description) && !/additional|3rd/i.test(r.description));
    if (anyRotary) return anyRotary;
  }

  return null;
}

/** Fallback day rate for a rig when no rate card match is found — returns 0 (Asset Panda is for inventory only, not pricing). */
export function rigFallbackDayRate(rigAsset) {
  return 0;
}

/**
 * Match ANY owned asset (rigs, machinery, trailers, lifting gear) to a rate card
 * item from Our Rate Card (rate_card_source !== 'supplier').
 *
 * - Rigs delegate to findRigRateCardItem (keyword / model-number matching).
 * - Other assets match by description against our company rate card entries.
 */
export function findOwnedAssetRateCardItem(asset, rateCardItems = [], projectId = null) {
  if (!asset) return null;

  // Rigs use the dedicated matcher (crew day rate logic).
  if (asset.is_rig === true || asset.asset_type === 'rig') {
    return findRigRateCardItem(asset, rateCardItems, projectId);
  }

  // Project-scoped rates take precedence over the global Master Price List.
  const projectItems = projectId
    ? (rateCardItems || []).filter((r) => r.is_active !== false && r.project_id === projectId)
    : [];
  const ourRates = projectItems.length > 0
    ? [...projectItems, ...(rateCardItems || []).filter((r) => r.is_active !== false && !r.project_id && r.rate_card_source !== 'supplier')]
    : (rateCardItems || []).filter((r) => r.is_active !== false && r.rate_card_source !== 'supplier');
  if (ourRates.length === 0) return null;

  const norm = (s) => String(s || '').toLowerCase().trim();
  const name = norm(asset.name);
  const eqType = norm(asset.equipment_type);

  // 1. Exact description match on asset name.
  if (name) {
    const exact = ourRates.find((r) => norm(r.description) === name);
    if (exact && exact.price != null) return exact;
  }
  // 2. Exact match on equipment_type (more specific catalogue label).
  if (eqType) {
    const exactType = ourRates.find((r) => norm(r.description) === eqType);
    if (exactType && exactType.price != null) return exactType;
  }
  // 3. Rate card description contains the asset name.
  if (name) {
    const contains = ourRates.find((r) => {
      const d = norm(r.description);
      return d && d.includes(name) && r.price != null;
    });
    if (contains) return contains;
  }
  return null;
}

/**
 * Resolve the billing price for an owned asset.
 *
 * Price precedence (per the Asset Panda cost-linkage spec):
 *   1. Confirmed rate-card link (asset.rate_card_item_id + status 'confirmed')
 *      → rate card price wins.
 *   2. Proposed rate-card link (status 'proposed') — the auto-match is a link
 *      too, so the rate card price wins unless the admin skips it.
 *   3. Fuzzy name match at pick time (findOwnedAssetRateCardItem) — rate card
 *      wins for any asset with a matching rate card item.
 *   4. Asset Panda cost_price / charge_out_price — the fallback when there is
 *      no rate card match (or the admin explicitly skipped the proposed link).
 *   5. Zero (no price available).
 *
 * Returns { cost, chargeOut, unit, rateCardItem, source } where source is
 * 'rate-card' | 'asset-panda' | 'none'.
 */
export function resolveAssetPrice(asset, rateCardItems = [], projectId = null) {
  if (!asset) return { cost: 0, chargeOut: 0, unit: 'day', rateCardItem: null, source: 'none' };

  // 1 & 2 — confirmed or proposed link on the asset record
  const linkStatus = asset.rate_card_link_status;
  if ((linkStatus === 'confirmed' || linkStatus === 'proposed') && asset.rate_card_item_id) {
    const rc = (rateCardItems || []).find((r) => r.id === asset.rate_card_item_id);
    if (rc && rc.price != null) {
      const cost = rc.cost_price != null ? Number(rc.cost_price) || 0 : Number(rc.price) || 0;
      return { cost, chargeOut: Number(rc.price) || 0, unit: rc.unit || 'day', rateCardItem: rc, source: 'rate-card' };
    }
  }

  // 3 — fuzzy name match (skipped assets bypass this — admin chose AP cost)
  if (linkStatus !== 'skipped') {
    const rc = findOwnedAssetRateCardItem(asset, rateCardItems, projectId);
    if (rc && rc.price != null) {
      const cost = rc.cost_price != null ? Number(rc.cost_price) || 0 : Number(rc.price) || 0;
      return { cost, chargeOut: Number(rc.price) || 0, unit: rc.unit || 'day', rateCardItem: rc, source: 'rate-card' };
    }
  }

  // 4 — Asset Panda cost as fallback
  const apCost = asset.cost_price != null ? Number(asset.cost_price) || 0 : 0;
  const apCharge = asset.charge_out_price != null ? Number(asset.charge_out_price) || 0 : apCost;
  if (apCost > 0 || apCharge > 0) {
    return { cost: apCost, chargeOut: apCharge, unit: 'day', rateCardItem: null, source: 'asset-panda' };
  }

  // 5 — no price
  return { cost: 0, chargeOut: 0, unit: 'day', rateCardItem: null, source: 'none' };
}