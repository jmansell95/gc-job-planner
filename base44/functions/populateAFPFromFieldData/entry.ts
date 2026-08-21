import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveRate, loadActiveContract } from '../../shared/rateResolver.ts';

/**
 * populateAFPFromFieldData — aggregates all daily field data sources for a
 * given AFP's period and job, maps them to AFPLineItem records, and upserts
 * them (preserving manual items).
 *
 * KEY FIX: Uses the charge_amount already stamped on each source record by
 * stampBillingCharge (for InvestigationLogs, DeliveryLogs) so billable work
 * flows into AFP totals automatically instead of showing £0.
 *
 * Sources: InvestigationLogs, SubcontractorLogs, Timesheets, DeliveryLogs,
 * DailyCosts, JobAssetAssignments.
 *
 * Input:  { afp_id: string }
 * Output: { success, populated, sources, total }
 */

function toNum(v) { const n = Number(v); return isNaN(n) ? 0 : n; }
function inRange(date, start, end) {
  if (!date) return false;
  const d = typeof date === 'string' ? date.slice(0, 10) : new Date(date).toISOString().slice(0, 10);
  if (start && d < start) return false;
  if (end && d > end) return false;
  return true;
}

// Parse the charge_breakdown JSON stamped by stampBillingCharge to extract
// the rate_card_item_id and unit_price for provenance tracking on the AFP line item.
function parseBreakdown(breakdownStr) {
  if (!breakdownStr) return {};
  try {
    const parsed = typeof breakdownStr === 'string' ? JSON.parse(breakdownStr) : breakdownStr;
    return {
      rate_card_item_id: parsed.rate_card_item_id || null,
      unit_price: toNum(parsed.unit_price),
      rate_source: parsed.source || parsed.rate_source || null,
    };
  } catch (_) {
    return {};
  }
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { afp_id } = body;
    if (!afp_id) return Response.json({ error: 'afp_id is required' }, { status: 400 });

    const afp = await base44.entities.AFP.get(afp_id);
    if (!afp) return Response.json({ error: 'AFP not found' }, { status: 404 });

    const startDate = afp.period_start_date || '';
    const endDate = afp.period_end_date || new Date().toISOString().slice(0, 10);
    const userName = user.full_name || user.email || 'System';

    // Fetch all field data for the job in parallel
    const [logs, subcons, timesheets, deliveries, costs, assignments] = await Promise.all([
      base44.entities.InvestigationLog.filter({ job_id: afp.job_id }, '-created_date', 500),
      base44.entities.SubcontractorLog.filter({ job_id: afp.job_id }, '-created_date', 500),
      base44.entities.Timesheet.filter({ job_id: afp.job_id }, '-created_date', 500),
      base44.entities.DeliveryLog.filter({ job_id: afp.job_id }, '-created_date', 500),
      base44.entities.DailyCost.filter({ job_id: afp.job_id }, '-created_date', 500),
      base44.entities.JobAssetAssignment.filter({ job_id: afp.job_id }, '-created_date', 500),
    ]);

    // Filter by date range
    const fLogs = logs.filter(l => inRange(l.date, startDate, endDate));
    const fSubcons = subcons.filter(s => inRange(s.date, startDate, endDate));
    const fTimesheets = timesheets.filter(t => inRange(t.date || t.shift_date, startDate, endDate));
    const fDeliveries = deliveries.filter(d => inRange(d.delivery_date || d.date, startDate, endDate));
    const fCosts = costs.filter(c => inRange(c.date, startDate, endDate));
    const fAssignments = assignments.filter(a => inRange(a.assigned_date, startDate, endDate) && (a.status === 'assigned' || a.status === 'on_site'));

    // Delete existing auto-populated items (keep manual ones)
    const existing = await base44.entities.AFPLineItem.filter({ afp_id }, 'sort_order', 500);
    const autoIds = existing.filter(li => li.source !== 'manual' && !li.is_manual).map(li => li.id);
    if (autoIds.length > 0) {
      for (const id of autoIds) {
        try { await base44.entities.AFPLineItem.delete(id); } catch (_) {}
      }
    }

    const newItems: any[] = [];
    let sortOrder = 0;

    // ── Driller logs → drilling line items (USE STAMPED CHARGES) ──
    // stampBillingCharge already priced each log at creation time using the
    // rate resolver (contract → job rate card → global master). We read that
    // stamped charge_amount and charge_breakdown so the AFP line item carries
    // the real rate and amount — billable work now adds up automatically.
    for (const log of fLogs) {
      const metres = toNum(log.metres_drilled) || (log.depth_to != null && log.depth_from != null ? toNum(log.depth_to) - toNum(log.depth_from) : 0);
      const units = toNum(log.units_completed) || metres || 1;
      const chargeAmount = toNum(log.charge_amount);
      const breakdown = parseBreakdown(log.charge_breakdown);
      const rateCardItemId = breakdown.rate_card_item_id || null;
      // Derive the per-unit rate from the stamped charge (charge / qty)
      const rate = chargeAmount > 0 && units > 0 ? Math.round((chargeAmount / units) * 100) / 100 : (breakdown.unit_price || 0);
      const isNoCharge = log.billing_status === 'no_charge' || (chargeAmount === 0 && !rateCardItemId);

      newItems.push({
        afp_id, job_id: afp.job_id, sheet_name: 'drilling', category: 'drilling',
        item: log.description || `Drilling — ${log.borehole_ref || 'Borehole'}`,
        unit: metres > 0 ? 'm' : (log.units_label || 'nr'),
        qty: units,
        rate,
        amount: chargeAmount,
        source: 'driller_log', source_date: log.date, source_id: log.id,
        is_manual: false,
        dispute_status: 'none',
        original_amount: chargeAmount,
        agreed_amount: isNoCharge ? 0 : chargeAmount,
        sort_order: sortOrder++,
      });
    }

    // ── Subcontractor logs → subcontractor line items (USE CLIENT CHARGE) ──
    for (const sc of fSubcons) {
      const amt = toNum(sc.client_charge_net || sc.purchase_cost_net);
      newItems.push({
        afp_id, job_id: afp.job_id, sheet_name: 'plant_hire', category: 'subcontractor',
        item: sc.description || sc.work_type || 'Subcontractor Work',
        unit: sc.purchase_rate_basis || 'sum', qty: toNum(sc.units_completed || sc.hours_worked || 1),
        rate: toNum(sc.purchase_rate), amount: amt,
        source: 'subcontractor', source_date: sc.date, source_id: sc.id,
        is_manual: false, dispute_status: 'none', original_amount: amt, agreed_amount: amt,
        sort_order: sortOrder++,
      });
    }

    // ── Timesheets → labour line items (grouped by date, use stamped charge if available) ──
    const tsByDate: Record<string, any[]> = {};
    for (const ts of fTimesheets) {
      const d = (ts.date || ts.shift_date || '').slice(0, 10);
      if (!d) continue;
      if (!tsByDate[d]) tsByDate[d] = [];
      tsByDate[d].push(ts);
    }
    for (const [date, tsList] of Object.entries(tsByDate)) {
      const totalHours = tsList.reduce((s, t) => s + toNum(t.hours || t.total_hours || t.regular_hours), 0);
      // Sum stamped charges across the day's timesheets
      const stampedCharge = tsList.reduce((s, t) => s + toNum(t.charge_amount), 0);
      if (totalHours > 0 || stampedCharge > 0) {
        const rate = stampedCharge > 0 && totalHours > 0 ? Math.round((stampedCharge / totalHours) * 100) / 100 : 0;
        newItems.push({
          afp_id, job_id: afp.job_id, sheet_name: 'drilling', category: 'labour',
          item: `Labour — ${date}`,
          unit: 'hour', qty: totalHours, rate, amount: stampedCharge,
          source: 'timesheet', source_date: date,
          is_manual: false, dispute_status: 'none', original_amount: stampedCharge, agreed_amount: stampedCharge,
          sort_order: sortOrder++,
        });
      }
    }

    // ── Deliveries → delivery line items (USE STAMPED CHARGE) ──
    for (const del of fDeliveries) {
      const stampedCharge = toNum(del.charge_amount);
      const amt = stampedCharge > 0 ? stampedCharge : toNum(del.cost || del.total_cost);
      newItems.push({
        afp_id, job_id: afp.job_id, sheet_name: 'plant_hire', category: 'delivery',
        item: `Delivery — ${del.description || del.delivery_type || ''}`,
        unit: 'sum', qty: 1, rate: amt, amount: amt,
        source: 'delivery', source_date: del.delivery_date || del.date, source_id: del.id,
        is_manual: false, dispute_status: 'none', original_amount: amt, agreed_amount: amt,
        sort_order: sortOrder++,
      });
    }

    // ── Daily costs → materials/other line items (USE STAMPED CLIENT CHARGE) ──
    for (const cost of fCosts) {
      const stampedCharge = toNum(cost.client_charge);
      const amt = stampedCharge > 0 ? stampedCharge : toNum(cost.amount || cost.cost);
      newItems.push({
        afp_id, job_id: afp.job_id, sheet_name: 'plant_hire', category: 'materials',
        item: cost.description || cost.category || 'Daily Cost',
        unit: 'sum', qty: 1, rate: amt, amount: amt,
        source: 'cost', source_date: cost.date, source_id: cost.id,
        is_manual: false, dispute_status: 'none', original_amount: amt, agreed_amount: amt,
        sort_order: sortOrder++,
      });
    }

    // ── Job asset assignments → plant hire line items (grouped by asset) ──
    const assetGroups: Record<string, any[]> = {};
    for (const a of fAssignments) {
      const key = a.asset_id;
      if (!assetGroups[key]) assetGroups[key] = [];
      assetGroups[key].push(a);
    }
    for (const [, assignList] of Object.entries(assetGroups)) {
      const days = assignList.length;
      newItems.push({
        afp_id, job_id: afp.job_id, sheet_name: 'plant_hire', category: 'plant_hire',
        item: `Plant Hire — ${assignList[0].asset_name || 'Equipment'}`,
        unit: 'day', qty: days, rate: 0, amount: 0,
        source: 'delivery', source_date: assignList[0].assigned_date, source_id: assignList[0].asset_id,
        is_manual: false, dispute_status: 'none', original_amount: 0, agreed_amount: 0,
        sort_order: sortOrder++,
      });
    }

    // Bulk create new items
    if (newItems.length > 0) {
      await base44.entities.AFPLineItem.bulkCreate(newItems);
    }

    // Calculate totals (sum of all items including manual ones that remain)
    const remaining = await base44.entities.AFPLineItem.filter({ afp_id }, 'sort_order', 500);
    const total = remaining.reduce((s, li) => s + toNum(li.amount), 0);
    const agreedTotal = remaining
      .filter(li => li.dispute_status !== 'rejected')
      .reduce((s, li) => s + toNum(li.agreed_amount || li.amount), 0);

    // Update AFP
    await base44.entities.AFP.update(afp_id, {
      total_claimed: total,
      original_total: total,
      agreed_total: agreedTotal,
      last_populated_at: new Date().toISOString(),
      last_populated_by: userName,
      last_updated_at: new Date().toISOString(),
      last_updated_by: userName,
    });

    return Response.json({
      success: true,
      populated: newItems.length,
      total_items: remaining.length,
      sources: {
        driller_logs: fLogs.length,
        subcontractors: fSubcons.length,
        timesheets: fTimesheets.length,
        deliveries: fDeliveries.length,
        daily_costs: fCosts.length,
        asset_assignments: fAssignments.length,
      },
      total,
      agreed_total: agreedTotal,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}