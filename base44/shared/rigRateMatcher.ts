// ---------------------------------------------------------------------------
// Shared Rig-to-Rate-Card Matching Logic
// ---------------------------------------------------------------------------
// Used by the spreadsheet import (backend) to match rigs to RateCardItem
// day rates when auto-linking rigs to jobs as JobCostItem records.
//
// Mirrors the frontend logic in src/components/logistics/rigRateMatcher.js.
// Kept in sync so backend imports and manual "Add Rig & Gear" produce the
// same day rate for the same rig.
//
// Priority:
// 1. Window Sampling rigs — matched by name keywords (modular, tracked, terrier)
// 2. CP rigs — matched by type (cutdown electric/diesel vs standard Cable Percussive Crew)
// 3. Rotary rigs — matched by model number in name (205, 300, 405), else first Rotary Crew
// 4. Falls back to null (no price — Asset Panda is for inventory only, not pricing)
// ---------------------------------------------------------------------------

export function findRigRateCardItem(rigAsset: any, rateCardItems: any[] = [], projectId: string | null = null): any {
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