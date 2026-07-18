/**
 * Shared rig-to-rate-card matching logic.
 * Used by RigGearPickerModal and JobLogisticsHub.
 *
 * Accepts a SiteAsset rig (asset_type === 'rig', is_rig === true) and matches it
 * against RateCardItem entries from "Our Rate Card" (rate_card_source === 'our_company').
 *
 * Priority:
 * 1. Window Sampling rigs — matched by name keywords (tracked, modular, terrier)
 * 2. CP rigs — matched by type (cutdown vs standard, electric vs diesel)
 * 3. Rotary rigs — matched by model number in name
 * 4. Falls back to null (caller uses the rig's daily_billing_rate from Asset Panda)
 */
export function findRigRateCardItem(rigAsset, rateCardItems = []) {
  if (!rigAsset) return null;

  const rigType = rigAsset.rig_type;
  const desc = String(rigAsset.name || '').toLowerCase();
  const isCutdown = /cut\s*down|cutdown/i.test(desc);

  // Only match against our own rate card (supplier rate cards are for hire items)
  const ourRates = (rateCardItems || []).filter(r => r.rate_card_source !== 'supplier');

  // 1. Window Sampling rigs — match by name keywords BEFORE the CP check,
  //    since rigs like "Dando Terrier" contain "dando" which would match CP.
  const isWindowSampling = /window\s*sampling|tracked|modular|terrier/i.test(desc);
  if (isWindowSampling) {
    const wsEntries = ourRates.filter(r =>
      r.category === 'labour' &&
      r.subcategory === 'Window Sampling'
    );
    if (wsEntries.length > 0) {
      if (/modular/i.test(desc)) {
        const modular = wsEntries.find(r =>
          /modular/i.test(r.description) && !/additional/i.test(r.description)
        );
        if (modular) return modular;
      }
      if (/tracked|terrier/i.test(desc)) {
        const tracked = wsEntries.find(r => /tracked/i.test(r.description));
        if (tracked) return tracked;
      }
      const generic = wsEntries.find(r => !/additional/i.test(r.description));
      if (generic) return generic;
    }
  }

  // 2. CP rigs — rate card entries have no model numbers, match by type
  const looksCp = rigType === 'cp' || ((!rigType || rigType === 'n/a') && (isCutdown || /dando|percussive|cable/i.test(desc)));
  if (looksCp) {
    if (isCutdown) {
      const isElectric = /electric/i.test(desc);
      const cutdown = ourRates.find(r =>
        r.subcategory === 'Cable Percussive Crews' &&
        /cutdown/i.test(r.description) &&
        !/enabling/i.test(r.description) &&
        (isElectric ? /electric/i.test(r.description) : /diesel/i.test(r.description))
      );
      if (cutdown) return cutdown;
      const anyCutdown = ourRates.find(r =>
        r.subcategory === 'Cable Percussive Crews' &&
        /cutdown/i.test(r.description) &&
        !/enabling/i.test(r.description)
      );
      if (anyCutdown) return anyCutdown;
    }
    const cpCrew = ourRates.find(r =>
      r.subcategory === 'Cable Percussive Crews' &&
      /^cable percussive crew$/i.test(String(r.description || '').trim())
    );
    if (cpCrew) return cpCrew;
  }

  // 3. Rotary rigs — match by model number in name
  const numMatch = desc.match(/(\d{2,4})/);
  if (numMatch) {
    const num = numMatch[1];
    const match = ourRates.find(r =>
      r.category === 'labour' &&
      r.subcategory === 'Rotary Crews' &&
      (r.description || '').includes(num) &&
      !/additional|3rd|enabling/i.test(r.description || '')
    );
    if (match) return match;
  }

  return null;
}

/** Fallback day rate for a rig when no rate card match is found. */
export function rigFallbackDayRate(rigAsset) {
  return Number(rigAsset?.daily_billing_rate) || 0;
}