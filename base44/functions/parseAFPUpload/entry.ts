import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { toNum, toDateStr } from '../../shared/cvrHelpers.ts';
import * as XLSX from 'npm:xlsx@0.18.5';

/**
 * parseAFPUpload — fetches the Lump Sum AFP Excel file, parses the four
 * sheets (Valuation Summary, Measured Works, Variation Summary, Materials
 * On site) deterministically using SheetJS, and returns a structured preview.
 *
 * Input:  { file_url: string }
 * Output: { preview: { contract_details, measured_works, variations, materials } }
 */

function findHeaderRow(rows, keywords, startIdx = 0) {
  for (let i = startIdx; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    for (const cell of row) {
      const l = String(cell || '').toLowerCase().trim();
      if (keywords.some(kw => l === kw || l.includes(kw))) return i;
    }
  }
  return -1;
}

function colIdx(headerRow, exact, includes) {
  for (let c = 0; c < headerRow.length; c++) {
    const l = String(headerRow[c] || '').toLowerCase().trim();
    if (exact && exact.some(e => l === e)) return c;
  }
  for (let c = 0; c < headerRow.length; c++) {
    const l = String(headerRow[c] || '').toLowerCase().trim();
    if (includes && includes.some(inc => l.includes(inc))) return c;
  }
  return -1;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { file_url } = body;
    if (!file_url) return Response.json({ error: 'file_url is required' }, { status: 400 });

    const fileRes = await fetch(file_url);
    if (!fileRes.ok) return Response.json({ error: 'Could not download AFP file' }, { status: 422 });
    const fileBuf = await fileRes.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(fileBuf), { type: 'array' });

    const preview = {
      contract_details: {},
      measured_works: [],
      variations: [],
      materials: [],
    };

    // ── Valuation Summary sheet (job metadata) ──
    const vsName = workbook.SheetNames.find(n => /valuation\s*summary/i.test(n));
    if (vsName) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[vsName], { header: 1, raw: true, defval: null, blankrows: false });
      const details: any = {};
      for (const row of rows) {
        if (!row) continue;
        // Scan all cells for label/value pairs (merged cells make positions unreliable)
        for (let c = 0; c < row.length; c++) {
          const cellVal = row[c];
          if (cellVal == null || cellVal === '') continue;
          const l = String(cellVal).toLowerCase().trim();
          // Look ahead for a value in the next non-empty cell
          let valCell = null;
          for (let c2 = c + 1; c2 < Math.min(row.length, c + 4); c2++) {
            if (row[c2] != null && row[c2] !== '') { valCell = row[c2]; break; }
          }
          if (l.includes('project name') && valCell) details.project_name = String(valCell).trim();
          else if ((l.includes('gcl') || l.includes('job no')) && valCell) details.gc_job_number = String(valCell).trim();
          else if (l === 'client' && valCell) details.client = String(valCell).trim();
          else if ((l.includes('order no') || l.includes('purchase order')) && valCell) details.client_purchase_order = String(valCell).trim();
          else if (l.includes('contact address') && valCell) details.contact_address = String(valCell).trim();
          else if (l.includes('payment due') && valCell) details.payment_due_date = String(valCell).trim();
          else if ((l.includes('contract award') || l.includes('contract value')) && valCell) details.contract_award_value = toNum(valCell);
          else if (l.includes('date') && !l.includes('payment') && valCell) details.date = toDateStr(valCell);
        }
        // Also capture PRJ- prefixed values (job number in col 0)
        if (row[0] && /^PRJ-/i.test(String(row[0]).trim())) details.gc_job_number = String(row[0]).trim();
      }
      preview.contract_details = details;
    }

    // ── Measured Works sheet (main line items) ──
    const mwName = workbook.SheetNames.find(n => /measured\s*works/i.test(n));
    if (mwName) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[mwName], { header: 1, raw: true, defval: null, blankrows: false });
      // Header row contains "Description" (row 4 in the sample, after title rows)
      const headerIdx = findHeaderRow(rows, ['description'], 0);
      if (headerIdx >= 0) {
        const headerRow = rows[headerIdx];
        const itemRefCol = colIdx(headerRow, ['item ref', 'item ref:'], ['item ref']);
        const descCol = colIdx(headerRow, ['description'], ['description']);
        const qtyCol = colIdx(headerRow, ['qty'], ['qty']);
        const unitCol = colIdx(headerRow, ['unit'], ['unit']);
        const rateCol = colIdx(headerRow, ['rate'], ['rate']);
        const sumCol = colIdx(headerRow, ['sum'], ['sum']);
        const appliedCol = colIdx(headerRow, null, ['applied in period']);
        const commentsCol = colIdx(headerRow, ['comments'], ['comments']);

        for (let r = headerIdx + 1; r < rows.length; r++) {
          const row = rows[r];
          if (!row) continue;
          const desc = descCol >= 0 ? String(row[descCol] || '').trim() : '';
          const itemRef = itemRefCol >= 0 ? String(row[itemRefCol] || '').trim() : '';
          if (!desc && !itemRef) continue;
          // Skip section headers (category labels with no qty/rate)
          const qty = qtyCol >= 0 ? toNum(row[qtyCol]) : 0;
          const rate = rateCol >= 0 ? toNum(row[rateCol]) : 0;
          if (!desc && !itemRef && qty === 0 && rate === 0) continue;

          const unit = unitCol >= 0 ? String(row[unitCol] || '').trim() : '';
          const amount = sumCol >= 0 ? toNum(row[sumCol]) : qty * rate;
          const appliedInPeriod = appliedCol >= 0 ? toNum(row[appliedCol]) : 0;
          const comments = commentsCol >= 0 ? String(row[commentsCol] || '').trim() : '';

          // Skip section headers (category labels with no financial data)
          if (qty === 0 && rate === 0 && amount === 0 && appliedInPeriod === 0) continue;

          preview.measured_works.push({
            item_ref: itemRef,
            item: desc,
            unit,
            qty,
            rate,
            amount,
            applied_in_period: appliedInPeriod,
            comments,
          });
        }
      }
    }

    // ── Variation Summary sheet ──
    const varName = workbook.SheetNames.find(n => /variation\s*summary/i.test(n));
    if (varName) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[varName], { header: 1, raw: true, defval: null, blankrows: false });
      // Header row contains "Description" (row 4 in the sample)
      const headerIdx = findHeaderRow(rows, ['description'], 0);
      if (headerIdx >= 0) {
        const headerRow = rows[headerIdx];
        const voRefCol = colIdx(headerRow, ['vo ref', 'vo ref:'], ['vo ref']);
        const dateCol = colIdx(headerRow, ['date', 'date:'], ['date']);
        const refCol = colIdx(headerRow, ['ref'], ['ref']);
        const descCol = colIdx(headerRow, ['description'], ['description']);
        const qtyCol = colIdx(headerRow, ['qty'], ['qty']);
        const unitCol = colIdx(headerRow, ['unit'], ['unit']);
        const rateCol = colIdx(headerRow, ['rate'], ['rate']);
        const totalCostCol = colIdx(headerRow, ['total cost'], ['total cost']);
        const commentsCol = colIdx(headerRow, ['comments'], ['comments']);

        for (let r = headerIdx + 1; r < rows.length; r++) {
          const row = rows[r];
          if (!row) continue;
          const desc = descCol >= 0 ? String(row[descCol] || '').trim() : '';
          const voRef = voRefCol >= 0 ? String(row[voRefCol] || '').trim() : '';
          if (!desc && !voRef) continue;
          const qty = qtyCol >= 0 ? toNum(row[qtyCol]) : 0;
          const rate = rateCol >= 0 ? toNum(row[rateCol]) : 0;
          if (!desc && !voRef && qty === 0 && rate === 0) continue;

          const date = dateCol >= 0 ? toDateStr(row[dateCol]) : null;
          const ref = refCol >= 0 ? String(row[refCol] || '').trim() : '';
          const unit = unitCol >= 0 ? String(row[unitCol] || '').trim() : '';
          const totalCost = totalCostCol >= 0 ? toNum(row[totalCostCol]) : qty * rate;
          const comments = commentsCol >= 0 ? String(row[commentsCol] || '').trim() : '';

          preview.variations.push({
            vo_ref: voRef,
            date,
            ref,
            description: desc,
            unit,
            qty,
            rate,
            total_cost: totalCost,
            comments,
          });
        }
      }
    }

    // ── Materials On site sheet ──
    const matName = workbook.SheetNames.find(n => /materials?\s*on\s*site/i.test(n));
    if (matName) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[matName], { header: 1, raw: true, defval: null, blankrows: false });
      // Header row contains "Description" (row 3 in the sample)
      const headerIdx = findHeaderRow(rows, ['description'], 0);
      if (headerIdx >= 0) {
        const headerRow = rows[headerIdx];
        const itemCol = colIdx(headerRow, ['item', 'item:'], ['item']);
        const descCol = colIdx(headerRow, ['description', 'description:'], ['description']);
        const qtyCol = colIdx(headerRow, ['quantity'], ['quantity']);
        const unitCol = colIdx(headerRow, ['unit'], ['unit']);
        const costCol = colIdx(headerRow, ['cost'], ['cost']);

        for (let r = headerIdx + 1; r < rows.length; r++) {
          const row = rows[r];
          if (!row) continue;
          const desc = descCol >= 0 ? String(row[descCol] || '').trim() : '';
          const item = itemCol >= 0 ? String(row[itemCol] || '').trim() : '';
          if (!desc && !item) continue;
          const qty = qtyCol >= 0 ? toNum(row[qtyCol]) : 0;
          const cost = costCol >= 0 ? toNum(row[costCol]) : 0;
          if (!desc && !item && qty === 0 && cost === 0) continue;

          const unit = unitCol >= 0 ? String(row[unitCol] || '').trim() : '';

          preview.materials.push({
            item,
            description: desc,
            unit,
            qty,
            cost,
          });
        }
      }
    }

    return Response.json({ preview });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}