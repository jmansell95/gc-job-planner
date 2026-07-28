// ============================================================
// supplierRateMatcher — supplier rate-card matching for plant hire
// ============================================================
// Hired plant has two sides:
//   • purchase cost  — what we pay the supplier (from the supplier's own
//                      rate card: RateCardItem.rate_card_source='supplier')
//   • client charge  — what we bill the client (from Our Rate Card
//                      rate_card_source='our_company', or markup-on-cost)
//
// This module resolves both sides for a hired-equipment JobCostItem so the
// financials engine and invoice generator can capture hire margin instead
// of billing hired plant through at zero margin.

export interface RateCardItemLike {
  id: string;
  rate_card_source?: string;
  supplier_id?: string;
  category?: string;
  subcategory?: string;
  description?: string;
  price?: number | null;
  price_text?: string;
  unit?: string;
  project_id?: string;
  is_active?: boolean;
}

const norm = (s: unknown): string => String(s || '').toLowerCase().trim();

/**
 * Find the best-matching supplier rate card item for a plant hire description.
 * Searches only the given supplier's rate card.
 * Matching: exact → contains (either direction) → keyword overlap.
 */
export function findSupplierRateCardItem(
  supplierId: string,
  description: string,
  supplierRateItems: RateCardItemLike[],
): RateCardItemLike | null {
  if (!supplierId || !description) return null;
  const pool = (supplierRateItems || []).filter(
    (r) => r.rate_card_source === 'supplier' && r.supplier_id === supplierId &&
      r.is_active !== false && r.price != null && !Number.isNaN(Number(r.price)),
  );
  if (pool.length === 0) return null;
  const desc = norm(description);

  let m = pool.find((r) => norm(r.description) === desc);
  if (m) return m;
  m = pool.find((r) => { const d = norm(r.description); return d && d.includes(desc); });
  if (m) return m;
  m = pool.find((r) => { const d = norm(r.description); return d && desc.includes(d); });
  if (m) return m;

  // keyword overlap
  const descWords = new Set(desc.split(/\W+/).filter((w) => w.length > 2));
  let best: RateCardItemLike | null = null;
  let bestScore = 0;
  for (const r of pool) {
    const words = norm(r.description).split(/\W+/).filter((w) => w.length > 2);
    const score = words.reduce((s, w) => s + (descWords.has(w) ? 1 : 0), 0);
    if (score > bestScore) { bestScore = score; best = r; }
  }
  return bestScore > 0 ? best : null;
}

/**
 * Find the sell-side (client charge) rate from Our Rate Card by description.
 */
export function findOurChargeRateCardItem(
  description: string,
  ourRateItems: RateCardItemLike[],
): RateCardItemLike | null {
  if (!description) return null;
  const pool = (ourRateItems || []).filter(
    (r) => r.rate_card_source !== 'supplier' && r.is_active !== false &&
      r.price != null && !Number.isNaN(Number(r.price)),
  );
  const desc = norm(description);
  let m = pool.find((r) => norm(r.description) === desc);
  if (m) return m;
  m = pool.find((r) => { const d = norm(r.description); return d && d.includes(desc); });
  if (m) return m;
  m = pool.find((r) => { const d = norm(r.description); return d && desc.includes(d); });
  if (m) return m;
  return null;
}

export interface HireCharge {
  cost_item_id: string;
  description: string;
  supplier_id: string;
  quantity: number;
  unit_label: string;
  purchase_unit_cost: number;
  purchase_cost: number;
  client_unit_charge: number;
  client_charge: number;
  margin_net: number;
  margin_pct: number;
  source: 'our_rate_card' | 'markup_on_cost' | 'no_margin';
  our_rate_card_id: string;
  supplier_rate_card_id: string;
}

/**
 * Resolve the full hire economics for a single hired-equipment JobCostItem.
 *  purchase_cost  — supplier rate card match, else the item's unit_cost
 *  client_charge  — Our Rate Card match, else purchase_cost × (1 + markup/100)
 *  margin_net     — client_charge − purchase_cost
 */
export function resolveHireCharge(
  hireItem: any,
  supplierRateItems: RateCardItemLike[],
  ourRateItems: RateCardItemLike[],
  defaultMarkupPct: number,
): HireCharge {
  const qty = Number(hireItem.quantity) || 1;
  const unitCost = (hireItem.price_confirmed && hireItem.negotiated_unit_cost != null)
    ? Number(hireItem.negotiated_unit_cost)
    : (Number(hireItem.unit_cost) || 0);
  const purchaseCost = Math.round(unitCost * qty * 100) / 100;

  // Confirm the purchase cost against the supplier's rate card when possible.
  const supplierMatch = hireItem.supplier_id
    ? findSupplierRateCardItem(hireItem.supplier_id, hireItem.description, supplierRateItems)
    : null;
  let purchaseUnit = unitCost;
  if (supplierMatch && supplierMatch.price != null) {
    purchaseUnit = Number(supplierMatch.price);
  }
  const resolvedPurchase = Math.round(purchaseUnit * qty * 100) / 100;

  // Sell side: Our Rate Card match first, then markup-on-cost.
  const ourMatch = findOurChargeRateCardItem(hireItem.description, ourRateItems);
  let clientCharge: number;
  let source: HireCharge['source'];
  if (ourMatch) {
    clientCharge = Math.round((Number(ourMatch.price) || 0) * qty * 100) / 100;
    source = 'our_rate_card';
  } else {
    const effMarkup = Number(defaultMarkupPct) || 0;
    clientCharge = Math.round(resolvedPurchase * (1 + effMarkup / 100) * 100) / 100;
    source = effMarkup > 0 ? 'markup_on_cost' : 'no_margin';
  }

  const marginNet = Math.round((clientCharge - resolvedPurchase) * 100) / 100;
  const marginPct = clientCharge > 0 ? Math.round((marginNet / clientCharge) * 1000) / 10 : 0;

  return {
    cost_item_id: hireItem.id,
    description: hireItem.description || '',
    supplier_id: hireItem.supplier_id || '',
    quantity: qty,
    unit_label: hireItem.unit_label || 'day',
    purchase_unit_cost: purchaseUnit,
    purchase_cost: resolvedPurchase,
    client_unit_charge: qty > 0 ? Math.round((clientCharge / qty) * 100) / 100 : clientCharge,
    client_charge: clientCharge,
    margin_net: marginNet,
    margin_pct: marginPct,
    source,
    our_rate_card_id: ourMatch?.id || '',
    supplier_rate_card_id: supplierMatch?.id || '',
  };
}

/**
 * Resolve hire charges for a list of cost items (only hired_equipment ones).
 * Returns { rows, purchase_net, client_charge_net, margin_net }.
 */
export function resolveHireCharges(
  costItems: any[],
  supplierRateItems: RateCardItemLike[],
  ourRateItems: RateCardItemLike[],
  defaultMarkupPct: number,
) {
  const hiredItems = (costItems || []).filter((c) => c.category === 'hired_equipment' && c.supplier_id);
  const rows = hiredItems.map((c) => resolveHireCharge(c, supplierRateItems, ourRateItems, defaultMarkupPct));
  const purchaseNet = Math.round(rows.reduce((s, r) => s + r.purchase_cost, 0) * 100) / 100;
  const clientChargeNet = Math.round(rows.reduce((s, r) => s + r.client_charge, 0) * 100) / 100;
  const marginNet = Math.round(rows.reduce((s, r) => s + r.margin_net, 0) * 100) / 100;
  return { rows, purchase_net: purchaseNet, client_charge_net: clientChargeNet, margin_net: marginNet };
}