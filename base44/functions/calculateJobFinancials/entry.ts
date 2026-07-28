import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { loadProjectRateCardItems, findBestRateCardMatch, type RateCardItemLike } from '../../shared/projectRateMatcher.ts';

// ============================================================
// calculateJobFinancials — the zero-touch auto-financials engine
// ============================================================
// Given a job_id, this function:
//   1. Detects the drilling method (CP / Rotary / Mixed) from rig
//      assignments, log types, and the job's drilling_method field.
//   2. Matches each logged activity against the correct rate card
//      (staff → project → global Master Price List).
//   3. Calculates per-metre drilling revenue by drilling method,
//      using either job.meterage_rate or the matched "Advance
//      borehole" / "Rotary drill" rate card item.
//   4. Aggregates rig/crew costs from rig assignments × matched
//      crew day rates.
//   5. Returns per-borehole revenue breakdown (method, metres,
//      rate, revenue) and per-rig profitability (revenue − cost).

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const jobId = body.job_id;
    if (!jobId) return Response.json({ error: 'job_id is required' }, { status: 400 });

    const job = await base44.asServiceRole.entities.Job.get(jobId);
    if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });

    const vatRate = Number(job.vat_rate) || 20;

    // ── Load all investigation logs ──
    const logs: any[] = await base44.asServiceRole.entities.InvestigationLog.filter({ job_id: jobId });

    // ── Load rate card items at all three levels ──
    const staffIds = [...new Set(logs.map((l: any) => l.staff_id).filter(Boolean))] as string[];
    const staffRates: Record<string, RateCardItemLike[]> = {};
    for (const sid of staffIds) {
      try {
        const items = await base44.asServiceRole.entities.RateCardItem.filter({ staff_id: sid, is_active: true }, '-sort_order', 500);
        staffRates[sid] = (items || []).filter((i: RateCardItemLike) => i.price != null && !isNaN(Number(i.price)));
      } catch (_) { staffRates[sid] = []; }
    }

    const projectRateItems = await loadProjectRateCardItems(base44, job.project_id);

    let globalItems: RateCardItemLike[] = [];
    if (job.project_id) {
      try {
        const global = await base44.asServiceRole.entities.RateCardItem.filter({ rate_card_source: 'our_company', is_active: true }, '-sort_order', 500);
        globalItems = (global || []).filter((i: RateCardItemLike) => i.price != null && !isNaN(Number(i.price)) && !i.project_id && !i.staff_id);
      } catch (_) {}
    } else {
      // No project — projectRateItems already IS the global list
      globalItems = projectRateItems;
    }

    // ── Drilling method detection ──
    // Priority: job.drilling_method field → rig assignments (rig_type) → log types
    const rigAssignments = await base44.asServiceRole.entities.JobAssetAssignment.filter({ job_id: jobId });
    const rigs = (rigAssignments as any[]).filter((a: any) => a.asset_type === 'rig');
    const rigMethods = new Set<string>();
    for (const r of rigs) {
      if (r.rig_type === 'cp') rigMethods.add('cp');
      if (r.rig_type === 'rotary') rigMethods.add('rotary');
    }
    const logMethods = new Set<string>();
    for (const l of logs) {
      if (l.log_type === 'core_inspection') logMethods.add('rotary');
      if (l.log_type === 'borehole_progress' || l.log_type === 'sample_collection' || l.log_type === 'window_sampling') logMethods.add('cp');
    }

    let jobDrillingMethod: string = job.drilling_method || 'not_applicable';
    if (jobDrillingMethod === 'not_applicable') {
      const detected = new Set([...rigMethods, ...logMethods]);
      if (detected.size === 1) jobDrillingMethod = [...detected][0];
      else if (detected.size > 1) jobDrillingMethod = 'mixed';
    }

    // Determine per-borehole drilling method
    // A borehole is Rotary if it has core_inspection logs, otherwise CP (if it has borehole_progress)
    const boreholeMethodMap: Record<string, string> = {};
    for (const l of logs) {
      const ref = l.borehole_ref;
      if (!ref) continue;
      if (l.log_type === 'core_inspection') boreholeMethodMap[ref] = 'rotary';
      else if (!boreholeMethodMap[ref] && (l.log_type === 'borehole_progress' || l.log_type === 'sample_collection' || l.log_type === 'window_sampling')) {
        boreholeMethodMap[ref] = 'cp';
      }
    }
    // Fall back to the rig method if we have exactly one rig type
    if (rigMethods.size === 1) {
      const singleRigMethod = [...rigMethods][0];
      for (const l of logs) {
        const ref = l.borehole_ref;
        if (ref && !boreholeMethodMap[ref]) boreholeMethodMap[ref] = singleRigMethod;
      }
    }

    // ── Per-metre drilling rate from the rate card ──
    // Find "Advance borehole" (CP) or "Rotary drill" (Rotary) rate card items
    // with unit = 'm', filtered by the subcategory prefix for the drilling method.
    const findPerMetreDrillingRate = (method: string, pool: RateCardItemLike[]): RateCardItemLike | null => {
      if (!pool || pool.length === 0) return null;
      const methodPrefix = method === 'rotary' ? 'Rotary Drilling' : 'CP Drilling';
      // Filter to per-metre items in the correct drilling section
      const perMetre = pool.filter(i =>
        i.unit === 'm' &&
        i.price != null &&
        !isNaN(Number(i.price)) &&
        String(i.subcategory || '').includes(methodPrefix)
      );
      if (perMetre.length === 0) return null;
      // Prefer the "advance borehole" or "rotary drill" description (the main drilling rate),
      // specifically the shallowest depth band (first item, since they're sorted by sort_order)
      const advance = perMetre.filter(i =>
        /advance borehole|rotary drill/i.test(i.description) &&
        !/backfill|standpipe|install|grout|piezo|inclined|extra over/i.test(i.description)
      );
      return advance[0] || perMetre[0];
    };

    // Get the per-metre rate for each method (try project first, then global)
    const cpPerMetreRate = job.meterage_rate && jobDrillingMethod !== 'rotary'
      ? { price: Number(job.meterage_rate), description: 'Job metre rate', unit: 'm', source: 'job', id: '' }
      : (findPerMetreDrillingRate('cp', projectRateItems) || findPerMetreDrillingRate('cp', globalItems));
    const rotaryPerMetreRate = job.meterage_rate && jobDrillingMethod !== 'cp'
      ? { price: Number(job.meterage_rate), description: 'Job metre rate', unit: 'm', source: 'job', id: '' }
      : (findPerMetreDrillingRate('rotary', projectRateItems) || findPerMetreDrillingRate('rotary', globalItems));

    // ── Match each log to a rate card item (for SOR line revenue) ──
    interface MatchedEntry {
      log_id: string; date: string; log_type: string; borehole_ref: string;
      description: string; staff_name: string; logged_by_role: string;
      rate_card_item_id: string; rate_card_description: string;
      rate_source: 'staff' | 'project' | 'global' | 'no_match';
      unit: string; unit_price: number; quantity: number; line_total: number;
    }

    const matched: MatchedEntry[] = [];
    let totalSorRevenueNet = 0;
    let totalMetres = 0;
    const unmatched: any[] = [];

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

    // Per-borehole meterage tracking
    const bhMap: Record<string, { borehole_ref: string; metres: number; entries: number; method: string }> = {};

    for (const log of logs) {
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

      // Track per-borehole meterage
      const ref = log.borehole_ref || 'Unspecified';
      if (!bhMap[ref]) bhMap[ref] = { borehole_ref: ref, metres: 0, entries: 0, method: boreholeMethodMap[ref] || jobDrillingMethod === 'mixed' ? '' : jobDrillingMethod };
      if (dTo > dFrom && (log.log_type === 'borehole_progress' || log.log_type === 'core_inspection')) {
        bhMap[ref].metres = Math.round((bhMap[ref].metres + (dTo - dFrom)) * 100) / 100;
      }
      bhMap[ref].entries++;
      // Set method on the borehole
      if (boreholeMethodMap[ref]) bhMap[ref].method = boreholeMethodMap[ref];

      // ── SOR line matching (non-drilling-advance activities) ──
      // Skip borehole_progress and core_inspection — those are priced by per-metre drilling rate,
      // not as individual SOR lines (they'd double-count the drilling revenue)
      if (log.log_type === 'borehole_progress' || log.log_type === 'core_inspection') continue;

      const rawDesc = log.description || log.strata_description_detail || '';
      const keywords = logTypeKeywords[log.log_type] || [];
      const keywordDesc = keywords.join(' ') || rawDesc || log.log_type;
      const meaningfulDesc = rawDesc && !rawDesc.startsWith('Imported from') ? rawDesc : '';

      let bestMatch: RateCardItemLike | null = null;
      let rateSource: 'staff' | 'project' | 'global' | 'no_match' = 'no_match';
      const tryMatch = (searchDesc: string, pool: RateCardItemLike[]): RateCardItemLike | null => {
        if (!pool || pool.length === 0 || !searchDesc) return null;
        return findBestRateCardMatch(searchDesc, pool);
      };

      if (meaningfulDesc) {
        if (log.staff_id && staffRates[log.staff_id]) bestMatch = tryMatch(meaningfulDesc, staffRates[log.staff_id]);
        if (bestMatch) rateSource = 'staff';
        if (!bestMatch) { bestMatch = tryMatch(meaningfulDesc, projectRateItems); if (bestMatch) rateSource = 'project'; }
        if (!bestMatch) { bestMatch = tryMatch(meaningfulDesc, globalItems); if (bestMatch) rateSource = 'global'; }
      }
      if (!bestMatch && keywordDesc) {
        if (log.staff_id && staffRates[log.staff_id]) bestMatch = tryMatch(keywordDesc, staffRates[log.staff_id]);
        if (bestMatch) rateSource = 'staff';
        if (!bestMatch) { bestMatch = tryMatch(keywordDesc, projectRateItems); if (bestMatch) rateSource = 'project'; }
        if (!bestMatch) { bestMatch = tryMatch(keywordDesc, globalItems); if (bestMatch) rateSource = 'global'; }
      }

      const displayDesc = meaningfulDesc || keywordDesc || log.log_type;

      if (!bestMatch) {
        unmatched.push({ log_id: log.id, date: log.date, description: displayDesc, log_type: log.log_type, borehole_ref: log.borehole_ref });
        continue;
      }

      const unitPrice = Number(bestMatch.price) || 0;
      const lineTotal = Math.round(unitPrice * quantity * 100) / 100;
      totalSorRevenueNet += lineTotal;

      matched.push({
        log_id: log.id, date: log.date, log_type: log.log_type, borehole_ref: log.borehole_ref || '',
        description: displayDesc, staff_name: log.staff_name || log.completed_by_name || '',
        logged_by_role: log.logged_by_role || 'unspecified',
        rate_card_item_id: bestMatch.id, rate_card_description: bestMatch.description,
        rate_source: rateSource, unit: bestMatch.unit || 'sum', unit_price: unitPrice,
        quantity, line_total: lineTotal,
      });
    }

    // ── Per-borehole meterage revenue ──
    // For each borehole: metres × per-metre rate (by drilling method)
    interface BoreholeRevenue {
      borehole_ref: string; method: string; metres: number; entries: number;
      rate_per_metre: number; rate_description: string; rate_source: string;
      revenue: number;
    }
    const boreholeRevenue: BoreholeRevenue[] = [];
    let totalMeterageRevenue = 0;
    for (const ref of Object.keys(bhMap)) {
      const bh = bhMap[ref];
      if (bh.metres <= 0) continue;
      const method = bh.method || (jobDrillingMethod === 'mixed' ? 'cp' : jobDrillingMethod);
      const rateItem = method === 'rotary' ? rotaryPerMetreRate : cpPerMetreRate;
      const ratePerM = rateItem ? Number(rateItem.price) : 0;
      const revenue = Math.round(bh.metres * ratePerM * 100) / 100;
      totalMeterageRevenue += revenue;
      boreholeRevenue.push({
        borehole_ref: bh.borehole_ref, method,
        metres: bh.metres, entries: bh.entries,
        rate_per_metre: ratePerM,
        rate_description: rateItem ? rateItem.description : 'No rate found',
        rate_source: rateItem ? rateItem.source || 'rate_card' : 'no_match',
        revenue,
      });
    }
    boreholeRevenue.sort((a, b) => a.borehole_ref.localeCompare(b.borehole_ref));

    // ── Costs ──
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

    // ── Rig crew cost (from rig assignments × matched day rates) ──
    let labourDayRates: RateCardItemLike[] = [];
    try {
      const allLabour = await base44.asServiceRole.entities.RateCardItem.filter({ category: 'labour', is_active: true }, '-sort_order', 500);
      labourDayRates = (allLabour || []).filter((r: RateCardItemLike) => r.unit === 'day' && r.price != null && !isNaN(Number(r.price)));
    } catch (_) {}
    const autoMatchRigRate = (rigType: string, rigName: string = ''): RateCardItemLike | null => {
      const name = String(rigName || '').toLowerCase();
      const wsEntries = labourDayRates.filter(r => (r.subcategory || '').toLowerCase().includes('window sampling'));
      if (wsEntries.length > 0) {
        if (/modular/i.test(name)) { const m = wsEntries.find(r => /modular/i.test(r.description) && !/additional/i.test(r.description)); if (m) return m; }
        if (/tracked|terrier/i.test(name)) { const t = wsEntries.find(r => /tracked/i.test(r.description)); if (t) return t; }
      }
      if (rigType === 'rotary') return labourDayRates.find(r => /rotary crew/i.test(r.description)) || null;
      if (rigType === 'cp') return labourDayRates.find(r => /^cable percussive crew$/i.test((r.description || '').trim())) || null;
      return null;
    };
    const workingDays = (() => {
      if (!job.start_date || !job.end_date) return 0;
      const s = new Date(job.start_date + 'T00:00:00');
      const e = new Date(job.end_date + 'T00:00:00');
      if (e < s) return 0;
      let count = 0; const d = new Date(s);
      while (d <= e) { const day = d.getUTCDay(); if (day !== 0 && day !== 6) count++; d.setUTCDate(d.getUTCDate() + 1); }
      return count;
    })();

    // ── Per-rig profitability ──
    // Map each rig to the boreholes drilled with that rig's method, and calculate
    // revenue (meterage) vs cost (day rate × working days)
    interface RigProfitability {
      rig_name: string; rig_type: string; status: string;
      day_rate: number; rate_description: string; working_days: number;
      total_cost: number; method: string;
      boreholes: string[]; metres_drilled: number;
      meterage_revenue: number; profit: number;
    }
    const rigCostRows = rigs.map((a: any) => {
      const rate = autoMatchRigRate(a.rig_type, a.asset_name);
      const method = a.rig_type || 'cp';
      // Find boreholes drilled with this rig's method
      const rigBoreholes = boreholeRevenue.filter(b => b.method === method);
      const metres = rigBoreholes.reduce((s, b) => s + b.metres, 0);
      const revenue = rigBoreholes.reduce((s, b) => s + b.revenue, 0);
      const cost = rate ? Math.round(Number(rate.price) * workingDays * 100) / 100 : 0;
      return {
        rig_name: a.asset_name || 'Rig', rig_type: a.rig_type || '', status: a.status || 'assigned',
        day_rate: rate ? Number(rate.price) : 0, rate_description: rate ? rate.description : 'No rate matched',
        working_days: workingDays, total_cost: cost,
        method, boreholes: rigBoreholes.map(b => b.borehole_ref),
        metres_drilled: metres, meterage_revenue: revenue,
        profit: Math.round((revenue - cost) * 100) / 100,
      } as RigProfitability;
    });
    const totalRigCost = rigCostRows.reduce((s, r) => s + r.total_cost, 0);

    // ── Revenue summary ──
    const meterageRate = Number(job.meterage_rate) || 0;
    // If job has a meterage_rate, recalculate meterage revenue as total metres × rate
    // (this overrides the per-borehole rate card matching)
    const meterageRevenue = meterageRate > 0 ? Math.round(totalMetres * meterageRate * 100) / 100 : totalMeterageRevenue;
    const targetMetres = Number(job.meterage_target) || 0;

    const totalRevenueNet = meterageRevenue + totalSorRevenueNet + additionalCharges;
    const totalCostNet = equipmentNet + hotelNet + totalRigCost;

    const revenueVat = totalRevenueNet * (vatRate / 100);
    const revenueGross = totalRevenueNet + revenueVat;
    const totalCostVat = totalCostNet * (vatRate / 100);
    const totalCostGross = totalCostNet + totalCostVat;

    const profit = totalRevenueNet - totalCostNet;
    const marginPct = totalRevenueNet > 0 ? (profit / totalRevenueNet) * 100 : 0;
    const costPerMetre = totalMetres > 0 ? Math.round((totalCostNet / totalMetres) * 100) / 100 : 0;
    const revenuePerMetre = totalMetres > 0 ? Math.round((totalRevenueNet / totalMetres) * 100) / 100 : 0;
    const profitPerMetre = totalMetres > 0 ? Math.round((profit / totalMetres) * 100) / 100 : 0;
    const targetPct = targetMetres > 0 ? Math.round(Math.min((totalMetres / targetMetres) * 100, 100) * 10) / 10 : 0;

    // Revenue by drilling method
    const cpRevenue = boreholeRevenue.filter(b => b.method === 'cp').reduce((s, b) => s + b.revenue, 0);
    const rotaryRevenue = boreholeRevenue.filter(b => b.method === 'rotary').reduce((s, b) => s + b.revenue, 0);

    const bySource = {
      staff: matched.filter(m => m.rate_source === 'staff').reduce((s, m) => s + m.line_total, 0),
      project: matched.filter(m => m.rate_source === 'project').reduce((s, m) => s + m.line_total, 0),
      global: matched.filter(m => m.rate_source === 'global').reduce((s, m) => s + m.line_total, 0),
    };

    // ── Billing setup status (for the UI warning banner) ──
    const billingSetup = {
      has_project: !!job.project_id,
      has_meterage_rate: meterageRate > 0,
      has_drilling_method: jobDrillingMethod !== 'not_applicable',
      drilling_method: jobDrillingMethod,
      has_project_rate_card: projectRateItems.length > 0 && !!job.project_id,
      cp_rate_found: !!cpPerMetreRate,
      rotary_rate_found: !!rotaryPerMetreRate,
      rate_card_source: job.project_id ? (projectRateItems.length > 0 ? 'project' : 'global') : 'global',
      warnings: [] as string[],
    };
    if (!job.project_id) billingSetup.warnings.push('No project assigned — billing against the Global Master Price List only.');
    if (jobDrillingMethod === 'not_applicable' && logs.length > 0) billingSetup.warnings.push('Drilling method not set — per-metre rates may not match correctly.');
    if (meterageRate === 0 && !cpPerMetreRate && !rotaryPerMetreRate && totalMetres > 0) billingSetup.warnings.push('No per-metre drilling rate found in any rate card for this drilling method.');
    if (rigs.length === 0 && totalMetres > 0) billingSetup.warnings.push('No rigs assigned — rig crew costs are £0. Assign rigs in the Logistics tab.');

    return Response.json({
      status: 'success',
      job_id: jobId,
      job_name: job.name,
      summary: {
        total_revenue_net: Math.round(totalRevenueNet * 100) / 100,
        total_revenue_vat: Math.round(revenueVat * 100) / 100,
        total_revenue_gross: Math.round(revenueGross * 100) / 100,
        total_cost_net: Math.round(totalCostNet * 100) / 100,
        total_cost_vat: Math.round(totalCostVat * 100) / 100,
        total_cost_gross: Math.round(totalCostGross * 100) / 100,
        profit: Math.round(profit * 100) / 100,
        margin_pct: Math.round(marginPct * 10) / 10,
        total_metres: Math.round(totalMetres * 100) / 100,
        meterage_revenue: Math.round(meterageRevenue * 100) / 100,
        sor_revenue: Math.round(totalSorRevenueNet * 100) / 100,
        matched_count: matched.length,
        unmatched_count: unmatched.length,
        additional_charges: Math.round(additionalCharges * 100) / 100,
      },
      billing_setup: billingSetup,
      drilling_method: {
        job_method: jobDrillingMethod,
        rig_methods: [...rigMethods],
        log_methods: [...logMethods],
        cp_revenue: Math.round(cpRevenue * 100) / 100,
        rotary_revenue: Math.round(rotaryRevenue * 100) / 100,
        cp_per_metre_rate: cpPerMetreRate ? { price: Number(cpPerMetreRate.price), description: cpPerMetreRate.description, source: cpPerMetreRate.source || 'rate_card' } : null,
        rotary_per_metre_rate: rotaryPerMetreRate ? { price: Number(rotaryPerMetreRate.price), description: rotaryPerMetreRate.description, source: rotaryPerMetreRate.source || 'rate_card' } : null,
      },
      revenue_by_source: bySource,
      matched_entries: matched,
      unmatched_entries: unmatched,
      cost_breakdown: {
        equipment_net: Math.round(equipmentNet * 100) / 100,
        hotel_net: Math.round(hotelNet * 100) / 100,
        rig_cost: Math.round(totalRigCost * 100) / 100,
        hotel_rows: hotelRows,
        delivery_charges: Math.round(deliveryCharges * 100) / 100,
        task_charges: Math.round(taskCharges * 100) / 100,
      },
      drilling_performance: {
        total_metres: Math.round(totalMetres * 100) / 100,
        target_metres: targetMetres,
        target_pct: targetPct,
        meterage_rate: meterageRate,
        meterage_revenue: Math.round(meterageRevenue * 100) / 100,
        rig_cost: Math.round(totalRigCost * 100) / 100,
        cost_per_metre: costPerMetre,
        revenue_per_metre: revenuePerMetre,
        profit_per_metre: profitPerMetre,
        working_days: workingDays,
        cp_revenue: Math.round(cpRevenue * 100) / 100,
        rotary_revenue: Math.round(rotaryRevenue * 100) / 100,
      },
      rig_profitability: rigCostRows,
      borehole_revenue: boreholeRevenue,
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