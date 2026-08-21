import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { toNum, calcLineItemTotals, calcVariationTotals, calcCVRSummary, logFinancialAudit } from '../../shared/cvrHelpers.ts';

/**
 * recalculateCVR — recalculates profit_loss, profit_pct, forecast_final_value,
 * and totals on the CVR and its line items + variation orders whenever a
 * value is edited in-app. Called after any CVRLineItem or VariationOrder update.
 *
 * Input:  { cvr_id }
 * Output: { profit_loss, profit_pct, total_cost, forecast_final_value }
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { cvr_id } = body;
    if (!cvr_id) return Response.json({ error: 'cvr_id is required' }, { status: 400 });

    // Fetch the CVR
    const cvrs = await base44.entities.CVR.filter({ id: cvr_id });
    const cvr = cvrs[0];
    if (!cvr) return Response.json({ error: 'CVR not found' }, { status: 404 });

    // Fetch all child records
    const lineItems = await base44.entities.CVRLineItem.filter({ cvr_id }, 'sort_order', 500);
    const variations = await base44.entities.VariationOrder.filter({ cvr_id }, 'sort_order', 200);

    // Recalculate each line item
    const recalcedLines = lineItems.map(li => calcLineItemTotals(li));
    const recalcedVOs = variations.map(vo => calcVariationTotals(vo));

    // Bulk update line items if totals changed
    const lineUpdates = recalcedLines
      .filter(li => {
        const orig = lineItems.find(o => o.id === li.id);
        return orig && (toNum(orig.profit_loss) !== toNum(li.profit_loss) || toNum(orig.profit_pct) !== toNum(li.profit_pct) || toNum(orig.forecast_final_value) !== toNum(li.forecast_final_value) || toNum(orig.total_cost) !== toNum(li.total_cost));
      })
      .map(li => ({
        id: li.id,
        forecast_final_value: toNum(li.forecast_final_value),
        total_cost: toNum(li.total_cost),
        profit_loss: toNum(li.profit_loss),
        profit_pct: toNum(li.profit_pct),
        pl_to_date: toNum(li.value_to_date) - toNum(li.costs_to_date),
      }));

    if (lineUpdates.length > 0) {
      await base44.entities.CVRLineItem.bulkUpdate(lineUpdates);
    }

    // Bulk update variation orders if totals changed
    const voUpdates = recalcedVOs
      .filter(vo => {
        const orig = variations.find(o => o.id === vo.id);
        return orig && (toNum(orig.profit_margin) !== toNum(vo.profit_margin) || toNum(orig.profit_margin_pct) !== toNum(vo.profit_margin_pct) || toNum(orig.total_cost) !== toNum(vo.total_cost));
      })
      .map(vo => ({
        id: vo.id,
        total_cost: toNum(vo.total_cost),
        profit_margin: toNum(vo.profit_margin),
        profit_margin_pct: toNum(vo.profit_margin_pct),
      }));

    if (voUpdates.length > 0) {
      await base44.entities.VariationOrder.bulkUpdate(voUpdates);
    }

    // Recalculate CVR summary
    const summary = calcCVRSummary(recalcedLines, recalcedVOs);
    const forecastFinal = toNum(cvr.contract_value) + summary.variationsTotal;
    const totalCost = summary.totalCost;
    const profitLoss = forecastFinal - totalCost;
    const profitPct = forecastFinal !== 0 ? (profitLoss / forecastFinal) * 100 : 0;

    await base44.entities.CVR.update(cvr_id, {
      variations_total: summary.variationsTotal,
      forecast_final_value: forecastFinal,
      total_cost: totalCost,
      profit_loss: profitLoss,
      profit_pct: profitPct,
      costs_to_date: summary.costsToDate,
      value_to_date: summary.valueToDate,
      last_updated_at: new Date().toISOString(),
      last_updated_by: user.full_name || user.email || '',
    });

    return Response.json({
      profit_loss: profitLoss,
      profit_pct: profitPct,
      total_cost: totalCost,
      forecast_final_value: forecastFinal,
      variations_total: summary.variationsTotal,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}