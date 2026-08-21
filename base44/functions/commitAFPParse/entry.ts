import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { toNum, toDateStr, calcAFPLineItemTotals, calcAFPTotal, logFinancialAudit } from '../../shared/cvrHelpers.ts';

/**
 * commitAFPParse — takes the confirmed parsed Lump Sum AFP data and creates/updates
 * the AFP + AFPLineItem records linked to the job. Also mirrors variations as
 * VariationOrder records linked to the job's CVR. Multiple AFPs per job
 * (one per monthly period) — if an AFP exists for the same period_date, it's
 * updated; otherwise a new one is created.
 *
 * Input:  { job_id, preview, source_file_url, source_file_name }
 * Output: { afp_id, line_item_count, total_claimed, variation_count }
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

    // Build AFP line items from all three line-item sheets
    const measuredItems = (preview.measured_works || []).map((m, i) => calcAFPLineItemTotals({
      item: m.item || m.item_ref || '',
      unit: m.unit || '',
      qty: toNum(m.qty),
      rate: toNum(m.rate),
      amount: toNum(m.amount),
      sheet_name: 'measured_works',
      source: 'manual',
      is_manual: false,
      sort_order: i,
    }));
    const variationItems = (preview.variations || []).map((v, i) => calcAFPLineItemTotals({
      item: v.description || v.vo_ref || '',
      unit: v.unit || '',
      qty: toNum(v.qty),
      rate: toNum(v.rate),
      amount: toNum(v.total_cost),
      sheet_name: 'variations',
      source: 'manual',
      is_manual: false,
      sort_order: i,
    }));
    const materialItems = (preview.materials || []).map((m, i) => calcAFPLineItemTotals({
      item: m.description || m.item || '',
      unit: m.unit || '',
      qty: toNum(m.qty),
      rate: toNum(m.cost),
      amount: toNum(m.qty) * toNum(m.cost),
      sheet_name: 'materials',
      source: 'manual',
      is_manual: false,
      sort_order: i,
    }));

    const allItems = [...measuredItems, ...variationItems, ...materialItems];
    const totalClaimed = calcAFPTotal(allItems);

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
          unit_price: toNum(li.rate),
          qty: toNum(li.qty),
          rate: toNum(li.rate),
          amount: toNum(li.amount),
          sort_order: li.sort_order || 0,
        }))
      );
    }

    // Mirror variations as VariationOrder records linked to the job's CVR
    let variationCount = 0;
    if ((preview.variations || []).length > 0) {
      // Find or create the job's CVR
      let cvrs = await base44.entities.CVR.filter({ job_id });
      let cvrId = cvrs[0]?.id;
      if (!cvrId) {
        const newCVR = await base44.entities.CVR.create({
          job_id,
          job_name: job.name,
          job_reference: job.job_reference || '',
          division_id: job.division_id || '',
          client_name: cd.client || '',
          last_updated_at: new Date().toISOString(),
          last_updated_by: user.full_name || user.email || '',
        });
        cvrId = newCVR.id;
      }

      // Delete existing variations for this CVR (replace on re-upload)
      await base44.entities.VariationOrder.deleteMany({ cvr_id: cvrId });

      const voRecords = (preview.variations || []).map((v, i) => ({
        cvr_id: cvrId,
        job_id,
        vo_number: i + 1,
        description: v.description || v.vo_ref || '',
        agreed_value: toNum(v.total_cost),
        sort_order: i,
      }));

      if (voRecords.length > 0) {
        await base44.entities.VariationOrder.bulkCreate(voRecords);
        variationCount = voRecords.length;
      }
    }

    // Audit log
    await logFinancialAudit(base44, {
      entity_name: 'AFP',
      entity_id: afpId,
      action: existingAFP ? 'update' : 'create',
      record_summary: `AFP for ${job.name} (${periodDate}): £${totalClaimed.toLocaleString()} claimed, ${allItems.length} line items, ${variationCount} variations`,
      actor_user_id: user.id,
      actor_name: user.full_name || user.email,
    });

    return Response.json({
      afp_id: afpId,
      line_item_count: allItems.length,
      total_claimed: totalClaimed,
      variation_count: variationCount,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}