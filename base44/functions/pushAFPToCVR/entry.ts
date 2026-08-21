import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * pushAFPToCVR — pushes an approved AFP's agreed values into the job's CVR,
 * creating/updating CashFlowEntry records, marking the AFP as 'invoiced'.
 *
 * Input:  { afp_id: string }
 * Output: { success, cvr_id, agreed_total }
 */

function toNum(v) { const n = Number(v); return isNaN(n) ? 0 : n; }

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
    if (afp.status !== 'approved') return Response.json({ error: 'AFP must be approved before pushing to CVR' }, { status: 400 });

    const userName = user.full_name || user.email || 'System';
    const now = new Date().toISOString();

    // Fetch AFP line items — calculate agreed total
    const lineItems = await base44.entities.AFPLineItem.filter({ afp_id }, 'sort_order', 500);
    const agreedTotal = lineItems.reduce((s, li) => {
      if (li.dispute_status === 'rejected') return s;
      return s + toNum(li.agreed_amount || li.amount);
    }, 0);

    // Fetch or create CVR for the job
    const cvrs = await base44.entities.CVR.filter({ job_id: afp.job_id });
    let cvr = cvrs[0];
    if (!cvr) {
      cvr = await base44.entities.CVR.create({
        job_id: afp.job_id,
        job_name: afp.job_name,
        job_reference: afp.job_reference,
        division_id: afp.division_id,
        client_name: afp.client_name,
        contract_value: afp.contract_value,
      });
    }

    // Update CVR financials — accumulate value_to_date and costs_to_date
    const currentValueToDate = toNum(cvr.value_to_date);
    const currentCostsToDate = toNum(cvr.costs_to_date);

    await base44.entities.CVR.update(cvr.id, {
      value_to_date: currentValueToDate + agreedTotal,
      costs_to_date: currentCostsToDate + agreedTotal,
      last_updated_at: now,
      last_updated_by: userName,
    });

    // Create or update CashFlowEntry for the AFP period
    const periodDate = afp.period_end_date || afp.period_date;
    const existingCashFlow = await base44.entities.CashFlowEntry.filter({ cvr_id: cvr.id, job_id: afp.job_id });
    const existingEntry = existingCashFlow.find(cf => cf.month_date === periodDate);

    if (existingEntry) {
      await base44.entities.CashFlowEntry.update(existingEntry.id, {
        app_value: agreedTotal,
        amount: agreedTotal,
        description: `AFP ${afp.afp_number || ''} — ${afp.job_name || ''}`,
      });
    } else {
      await base44.entities.CashFlowEntry.create({
        cvr_id: cvr.id,
        job_id: afp.job_id,
        month_date: periodDate,
        description: `AFP ${afp.afp_number || ''} — ${afp.job_name || ''}`,
        app_value: agreedTotal,
        amount: agreedTotal,
        sort_order: (existingCashFlow.length || 0) + 1,
      });
    }

    // Mark AFP as invoiced
    await base44.entities.AFP.update(afp_id, {
      status: 'invoiced',
      agreed_total: agreedTotal,
      pushed_to_cvr_at: now,
      pushed_by: userName,
      last_updated_at: now,
      last_updated_by: userName,
    });

    return Response.json({
      success: true,
      cvr_id: cvr.id,
      agreed_total: agreedTotal,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}