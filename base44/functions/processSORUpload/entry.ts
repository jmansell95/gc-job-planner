import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import * as XLSX from 'npm:xlsx@0.18.5';

const SOR_SHEETS = [
  'CP Standard',
  'CP Cutdown',
  'Rotary Drilling & Coring',
  'Sonic Drilling & Coring',
  'Dynamic Sampling',
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json();
    const fileUrl = body.file_url;
    const year = Number(body.year) || 2026;
    if (!fileUrl) return Response.json({ error: 'file_url is required' }, { status: 400 });

    // Fetch and parse the Excel file deterministically with SheetJS.
    // This reads every row — AI extraction was truncating at ~40 items.
    const fileRes = await fetch(fileUrl);
    if (!fileRes.ok) return Response.json({ error: 'Could not download SOR file' }, { status: 422 });
    const fileBuf = await fileRes.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(fileBuf), { type: 'array' });

    const payload = [];
    let sortOrder = 0;

    for (const sheetName of SOR_SHEETS) {
      // Match the workbook tab name (case-insensitive, partial)
      const actualName = workbook.SheetNames.find(n =>
        n.toLowerCase().includes(sheetName.toLowerCase().split(' ')[0])
      );
      if (!actualName) continue;

      const sheet = workbook.Sheets[actualName];
      // Read as array-of-arrays for predictable positional column access
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null, blankrows: false });
      if (rows.length < 2) continue;

      // --- Column detection ---
      // Standard SOR layout: col 0=section letter, col 1=item ref, col 2=description, col 3=unit, then price columns.
      // The 2026 price column has "2026" in one of the first 3 header rows.
      let yearColIdx = -1;
      const checkRange = Math.min(rows.length, 3);
      for (let r = 0; r < checkRange; r++) {
        for (let c = 0; c < (rows[r] || []).length; c++) {
          const val = rows[r][c];
          if (val === year || String(val).trim() === String(year)) {
            yearColIdx = c;
            break;
          }
        }
        if (yearColIdx !== -1) break;
      }

      // Fallback: if no 2026 column, use the "Rate" or "Tender" column from the header row
      const headerRow = rows[0] || [];
      let unitColIdx = -1, descColIdx = -1, itemRefColIdx = -1, sectionColIdx = -1;
      for (let c = 0; c < headerRow.length; c++) {
        const h = String(headerRow[c] || '').toLowerCase().trim();
        if (h.includes('item description') || h === 'description') descColIdx = c;
        if (h === 'unit') unitColIdx = c;
        if (h === 'item' && sectionColIdx === -1) sectionColIdx = c;
        else if ((h === 'item' || h.includes('item')) && c !== sectionColIdx && itemRefColIdx === -1 && !h.includes('description')) itemRefColIdx = c;
        if (yearColIdx === -1 && (h === 'rate' || h === 'tender')) yearColIdx = c;
      }
      // Default positional fallbacks
      if (descColIdx === -1) descColIdx = 2;
      if (unitColIdx === -1) unitColIdx = 3;
      if (sectionColIdx === -1) sectionColIdx = 0;
      if (itemRefColIdx === -1) itemRefColIdx = 1;
      if (yearColIdx === -1) yearColIdx = headerRow.length - 1; // last column

      // --- Parse data rows (skip header rows) ---
      let currentSection = null;
      let currentHeading = null;
      const dataStartRow = rows[0] && String(rows[0][descColIdx] || '').toLowerCase().includes('description') ? 1 : 0;

      for (let r = dataStartRow; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.length === 0) continue;

        const sectionVal = row[sectionColIdx];
        const itemRefVal = itemRefColIdx < row.length ? row[itemRefColIdx] : null;
        const descVal = descColIdx < row.length ? row[descColIdx] : null;
        const unitVal = unitColIdx < row.length ? row[unitColIdx] : null;
        const priceVal = yearColIdx < row.length ? row[yearColIdx] : null;

        const descStr = String(descVal || '').trim();
        const descLower = descStr.toLowerCase();

        // Skip completely empty rows
        if (!descStr && !sectionVal && !itemRefVal) continue;

        // Skip header rows that leaked past dataStartRow detection:
        // - Description column literally says "Item Description" / "Description"
        // - Price column equals the target year (the "2026" header marker)
        // - Description is just "Item" (column header for the section letter)
        if (descLower === 'item description' || descLower === 'description' || descLower === 'item') continue;
        if (priceVal === year || String(priceVal).trim() === String(year)) continue;

        // Section heading row: has a section letter and description but NO item ref and NO unit
        if (descStr && sectionVal != null && itemRefVal == null && unitVal == null) {
          currentSection = String(sectionVal).trim();
          currentHeading = descStr;
          continue;
        }

        // Item row: must have a description
        if (!descStr) continue;

        // Parse price
        let priceNum = null;
        let priceText = null;
        if (priceVal != null && priceVal !== '') {
          if (typeof priceVal === 'number') {
            priceNum = priceVal;
          } else {
            const parsed = parseFloat(String(priceVal).replace(/[^0-9.\-]/g, ''));
            if (!isNaN(parsed) && /\d/.test(String(priceVal))) {
              priceNum = parsed;
            } else {
              priceText = String(priceVal).trim();
            }
          }
        }

        payload.push({
          sheet_name: sheetName,
          section: currentSection || (sectionVal ? String(sectionVal).trim() : null),
          section_heading: currentHeading,
          item_ref: itemRefVal != null ? String(itemRefVal).trim() : null,
          description: descStr,
          unit: unitVal ? String(unitVal).trim() : null,
          price: priceNum,
          price_text: priceText,
          year,
          sort_order: sortOrder++,
          is_active: true,
        });
      }
    }

    if (payload.length === 0) {
      return Response.json({ error: 'No SOR line items could be read from this file' }, { status: 422 });
    }

    // Replace existing SOR items for this year
    await base44.asServiceRole.entities.InvestigationSOR.deleteMany({ year });
    await base44.asServiceRole.entities.InvestigationSOR.bulkCreate(payload);

    const perSheet = {};
    for (const p of payload) {
      perSheet[p.sheet_name] = (perSheet[p.sheet_name] || 0) + 1;
    }

    return Response.json({
      status: 'success',
      year,
      ingested: payload.length,
      per_sheet: perSheet,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});