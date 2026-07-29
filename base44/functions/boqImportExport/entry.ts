import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// boqImportExport — import and export Bill of Quantities data
// ============================================================
//
// IMPORT: Parses a CSV/Excel file of BOQ lines and creates
// JobBillOfQuantities records for a specific job.
//
// Expected CSV columns (header row required):
//   sor_ref, description, category, subcategory, unit,
//   agreed_quantity, agreed_unit_price, notes
//
// The function auto-matches each row to a RateCardItem by description
// (within the job's project or global rate card) so that
// rate_card_item_id is populated for variation tracking.
//
// EXPORT: Returns all BOQ lines for a job as a flat CSV string
// (including actual vs agreed quantities and status).
//
// Modes:
//   { mode: 'import', file_url, job_id, project_id }
//   { mode: 'export', job_id }

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Simple CSV row parser that handles quoted fields with commas
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function csvEscape(val: any): string {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json();
    const mode = body.mode;

    // ── EXPORT ──
    if (mode === 'export') {
      const jobId = body.job_id;
      if (!jobId) return Response.json({ error: 'job_id required' }, { status: 400 });

      const lines = await base44.asServiceRole.entities.JobBillOfQuantities.filter(
        { job_id: jobId }, 'sort_order', 500
      );

      const headers = [
        'SOR Ref', 'Description', 'Category', 'Subcategory', 'Unit',
        'Agreed Quantity', 'Agreed Unit Price', 'Agreed Line Total',
        'Actual Quantity', 'Remaining', 'Variation', 'Status',
        'Is Variation', 'Variation Reason', 'Notes',
      ];
      const rows = lines.map((l: any) => [
        l.sor_ref || '', l.description || '', l.category || '', l.subcategory || '', l.unit || '',
        Number(l.agreed_quantity) || 0, Number(l.agreed_unit_price) || 0, Number(l.agreed_line_total) || 0,
        Number(l.actual_quantity) || 0, Number(l.remaining_quantity) || 0, Number(l.variation_quantity) || 0,
        l.status || '', l.is_variation ? 'Yes' : 'No', l.variation_reason || '', l.notes || '',
      ].map(csvEscape).join(','));

      const csv = [headers.join(','), ...rows].join('\n');
      return Response.json({ ok: true, csv, line_count: lines.length });
    }

    // ── IMPORT ──
    if (mode === 'import') {
      const { file_url, job_id, project_id, replace_existing } = body;
      if (!file_url || !job_id) {
        return Response.json({ error: 'file_url and job_id required' }, { status: 400 });
      }

      // Fetch the file
      const fileRes = await fetch(file_url);
      if (!fileRes.ok) return Response.json({ error: 'Could not download file' }, { status: 422 });
      const text = await fileRes.text();

      // Parse CSV
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) return Response.json({ error: 'File is empty or has no data rows' }, { status: 422 });

      const headerMap: Record<string, number> = {};
      const headerRow = parseCSVLine(lines[0]);
      headerRow.forEach((h, i) => {
        const key = h.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
        headerMap[key] = i;
      });

      // Helper to get a value by flexible column name
      const getVal = (row: string[], ...keys: string[]): string => {
        for (const k of keys) {
          const key = k.toLowerCase().replace(/[^a-z0-9]/g, '_');
          if (headerMap[key] != null) return row[headerMap[key]] || '';
        }
        return '';
      };

      // Load rate card items for auto-matching
      const rateItems = project_id
        ? await base44.asServiceRole.entities.RateCardItem.filter({ project_id, is_active: true }, 'sort_order', 500)
        : await base44.asServiceRole.entities.RateCardItem.filter({ rate_card_source: 'our_company', is_active: true }, 'sort_order', 500);

      // Optionally clear existing BOQ for this job
      if (replace_existing) {
        await base44.asServiceRole.entities.JobBillOfQuantities.deleteMany({ job_id });
      }

      const payload: any[] = [];
      let sortOrder = 0;
      let skipped = 0;

      for (let i = 1; i < lines.length; i++) {
        const row = parseCSVLine(lines[i]);
        const description = getVal(row, 'description', 'sor_description', 'item_description');
        const qty = Number(getVal(row, 'agreed_quantity', 'quantity', 'qty')) || 0;
        const unitPrice = Number(getVal(row, 'agreed_unit_price', 'unit_price', 'price')) || 0;

        if (!description || qty <= 0) { skipped++; continue; }

        const sorRef = getVal(row, 'sor_ref', 'item_ref', 'ref');
        const category = getVal(row, 'category', 'cat') || 'labour';
        const subcategory = getVal(row, 'subcategory', 'section');
        const unit = getVal(row, 'unit', 'uom') || 'nr';
        const notes = getVal(row, 'notes', 'note');

        // Try to match against rate card by SOR ref first, then by description
        let matchedRateId: string | null = null;
        if (sorRef) {
          const byRef = rateItems.find((r: any) =>
            String(r.sort_order || '').includes(sorRef) || String(r.description || '').includes(sorRef)
          );
          if (byRef) matchedRateId = byRef.id;
        }

        payload.push({
          job_id,
          project_id: project_id || null,
          rate_card_item_id: matchedRateId,
          sor_ref: sorRef,
          description,
          category,
          subcategory,
          unit,
          agreed_quantity: qty,
          agreed_unit_price: unitPrice,
          agreed_line_total: round2(qty * unitPrice),
          actual_quantity: 0,
          remaining_quantity: qty,
          variation_quantity: 0,
          status: 'not_started',
          is_variation: false,
          sort_order: sortOrder++,
          notes: notes || null,
        });
      }

      if (payload.length === 0) {
        return Response.json({ error: 'No valid BOQ lines could be parsed from this file' }, { status: 422 });
      }

      const created = await base44.asServiceRole.entities.JobBillOfQuantities.bulkCreate(payload);

      // Run variation check immediately to populate actuals
      try {
        await base44.asServiceRole.functions.invoke('checkBOQVariations', { job_id });
      } catch (_) { /* non-fatal */ }

      return Response.json({
        ok: true,
        imported: created.length,
        skipped,
        matched_rates: payload.filter((p) => p.rate_card_item_id).length,
      });
    }

    return Response.json({ error: 'mode must be import or export' }, { status: 400 });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}