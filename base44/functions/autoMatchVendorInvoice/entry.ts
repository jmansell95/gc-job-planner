import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Auto-matches a uploaded supplier invoice PDF against SubcontractorLog records.
// 1. Extracts invoice data (supplier, number, net, VAT, gross) from the PDF
// 2. Identifies the subcontractor by name match (or uses a provided ID)
// 3. Finds pending SubcontractorLog records for that supplier
// 4. Compares the invoice total against the sum of logged purchase costs
// 5. Updates matching logs with invoice data + reconciliation status
//
// Payload: { file_url, subcontractor_id?, tolerance? }
// tolerance defaults to £5.00 (absolute) or 1% of invoice total, whichever is greater.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json();
    const { file_url, subcontractor_id, tolerance } = body;

    if (!file_url) {
      return Response.json({ error: 'file_url is required' }, { status: 400 });
    }

    // --- Extract invoice data from the uploaded PDF ---
    const extractRes = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: {
        type: 'object',
        properties: {
          supplier_name: { type: 'string', description: 'The supplier/vendor company name on the invoice' },
          invoice_number: { type: 'string', description: 'The invoice number or reference' },
          invoice_date: { type: 'string', description: 'Invoice date (DD/MM/YYYY or YYYY-MM-DD)' },
          net_amount: { type: 'number', description: 'Net amount (subtotal before VAT) in GBP' },
          vat_amount: { type: 'number', description: 'VAT amount in GBP' },
          gross_amount: { type: 'number', description: 'Gross total (net + VAT) in GBP' },
          po_number: { type: 'string', description: 'Purchase order number if shown' },
        },
      },
    });

    const extracted = extractRes?.output || extractRes?.data?.output || extractRes;
    if (!extracted || extractRes?.status === 'error') {
      return Response.json({ error: 'Could not extract invoice data', details: extractRes?.details || 'Extraction failed' }, { status: 422 });
    }

    const invoiceNet = Number(extracted.net_amount) || 0;
    const invoiceVat = Number(extracted.vat_amount) || 0;
    const invoiceGross = Number(extracted.gross_amount) || (invoiceNet + invoiceVat);
    const invoiceNumber = String(extracted.invoice_number || '').trim();
    const supplierName = String(extracted.supplier_name || '').trim();
    const poNumber = String(extracted.po_number || '').trim();

    if (invoiceGross === 0) {
      return Response.json({ error: 'Could not read a valid invoice total from the document' }, { status: 422 });
    }

    // --- Identify the subcontractor ---
    let subcontractor = null;

    if (subcontractor_id) {
      const contractors = await base44.asServiceRole.entities.Contractor.filter({ id: subcontractor_id });
      subcontractor = contractors[0];
    }

    if (!subcontractor && supplierName) {
      // Match by name (case-insensitive contains)
      const allContractors = await base44.asServiceRole.entities.Contractor.list('-created_date', 200);
      const lowerName = supplierName.toLowerCase();
      subcontractor = allContractors.find(c =>
        (c.name || '').toLowerCase().includes(lowerName) ||
        lowerName.includes((c.name || '').toLowerCase())
      );
    }

    if (!subcontractor) {
      return Response.json({
        success: false,
        error: 'Could not identify the supplier. Please select the subcontractor manually.',
        extracted: { supplier_name: supplierName, invoice_number: invoiceNumber, net_amount: invoiceNet, vat_amount: invoiceVat, gross_amount: invoiceGross },
      });
    }

    // --- Find pending SubcontractorLog records for this supplier ---
    const logs = await base44.asServiceRole.entities.SubcontractorLog.filter({
      subcontractor_id: subcontractor.id,
      reconciliation_status: { $in: ['pending', 'mismatched'] },
    });

    if (logs.length === 0) {
      return Response.json({
        success: true,
        matched: 0,
        message: `No pending logs found for ${subcontractor.name}. Invoice data extracted successfully.`,
        subcontractor: { id: subcontractor.id, name: subcontractor.name },
        extracted: { supplier_name: supplierName, invoice_number: invoiceNumber, net_amount: invoiceNet, vat_amount: invoiceVat, gross_amount: invoiceGross },
      });
    }

    // --- Compare invoice total against sum of logged purchase costs ---
    const loggedTotal = logs.reduce((sum, l) => sum + (Number(l.purchase_cost_net) || 0), 0);
    const diff = invoiceNet - loggedTotal;
    const absTolerance = Math.max(Number(tolerance) || 5, invoiceNet * 0.01); // £5 or 1%, whichever is greater
    const isMatch = Math.abs(diff) <= absTolerance;

    const now = new Date().toISOString();
    const reconStatus = isMatch ? 'reconciled' : 'mismatched';
    const reconNote = isMatch
      ? `Auto-matched from invoice ${invoiceNumber} — invoice net £${invoiceNet.toFixed(2)} vs logged £${loggedTotal.toFixed(2)}`
      : `Auto-match from invoice ${invoiceNumber} — MISMATCH: invoice net £${invoiceNet.toFixed(2)} vs logged £${loggedTotal.toFixed(2)} (diff £${diff.toFixed(2)})`;

    // --- Update all matching logs with the invoice data ---
    const updates = logs.map(l => ({
      id: l.id,
      invoice_received: true,
      invoice_number: invoiceNumber,
      invoice_url: file_url,
      invoice_net_amount: Math.round(invoiceNet * 100) / 100,
      invoice_vat_amount: Math.round(invoiceVat * 100) / 100,
      invoice_gross_amount: Math.round(invoiceGross * 100) / 100,
      reconciliation_status: reconStatus,
      reconciled_at: isMatch ? now : undefined,
      reconciled_by_name: 'Auto-Match (Invoice Upload)',
      reconciliation_note: reconNote,
    }));

    await base44.asServiceRole.entities.SubcontractorLog.bulkUpdate(updates);

    return Response.json({
      success: true,
      matched: logs.length,
      reconciliation_status: reconStatus,
      is_match: isMatch,
      difference: Math.round(diff * 100) / 100,
      tolerance: Math.round(absTolerance * 100) / 100,
      subcontractor: { id: subcontractor.id, name: subcontractor.name },
      extracted: {
        supplier_name: supplierName,
        invoice_number: invoiceNumber,
        invoice_date: extracted.invoice_date || '',
        net_amount: invoiceNet,
        vat_amount: invoiceVat,
        gross_amount: invoiceGross,
        po_number: poNumber,
      },
      logged_total: Math.round(loggedTotal * 100) / 100,
      message: isMatch
        ? `Reconciled ${logs.length} log${logs.length === 1 ? '' : 's'} for ${subcontractor.name} — invoice matches logged costs.`
        : `Flagged ${logs.length} log${logs.length === 1 ? '' : 's'} for ${subcontractor.name} as MISMATCH — invoice £${invoiceNet.toFixed(2)} vs logged £${loggedTotal.toFixed(2)} (diff £${diff.toFixed(2)}).`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}