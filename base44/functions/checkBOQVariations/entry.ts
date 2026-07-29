import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// checkBOQVariations — compares actual logged work against the
// contracted Bill of Quantities for a job.
// ============================================================
// For each JobBillOfQuantities line, sums up the actual quantity from
// InvestigationLogs (by rate_card_item_id or description match) and
// Timesheets (by billing_rule_id), then updates:
//   • actual_quantity
//   • remaining_quantity
//   • variation_quantity
//   • status (not_started → in_progress → complete → overrun)
//
// Overrun lines (actual > agreed, no approved variation) are returned
// as blockers so checkBillingReadiness can flag them.
//
// Triggered:
//   • On InvestigationLog / Timesheet CREATE (entity automation)
//   • Manually from the BOQ management UI (refresh button)

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const jobId = body.job_id || (body.data && body.data.job_id);
    if (!jobId) return Response.json({ error: 'job_id required' }, { status: 400 });

    // Load BOQ lines for this job (exclude approved variation lines — those
    // carry their own agreed_quantity and are tracked separately).
    const boqLines = await base44.asServiceRole.entities.JobBillOfQuantities.filter({
      job_id: jobId,
      is_variation: { $ne: true },
    });

    if (!boqLines || boqLines.length === 0) {
      return Response.json({ ok: true, checked: 0, overruns: [], updated: [] });
    }

    // Load actual work logs
    const [invLogs, timesheets] = await Promise.all([
      base44.asServiceRole.entities.InvestigationLog.filter({ job_id: jobId }),
      base44.asServiceRole.entities.Timesheet.filter({ job_id: jobId }),
    ]);

    // Build actual-quantity map keyed by rate_card_item_id
    const actualByRateItem: Record<string, number> = {};
    const actualByDescription: Record<string, { qty: number; rateItemId: string | null }> = {};

    // InvestigationLogs — quantity comes from depth or units_completed
    for (const log of invLogs) {
      // Skip queried / rejected logs
      if (log.manager_review_status === 'queried') continue;
      const qty = Number(log.units_completed) ||
        ((Number(log.depth_to) || 0) - (Number(log.depth_from) || 0)) || 1;
      const rateId = log.billing_rule_id; // when stamped, this holds the rate card item id
      const desc = String(log.description || '').toLowerCase().trim();
      if (rateId) {
        actualByRateItem[rateId] = (actualByRateItem[rateId] || 0) + qty;
      }
      if (desc) {
        if (!actualByDescription[desc]) actualByDescription[desc] = { qty: 0, rateItemId: rateId || null };
        actualByDescription[desc].qty += qty;
      }
    }

    // Timesheets — count chargeable entries matched to a billing rule
    for (const ts of timesheets) {
      if (ts.is_break) continue;
      if (ts.status === 'rejected' || ts.status === 'deleted') continue;
      const rateId = ts.billing_rule_id;
      if (!rateId) continue;
      const qty = Number(ts.units_completed) || 1; // most tasks are per-sum
      actualByRateItem[rateId] = (actualByRateItem[rateId] || 0) + qty;
    }

    const updated: any[] = [];
    const overruns: any[] = [];

    for (const line of boqLines) {
      const agreedQty = Number(line.agreed_quantity) || 0;
      // Match by rate_card_item_id first, then by description
      let actualQty = 0;
      if (line.rate_card_item_id && actualByRateItem[line.rate_card_item_id]) {
        actualQty = actualByRateItem[line.rate_card_item_id];
      } else {
        const descKey = String(line.description || '').toLowerCase().trim();
        if (descKey && actualByDescription[descKey]) {
          actualQty = actualByDescription[descKey].qty;
        }
      }

      const remaining = round2(agreedQty - actualQty);
      const variationQty = actualQty > agreedQty ? round2(actualQty - agreedQty) : 0;

      // Determine status
      let status = line.status;
      if (actualQty === 0) {
        status = 'not_started';
      } else if (variationQty > 0) {
        // Actual exceeds agreed — check if an approved variation exists
        const hasApprovedVariation = boqLines.some(
          (v) => v.is_variation === true && v.variation_of_id === line.id && v.status !== 'overrun',
        );
        status = hasApprovedVariation ? 'variation' : 'overrun';
      } else if (actualQty >= agreedQty) {
        status = 'complete';
      } else {
        status = 'in_progress';
      }

      // Only update if something changed
      if (
        Number(line.actual_quantity) !== actualQty ||
        Number(line.remaining_quantity) !== remaining ||
        Number(line.variation_quantity) !== variationQty ||
        line.status !== status
      ) {
        await base44.asServiceRole.entities.JobBillOfQuantities.update(line.id, {
          actual_quantity: actualQty,
          remaining_quantity: remaining,
          variation_quantity: variationQty,
          status,
        });
        updated.push({ id: line.id, description: line.description, actual: actualQty, agreed: agreedQty, status });

        if (status === 'overrun') {
          overruns.push({
            boq_line_id: line.id,
            description: line.description,
            agreed_quantity: agreedQty,
            actual_quantity: actualQty,
            variation_quantity: variationQty,
          });
        }
      }
    }

    return Response.json({
      ok: true,
      job_id: jobId,
      checked: boqLines.length,
      updated: updated.length,
      overruns,
      updated_lines: updated,
    });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}