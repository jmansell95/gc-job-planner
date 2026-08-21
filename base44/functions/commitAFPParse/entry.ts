import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { toNum, toDateStr, calcAFPLineItemTotals, calcAFPTotal, logFinancialAudit } from '../../shared/cvrHelpers.ts';

/**
 * commitAFPParse — takes the confirmed parsed AFP data and creates/updates
 * the AFP + AFPLineItem records linked to the job. Multiple AFPs per job
 * (one per monthly period) — if an AFP exists for the same period_date, it's
 * updated; otherwise a new one is created.
 *
 * Input:  { job_id, preview, source_file_url, source_file_name }
 * Output: { afp_id, line_item_count, total_claimed }
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

    const cd = preview.contract_details || {};
    const periodDate = toDateStr(cd.date) || new Date().toISOString().slice(0, 10);

    // Build all line items
    const drillingItems = (preview.drilling || []).map((d, i) => calcAFPLineItemTotals({
      ...d,
      sheet_name: 'drilling',
      sort_order: i,
    }));
    const plantHireItems = (preview.plant_hire || []).map((p, i) => calcAFPLineItemTotals({
      ...p,
      item: p.item,
      unit_price: toNum(p.unit_price),
      qty: toNum(p.qty),
      amount: toNum(p.total || p.amount),
      sheet_name: 'plant_hire',
      sort_order: i,
    }));
    const rateItems = (preview.rates || []).map((r, i) => ({
      item: r.item || '',
      unit: r.per || '',
      unit_price: toNum(r.price),
      qty: 0,
      rate: toNum(r.price),
      amount: 0,
      sheet_name: 'rates',
      sort_order: i,
    }));

    const allItems = [...drillingItems, ...plantHireItems, ...rateItems];
    const totalClaimed = calcAFPTotal([...drillingItems, ...plantHireItems]);

    // Check for existing AFP for this job+period
    const existingAFPs = await base44.entities.AFP.filter({ job_id });
    const existingAFP = existingAFPs.find(a => a.period_date === periodDate);

    let afpId;

    const afpData = {
      job_id,
      job_name: job.name,
      job_reference: job.job_reference || '',
      division_id: job.division_id || '',
      period_date: periodDate,
      client_po: cd.client_purchase_order || '',
      gc_job_number: cd.gc_job_number || job.job_reference || '',
      client_name: cd.client || '',
      payment_due_date: cd.payment_due_date || '',
      contract_value: toNum(cd.contract_award_value),
      total_claimed: totalClaimed,
      status: existingAFP?.status || 'draft',
      source_file_url: source_file_url || '',
      source_file_name: source_file_name || '',
      last_updated_at: new Date().toISOString(),
      last_updated_by: user.full_name || user.email || '',
    };

    if (existingAFP) {
      await base44.entities.AFPLineItem.deleteMany({ afp_id: existingAFP.id });
      await base44.entities.AFP.update(existingAFP.id, afpData);
      afpId = existingAFP.id;
    } else {
      const created = await base44.entities.AFP.create(afpData);
      afpId = created.id;
    }

    // Create line items
    if (allItems.length > 0) {
      await base44.entities.AFPLineItem.bulkCreate(
        allItems.map(li => ({
          afp_id: afpId,
          job_id,
          sheet_name: li.sheet_name,
          item: li.item || '',
          unit: li.unit || '',
          unit_price: toNum(li.unit_price),
          qty: toNum(li.qty),
          rate: toNum(li.rate),
          amount: toNum(li.amount),
          week_breakdown: li.week_breakdown || [],
          sort_order: li.sort_order || 0,
        }))
      );
    }

    // Audit log
    await logFinancialAudit(base44, {
      entity_name: 'AFP',
      entity_id: afpId,
      action: existingAFP ? 'update' : 'create',
      record_summary: `AFP for ${job.name} (${periodDate}): £${totalClaimed.toLocaleString()} claimed, ${allItems.length} line items`,
      actor_user_id: user.id,
      actor_name: user.full_name || user.email,
    });

    return Response.json({
      afp_id: afpId,
      line_item_count: allItems.length,
      total_claimed: totalClaimed,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}