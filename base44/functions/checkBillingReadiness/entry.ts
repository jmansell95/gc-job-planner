import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * Billing Readiness Check — validates that a job has captured all
 * financial data before it can be marked "completed".
 *
 * Called from the Job Status modal when a user selects 'decommissioning'
 * or 'completed'. Returns a list of blockers that must be resolved.
 *
 * Blocker categories:
 *   • assets_on_site   — equipment still physically on site (not returned)
 *   • unapproved_ts    — timesheets still awaiting manager approval
 *   • missing_charges  — chargeable tasks/deliveries with £0 charge
 *   • unpriced_poa     — POA items without a confirmed negotiated price
 *   • unreconciled_sub — subcontractor logs pending vendor invoice match
 *   • missing_rates    — crew on rota with no matching day-rate
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const jobId = body.job_id;
    if (!jobId) return Response.json({ error: 'job_id required' }, { status: 400 });

    const [
      costItems, deliveries, timesheets, subconLogs, rotas, rateItems, boqLines
    ] = await Promise.all([
      base44.asServiceRole.entities.JobCostItem.filter({ job_id: jobId }),
      base44.asServiceRole.entities.DeliveryLog.filter({ job_id: jobId }),
      base44.asServiceRole.entities.Timesheet.filter({ job_id: jobId }),
      base44.asServiceRole.entities.SubcontractorLog.filter({ job_id: jobId }),
      base44.asServiceRole.entities.RotaAssignment.filter({ job_id: jobId }),
      base44.asServiceRole.entities.RateCardItem.filter({ category: 'labour', is_active: true }),
      base44.asServiceRole.entities.JobBillOfQuantities.filter({ job_id: jobId }),
    ]);

    const blockers = [];

    // 1. Equipment still on site
    const onSiteItems = costItems.filter(
      (c) => c.current_location === 'site' || (c.hire_status === 'active' && !c.current_location)
    );
    if (onSiteItems.length > 0) {
      blockers.push({
        type: 'assets_on_site',
        severity: 'warning',
        count: onSiteItems.length,
        label: `${onSiteItems.length} item${onSiteItems.length === 1 ? '' : 's'} still on site`,
        detail: onSiteItems.map((c) => c.description || 'Unnamed item').slice(0, 5),
      });
    }

    // 2. Unapproved timesheets
    const unapprovedTs = timesheets.filter(
      (t) => t.status === 'submitted' && !t.is_summary
    );
    if (unapprovedTs.length > 0) {
      blockers.push({
        type: 'unapproved_ts',
        severity: 'blocking',
        count: unapprovedTs.length,
        label: `${unapprovedTs.length} timesheet${unapprovedTs.length === 1 ? '' : 's'} awaiting approval`,
        detail: [],
      });
    }

    // 3. Chargeable tasks with £0 charge
    const missingCharges = timesheets.filter(
      (t) => t.chargeable === true && !t.is_break && (Number(t.charge_amount) || 0) === 0
    );
    if (missingCharges.length > 0) {
      blockers.push({
        type: 'missing_charges',
        severity: 'warning',
        count: missingCharges.length,
        label: `${missingCharges.length} chargeable task${missingCharges.length === 1 ? '' : 's'} with £0 charge`,
        detail: [],
      });
    }

    // 4. Unpriced POA items
    const unpricedPoa = costItems.filter(
      (c) => c.is_poa === true && c.price_confirmed !== true
    );
    if (unpricedPoa.length > 0) {
      blockers.push({
        type: 'unpriced_poa',
        severity: 'blocking',
        count: unpricedPoa.length,
        label: `${unpricedPoa.length} POA item${unpricedPoa.length === 1 ? '' : 's'} without a confirmed price`,
        detail: unpricedPoa.map((c) => c.description).slice(0, 5),
      });
    }

    // 5. Unreconciled subcontractor logs
    const unreconciledSub = subconLogs.filter(
      (l) => l.reconciliation_status === 'pending' || l.reconciliation_status === 'mismatched'
    );
    if (unreconciledSub.length > 0) {
      blockers.push({
        type: 'unreconciled_sub',
        severity: 'warning',
        count: unreconciledSub.length,
        label: `${unreconciledSub.length} sub-con log${unreconciledSub.length === 1 ? '' : 's'} not reconciled`,
        detail: [],
      });
    }

    // 6. Crew on rota with no matching day rate
    const labourItemStaffIds = new Set(
      costItems.filter((c) => c.category === 'labour' && c.staff_id).map((c) => c.staff_id)
    );
    const rotaStaffWithoutRate = [...new Set(rotas.map((r) => r.staff_id))]
      .filter((sid) => sid && !labourItemStaffIds.has(sid))
      .filter((sid) => !rateItems.some((r) => r.staff_id === sid));
    if (rotaStaffWithoutRate.length > 0) {
      blockers.push({
        type: 'missing_rates',
        severity: 'warning',
        count: rotaStaffWithoutRate.length,
        label: `${rotaStaffWithoutRate.length} crew member${rotaStaffWithoutRate.length === 1 ? '' : 's'} without a day rate`,
        detail: [],
      });
    }

    // 7. BOQ overruns — actual logged work exceeds contracted scope without
    //    an approved variation. Blocks invoicing until a manager reviews.
    const overrunLines = (boqLines || []).filter(
      (b) => b.status === 'overrun' && b.is_variation !== true
    );
    if (overrunLines.length > 0) {
      blockers.push({
        type: 'boq_overrun',
        severity: 'blocking',
        count: overrunLines.length,
        label: `${overrunLines.length} BOQ line${overrunLines.length === 1 ? '' : 's'} over scope — unapproved variation`,
        detail: overrunLines.map((b) =>
          `${b.description || 'Unnamed'}: ${Number(b.actual_quantity).toFixed(1)} of ${Number(b.agreed_quantity).toFixed(1)} ${b.unit || ''} (+${Number(b.variation_quantity).toFixed(1)})`
        ).slice(0, 5),
      });
    }

    const hasBlocking = blockers.some((b) => b.severity === 'blocking');
    return Response.json({
      ready: blockers.length === 0,
      has_blocking: hasBlocking,
      blockers,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}