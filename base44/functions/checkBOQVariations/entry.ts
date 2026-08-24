import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// checkBOQVariations — compares actual logged work against the
// contracted Bill of Quantities for a job, and auto-creates draft
// variation rows for overruns so they appear in the manager review queue.
// ============================================================
// For each JobBillOfQuantities line (is_variation=false), sums up the actual
// quantity from InvestigationLogs and Timesheets, then updates:
//   • actual_quantity, remaining_quantity, variation_quantity
//   • status (not_started → in_progress → complete → overrun / variation)
//
// For every overrun (actual > agreed) with no existing draft or approved
// variation row, auto-creates a draft JobBillOfQuantities variation row
// (is_variation=true, status='not_started') linked via variation_of_id.
//
// Triggered:
//   • On InvestigationLog / Timesheet CREATE (entity automation)
//   • Manually from the Variations tab (per-job)
//   • Nightly scheduled automation (no job_id → iterates all active jobs)

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function checkJob(base44: any, jobId: string): Promise<any> {
  // Load original BOQ lines (exclude variation lines — those carry their own scope)
  const boqLines = await base44.entities.JobBillOfQuantities.filter({
    job_id: jobId,
    is_variation: { $ne: true },
  });

  if (!boqLines || boqLines.length === 0) {
    return { checked: 0, updated: 0, overruns: [], drafts_created: 0 };
  }

  // Load all variation lines for this job (drafts + approved) so we can skip
  // overruns that already have a pending or approved variation.
  const variationLines = await base44.entities.JobBillOfQuantities.filter({
    job_id: jobId,
    is_variation: true,
  });
  const variationByOriginal: Record<string, any[]> = {};
  for (const v of variationLines) {
    const key = v.variation_of_id || '';
    if (!variationByOriginal[key]) variationByOriginal[key] = [];
    variationByOriginal[key].push(v);
  }

  // Load actual work logs + billing rules
  const [invLogs, timesheets, billingRules] = await Promise.all([
    base44.entities.InvestigationLog.filter({ job_id: jobId }),
    base44.entities.Timesheet.filter({ job_id: jobId }),
    base44.entities.BillingRule.list('-created_date', 500),
  ]);

  // Map billing_rule_id → rate_card_item_id
  const billingRuleToRateItem: Record<string, string> = {};
  for (const br of billingRules) {
    if (br.rate_card_item_id) billingRuleToRateItem[br.id] = br.rate_card_item_id;
  }

  // Build actual-quantity maps
  const actualByRateItem: Record<string, number> = {};
  const actualByDescription: Record<string, { qty: number; rateItemId: string | null }> = {};

  for (const log of invLogs) {
    if (log.manager_review_status === 'queried') continue;
    const qty = Number(log.units_completed) ||
      ((Number(log.depth_to) || 0) - (Number(log.depth_from) || 0)) || 1;
    const rateId = log.billing_rule_id
      ? (billingRuleToRateItem[log.billing_rule_id] || log.billing_rule_id)
      : null;
    const desc = String(log.description || '').toLowerCase().trim();
    if (rateId) {
      actualByRateItem[rateId] = (actualByRateItem[rateId] || 0) + qty;
    }
    if (desc) {
      if (!actualByDescription[desc]) actualByDescription[desc] = { qty: 0, rateItemId: rateId || null };
      actualByDescription[desc].qty += qty;
    }
  }

  for (const ts of timesheets) {
    if (ts.is_break) continue;
    if (ts.status === 'rejected' || ts.status === 'deleted') continue;
    if (!ts.billing_rule_id) continue;
    const rateId = billingRuleToRateItem[ts.billing_rule_id] || ts.billing_rule_id;
    const qty = Number(ts.units_completed) || 1;
    actualByRateItem[rateId] = (actualByRateItem[rateId] || 0) + qty;
  }

  const updated: any[] = [];
  const overruns: any[] = [];
  const draftsToCreate: any[] = [];

  for (const line of boqLines) {
    const agreedQty = Number(line.agreed_quantity) || 0;
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
      const existingVariations = variationByOriginal[line.id] || [];
      const hasApproved = existingVariations.some((v: any) => v.status === 'complete');
      status = hasApproved ? 'variation' : 'overrun';
    } else if (actualQty >= agreedQty) {
      status = 'complete';
    } else {
      status = 'in_progress';
    }

    // Update the line if something changed
    if (
      Number(line.actual_quantity) !== actualQty ||
      Number(line.remaining_quantity) !== remaining ||
      Number(line.variation_quantity) !== variationQty ||
      line.status !== status
    ) {
      await base44.entities.JobBillOfQuantities.update(line.id, {
        actual_quantity: actualQty,
        remaining_quantity: remaining,
        variation_quantity: variationQty,
        status,
      });
      updated.push({ id: line.id, description: line.description, actual: actualQty, agreed: agreedQty, status });
    }

    if (status === 'overrun') {
      overruns.push({
        boq_line_id: line.id,
        description: line.description,
        agreed_quantity: agreedQty,
        actual_quantity: actualQty,
        variation_quantity: variationQty,
      });

      // Auto-create a draft variation row if no draft/approved variation exists yet
      const existingVariations = variationByOriginal[line.id] || [];
      if (existingVariations.length === 0) {
        draftsToCreate.push({
          job_id: jobId,
          project_id: line.project_id || null,
          rate_card_item_id: line.rate_card_item_id || null,
          sor_ref: line.sor_ref || '',
          description: `${line.description} — Variation (overrun)`,
          category: line.category || 'labour',
          subcategory: line.subcategory || '',
          unit: line.unit || 'nr',
          agreed_quantity: variationQty,
          agreed_unit_price: Number(line.agreed_unit_price) || 0,
          agreed_line_total: round2(variationQty * (Number(line.agreed_unit_price) || 0)),
          actual_quantity: 0,
          remaining_quantity: variationQty,
          variation_quantity: 0,
          status: 'not_started',
          is_variation: true,
          variation_of_id: line.id,
          variation_reason: '',
          sort_order: line.sort_order || 0,
        });
      }
    }
  }

  // Bulk-create draft variation rows
  let draftsCreated = 0;
  if (draftsToCreate.length > 0) {
    try {
      await base44.entities.JobBillOfQuantities.bulkCreate(draftsToCreate);
      draftsCreated = draftsToCreate.length;
    } catch (e) {
      // non-fatal — the overrun is still flagged on the original line
    }
  }

  return {
    checked: boqLines.length,
    updated: updated.length,
    overruns,
    drafts_created: draftsCreated,
    updated_lines: updated,
  };
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const b = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const jobId = body.job_id || (body.data && body.data.job_id);

    // No job_id → nightly scheduled run: iterate all active jobs with BOQs
    if (!jobId) {
      const jobs = await b.entities.Job.filter({ status: { $in: ['in_progress', 'decommissioning'] } }, '-created_date', 500);
      const results: any[] = [];
      let totalDrafts = 0;
      for (const job of jobs) {
        try {
          const r = await checkJob(b, job.id);
          if (r.checked > 0) {
            results.push({ job_id: job.id, job_name: job.name, ...r });
            totalDrafts += r.drafts_created;
          }
        } catch (_) { /* skip failing job */ }
      }
      return Response.json({
        ok: true,
        jobs_checked: results.length,
        drafts_created: totalDrafts,
        results,
      });
    }

    const result = await checkJob(b, jobId);
    return Response.json({ ok: true, job_id: jobId, ...result });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}