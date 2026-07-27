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
export function findRigRateCardItem(rigAsset, rateCardItems = []) {
  if (!rigAsset) return null;

  const rigType = rigAsset.rig_type;
  const desc = String(rigAsset.name || '').toLowerCase();
  const isCutdown = /cut\s*down|cutdown/i.test(desc);

  // Rig crew day rates live under subcategory 'Labour' in Our Rate Card
  // (rate_card_source !== 'supplier'). Only entries with a numeric price are usable.
  const labourRates = (rateCardItems || []).filter(
    (r) => r.rate_card_source !== 'supplier' &&
           String(r.subcategory || '').toLowerCase() === 'labour' &&
           r.price != null && !Number.isNaN(Number(r.price))
  );

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
export function findOwnedAssetRateCardItem(asset, rateCardItems = []) {
  if (!asset) return null;

  // Rigs use the dedicated matcher (crew day rate logic).
  if (asset.is_rig === true || asset.asset_type === 'rig') {
    return findRigRateCardItem(asset, rateCardItems);
  }

  const ourRates = (rateCardItems || []).filter(
    (r) => r.is_active !== false && r.rate_card_source !== 'supplier'
  );
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
 * Resolve the billing price for an owned asset from the Master Price List (Our Rate Card).
 * Asset Panda is for inventory/stock only — it is NOT a pricing source.
 *
 * Returns { cost, unit, rateCardItem, source } where source is
 * 'rate-card' | 'none'.
 */
export function resolveAssetPrice(asset, rateCardItems = []) {
  if (!asset) return { cost: 0, unit: 'day', rateCardItem: null, source: 'none' };

  const rc = findOwnedAssetRateCardItem(asset, rateCardItems);
  if (rc && rc.price != null) {
    return { cost: Number(rc.price) || 0, unit: rc.unit || 'day', rateCardItem: rc, source: 'rate-card' };
  }

  return { cost: 0, unit: 'day', rateCardItem: null, source: 'none' };
}