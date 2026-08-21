import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import * as XLSX from 'npm:xlsx@0.18.5';

/**
 * parseAFPUpload — fetches the AFP Excel file, parses all 4 sheets
 * deterministically using SheetJS, and returns a structured preview.
 *
 * Input:  { file_url: string }
 * Output: { preview: { contract_details, rates, drilling, plant_hire } }
 */

function toNum(val) {
  if (val == null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const cleaned = String(val).replace(/[^0-9.\-]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function toDateStr(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  if (typeof val === 'string') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return val;
  }
  return null;
}

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
      rates: [],
      drilling: [],
      plant_hire: [],
    };

    // ── Contract Value sheet ──
    const cvName = workbook.SheetNames.find(n => /contract\s*value/i.test(n));
    if (cvName) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[cvName], { header: 1, raw: true, defval: null, blankrows: false });
      const details = {};
      for (const row of rows) {
        const label = String(row[0] || '').toLowerCase().trim();
        const val = row[1];
        if (label.includes('date')) details.date = toDateStr(val);
        else if (label.includes('client purchase') || label.includes('purchase order')) details.client_purchase_order = String(val || '').trim();
        else if (label.includes('gc job number') || label.includes('gc job')) details.gc_job_number = String(val || '').trim();
        else if (label === 'client') details.client = String(val || '').trim();
        else if (label.includes('payment due')) details.payment_due_date = String(val || '').trim();
        else if (label.includes('contract award') || label.includes('contract value')) details.contract_award_value = toNum(val);
      }
      preview.contract_details = details;
    }

    // ── Rates sheet ──
    const ratesName = workbook.SheetNames.find(n => /rates/i.test(n) && !/drilling/i.test(n));
    if (ratesName) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[ratesName], { header: 1, raw: true, defval: null, blankrows: false });
      // Find header row with "Price" and "Per"
      const headerIdx = findHeaderRow(rows, ['price'], 0);
      if (headerIdx >= 0) {
        for (let r = headerIdx + 1; r < rows.length; r++) {
          const row = rows[r];
          if (!row) continue;
          const item = String(row[0] || '').trim();
          if (!item) continue;
          // Skip section headers like "Labour", "Plant", "Materials"
          if (['labour', 'plant', 'materials', 'mobilisation'].includes(item.toLowerCase()) && row[1] == null) continue;
          if (item.toLowerCase() === 'price' || item === '£') continue;

          const price = toNum(row[1]);
          const per = String(row[2] || '').trim();
          const men = toNum(row[3]);
          const notes = String(row[4] || '').trim();

          if (price > 0 || item.length > 3) {
            preview.rates.push({ item, price, per, men, notes });
          }
        }
      }
    }

    // ── Drilling sheet ──
    const drillName = workbook.SheetNames.find(n => /drilling/i.test(n));
    if (drillName) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[drillName], { header: 1, raw: true, defval: null, blankrows: false });
      // Find header row with "Item" and "Unit Price"
      const headerIdx = findHeaderRow(rows, ['item'], 0);
      if (headerIdx >= 0) {
        const headerRow = rows[headerIdx];
        // Find week commencing columns (columns with date values)
        const weekCols = [];
        for (let c = 0; c < headerRow.length; c++) {
          const val = headerRow[c];
          if (val instanceof Date || (typeof val === 'string' && /\d{4}-\d{2}-\d{2}/.test(val))) {
            weekCols.push({ col: c, date: toDateStr(val) });
          }
        }

        // Find column indices for item, unit price, qty, rate, amount
        let itemCol = -1, unitCol = -1, qtyCol = -1, rateCol = -1, amountCol = -1;
        for (let c = 0; c < headerRow.length; c++) {
          const l = String(headerRow[c] || '').toLowerCase().trim();
          if (l === 'item' && itemCol < 0) itemCol = c;
          else if (l.includes('unit price') || l === 'unit') unitCol = c;
          else if (l === 'qty') qtyCol = c;
          else if (l === 'rate') rateCol = c;
          else if (l === 'amount') amountCol = c;
        }

        for (let r = headerIdx + 1; r < rows.length; r++) {
          const row = rows[r];
          if (!row) continue;
          const item = itemCol >= 0 ? String(row[itemCol] || '').trim() : '';
          if (!item || item.toLowerCase() === 'item') continue;

          const unit = unitCol >= 0 ? String(row[unitCol] || '').trim() : '';
          const unitPrice = unitCol >= 0 ? toNum(row[unitCol]) : 0;
          const qty = qtyCol >= 0 ? toNum(row[qtyCol]) : 0;
          const rate = rateCol >= 0 ? toNum(row[rateCol]) : 0;
          const amount = amountCol >= 0 ? toNum(row[amountCol]) : qty * rate;

          if (item.length < 3 && amount === 0 && qty === 0) continue;

          // Build week breakdown
          const weekBreakdown = weekCols
            .filter(wc => row[wc.col] != null && toNum(row[wc.col]) !== 0)
            .map(wc => ({ week_date: wc.date, qty: toNum(row[wc.col]) }));

          preview.drilling.push({ item, unit, unit_price: unitPrice, qty, rate, amount, week_breakdown: weekBreakdown });
        }
      }
    }

    // ── Plant hire sheet ──
    const phName = workbook.SheetNames.find(n => /plant\s*hire/i.test(n));
    if (phName) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[phName], { header: 1, raw: true, defval: null, blankrows: false });
      const headerIdx = findHeaderRow(rows, ['item'], 0);
      if (headerIdx >= 0) {
        const headerRow = rows[headerIdx];
        let itemCol = -1, unitCol = -1, priceCol = -1, qtyCol = -1, totalCol = -1;
        for (let c = 0; c < headerRow.length; c++) {
          const l = String(headerRow[c] || '').toLowerCase().trim();
          if (l === 'item' && itemCol < 0) itemCol = c;
          else if (l.includes('unit price') || l === 'unit') unitCol = c;
          else if (l === 'qty') qtyCol = c;
          else if (l === 'total') totalCol = c;
        }
        // If no explicit price column, use the column after unit
        if (unitCol >= 0) priceCol = unitCol;

        for (let r = headerIdx + 1; r < rows.length; r++) {
          const row = rows[r];
          if (!row) continue;
          const item = itemCol >= 0 ? String(row[itemCol] || '').trim() : '';
          if (!item || item.toLowerCase() === 'item') continue;

          const unit = unitCol >= 0 ? String(row[unitCol] || '').trim() : '';
          const unitPrice = unitCol >= 0 ? toNum(row[unitCol]) : 0;
          const qty = qtyCol >= 0 ? toNum(row[qtyCol]) : 0;
          const total = totalCol >= 0 ? toNum(row[totalCol]) : unitPrice * qty;

          if (item.length < 3 && total === 0) continue;

          preview.plant_hire.push({ item, unit, unit_price: unitPrice, qty, total });
        }
      }
    }

    return Response.json({ preview });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}