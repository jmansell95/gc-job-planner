import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import * as XLSX from 'npm:xlsx@0.18.5';

// Deterministic SheetJS parser for a project-scoped rate card workbook (e.g. the
// East West Rail "Application for Payment" file). Ingests RateCardItem records
// tagged with the target project_id, so any job linked to that project bills
// against these rates in preference to the global Master Price List.
//
// AI extraction (ExtractDataFromUploadedFile) truncates large workbooks, so this
// reads every row positionally — mirroring processMasterPriceListUpload.
//
// Sheets parsed:
//   "2026 Rates"            — schedule of rates (labour / plant / materials)
//   "Rotary Drilling"       — itemised rotary SOR (section, item ref, rate)
//   "CP Drilling."          — itemised CP SOR (section, item ref, rate)
//   "Hires"                 — plant hire weekly/day rates
//   "Misc"                  — miscellaneous chargeable items
// Transactional sheets (Dayworks, Enabling Crew, Accommodation, Mileage, Summary)
// are actual logged activity / bookings, not rates — skipped intentionally.

const CATEGORY_BY_KEYWORD = { labour: 'labour', plant: 'plant', materials: 'materials' };

function parsePrice(val) {
  if (val == null || val === '') return { priceNum: null, priceText: null };
  if (typeof val === 'number') return { priceNum: val, priceText: null };
  const s = String(val).trim();
  if (!s) return { priceNum: null, priceText: null };
  const parsed = parseFloat(s.replace(/[^0-9.\-]/g, ''));
  if (!isNaN(parsed) && /\d/.test(s)) return { priceNum: parsed, priceText: null };
  return { priceNum: null, priceText: s };
}

