import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// checkInvoiceDiscrepancies — compares PO totals against matched
// supplier invoice amounts and flags mismatches (three-way match
// failures). Returns a list of discrepancies with variance amounts.
// ============================================================
// Payload: { tolerance_pct?: number (default 2) }
//
// A discrepancy is flagged when:
//   - invoice_received is true AND invoice_amount is set
//   - |invoice_amount - po.total| / po.total > tolerance_pct
//   - OR match_status is 'discrepancy'

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const tolerancePct = Number(body.tolerance_pct) || 2;

    // Load all POs that have invoices received
    const allPOs = await base44.asServiceRole.entities.PurchaseOrder.list('-created_date', 500);
    const jobs = await base44.asServiceRole.entities.Job.list('-created_date', 500);
    const jobMap: Record<string, any> = {};
    for (const j of jobs) jobMap[j.id] = j;

    const discrepancies: any[] = [];
    const matched: any[] = [];
    let totalVariance = 0;

    for (const po of allPOs) {
      // Only check POs where an invoice has been received
      if (!po.invoice_received || po.invoice_amount == null) continue;

      const poTotal = Number(po.total) || 0;
      const invoiceAmt = Number(po.invoice_amount) || 0;
      const variance = invoiceAmt - poTotal;
      const variancePct = poTotal > 0 ? Math.abs(variance) / poTotal * 100 : 0;

      const isDiscrepancy = variancePct > tolerancePct || po.match_status === 'discrepancy';

      const record = {
        po_id: po.id,
        po_number: po.po_number,
        job_id: po.job_id,
        job_name: po.job_name || jobMap[po.job_id]?.name || '',
        supplier_name: po.supplier_name,
        po_total: poTotal,
        invoice_amount: invoiceAmt,
        variance: Math.round(variance * 100) / 100,
        variance_pct: Math.round(variancePct * 10) / 10,
        match_status: po.match_status,
        invoice_number: po.invoice_number,
        is_discrepancy: isDiscrepancy,
      };

      if (isDiscrepancy) {
        discrepancies.push(record);
        totalVariance += variance;
      } else {
        matched.push(record);
      }
    }

    // Sort discrepancies by absolute variance (largest first)
    discrepancies.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));

    return Response.json({
      ok: true,
      tolerance_pct: tolerancePct,
      total_pos_checked: discrepancies.length + matched.length,
      discrepancy_count: discrepancies.length,
      matched_count: matched.length,
      total_variance: Math.round(totalVariance * 100) / 100,
      discrepancies,
      matched,
    });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ error: msg }, { status: 500 });
  }
}