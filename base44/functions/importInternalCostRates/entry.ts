import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import * as XLSX from 'npm:xlsx@0.18.5';
import { normalizeName, nameKey } from '../../shared/spreadsheetParser.ts';
import { fuzzyFindStaff } from '../../shared/entityRegistry.ts';

// ---------------------------------------------------------------------------
// Internal Cost Rate Card Import
// ---------------------------------------------------------------------------
// Parses the "Internalstaffchargecost-nomargins.xlsx" file and creates
// RateCardItem records under a dedicated "Internal Costs" supplier tab.
//
// The file has two sheets:
//   1. "DE roles (No Margin)" — role names with day rates and hourly rates
//   2. "Staff List" — staff names mapped to their roles
//
// Creates:
//   • One RateCardItem per role (category=labour, cost_price=day rate, price=null)
//   • One RateCardItem per staff member (staff_id set, cost_price=matched role's day rate)
//
// All records go into a Supplier named "Internal Costs" so they appear as a
// separate tab in the Rate Card Manager, keeping internal cost data isolated
// from client-facing chargeable rates.
// ---------------------------------------------------------------------------

const INTERNAL_COSTS_SUPPLIER_NAME = 'Internal Costs';
const INTERNAL_COSTS_SUBCATEGORY = 'Internal Crew Costs';

// Map staff-list role labels to DE-roles-sheet role names.
// The Staff List uses specific labels ("Lead CP Driller", "Lead Rotary Driller")
// while the DE roles sheet uses combined labels ("Lead CP or Rotary Driller").
const ROLE_ALIASES: Record<string, string> = {
  'lead cp driller': 'Lead CP or Rotary Driller',
  'lead rotary driller': 'Lead CP or Rotary Driller',
  'cp driller': 'Lead CP or Rotary Driller',
  'rotary driller': 'Lead CP or Rotary Driller',
  'driller': 'Lead CP or Rotary Driller',
};

