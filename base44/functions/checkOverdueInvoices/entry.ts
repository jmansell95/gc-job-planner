import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Nightly check — flips 'sent' invoices to 'overdue' when the due date has passed.
// Runs on a schedule (admin-only service role).

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const today = new Date().toISOString().split('T')[0];

    // Fetch all sent invoices
    const sentInvoices = await base44.asServiceRole.entities.Invoice.filter({ status: 'sent' });

    let flipped = 0;
    for (const inv of sentInvoices) {
      if (inv.due_date && inv.due_date < today) {
        await base44.asServiceRole.entities.Invoice.update(inv.id, { status: 'overdue' });
        flipped++;
      }
    }

    return Response.json({
      success: true,
      checked: sentInvoices.length,
      flipped_to_overdue: flipped,
      date: today,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}