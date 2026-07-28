import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import * as XLSX from 'npm:xlsx@0.18.5';

// Deterministic SheetJS parser for the "our_company" Master Price List.
// AI extraction (processRateCardUpload) truncates at ~40 items, so this reads
// every row positionally — mirroring processSORUpload's approach.
//
// Expected workbook tabs: Labour, Plant, Materials (case-insensitive).
// Column layouts (positional):
//   Labour:    [description, price, unit, #men, _, notes]
//   Plant:     [description, price, unit, notes]
//   Materials: [description, unit, size, price, ...]

const SHEETS = [
  { name: 'Labour', category: 'labour', desc: 0, price: 1, unit: 2, men: 3, size: -1, notes: 5 },
  { name: 'Plant', category: 'plant', desc: 0, price: 1, unit: 2, men: -1, size: -1, notes: 3 },
  { name: 'Materials', category: 'materials', desc: 0, price: 3, unit: 1, men: -1, size: 2, notes: -1 },
];

const isHeaderToken = (s) => {
  const l = String(s || '').toLowerCase().trim();
  return l === 'price' || l === '£' || l === 'item' || l === 'description' || l === 'item description' || l === 'per' || l === 'size' || l === '# men' || l === 'men';
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json();
    const fileUrl = body.file_url;
    if (!fileUrl) return Response.json({ error: 'file_url is required' }, { status: 400 });

    const fileRes = await fetch(fileUrl);
    if (!fileRes.ok) return Response.json({ error: 'Could not download rate card file' }, { status: 422 });
    const fileBuf = await fileRes.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(fileBuf), { type: 'array' });

    const payload = [];
    let sortOrder = 0;
    const perCategory = {};

    for (const cfg of SHEETS) {
      const actualName = workbook.SheetNames.find(n => n.toLowerCase().trim() === cfg.name.toLowerCase());
      if (!actualName) continue;

      const sheet = workbook.Sheets[actualName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null, blankrows: false });
      if (rows.length < 2) continue;

      let currentSubcategory = cfg.name;

      // Detect an optional "Cost" column from the header row (first row).
      // Looks for a header cell containing "cost" (case-insensitive) that
      // isn't the main price column. This lets users include an internal
      // cost column alongside the charge-out price in their Excel.
      let costColIdx = -1;
      if (rows.length > 0) {
        const headerRow = rows[0];
        for (let c = 0; c < headerRow.length; c++) {
          if (c === cfg.desc || c === cfg.price || c === cfg.unit) continue;
          const h = String(headerRow[c] || '').toLowerCase().trim();
          if (h.includes('cost') && h !== 'price') { costColIdx = c; break; }
        }
      }

      for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.length === 0) continue;

        const descVal = row[cfg.desc];
        const descStr = String(descVal || '').trim();
        if (!descStr) continue;
        if (isHeaderToken(descStr)) continue;
        if (descStr.toLowerCase() === cfg.name.toLowerCase()) continue;

        const priceVal = cfg.price >= 0 ? row[cfg.price] : null;
        const unitVal = cfg.unit >= 0 ? row[cfg.unit] : null;
        const menVal = cfg.men >= 0 ? row[cfg.men] : null;
        const sizeVal = cfg.size >= 0 ? row[cfg.size] : null;
        const costVal = costColIdx >= 0 ? row[costColIdx] : null;

        // Skip header rows where the price column is literally a header token
        if (priceVal != null && isHeaderToken(priceVal)) continue;

        const priceEmpty = priceVal == null || priceVal === '' || (typeof priceVal === 'string' && !priceVal.trim());
        const unitEmpty = unitVal == null || unitVal === '' || (typeof unitVal === 'string' && !unitVal.trim());
        const costEmpty = costVal == null || costVal === '' || (typeof costVal === 'string' && !costVal.trim());

        // Subcategory heading row: description present, no price, no unit
        if (priceEmpty && unitEmpty) {
          currentSubcategory = descStr;
          continue;
        }

        // Parse price (number or text like "POA")
        let priceNum = null;
        let priceText = null;
        if (!priceEmpty) {
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

        // Parse internal cost price (optional column)
        let costPriceNum = null;
        if (!costEmpty) {
          if (typeof costVal === 'number') {
            costPriceNum = costVal;
          } else {
            const parsed = parseFloat(String(costVal).replace(/[^0-9.\-]/g, ''));
            if (!isNaN(parsed) && /\d/.test(String(costVal))) costPriceNum = parsed;
          }
        }

        const item = {
          category: cfg.category,
          subcategory: currentSubcategory,
          description: descStr,
          price: priceNum,
          price_text: priceText,
          cost_price: costPriceNum,
          unit: unitVal ? String(unitVal).trim() : null,
          men: menVal != null && menVal !== '' ? Number(menVal) : null,
          size: sizeVal != null && sizeVal !== '' ? String(sizeVal).trim() : null,
          notes: cfg.notes >= 0 && row[cfg.notes] != null && row[cfg.notes] !== '' ? String(row[cfg.notes]).trim() : null,
          rate_card_source: 'our_company',
          supplier_id: null,
          sort_order: sortOrder++,
          is_active: true,
        };
        payload.push(item);
        perCategory[cfg.category] = (perCategory[cfg.category] || 0) + 1;
      }
    }

    if (payload.length === 0) {
      return Response.json({ error: 'No rate card line items could be read from this file' }, { status: 422 });
    }

    // Replace existing "our_company" rate card items (demo + previously uploaded)
    await base44.asServiceRole.entities.RateCardItem.deleteMany({ rate_card_source: 'our_company' });
    // Clear any legacy items with no source set (shown under "Our Rate Card" in the UI)
    const legacy = await base44.asServiceRole.entities.RateCardItem.filter({ rate_card_source: { $exists: false } }, null, 500);
    if (legacy && legacy.length) {
      await base44.asServiceRole.entities.RateCardItem.deleteMany({ id: { $in: legacy.map(i => i.id) } });
    }

    for (let i = 0; i < payload.length; i += 500) {
      await base44.asServiceRole.entities.RateCardItem.bulkCreate(payload.slice(i, i + 500));
    }

    return Response.json({
      status: 'success',
      ingested: payload.length,
      per_category: perCategory,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});