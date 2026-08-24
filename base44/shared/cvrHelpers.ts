/**
 * Shared helpers for CVR & AFP parsing, calculation, and audit logging.
 * Used by parseCVRUpload, parseAFPUpload, commitCVRParse, commitAFPParse,
 * and recalculateCVR backend functions.
 */

// ── Number parsing ──────────────────────────────────────────────────────
export function toNum(val): number {
  if (val == null || val === '') return 0;
  if (val instanceof Date) return 0; // dates in numeric columns are parsing errors
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const cleaned = String(val).replace(/[^0-9.\-]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

export function toDateStr(val): string | null {
  if (!val) return null;
  if (typeof val === 'string') {
    // Handle ISO date strings
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return val;
  }
  if (val instanceof Date) {
    return val.toISOString().slice(0, 10);
  }
  return null;
}

// ── CVR calculation ─────────────────────────────────────────────────────
export function calcLineItemTotals(item) {
  const tender = toNum(item.tender_value);
  const voSum = (item.vo_values || []).reduce((s, v) => s + toNum(v.value), 0);
  const forecast = item.forecast_final_value != null ? toNum(item.forecast_final_value) : tender + voSum;
  const invoiced = toNum(item.invoiced_costs);
  const committed = toNum(item.committed_costs);
  const ordersNotPlaced = toNum(item.orders_not_placed);
  const defects = toNum(item.defects_contingency);
  const totalCost = item.total_cost != null ? toNum(item.total_cost) : invoiced + committed + ordersNotPlaced + defects;
  const profitLoss = forecast - totalCost;
  const profitPct = forecast !== 0 ? (profitLoss / forecast) * 100 : 0;
  return {
    ...item,
    forecast_final_value: forecast,
    total_cost: totalCost,
    profit_loss: profitLoss,
    profit_pct: profitPct,
  };
}

export function calcVariationTotals(vo) {
  const agreed = toNum(vo.agreed_value);
  const totalCost = vo.total_cost != null
    ? toNum(vo.total_cost)
    : toNum(vo.prelim_cost) + toNum(vo.labour_cost) + toNum(vo.plant_cost) +
      toNum(vo.material_cost) + toNum(vo.nursery_cost) + toNum(vo.maintenance_cost);
  const profitMargin = agreed - totalCost;
  const profitMarginPct = agreed !== 0 ? (profitMargin / agreed) * 100 : 0;
  return {
    ...vo,
    total_cost: totalCost,
    profit_margin: profitMargin,
    profit_margin_pct: profitMarginPct,
  };
}

export function calcCVRSummary(lineItems, variations) {
  const variationsTotal = variations.reduce((s, v) => s + toNum(v.agreed_value), 0);
  const totalCost = lineItems.reduce((s, li) => s + toNum(li.total_cost), 0);
  const costsToDate = lineItems.reduce((s, li) => s + toNum(li.costs_to_date), 0);
  const valueToDate = lineItems.reduce((s, li) => s + toNum(li.value_to_date), 0);
  const plToDate = valueToDate - costsToDate;
  return { variationsTotal, totalCost, costsToDate, valueToDate, plToDate };
}

// ── AFP calculation ─────────────────────────────────────────────────────
export function calcAFPLineItemTotals(item) {
  const qty = toNum(item.qty);
  const rate = toNum(item.rate || item.unit_price);
  const amount = item.amount != null ? toNum(item.amount) : qty * rate;
  return { ...item, amount };
}

export function calcAFPTotal(lineItems) {
  return lineItems.reduce((s, li) => s + toNum(li.amount), 0);
}

// ── Audit logging ───────────────────────────────────────────────────────
export async function logFinancialAudit(base44, params) {
  try {
    await base44.asServiceRole.entities.FinancialAuditLog.create({
      entity_name: params.entity_name,
      entity_id: params.entity_id,
      action: params.action,
      changed_fields: params.changed_fields || [],
      field_changes: params.field_changes ? JSON.stringify(params.field_changes) : null,
      record_summary: params.record_summary || '',
      actor_user_id: params.actor_user_id || null,
      actor_name: params.actor_name || 'System',
      source: 'manual',
    });
  } catch (e) {
    // Audit logging is best-effort — don't fail the main operation
  }
}