/**
 * Shared rig-to-rate-card matching logic.
 * Used by both RigGearPickerModal and JobLogisticsHub to avoid duplication.
 *
 * Priority:
 * 1. Explicit link via rate_card_item_id (set in Equipment Library settings)
 * 2. Window Sampling rigs — matched by name keywords (tracked, modular, terrier)
 * 3. CP rigs — matched by type (cutdown vs standard, electric vs diesel)
 * 4. Rotary rigs — matched by model number in description
 * 5. Falls back to null (caller uses default_unit_cost)
 */
export function findRigRateCardItem(rig, rateCardItems = [], assetMap = {}) {
  // 1. Explicit link set in Equipment Library settings or by sync
  if (rig.rate_card_item_id) {
    const linked = rateCardItems.find(r => r.id === rig.rate_card_item_id);
    if (linked) return linked;
  }

  const asset = rig.site_asset_id ? assetMap[rig.site_asset_id] : null;
  const rigType = asset?.rig_type;
  const desc = String(rig.description || '').toLowerCase();
  const isCutdown = /cut\s*down|cutdown/i.test(desc);

  // 2. Window Sampling rigs — match by name keywords BEFORE the CP check,
  //    since rigs like "Dando Terrier" contain "dando" which would match CP.
  //    Tracked rigs (Global Tracked, Dando Terrier) → "Tracked Window Sampling + Driller"
  //    Modular rigs (Global Modular) → "Modular Window Sampling + Driller & Enabler"
  const isWindowSampling = /window\s*sampling|tracked|modular|terrier/i.test(desc);
  if (isWindowSampling) {
    const wsEntries = rateCardItems.filter(r =>
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
      // Generic window sampling — first non-additional entry
      const generic = wsEntries.find(r => !/additional/i.test(r.description));
      if (generic) return generic;
    }
  }

  // 3. CP rigs — rate card entries have no model numbers, match by type
  const looksCp = rigType === 'cp' || ((!rigType || rigType === 'n/a') && (isCutdown || /dando|percussive|cable/i.test(desc)));
  if (looksCp) {
    if (isCutdown) {
      const isElectric = /electric/i.test(desc);
      const cutdown = rateCardItems.find(r =>
        r.subcategory === 'Cable Percussive Crews' &&
        /cutdown/i.test(r.description) &&
        !/enabling/i.test(r.description) &&
        (isElectric ? /electric/i.test(r.description) : /diesel/i.test(r.description))
      );
      if (cutdown) return cutdown;
      const anyCutdown = rateCardItems.find(r =>
        r.subcategory === 'Cable Percussive Crews' &&
        /cutdown/i.test(r.description) &&
        !/enabling/i.test(r.description)
      );
      if (anyCutdown) return anyCutdown;
    }
    const cpCrew = rateCardItems.find(r =>
      r.subcategory === 'Cable Percussive Crews' &&
      /^cable percussive crew$/i.test(String(r.description || '').trim())
    );
    if (cpCrew) return cpCrew;
  }

  // 4. Rotary rigs — match by model number in description
  const numMatch = desc.match(/(\d{2,4})/);
  if (numMatch) {
    const num = numMatch[1];
    const match = rateCardItems.find(r =>
      r.category === 'labour' &&
      r.subcategory === 'Rotary Crews' &&
      (r.description || '').includes(num) &&
      !/additional|3rd|enabling/i.test(r.description || '')
    );
    if (match) return match;
  }

  return null;
}