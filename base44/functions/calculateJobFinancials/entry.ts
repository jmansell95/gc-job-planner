import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { loadProjectRateCardItems, findBestRateCardMatch, type RateCardItemLike } from '../../shared/projectRateMatcher.ts';

// ============================================================
// calculateJobFinancials — the zero-touch auto-financials engine
// ============================================================
// Given a job_id, this function reads every InvestigationLog (Site Logs +
// borehole data), matches each activity against the correct rate card
// (staff-specific → project-specific → global Master Price List), and
// returns a complete revenue + cost breakdown with zero manual input.
//
// Matching priority for each logged activity:
//   1. Staff rate card items (RateCardItem.staff_id = log.staff_id)
//   2. Project rate card items (RateCardItem.project_id = job.project_id)
//   3. Global Master Price List (no project_id, no staff_id)
//
// Revenue is derived from the matched rate × quantity:
//   • Drilling meterage → metres drilled (sum of depth intervals) × £/m rate
//   • Unit-rate activities → units_completed × £/unit
//   • Day-rate crews → crew day rate × working days
//   • Per-activity SOR lines → matched item price (sum / each / m / hour)
//
// Costs come from JobCostItem (equipment), HotelBooking (accommodation), and
// chargeable Timesheet entries — the same sources useJobFinancials uses.
//
// The result powers the Financials tab "Auto-Calculated Breakdown" widget.

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const jobId = body.job_id;
    if (!jobId) return Response.json({ error: 'job_id is required' }, { status: 400 });

    // Load the job
    const job = await base44.asServiceRole.entities.Job.get(jobId);
    if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });

    const vatRate = Number(job.vat_rate) || 20;

    // ── Load all investigation logs ──
    const logs: any[] = await base44.asServiceRole.entities.InvestigationLog.filter({ job_id: jobId });

    // ── Load rate card items at all three levels ──
    // Staff-specific rates (keyed by staff_id)
    const staffIds = [...new Set(logs.map((l: any) => l.staff_id).filter(Boolean))] as string[];
    const staffRates: Record<string, RateCardItemLike[]> = {};
    for (const sid of staffIds) {
      try {
        const items = await base44.asServiceRole.entities.RateCardItem.filter({ staff_id: sid, is_active: true }, '-sort_order', 500);
        staffRates[sid] = (items || []).filter((i: RateCardItemLike) => i.price != null && !isNaN(Number(i.price)));
      } catch (_) { staffRates[sid] = []; }
    }

    // Project rate card (or global fallback)
    const projectRateItems = await loadProjectRateCardItems(base44, job.project_id);

    // Global rates (always available as the last fallback)
    let globalItems: RateCardItemLike[] = [];
    if (job.project_id) {
      try {
        const global = await base44.asServiceRole.entities.RateCardItem.filter({ rate_card_source: 'our_company', is_active: true }, '-sort_order', 500);
        globalItems = (global || []).filter((i: RateCardItemLike) => i.price != null && !isNaN(Number(i.price)) && !i.project_id && !i.staff_id);
      } catch (_) {}
    }

    // ── Match each log to a rate card item ──
    interface MatchedEntry {
      log_id: string;
      date: string;
      log_type: string;
      borehole_ref: string;
      description: string;
      staff_name: string;
      logged_by_role: string;
      rate_card_item_id: string;
      rate_card_description: string;
      rate_source: 'staff' | 'project' | 'global' | 'no_match';
      unit: string;
      unit_price: number;
      quantity: number;
      line_total: number;
    }

    const matched: MatchedEntry[] = [];
    let totalRevenueNet = 0;
    let totalMetres = 0;
    const unmatched: any[] = [];

    // Map log_type to search keywords so generic AGS import descriptions
    // (e.g. "Imported from KeyLogBook AGS — strata") can still match rate
    // card items by their activity category.
    const logTypeKeywords: Record<string, string[]> = {
      borehole_progress: ['borehole', 'drilling', 'drill', 'percussive', 'rotary', 'cable percussion', 'borehole advance'],
      core_inspection: ['core', 'coring', 'rotary core', 'core run', 'rock quality'],
      sample_collection: ['sample', 'sampling', 'undisturbed sample', 'disturbed sample', 'u100', 'uds'],
      pit_excavation: ['trial pit', 'excavation', 'pit', 'investigation pit'],
      installation: ['install', 'standpipe', 'piezometer', 'monitoring well', 'gas monitoring'],
      standpipe_reading: ['monitoring', 'standpipe', 'groundwater monitoring', 'dip'],
      grouting_works: ['grout', 'grouting', 'backfill', 'bentonite'],
      borehole_decommissioning: ['decommission', 'backfill', 'seal', 'grout'],
      geophysical_probing: ['probing', 'geophysical', 'cone', 'cpt'],
      window_sampling: ['window sampling', 'window sample', 'dynamic sampling'],
    };

    for (const log of logs) {
      // Calculate quantity from the log data:
      //  - borehole_progress with depth_from/depth_to → metres (depth_to - depth_from)
      //  - logs with units_completed → use that
      //  - core_inspection with depth interval → metres cored
      //  - everything else → 1 (sum / each)
      let quantity = 1;
      const dFrom = Number(log.depth_from) || 0;
      const dTo = Number(log.depth_to) || 0;
      if (dTo > dFrom && (log.log_type === 'borehole_progress' || log.log_type === 'core_inspection')) {
        quantity = Math.round((dTo - dFrom) * 100) / 100;
        totalMetres += quantity;
      }
      if (log.units_completed && Number(log.units_completed) > 0) {
        quantity = Number(log.units_completed);
      }

      // Build search descriptions. We try two passes:
      //   1) the log's own description (if it has meaningful text)
      //   2) log_type keywords as a fallback so generic AGS imports AND
      //      manual logs that don't mention the rate-card term still match.
      const rawDesc = log.description || log.strata_description_detail || '';
      const keywords = logTypeKeywords[log.log_type] || [];
      const keywordDesc = keywords.join(' ') || rawDesc || log.log_type;
      // Skip the raw description if it's just the generic AGS import prefix
      const meaningfulDesc = rawDesc && !rawDesc.startsWith('Imported from') ? rawDesc : '';

      // Try to match the activity against rate cards
      let bestMatch: RateCardItemLike | null = null;
      let rateSource: 'staff' | 'project' | 'global' | 'no_match' = 'no_match';

      const tryMatch = (searchDesc: string, pool: RateCardItemLike[]): RateCardItemLike | null => {
        if (!pool || pool.length === 0 || !searchDesc) return null;
        return findBestRateCardMatch(searchDesc, pool);
      };

      // Pass 1: raw description (most precise when it has real content)
      if (meaningfulDesc) {
        if (log.staff_id && staffRates[log.staff_id]) bestMatch = tryMatch(meaningfulDesc, staffRates[log.staff_id]);
        if (bestMatch) rateSource = 'staff';
        if (!bestMatch) { bestMatch = tryMatch(meaningfulDesc, projectRateItems); if (bestMatch) rateSource = 'project'; }
        if (!bestMatch) { bestMatch = tryMatch(meaningfulDesc, globalItems); if (bestMatch) rateSource = 'global'; }
      }
      // Pass 2: log_type keywords (fallback for generic AGS imports or
      // manual logs whose description doesn't contain the rate-card term)
      if (!bestMatch && keywordDesc) {
        if (log.staff_id && staffRates[log.staff_id]) bestMatch = tryMatch(keywordDesc, staffRates[log.staff_id]);
        if (bestMatch) rateSource = 'staff';
        if (!bestMatch) { bestMatch = tryMatch(keywordDesc, projectRateItems); if (bestMatch) rateSource = 'project'; }
        if (!bestMatch) { bestMatch = tryMatch(keywordDesc, globalItems); if (bestMatch) rateSource = 'global'; }
      }

      const displayDesc = meaningfulDesc || keywordDesc || log.log_type;

      if (!bestMatch) {
        unmatched.push({
          log_id: log.id,
          date: log.date,
          description: displayDesc,
          log_type: log.log_type,
          borehole_ref: log.borehole_ref,
        });
        continue;
      }

      const unitPrice = Number(bestMatch.price) || 0;
      const lineTotal = Math.round(unitPrice * quantity * 100) / 100;
      totalRevenueNet += lineTotal;

      matched.push({
        log_id: log.id,
        date: log.date,
        log_type: log.log_type,
        borehole_ref: log.borehole_ref || '',
        description: desc,
        staff_name: log.staff_name || log.completed_by_name || '',
        logged_by_role: log.logged_by_role || 'unspecified',
        rate_card_item_id: bestMatch.id,
        rate_card_description: bestMatch.description,
        rate_source: rateSource,
        unit: bestMatch.unit || 'sum',
        unit_price: unitPrice,
        quantity,
        line_total: lineTotal,
      });
    }

    // ── Costs (same sources as useJobFinancials) ──
    const costItems = await base44.asServiceRole.entities.JobCostItem.filter({ job_id: jobId });
    const hotelBookings = await base44.asServiceRole.entities.HotelBooking.filter({ job_id: jobId });
    const deliveries = await base44.asServiceRole.entities.DeliveryLog.filter({ job_id: jobId });
    const timesheets = await base44.asServiceRole.entities.Timesheet.filter({ job_id: jobId });

    const itemNet = (c: any) => {
      const rate = c.price_confirmed && c.negotiated_unit_cost != null ? Number(c.negotiated_unit_cost) : (Number(c.unit_cost) || 0);
      return rate * (Number(c.quantity) || 1);
    };
    const equipmentNet = costItems.reduce((s: number, c: any) => s + itemNet(c), 0);

    const hotelRows = hotelBookings.map((b: any) => {
      const nights = b.check_in_date && b.check_out_date
        ? Math.max(0, Math.round((new Date(b.check_out_date + 'T00:00:00').getTime() - new Date(b.check_in_date + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24)))
        : 0;
      return { id: b.id, name: b.hotel_name, nights, rooms: Number(b.room_count) || 1, perNight: Number(b.cost_per_night) || 0, total: (Number(b.cost_per_night) || 0) * (Number(b.room_count) || 1) * nights };
    });
    const hotelNet = hotelRows.reduce((s: number, h: any) => s + h.total, 0);

    const deliveryCharges = deliveries.filter((d: any) => d.chargeable !== false).reduce((s: number, d: any) => s + (Number(d.charge_amount) || 0), 0);
    const taskCharges = timesheets.filter((t: any) => t.chargeable && !t.is_break).reduce((s: number, t: any) => s + (Number(t.charge_amount) || 0), 0);
    const additionalCharges = deliveryCharges + taskCharges;

    const totalCostNet = equipmentNet + hotelNet;
    const totalCostVat = totalCostNet * (vatRate / 100);
    const totalCostGross = totalCostNet + totalCostVat;

    // Add additional charges to revenue
    const grandRevenueNet = totalRevenueNet + additionalCharges;
    const revenueVat = grandRevenueNet * (vatRate / 100);
    const revenueGross = grandRevenueNet + revenueVat;

    // Profit & margin
    const profit = grandRevenueNet - totalCostNet;
    const marginPct = grandRevenueNet > 0 ? (profit / grandRevenueNet) * 100 : 0;

    // Group matched entries by rate source for the breakdown
    const bySource = {
      staff: matched.filter(m => m.rate_source === 'staff').reduce((s, m) => s + m.line_total, 0),
      project: matched.filter(m => m.rate_source === 'project').reduce((s, m) => s + m.line_total, 0),
      global: matched.filter(m => m.rate_source === 'global').reduce((s, m) => s + m.line_total, 0),
    };

    return Response.json({
      status: 'success',
      job_id: jobId,
      job_name: job.name,
      summary: {
        total_revenue_net: Math.round(grandRevenueNet * 100) / 100,
        total_revenue_vat: Math.round(revenueVat * 100) / 100,
        total_revenue_gross: Math.round(revenueGross * 100) / 100,
        total_cost_net: Math.round(totalCostNet * 100) / 100,
        total_cost_vat: Math.round(totalCostVat * 100) / 100,
        total_cost_gross: Math.round(totalCostGross * 100) / 100,
        profit: Math.round(profit * 100) / 100,
        margin_pct: Math.round(marginPct * 10) / 10,
        total_metres: Math.round(totalMetres * 100) / 100,
        matched_count: matched.length,
        unmatched_count: unmatched.length,
        additional_charges: Math.round(additionalCharges * 100) / 100,
      },
      revenue_by_source: bySource,
      matched_entries: matched,
      unmatched_entries: unmatched,
      cost_breakdown: {
        equipment_net: Math.round(equipmentNet * 100) / 100,
        hotel_net: Math.round(hotelNet * 100) / 100,
        hotel_rows: hotelRows,
        delivery_charges: Math.round(deliveryCharges * 100) / 100,
        task_charges: Math.round(taskCharges * 100) / 100,
      },
      rate_card_levels: {
        staff_rates_found: Object.keys(staffRates).filter(k => staffRates[k].length > 0).length,
        project_rates_found: projectRateItems.length,
        global_rates_found: globalItems.length,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}