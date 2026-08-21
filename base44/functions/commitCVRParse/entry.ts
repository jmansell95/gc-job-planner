import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { toNum, toDateStr, calcLineItemTotals, calcVariationTotals, calcCVRSummary, logFinancialAudit } from '../../shared/cvrHelpers.ts';

/**
 * commitCVRParse — takes the confirmed parsed CVR data and creates/updates
 * the CVR + CVRLineItem + VariationOrder + CashFlowEntry records linked to
 * the job. If a CVR already exists for the job, its child records are deleted
 * and replaced (upsert). Totals are auto-calculated.
 *
 * Input:  { job_id, preview, source_file_url, source_file_name }
 * Output: { cvr_id, line_item_count, variation_count, cash_flow_count }
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { job_id, preview, source_file_url, source_file_name } = body;
    if (!job_id || !preview) return Response.json({ error: 'job_id and preview are required' }, { status: 400 });

    // Fetch the job for denormalised fields
    const jobs = await base44.entities.Job.filter({ id: job_id });
    const job = jobs[0];
    if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });

    // Check for existing CVR
    const existingCVRs = await base44.entities.CVR.filter({ job_id });
    const existingCVR = existingCVRs[0];

    let cvrId;

    // Calculate totals from parsed data
    const lineItems = (preview.line_items || []).map((li, i) => calcLineItemTotals({
      ...li,
      vo_values: li.vo_values || [],
      sort_order: i,
    }));
    const variations = (preview.variation_orders || []).map((vo, i) => calcVariationTotals({
      ...vo,
      sort_order: i,
    }));
    const summary = calcCVRSummary(lineItems, variations);

    const fs = preview.financial_summary || {};
    const pp = preview.project_plan || {};
    const contractValue = toNum(fs.contract_value);
    const forecastFinal = fs.forecast_final_value != null ? toNum(fs.forecast_final_value) : contractValue + summary.variationsTotal;
    const totalCost = summary.totalCost || toNum(fs.budget);
    const profitLoss = forecastFinal - totalCost;
    const profitPct = forecastFinal !== 0 ? (profitLoss / forecastFinal) * 100 : 0;

    const cvrData = {
      job_id,
      job_name: job.name,
      job_reference: job.job_reference || '',
      division_id: job.division_id || '',
      client_name: '',
      contract_value: contractValue,
      variations_total: summary.variationsTotal,
      budget: toNum(fs.budget),
      forecast_final_value: forecastFinal,
      total_cost: totalCost,
      profit_loss: profitLoss,
      profit_pct: profitPct,
      project_start: toDateStr(pp.project_start),
      project_end: toDateStr(pp.project_end),
      weeks_in_progress: toNum(pp.weeks_in_progress),
      costs_to_date: summary.costsToDate,
      value_to_date: summary.valueToDate,
      source_file_url: source_file_url || '',
      source_file_name: source_file_name || '',
      last_updated_at: new Date().toISOString(),
      last_updated_by: user.full_name || user.email || '',
    };

    if (existingCVR) {
      // Delete old child records
      await base44.entities.CVRLineItem.deleteMany({ cvr_id: existingCVR.id });
      await base44.entities.VariationOrder.deleteMany({ cvr_id: existingCVR.id });
      await base44.entities.CashFlowEntry.deleteMany({ cvr_id: existingCVR.id });
      // Update the CVR record
      await base44.entities.CVR.update(existingCVR.id, cvrData);
      cvrId = existingCVR.id;
    } else {
      const created = await base44.entities.CVR.create({ ...cvrData, job_id });
      cvrId = created.id;
    }

    // Create line items
    if (lineItems.length > 0) {
      await base44.entities.CVRLineItem.bulkCreate(
        lineItems.map(li => ({
          cvr_id: cvrId,
          job_id,
          description: li.description || '',
          supplier: li.supplier || '',
          tender_value: toNum(li.tender_value),
          vo_values: li.vo_values || [],
          forecast_final_value: toNum(li.forecast_final_value),
          total_order: toNum(li.total_order),
          invoiced_costs: toNum(li.invoiced_costs),
          committed_costs: toNum(li.committed_costs),
          orders_not_placed: toNum(li.orders_not_placed),
          defects_contingency: toNum(li.defects_contingency),
          total_cost: toNum(li.total_cost),
          profit_loss: toNum(li.profit_loss),
          profit_pct: toNum(li.profit_pct),
          comments: li.comments || '',
          pct_on_site: toNum(li.pct_on_site),
          costs_to_date: toNum(li.costs_to_date),
          value_to_date: toNum(li.value_to_date),
          pl_to_date: toNum(li.value_to_date) - toNum(li.costs_to_date),
          sort_order: li.sort_order || 0,
        }))
      );
    }

    // Create variation orders
    if (variations.length > 0) {
      await base44.entities.VariationOrder.bulkCreate(
        variations.map(vo => ({
          cvr_id: cvrId,
          job_id,
          vo_number: toNum(vo.vo_number),
          description: vo.description || '',
          agreed_value: toNum(vo.agreed_value),
          firm: toNum(vo.firm),
          budget: toNum(vo.budget),
          prelim_cost: toNum(vo.prelim_cost),
          labour_cost: toNum(vo.labour_cost),
          plant_cost: toNum(vo.plant_cost),
          material_cost: toNum(vo.material_cost),
          nursery_cost: toNum(vo.nursery_cost),
          maintenance_cost: toNum(vo.maintenance_cost),
          total_cost: toNum(vo.total_cost),
          profit_margin: toNum(vo.profit_margin),
          profit_margin_pct: toNum(vo.profit_margin_pct),
          sort_order: vo.sort_order || 0,
        }))
      );
    }

    // Create cash flow entries
    const cashFlow = (preview.cash_flow || []).map((cf, i) => ({
      cvr_id: cvrId,
      job_id,
      month_date: toDateStr(cf.month_date),
      description: cf.description || '',
      app_value: toNum(cf.app_value),
      qty: toNum(cf.qty),
      unit: cf.unit || '',
      rate: toNum(cf.rate),
      amount: toNum(cf.amount),
      sort_order: i,
    }));
    if (cashFlow.length > 0) {
      await base44.entities.CashFlowEntry.bulkCreate(cashFlow);
    }

    // Audit log
    await logFinancialAudit(base44, {
      entity_name: 'CVR',
      entity_id: cvrId,
      action: existingCVR ? 'update' : 'create',
      record_summary: `CVR for ${job.name}: contract £${contractValue.toLocaleString()}, ${lineItems.length} line items, ${variations.length} VOs`,
      actor_user_id: user.id,
      actor_name: user.full_name || user.email,
    });

    return Response.json({
      cvr_id: cvrId,
      line_item_count: lineItems.length,
      variation_count: variations.length,
      cash_flow_count: cashFlow.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}