function isHeaderToken(s) {
  const l = String(s || '').toLowerCase().trim();
  return l === 'price' || l === '£' || l === 'per' || l === '# men' || l === 'item' ||
    l === 'description' || l === 'item description';
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json();
    const { file_url, project_id } = body;
    if (!file_url || !project_id) {
      return Response.json({ error: 'file_url and project_id are required' }, { status: 400 });
    }

    // Verify the project exists
    const project = await base44.asServiceRole.entities.Project.get(project_id);
    if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });

    const fileRes = await fetch(file_url);
    if (!fileRes.ok) return Response.json({ error: 'Could not download rate card file' }, { status: 422 });
    const fileBuf = await fileRes.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(fileBuf), { type: 'array' });

    const payload = [];
    let sortOrder = 0;

    // --- "2026 Rates" sheet (schedule of rates) ---
    const ratesName = workbook.SheetNames.find((n) => /2026\s*rates/i.test(n));
    if (ratesName) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[ratesName], { header: 1, raw: true, defval: null, blankrows: false });
      let currentCategory = 'labour';
      let currentSubcategory = 'Labour';
      for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.length === 0) continue;
        const descStr = String(row[0] || '').trim();
        if (!descStr) continue;
        const lower = descStr.toLowerCase();
        if (/phenna group|schedule of rates|effective/i.test(lower)) continue;
        if (isHeaderToken(descStr)) continue;
        if (CATEGORY_BY_KEYWORD[lower]) {
          currentCategory = CATEGORY_BY_KEYWORD[lower];
          currentSubcategory = descStr;
          continue;
        }
        const priceVal = row[1];
        const unitVal = row[2];
        const menVal = row[3];
        const notesVal = row[5];
        const priceEmpty = priceVal == null || priceVal === '' || (typeof priceVal === 'string' && !priceVal.trim());
        const unitEmpty = unitVal == null || unitVal === '' || (typeof unitVal === 'string' && !unitVal.trim());
        if (priceEmpty && unitEmpty) {
          currentSubcategory = descStr;
          continue;
        }
        const { priceNum, priceText } = parsePrice(priceVal);
        payload.push({
          category: currentCategory,
          subcategory: currentSubcategory,
          description: descStr,
          price: priceNum,
          price_text: priceText,
          unit: unitVal ? String(unitVal).trim() : null,
          men: menVal != null && menVal !== '' ? Number(menVal) : null,
          size: null,
          notes: notesVal != null && notesVal !== '' ? String(notesVal).trim() : null,
          rate_card_source: 'our_company',
          supplier_id: null,
          project_id,
          sort_order: sortOrder++,
          is_active: true,
        });
      }
    }

    // --- Rotary Drilling & CP Drilling SOR sheets ---
    for (const sheetName of workbook.SheetNames) {
      if (!/^(rotary drilling|cp drilling)/i.test(sheetName.trim())) continue;
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: true, defval: null, blankrows: false });
      const label = /rotary/i.test(sheetName) ? 'Rotary Drilling' : 'CP Drilling';
      let currentSubcategory = `${label} SOR`;
      for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.length === 0) continue;
        const sectionLetter = row[0];
        const itemRef = row[1];
        const descStr = String(row[2] || '').trim();
        const unitVal = row[3];
        const rateVal = row[4];
        if (!descStr) continue;
        if (/^item description$/i.test(descStr)) continue;
        const rateEmpty = rateVal == null || rateVal === '' || (typeof rateVal === 'string' && !rateVal.trim());
        if (rateEmpty) {
          const letter = String(sectionLetter || '').trim();
          if (/^[A-Z]$/i.test(letter)) {
            currentSubcategory = `${label} — Section ${letter} — ${descStr}`;
          } else if (/general items|provisional/i.test(descStr.toLowerCase())) {
            currentSubcategory = `${label} — ${descStr}`;
          }
          continue;
        }
        const { priceNum, priceText } = parsePrice(rateVal);
        const refStr = itemRef != null && itemRef !== '' ? String(itemRef).trim() : '';
        payload.push({
          category: 'labour',
          subcategory: currentSubcategory,
          description: refStr ? `${refStr} — ${descStr}` : descStr,
          price: priceNum,
          price_text: priceText,
          unit: unitVal ? String(unitVal).trim() : null,
          men: null,
          size: null,
          notes: null,
          rate_card_source: 'our_company',
          supplier_id: null,
          project_id,
          sort_order: sortOrder++,
          is_active: true,
        });
      }
    }

    // --- Hires sheet (plant hire rates) ---
    const hiresName = workbook.SheetNames.find((n) => /^hires$/i.test(n.trim()));
    if (hiresName) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[hiresName], { header: 1, raw: true, defval: null, blankrows: false });
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row) continue;
        const descStr = String(row[1] || '').trim();
        if (!descStr || /resource name/i.test(descStr)) continue;
        const rateVal = row[3];
        if (rateVal == null || rateVal === '') continue;
        const unitVal = row[2];
        const { priceNum, priceText } = parsePrice(rateVal);
        payload.push({
          category: 'plant',
          subcategory: 'EWR Hires',
          description: descStr,
          price: priceNum,
          price_text: priceText,
          unit: unitVal ? String(unitVal).trim() : null,
          men: null, size: null, notes: null,
          rate_card_source: 'our_company', supplier_id: null, project_id,
          sort_order: sortOrder++, is_active: true,
        });
      }
    }

    // --- Misc sheet (miscellaneous chargeable items) ---
    const miscName = workbook.SheetNames.find((n) => /^misc$/i.test(n.trim()));
    if (miscName) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[miscName], { header: 1, raw: true, defval: null, blankrows: false });
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row) continue;
        const descStr = String(row[1] || '').trim();
        if (!descStr || /resource name/i.test(descStr)) continue;
        const rateVal = row[3];
        if (rateVal == null || rateVal === '') continue;
        const unitVal = row[2];
        const { priceNum, priceText } = parsePrice(rateVal);
        payload.push({
          category: 'materials',
          subcategory: 'EWR Misc',
          description: descStr,
          price: priceNum,
          price_text: priceText,
          unit: unitVal ? String(unitVal).trim() : null,
          men: null, size: null, notes: null,
          rate_card_source: 'our_company', supplier_id: null, project_id,
          sort_order: sortOrder++, is_active: true,
        });
      }
    }

    if (payload.length === 0) {
      return Response.json({ error: 'No rate card items could be read from this file' }, { status: 422 });
    }

    // Idempotent re-upload: replace existing project-scoped items
    await base44.asServiceRole.entities.RateCardItem.deleteMany({ project_id });

    for (let i = 0; i < payload.length; i += 500) {
      await base44.asServiceRole.entities.RateCardItem.bulkCreate(payload.slice(i, i + 500));
    }

    return Response.json({
      status: 'success',
      ingested: payload.length,
      project: project.name,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}