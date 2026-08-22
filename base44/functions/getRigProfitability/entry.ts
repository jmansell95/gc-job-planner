import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// getRigProfitability — per-rig earned vs cost for a date range
// ============================================================
// Aggregates AFPLineItem revenue attributed to each rig (via the
// job's primary rig assignment), and joins SiteAsset cost data
// (operating hours × internal cost rate) to produce a per-rig
// P&L. Filterable by date range and division.
//
// Returns: [{ rig_id, rig_name, earned, cost, margin, margin_pct,
//             operating_hours, jobs_count, utilisation_pct }]

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { date_from, date_to, division_id } = body;

    // 1. Fetch all rigs
    const rigsFilter: any = { is_rig: true };
    if (division_id) rigsFilter.division_id = division_id;
    const rigs = await base44.asServiceRole.entities.SiteAsset.filter(rigsFilter);

    // 2. Fetch all AFPLineItems in the date range (drilling category)
    const lineItems = await base44.asServiceRole.entities.AFPLineItem.list('-source_date', 2000);
    const filtered = lineItems.filter(li => {
      if (li.category !== 'drilling' && li.source !== 'driller_log') return false;
      if (date_from && li.source_date && li.source_date < date_from) return false;
      if (date_to && li.source_date && li.source_date > date_to) return false;
      return true;
    });

    // 3. Fetch job → rig assignments (primary rig per job)
    const assignments = await base44.asServiceRole.entities.JobAssetAssignment.filter({ asset_type: 'rig' });
    const jobToRig: Record<string, string> = {};
    for (const a of assignments) {
      if (a.role === 'primary_rig' || a.status !== 'returned') {
        if (!jobToRig[a.job_id]) jobToRig[a.job_id] = a.asset_id;
      }
    }

    // 4. Aggregate per rig (with per-job breakdown)
    const rigStats: Record<string, { earned: number; jobs: Set<string>; jobEarned: Record<string, number> }> = {};
    for (const li of filtered) {
      const rigId = jobToRig[li.job_id];
      if (!rigId) continue;
      if (!rigStats[rigId]) rigStats[rigId] = { earned: 0, jobs: new Set(), jobEarned: {} };
      const amt = li.dispute_status === 'rejected' ? 0 : (li.agreed_amount || li.amount || 0);
      rigStats[rigId].earned += amt;
      rigStats[rigId].jobs.add(li.job_id);
      rigStats[rigId].jobEarned[li.job_id] = (rigStats[rigId].jobEarned[li.job_id] || 0) + amt;
    }

    // 4a. Fetch job names for breakdown
    const allJobIds = new Set<string>();
    for (const stats of Object.values(rigStats)) {
      for (const jid of stats.jobs) allJobIds.add(jid);
    }
    const jobNames: Record<string, { name: string; reference: string }> = {};
    for (const jid of allJobIds) {
      try {
        const j = await base44.asServiceRole.entities.Job.get(jid);
        jobNames[jid] = { name: j.name || '—', reference: j.job_reference || '' };
      } catch (_) { jobNames[jid] = { name: '—', reference: '' }; }
    }

    // 5. Build result with cost data
    const results = rigs.map(rig => {
      const stats = rigStats[rig.id] || { earned: 0, jobs: new Set(), jobEarned: {} };
      const operatingHours = Number(rig.operating_hours) || 0;
      const costRate = Number(rig.cost_price) || 0;
      // Cost = operating hours × hourly cost rate (if available), else 0
      const cost = round2(operatingHours * costRate);
      const earned = round2(stats.earned);
      const margin = round2(earned - cost);
      const marginPct = earned > 0 ? round2((margin / earned) * 100) : 0;
      // Build job breakdown sorted by earned desc
      const job_breakdown = Object.entries(stats.jobEarned || {}).map(([jid, amt]) => ({
        job_id: jid,
        job_name: jobNames[jid]?.name || '—',
        job_reference: jobNames[jid]?.reference || '',
        earned: round2(amt),
      })).sort((a, b) => b.earned - a.earned);
      return {
        rig_id: rig.id,
        rig_name: rig.name,
        rig_type: rig.rig_type || 'n/a',
        division_id: rig.division_id,
        earned,
        cost,
        margin,
        margin_pct: marginPct,
        operating_hours: operatingHours,
        jobs_count: stats.jobs.size,
        compliance_status: rig.compliance_status || 'unknown',
        maintenance_status: rig.maintenance_status || 'unknown',
        job_breakdown,
      };
    });

    // Sort by earned descending
    results.sort((a, b) => b.earned - a.earned);

    // Totals
    const totals = {
      total_earned: round2(results.reduce((s, r) => s + r.earned, 0)),
      total_cost: round2(results.reduce((s, r) => s + r.cost, 0)),
      total_margin: round2(results.reduce((s, r) => s + r.margin, 0)),
      rigs_count: results.length,
    };

    return Response.json({ ok: true, rigs: results, totals });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}