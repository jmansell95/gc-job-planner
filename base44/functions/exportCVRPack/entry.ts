import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// exportCVRPack — returns structured CVR data for client-side
// CSV/Excel generation. Fetches CVR + line items + variations +
// cash flow for the selected CVR IDs.
// ============================================================

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { cvr_ids } = body;

    if (!cvr_ids || !Array.isArray(cvr_ids) || cvr_ids.length === 0) {
      return Response.json({ ok: false, error: 'cvr_ids required' }, { status: 400 });
    }

    const cvrs = [];
    for (const id of cvr_ids) {
      try {
        const cvr = await base44.asServiceRole.entities.CVR.get(id);
        if (!cvr) continue;
        const [lineItems, variations, cashFlow] = await Promise.all([
          base44.asServiceRole.entities.CVRLineItem.filter({ cvr_id: id }, 'sort_order', 500),
          base44.asServiceRole.entities.VariationOrder.filter({ cvr_id: id }, 'vo_number', 100),
          base44.asServiceRole.entities.CashFlowEntry.filter({ cvr_id: id }, 'sort_order', 200),
        ]);
        cvrs.push({
          cvr,
          line_items: lineItems,
          variations,
          cash_flow: cashFlow,
        });
      } catch (_) { /* skip failed CVR */ }
    }

    return Response.json({
      ok: true,
      count: cvrs.length,
      cvrs,
    });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}