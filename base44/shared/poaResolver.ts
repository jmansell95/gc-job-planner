// ============================================================
// POA (Price on Application) Resolver
// ============================================================
// Resolves charges for rate card items that are currently POA
// (price = null, price_text = "POA") by looking up agreed prices
// from the POAPriceLock entity.
//
// Resolution order for POA locks:
//   1. Job-scoped lock  — POAPriceLock where scope='job' and job_id matches
//   2. Project-scoped lock — POAPriceLock where scope='project' and project_id matches
//   3. Global lock — POAPriceLock where scope='global'
//
// Used by:
//   • stampBillingCharge — checks POA locks after the priced resolver fails
//   • lockPOAPrice — retroactive stamping of unpriced cost logs
//   • POA Worklist UI — shows which POA items have locks

import {
  tokenize,
  scoreMatch,
  type RateCardItemLike,
} from './projectRateMatcher.ts';

export interface POALockLike {
  id: string;
  rate_card_item_id: string;
  agreed_price: number;
  unit: string | null;
  scope: string;
  status: string;
  effective_date: string | null;
  expiry_date: string | null;
  project_id: string | null;
  job_id: string | null;
}

export interface ResolvedPOARate {
  rate_card_item_id: string;
  poa_lock_id: string;
  description: string;
  unit_price: number;
  quantity: number;
  total: number;
  unit: string | null;
  rate_source: 'poa_lock';
  lock_scope: string;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Find the best-matching POA rate card item (null price) for a description.
// Uses the same recall-based scoring as the priced matcher, but only
// considers items where price is null (POA items).
export function findBestPOAMatch(
  description: string,
  rateCardItems: RateCardItemLike[]
): RateCardItemLike | null {
  if (!description || !rateCardItems || rateCardItems.length === 0) return null;
  const poaItems = rateCardItems.filter(
    (i) => i.price == null || isNaN(Number(i.price))
  );
  if (poaItems.length === 0) return null;
  let best: RateCardItemLike | null = null;
  let bestScore = 0;
  for (const item of poaItems) {
    if (item.is_active === false) continue;
    const score = scoreMatch(description, item);
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return bestScore >= 0.6 ? best : null;
}

// Load ALL rate card items for a project (including POA / null-price items).
// Unlike loadProjectRateCardItems, this does NOT filter to priced items only.
export async function loadAllRateCardItems(
  base44: any,
  projectId: string | null | undefined,
  jobDate?: string | null
): Promise<RateCardItemLike[]> {
  if (projectId) {
    const projectItems = await base44.asServiceRole.entities.RateCardItem.filter(
      { project_id: projectId, is_active: true },
      '-sort_order',
      500
    );
    if (projectItems && projectItems.length > 0) {
      return projectItems;
    }
  }
  const global = await base44.asServiceRole.entities.RateCardItem.filter(
    { rate_card_source: 'our_company', is_active: true },
    '-sort_order',
    500
  );
  return (global || []).filter((i: any) => !i.project_id);
}

// Load POA locks applicable to a job/project.
// Returns locks in priority order: job → project → global.
export async function loadPOALocks(
  base44: any,
  jobId: string | null | undefined,
  projectId: string | null | undefined,
): Promise<POALockLike[]> {
  try {
    const locks = await base44.asServiceRole.entities.POAPriceLock.filter(
      { status: 'agreed' },
      '-agreed_at',
      500
    );
    const applicable = (locks || []).filter((l: any) => {
      if (l.scope === 'global') return true;
      if (l.scope === 'project' && projectId && l.project_id === projectId) return true;
      if (l.scope === 'job' && jobId && l.job_id === jobId) return true;
      return false;
    });
    // Sort by priority: job first, then project, then global
    const priority: Record<string, number> = { job: 0, project: 1, global: 2 };
    applicable.sort((a: any, b: any) => (priority[a.scope] || 9) - (priority[b.scope] || 9));
    return applicable;
  } catch (_) {
    return [];
  }
}

// Check if a POA lock is valid for a given date
export function isLockValidForDate(lock: POALockLike, jobDate: string | null | undefined): boolean {
  if (lock.effective_date && jobDate && lock.effective_date > jobDate) return false;
  if (lock.expiry_date && jobDate && lock.expiry_date < jobDate) return false;
  return true;
}

// Resolve a POA price for a description against a job/project.
// Returns the locked price if a POA rate card item matches AND a lock exists.
export async function resolvePOAPrice(
  base44: any,
  params: {
    job_id: string | null | undefined;
    project_id: string | null | undefined;
    description: string;
    quantity?: number;
    job_date?: string | null;
  }
): Promise<ResolvedPOARate | null> {
  const { job_id, project_id, description, quantity = 1, job_date } = params;
  if (!description) return null;

  // Load all rate card items (including POA)
  const allItems = await loadAllRateCardItems(base44, project_id, job_date);
  // Find the best POA match
  const poaMatch = findBestPOAMatch(description, allItems);
  if (!poaMatch) return null;

  // Load POA locks for this job/project
  const locks = await loadPOALocks(base44, job_id, project_id);
  // Find a lock for this specific rate card item, valid for the job date
  const lock = locks.find(
    (l) => l.rate_card_item_id === poaMatch.id && isLockValidForDate(l, job_date)
  );
  if (!lock) return null;

  const unitPrice = Number(lock.agreed_price) || 0;
  const qty = Number(quantity) || 1;
  return {
    rate_card_item_id: poaMatch.id,
    poa_lock_id: lock.id,
    description: poaMatch.description,
    unit_price: unitPrice,
    quantity: qty,
    total: round2(unitPrice * qty),
    unit: lock.unit || poaMatch.unit || null,
    rate_source: 'poa_lock',
    lock_scope: lock.scope,
  };
}