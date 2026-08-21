import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import * as XLSX from 'npm:xlsx@0.18.5';

/**
 * parseCVRUpload — fetches the CVR Excel file, parses all 5 sheets
 * deterministically using SheetJS, and returns a structured preview.
 *
 * Input:  { file_url: string }
 * Output: { preview: { financial_summary, project_plan, line_items, variation_orders, cash_flow } }
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

// Find a row index by scanning for a cell that matches a keyword
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

// Build a column index map from a header row
function mapColumns(headerRow, mappings) {
  const map = {};
  for (const [key, keywords] of Object.entries(mappings)) {
    for (let c = 0; c < headerRow.length; c++) {
      const l = String(headerRow[c] || '').toLowerCase().trim();
      if (keywords.some(kw => l === kw || l.includes(kw))) {
        map[key] = c;
        break;
      }
    }
    if (map[key] === undefined) map[key] = -1;
  }
  return map;
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
    if (!fileRes.ok) return Response.json({ error: 'Could not download CVR file' }, { status: 422 });
    const fileBuf = await fileRes.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(fileBuf), { type: 'array' });

    const preview = {
      financial_summary: {},
      project_plan: {},
      line_items: [],
      variation_orders: [],
      cash_flow: [],
    };

    // ── Financial Summary sheet ──
    const fsName = workbook.SheetNames.find(n => /financial\s*summary/i.test(n));
    if (fsName) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[fsName], { header: 1, raw: true, defval: null, blankrows: false });
      const summary = {};
      for (const row of rows) {
        const label = String(row[0] || '').toLowerCase().trim();
        const val = row[2];
        if (label.includes('contract value')) summary.contract_value = toNum(val);
        else if (label.includes('variation')) summary.variations = toNum(val);
        else if (label.includes('budget')) summary.budget = toNum(val);
        else if (label.includes('forecast')) summary.forecast_final_value = toNum(val);
        else if (label.includes('date updated')) summary.date_updated = toDateStr(val);
      }
      preview.financial_summary = summary;
    }

    // ── Project Plan sheet ──
    const ppName = workbook.SheetNames.find(n => /project\s*plan/i.test(n));
    if (ppName) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[ppName], { header: 1, raw: true, defval: null, blankrows: false });
      const plan = {};
      for (const row of rows) {
        const label = String(row[0] || '').toLowerCase().trim();
        if (label.includes('project start')) {
          // Find first non-null date in the row
          for (let c = 1; c < row.length; c++) {
            if (row[c]) { plan.project_start = toDateStr(row[c]); break; }
          }
        } else if (label.includes('project end')) {
          for (let c = 1; c < row.length; c++) {
            if (row[c]) { plan.project_end = toDateStr(row[c]); break; }
          }
        } else if (label.includes('weeks in progress')) {
          plan.weeks_in_progress = toNum(row[1]);
        }
      }
      preview.project_plan = plan;
    }

    // ── CVR sheet (main cost/value report) ──
    const cvrName = workbook.SheetNames.find(n => n === 'CVR' || /cost.*value.*report/i.test(n));
    if (cvrName) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[cvrName], { header: 1, raw: true, defval: null, blankrows: false });
      // Find header row containing "Description" and "Tender Value"
      const headerIdx = findHeaderRow(rows, ['description'], 0);
      if (headerIdx >= 0) {
        const headerRow = rows[headerIdx];
        const col = mapColumns(headerRow, {
          description: ['description'],
          supplier: ['supplier'],
          tender_value: ['tender value'],
          forecast_final_value: ['forecast final value'],
          total_order: ['total order'],
          invoiced_costs: ['invoiced cost'],
          committed_costs: ['committed cost'],
          orders_not_placed: ['orders not placed'],
          defects_contingency: ['defects', 'contingency'],
          total_cost: ['total cost'],
          profit_loss: ['profit/loss', 'profit / loss', 'p&l', 'p / l'],
          profit_pct: ['%'],
          comments: ['comments'],
          pct_on_site: ['% on site', '% on'],
          costs_to_date: ['costs to date'],
          value_to_date: ['value to date', 'value of production'],
          pl_to_date: ['p&l to date', 'p / l to date'],
        });

        // Find VO columns (VO.1 through VO.10)
        const voCols = [];
        for (let c = 0; c < headerRow.length; c++) {
          const l = String(headerRow[c] || '').toLowerCase().trim();
          if (/^vo\.\d+$/.test(l) || /^vo\d+$/.test(l)) {
            voCols.push({ col: c, label: String(headerRow[c]).trim() });
          }
        }

        // Extract data rows (skip header and any empty/section rows)
        for (let r = headerIdx + 1; r < rows.length; r++) {
          const row = rows[r];
          if (!row) continue;
          const desc = row[col.description] != null ? String(row[col.description]).trim() : '';
          if (!desc || desc.toLowerCase() === 'description') continue;

          // Skip total/summary rows
          if (desc.toLowerCase().includes('total') && !desc.toLowerCase().includes('total cost')) continue;

          const voValues = voCols
            .filter(vc => row[vc.col] != null && toNum(row[vc.col]) !== 0)
            .map(vc => ({ vo_number: vc.label, value: toNum(row[vc.col]) }));

          preview.line_items.push({
            description: desc,
            supplier: col.supplier >= 0 ? String(row[col.supplier] || '').trim() : '',
            tender_value: col.tender_value >= 0 ? toNum(row[col.tender_value]) : 0,
            vo_values: voValues,
            forecast_final_value: col.forecast_final_value >= 0 ? toNum(row[col.forecast_final_value]) : 0,
            total_order: col.total_order >= 0 ? toNum(row[col.total_order]) : 0,
            invoiced_costs: col.invoiced_costs >= 0 ? toNum(row[col.invoiced_costs]) : 0,
            committed_costs: col.committed_costs >= 0 ? toNum(row[col.committed_costs]) : 0,
            orders_not_placed: col.orders_not_placed >= 0 ? toNum(row[col.orders_not_placed]) : 0,
            defects_contingency: col.defects_contingency >= 0 ? toNum(row[col.defects_contingency]) : 0,
            total_cost: col.total_cost >= 0 ? toNum(row[col.total_cost]) : 0,
            profit_loss: col.profit_loss >= 0 ? toNum(row[col.profit_loss]) : 0,
            profit_pct: col.profit_pct >= 0 ? toNum(row[col.profit_pct]) : 0,
            comments: col.comments >= 0 ? String(row[col.comments] || '').trim() : '',
            pct_on_site: col.pct_on_site >= 0 ? toNum(row[col.pct_on_site]) : 0,
            costs_to_date: col.costs_to_date >= 0 ? toNum(row[col.costs_to_date]) : 0,
            value_to_date: col.value_to_date >= 0 ? toNum(row[col.value_to_date]) : 0,
            pl_to_date: col.pl_to_date >= 0 ? toNum(row[col.pl_to_date]) : 0,
          });
        }
      }
    }

    // ── VO Account sheet ──
    const voName = workbook.SheetNames.find(n => /vo\s*account/i.test(n));
    if (voName) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[voName], { header: 1, raw: true, defval: null, blankrows: false });
      const headerIdx = findHeaderRow(rows, ['vo no', 'vo no.'], 0);
      if (headerIdx >= 0) {
        const headerRow = rows[headerIdx];
        const col = mapColumns(headerRow, {
          vo_number: ['vo no', 'vo no.'],
          description: ['description'],
          agreed: ['agreed'],
          firm: ['firm'],
          budget: ['budget'],
          prelim_cost: ['prelim'],
          labour_cost: ['labour'],
          plant_cost: ['plant'],
          material_cost: ['material'],
          nursery_cost: ['nursery'],
          maintenance_cost: ['maintenance'],
          total_cost: ['total cost'],
          profit_margin: ['profit margin'],
          profit_margin_pct: ['profit margin %'],
        });

        for (let r = headerIdx + 1; r < rows.length; r++) {
          const row = rows[r];
          if (!row) continue;
          const voNum = col.vo_number >= 0 ? toNum(row[col.vo_number]) : 0;
          if (!voNum) continue;
          const desc = col.description >= 0 ? String(row[col.description] || '').trim() : '';
          if (!desc) continue;

          preview.variation_orders.push({
            vo_number: voNum,
            description: desc,
            agreed_value: col.agreed >= 0 ? toNum(row[col.agreed]) : 0,
            firm: col.firm >= 0 ? toNum(row[col.firm]) : 0,
            budget: col.budget >= 0 ? toNum(row[col.budget]) : 0,
            prelim_cost: col.prelim_cost >= 0 ? toNum(row[col.prelim_cost]) : 0,
            labour_cost: col.labour_cost >= 0 ? toNum(row[col.labour_cost]) : 0,
            plant_cost: col.plant_cost >= 0 ? toNum(row[col.plant_cost]) : 0,
            material_cost: col.material_cost >= 0 ? toNum(row[col.material_cost]) : 0,
            nursery_cost: col.nursery_cost >= 0 ? toNum(row[col.nursery_cost]) : 0,
            maintenance_cost: col.maintenance_cost >= 0 ? toNum(row[col.maintenance_cost]) : 0,
            total_cost: col.total_cost >= 0 ? toNum(row[col.total_cost]) : 0,
            profit_margin: col.profit_margin >= 0 ? toNum(row[col.profit_margin]) : 0,
            profit_margin_pct: col.profit_margin_pct >= 0 ? toNum(row[col.profit_margin_pct]) : 0,
          });
        }
      }
    }

    // ── Cash flow sheet ──
    const cfName = workbook.SheetNames.find(n => /cash\s*flow/i.test(n));
    if (cfName) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[cfName], { header: 1, raw: true, defval: null, blankrows: false });
      // Find the header row with "Item" and month dates
      const headerIdx = findHeaderRow(rows, ['item'], 0);
      if (headerIdx >= 0) {
        const headerRow = rows[headerIdx];
        // Find month date columns (columns with date values)
        const monthCols = [];
        for (let c = 0; c < headerRow.length; c++) {
          const val = headerRow[c];
          if (val instanceof Date || (typeof val === 'string' && /\d{4}-\d{2}-\d{2}/.test(val))) {
            monthCols.push({ col: c, date: toDateStr(val) });
          }
        }

        // Extract data rows
        for (let r = headerIdx + 1; r < rows.length; r++) {
          const row = rows[r];
          if (!row) continue;
          const item = String(row[0] || '').trim();
          const desc = String(row[1] || '').trim();
          if (!item && !desc) continue;

          // For each month column, create a cash flow entry
          for (const mc of monthCols) {
            const val = row[mc.col];
            if (val != null && toNum(val) !== 0) {
              preview.cash_flow.push({
                month_date: mc.date,
                description: item || desc,
                app_value: toNum(val),
                qty: 0,
                unit: '',
                rate: 0,
                amount: toNum(val),
              });
            }
          }

          // Also capture the total column if present
          const totalCol = headerRow.findIndex(h => String(h || '').toLowerCase().trim() === 'total');
          if (totalCol >= 0 && row[totalCol] != null) {
            // Skip — the total is already captured via month columns
          }
        }
      }
    }

    return Response.json({ preview });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}