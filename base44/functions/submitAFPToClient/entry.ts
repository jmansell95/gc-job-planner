import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * submitAFPToClient — marks an AFP as submitted to the client and auto-creates
 * the next AFP in the chain (period_start = submitted AFP's period_end + 1 day).
 *
 * Input:  { afp_id: string }
 * Output: { success, afp, next_afp }
 */

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
    if (afp.status !== 'draft') return Response.json({ error: 'AFP must be in draft status to submit' }, { status: 400 });

    const userName = user.full_name || user.email || 'System';
    const now = new Date().toISOString();

    // Capture original totals at submission time
    const lineItems = await base44.entities.AFPLineItem.filter({ afp_id }, 'sort_order', 500);
    const originalTotal = lineItems.reduce((s, li) => s + (li.amount || 0), 0);

    // Update AFP: set original amounts on line items and mark as submitted
    await base44.entities.AFP.update(afp_id, {
      status: 'submitted',
      original_total: originalTotal,
      agreed_total: originalTotal,
      last_updated_at: now,
      last_updated_by: userName,
    });

    // Set original_amount on all line items (snapshot at submission time)
    const updates = lineItems.map(li => ({
      id: li.id,
      original_amount: li.amount,
      agreed_amount: li.amount,
    }));
    if (updates.length > 0) {
      await base44.entities.AFPLineItem.bulkUpdate(updates);
    }

    // Auto-create next AFP if period_end_date is set
    let nextAfp = null;
    if (afp.period_end_date) {
      const nextStart = new Date(afp.period_end_date);
      nextStart.setDate(nextStart.getDate() + 1);
      const nextStartStr = nextStart.toISOString().slice(0, 10);

      // Determine next AFP number
      const allAfps = await base44.entities.AFP.filter({ job_id: afp.job_id });
      const nextNumber = allAfps.length + 1;

      nextAfp = await base44.entities.AFP.create({
        job_id: afp.job_id,
        job_name: afp.job_name,
        job_reference: afp.job_reference,
        division_id: afp.division_id,
        afp_number: nextNumber,
        period_start_date: nextStartStr,
        status: 'draft',
        client_po: afp.client_po,
        gc_job_number: afp.gc_job_number,
        client_name: afp.client_name,
        contract_value: afp.contract_value,
      });

      // Link next AFP to current
      await base44.entities.AFP.update(afp_id, { next_afp_id: nextAfp.id });
    }

    return Response.json({
      success: true,
      afp: { ...afp, status: 'submitted', original_total: originalTotal },
      next_afp: nextAfp,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}