function findRoleKey(roleLabel: string): string {
  if (!roleLabel) return '';
  const lower = normalizeName(roleLabel).toLowerCase();
  if (ROLE_ALIASES[lower]) return ROLE_ALIASES[lower];
  // Try partial match — "CP" in the role → Lead CP or Rotary Driller
  if (lower.includes('cp') || lower.includes('rotary') || lower.includes('driller')) {
    return 'Lead CP or Rotary Driller';
  }
  return roleLabel.trim();
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    // Accept multipart form upload (preferred) or JSON with file_url
    let arrayBuffer: ArrayBuffer;
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const filePart = formData.get('file');
      if (!filePart) return Response.json({ error: 'A spreadsheet file is required.' }, { status: 400 });
      arrayBuffer = await (filePart as File).arrayBuffer();
    } else {
      const body = await req.json();
      if (!body.file_url) return Response.json({ error: 'file_url is required' }, { status: 400 });
      const fileRes = await fetch(body.file_url);
      if (!fileRes.ok) return Response.json({ error: 'Could not download the uploaded file' }, { status: 422 });
      arrayBuffer = await fileRes.arrayBuffer();
    }

    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });

    // ── Parse "DE roles (No Margin)" sheet ──
    const rolesSheetName = workbook.SheetNames.find(n => n.toLowerCase().includes('de roles') || n.toLowerCase().includes('no margin'));
    if (!rolesSheetName) return Response.json({ error: 'Could not find the "DE roles" sheet in this file.' }, { status: 422 });
    const rolesRows = XLSX.utils.sheet_to_json(workbook.Sheets[rolesSheetName], { header: 1, raw: true, defval: null });

    // Structure: Row 0-1 are headers, Row 2+ has role data
    // col_0 = role name, col_1 = day rate, col_2 = hourly rate
    const roleRates: Record<string, { day_rate: number; hourly_rate: number }> = {};
    for (let i = 2; i < rolesRows.length; i++) {
      const row = rolesRows[i];
      if (!row) continue;
      const roleName = row[0] ? String(row[0]).trim() : '';
      const dayRate = row[1] != null ? Number(row[1]) : null;
      const hourlyRate = row[2] != null ? Number(row[2]) : null;
      if (!roleName || dayRate == null || isNaN(dayRate)) continue;
      roleRates[roleName] = { day_rate: dayRate, hourly_rate: hourlyRate || (dayRate / 8) };
    }

    if (Object.keys(roleRates).length === 0) {
      return Response.json({ error: 'No role rates found in the "DE roles" sheet.' }, { status: 422 });
    }

    // ── Parse "Staff List" sheet ──
    const staffSheetName = workbook.SheetNames.find(n => n.toLowerCase().includes('staff list') || n.toLowerCase().includes('staff'));
    let staffList: { name: string; role: string }[] = [];
    if (staffSheetName) {
      const staffRows = XLSX.utils.sheet_to_json(workbook.Sheets[staffSheetName], { header: 1, raw: true, defval: null });
      // Find the header row (has "Names" and "Role")
      let headerIdx = -1;
      for (let i = 0; i < Math.min(staffRows.length, 5); i++) {
        const row = staffRows[i];
        if (!row) continue;
        const cells = row.map(c => String(c || '').toLowerCase());
        if (cells.some(c => c.includes('name')) && cells.some(c => c.includes('role'))) {
          headerIdx = i;
          break;
        }
      }
      const startIdx = headerIdx >= 0 ? headerIdx + 1 : 1;
      for (let i = startIdx; i < staffRows.length; i++) {
        const row = staffRows[i];
        if (!row) continue;
        // Find the name and role columns — they're in col_2 and col_3 based on the sample
        let name = '', role = '';
        for (let c = 0; c < (row.length || 0); c++) {
          const val = row[c] ? String(row[c]).trim() : '';
          if (!val) continue;
          if (!name && val.length > 2 && !val.toLowerCase().includes('name') && !val.toLowerCase().includes('role')) {
            name = val;
          } else if (!role && !val.toLowerCase().includes('name') && !val.toLowerCase().includes('role')) {
            role = val;
          }
        }
        if (name && role) staffList.push({ name, role });
      }
    }

    // ── Create or find the "Internal Costs" supplier ──
    const existingSuppliers = await base44.asServiceRole.entities.Supplier.list('-created_date', 500);
    let internalCostsSupplier = existingSuppliers.find(s => s.name === INTERNAL_COSTS_SUPPLIER_NAME);
    if (!internalCostsSupplier) {
      internalCostsSupplier = await base44.asServiceRole.entities.Supplier.create({
        name: INTERNAL_COSTS_SUPPLIER_NAME,
        notes: 'Internal crew cost rates — cost-only, no client charge-out. Used for margin calculations.',
      });
    }

    // ── Delete existing internal cost rate items (clean slate) ──
    const existingCostItems = await base44.asServiceRole.entities.RateCardItem.list('-created_date', 500);
    const internalCostItems = existingCostItems.filter(i => i.supplier_id === internalCostsSupplier.id);
    if (internalCostItems.length > 0) {
      await base44.asServiceRole.entities.RateCardItem.deleteMany({ supplier_id: internalCostsSupplier.id });
    }

    // ── Create role-level RateCardItem records ──
    const rolePayloads = Object.entries(roleRates).map(([roleName, rates]) => ({
      category: 'labour',
      subcategory: INTERNAL_COSTS_SUBCATEGORY,
      description: roleName,
      price: null, // No charge-out — cost-only rate card
      cost_price: rates.day_rate,
      unit: 'day',
      men: 1,
      rate_card_source: 'supplier' as const,
      supplier_id: internalCostsSupplier.id,
      notes: `Internal cost — ${rates.hourly_rate}/hr. Rates inclusive of PPE, Bonus, Vehicle and fuel.`,
      is_active: true,
    }));

    let createdRoleItems: any[] = [];
    if (rolePayloads.length > 0) {
      createdRoleItems = await base44.asServiceRole.entities.RateCardItem.bulkCreate(rolePayloads);
    }

    // ── Create staff-level RateCardItem records (personal rate cards) ──
    // Match each staff member to their role's day rate, then create a personal
    // rate card entry with staff_id set so the auto-financials engine can match
    // logged activities to the staff member's own cost rate.
    const allStaff = await base44.asServiceRole.entities.Staff.list('-created_date', 5000);
    const staffPayloads: any[] = [];
    const staffMatchResults: any[] = [];

    for (const sl of staffList) {
      const matchedStaff = fuzzyFindStaff(sl.name, allStaff, 0.70);
      const roleKey = findRoleKey(sl.role);
      const rates = roleRates[roleKey] || roleRates[sl.role.trim()];

      if (!rates) {
        staffMatchResults.push({ name: sl.name, role: sl.role, status: 'no_rate', note: `Role "${sl.role}" not found in DE roles sheet` });
        continue;
      }

      if (!matchedStaff) {
        staffMatchResults.push({ name: sl.name, role: sl.role, status: 'no_staff', note: 'Staff member not found in Staff Command' });
        continue;
      }

      staffPayloads.push({
        category: 'labour',
        subcategory: INTERNAL_COSTS_SUBCATEGORY,
        description: `${matchedStaff.staff.name} — ${sl.role}`,
        price: null,
        cost_price: rates.day_rate,
        unit: 'day',
        men: 1,
        rate_card_source: 'supplier',
        supplier_id: internalCostsSupplier.id,
        staff_id: matchedStaff.staff.id,
        notes: `Personal cost rate for ${matchedStaff.staff.name} (${sl.role}). Day rate: ${rates.day_rate}, hourly: ${rates.hourly_rate}.`,
        is_active: true,
      });
      staffMatchResults.push({ name: sl.name, role: sl.role, status: 'matched', staff_id: matchedStaff.staff.id, day_rate: rates.day_rate });
    }

    let createdStaffItems: any[] = [];
    if (staffPayloads.length > 0) {
      for (let i = 0; i < staffPayloads.length; i += 400) {
        const batch = staffPayloads.slice(i, i + 400);
        const created = await base44.asServiceRole.entities.RateCardItem.bulkCreate(batch);
        createdStaffItems = createdStaffItems.concat(created);
      }
    }

    return Response.json({
      status: 'success',
      summary: {
        supplier_id: internalCostsSupplier.id,
        supplier_name: INTERNAL_COSTS_SUPPLIER_NAME,
        roles_found: Object.keys(roleRates).length,
        staff_in_list: staffList.length,
        role_items_created: createdRoleItems.length,
        staff_items_created: createdStaffItems.length,
        staff_matched: staffMatchResults.filter(r => r.status === 'matched').length,
        staff_not_found: staffMatchResults.filter(r => r.status === 'no_staff').length,
        roles_not_matched: staffMatchResults.filter(r => r.status === 'no_rate').length,
      },
      role_rates: Object.entries(roleRates).map(([name, r]) => ({ role: name, day_rate: r.day_rate, hourly_rate: r.hourly_rate })),
      staff_match_results: staffMatchResults,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}