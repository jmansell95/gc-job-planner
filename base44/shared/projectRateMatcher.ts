// ============================================================
// Project Rate Card Matcher — shared by backend functions
// ============================================================
// Maps a free-text activity / remark description (e.g. a driller's
// "bagging spoil" remark, or an investigation log description) to the
// best-matching RateCardItem for a given project.
//
// Project-scoped rate cards (e.g. the East West Rail schedule of rates)
// take precedence over the global Master Price List, so a job linked to
// that project bills against the project's own rates automatically.
//
// Matching is recall-based: we ask "what fraction of the activity's
// meaningful words appear in this rate item's description?" — this works
// far better than coverage for short driller remarks vs long SOR lines.
// A light stemmer collapses bagging/bags, mobilise/mobilisation, etc.
//
// Used by:
//   • receiveKeyLogBookData  — auto-prices parsed driller remarks at ingest
//   • calculateCharge        — auto-prices investigation logs by project rate card

export interface RateCardItemLike {
  id: string;
  description: string;
  price: number | null;
  price_text?: string | null;
  unit?: string | null;
  subcategory?: string | null;
  project_id?: string | null;
  is_active?: boolean;
}

export interface RateMatch {
  rateCardItem: RateCardItemLike;
  quantity: number;
  unitPrice: number;
  total: number;
}

// Only truly generic English function words are stopwords — domain terms
// (borehole, advance, core, sample, pit, rotary, etc.) participate in matching.
const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'into', 'onto', 'over', 'under',
  'this', 'that', 'all', 'any', 'per', 'sum', 'nr', 'each', 'set', 'between',
  'but', 'asd', 'of', 'to', 'in', 'on', 'a', 'an', 'is', 'by', 'or', 'at', 'be', 'as',
  // Generic drilling-context words that rarely discriminate a specific rate line
  'site', 'work', 'works', 'day', 'shift', 'time',
]);

// Strip a leading item-ref prefix like "2 — " or "B4 — " or "2.1 - "
export function stripItemRef(desc: string): string {
  return String(desc || '').replace(/^\s*[A-Z]?\d+(?:\.\d+)?\s*[—\-–:]\s*/i, '').trim();
}

export function normalizeText(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Light stemmer — collapses common suffixes so "bagging"↔"bags",
// "mobilise"↔"mobilisation", "drilling"↔"drill" all match.
function stem(t: string): string {
  let s = t;
  for (const suf of ['isation', 'ization', 'ation', 'ising', 'izing', 'ing', 'ied', 'ied', 'ed', 'er', 'es', 's']) {
    if (s.length > suf.length + 2 && s.endsWith(suf)) {
      const stem = s.slice(0, -suf.length);
      if (stem.length >= 3) return stem;
    }
  }
  return s;
}

export function tokenize(s: string): string[] {
  const norm = normalizeText(stripItemRef(s));
  return norm
    .split(' ')
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t))
    .map(stem)
    .filter((t) => t.length >= 3);
}

// Recall-based score: fraction of the ACTIVITY's tokens found in the rate item.
// Requires at least 2 matched tokens (so a single generic word can't trigger a
// charge) and recall ≥ 0.6 (most of the activity's meaning must be present).
export function scoreMatch(activityDesc: string, rateItem: RateCardItemLike): number {
  const activityTokens = tokenize(activityDesc);
  if (activityTokens.length === 0) return 0;
  const rateTokenSet = new Set(tokenize(rateItem.description));
  if (rateTokenSet.size === 0) return 0;
  let hits = 0;
  for (const t of activityTokens) {
    if (rateTokenSet.has(t)) hits++;
  }
  if (hits === 0) return 0;
  // Require at least 2 matched tokens — single-word remarks are too ambiguous
  // to auto-price confidently and stay for manual review instead.
  if (hits < 2) return 0;
  const recall = hits / activityTokens.length;
  return recall >= 0.6 ? recall : recall * 0.5;
}

// Find the best-matching chargeable rate card item for a description.
export function findBestRateCardMatch(
  description: string,
  rateCardItems: RateCardItemLike[]
): RateCardItemLike | null {
  if (!description || !rateCardItems || rateCardItems.length === 0) return null;
  let best: RateCardItemLike | null = null;
  let bestScore = 0;
  for (const item of rateCardItems) {
    if (item.is_active === false) continue;
    if (item.price == null || isNaN(Number(item.price))) continue;
    const score = scoreMatch(description, item);
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  // Only accept a match above the confidence threshold to avoid false charges.
  return bestScore >= 0.6 ? best : null;
}

// Load rate card items for a project: project-scoped items when the project
// has any, otherwise the global "our_company" Master Price List items.
// Returns only items with a usable numeric price.
export async function loadProjectRateCardItems(
  base44: any,
  projectId: string | null | undefined
): Promise<RateCardItemLike[]> {
  if (projectId) {
    const projectItems = await base44.asServiceRole.entities.RateCardItem.filter(
      { project_id: projectId, is_active: true },
      '-sort_order',
      500
    );
    if (projectItems && projectItems.length > 0) {
      return projectItems.filter((i: RateCardItemLike) => i.price != null && !isNaN(Number(i.price)));
    }
  }
  // Fall back to the global Master Price List (our_company, no project)
  const global = await base44.asServiceRole.entities.RateCardItem.filter(
    { rate_card_source: 'our_company', is_active: true },
    '-sort_order',
    500
  );
  return (global || []).filter(
    (i: RateCardItemLike) => i.price != null && !isNaN(Number(i.price)) && !i.project_id
  );
}

// Resolve a charge for an activity description against a project rate card.
// quantity defaults to 1 (most SOR line items are per-sum/per-each); callers
// that know the unit (metres, hours) can pass an explicit quantity.
export function resolveProjectCharge(
  description: string,
  rateCardItems: RateCardItemLike[],
  quantity: number = 1
): RateMatch | null {
  const item = findBestRateCardMatch(description, rateCardItems);
  if (!item) return null;
  const unitPrice = Number(item.price) || 0;
  const qty = Number(quantity) || 1;
  return {
    rateCardItem: item,
    quantity: qty,
    unitPrice,
    total: Math.round(unitPrice * qty * 100) / 100,
  };
}