import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import * as XLSX from 'npm:xlsx@0.18.5';

// ============================================================
// importEWRApplicationData — ingests crew + accommodation data
// from the EWR "Application for Payment" workbook into a job.
// ============================================================
// Parses the "Enabling Crew" and "Accommodation" sheets:
//   • Creates Staff records for any crew member not already in the
//     system (assigned to the Enabling Works Team).
//   • Creates RotaAssignment records (one per person per working day,
//     Mon–Fri) for each crew row, linked to the target job.
//   • Creates HotelBooking records for each accommodation row.
//
// The "2026 Rates", "Rotary Drilling", "CP Drilling" sheets are
// handled by processEWRRateCardUpload (project-scoped rate card).

const ENABLING_TEAM_ID = '6a6855afa65c3c800579e536';
const IMPORT_TAG = 'EWR-AFP-Import';

function parseExcelDate(val) {
  if (val == null || val === '') return null;
  if (val instanceof Date) return val;
  if (typeof val === 'number') {
    // Excel serial date (days since 1899-12-30)
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(val * 86400000));
    return d;
  }
  const s = String(val).trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

function getWeekStart(d) {
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() + diff);
  return monday.toISOString().slice(0, 10);
}

function splitNames(s) {
  return String(s || '')
    .split(/[,/&]|\band\b/)
    .map(n => n.trim())
    .filter(n => n.length > 1);
}

function emailFromName(name) {
  const clean = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');
  return `${clean}@ewr-contractors.co.uk`;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json();
    const { file_url, job_id } = body;
    if (!file_url || !job_id) {
      return Response.json({ error: 'file_url and job_id are required' }, { status: 400 });
    }

    const job = await base44.asServiceRole.entities.Job.get(job_id);
    if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });

    const fileRes = await fetch(file_url);
    if (!fileRes.ok) return Response.json({ error: 'Could not download file' }, { status: 422 });
    const fileBuf = await fileRes.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(fileBuf), { type: 'array' });

    const allNames = new Set();
    const crewRows = [];
    const hotelRows = [];
    const debug = { crew_raw_rows: 0, accom_raw_rows: 0 };

    // --- Enabling Crew sheet ---
    const crewSheetName = workbook.SheetNames.find(n => /enabling\s*crew/i.test(n));
    if (crewSheetName) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[crewSheetName], { header: 1, raw: true, defval: null, blankrows: false });
      debug.crew_raw_rows = rows.length;
      let lastStart = null, lastEnd = null;
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row) continue;
        const resourceNames = String(row[1] || '').trim();
        if (!resourceNames || /resource name/i.test(resourceNames)) continue;
        const rate = Number(row[5]) || 0;
        const qty = Number(row[6]) || 0;
        const netTotal = Number(row[7]) || 0;
        // Dates may be in merged cells — carry forward last valid dates
        const start = parseExcelDate(row[2]) || lastStart;
        const end = parseExcelDate(row[3]) || lastEnd;
        if (!start || !end) continue;
        lastStart = start;
        lastEnd = end;
        const names = splitNames(resourceNames);
        names.forEach(n => allNames.add(n));
        crewRows.push({ names, start, end, rate, qty, netTotal });
      }
    }

    // --- Accommodation sheet ---
    const accomSheetName = workbook.SheetNames.find(n => /accommodation/i.test(n));
    if (accomSheetName) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[accomSheetName], { header: 1, raw: true, defval: null, blankrows: false });
      debug.accom_raw_rows = rows.length;
      let lastStart = null, lastEnd = null;
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row) continue;
        const name = String(row[1] || '').trim();
        if (!name || /resource name/i.test(name)) continue;
        const start = parseExcelDate(row[2]) || lastStart;
        const end = parseExcelDate(row[3]) || lastEnd;
        if (start) lastStart = start;
        if (end) lastEnd = end;
        const bookingRef = row[4] != null && String(row[4]).trim() !== '' ? String(row[4]).trim() : null;
        const rate = Number(row[5]) || 0;
        const nights = Number(row[6]) || 0;
        const netTotal = Number(row[7]) || 0;
        if (!start || !end) continue;
        allNames.add(name);
        hotelRows.push({ name, start, end, bookingRef, rate, nights, netTotal });
      }
    }

    // --- Load existing staff and build a name→staff map ---
    const existingStaff = await base44.asServiceRole.entities.Staff.list('-created_date', 500);
    const staffByName = {};
    for (const s of existingStaff) {
      const key = String(s.name || '').toLowerCase().trim();
      if (key) staffByName[key] = s;
    }

    // --- Create missing staff ---
    const createdStaffNames = [];
    for (const name of allNames) {
      const key = name.toLowerCase().trim();
      if (staffByName[key]) continue;
      try {
        const newStaff = await base44.asServiceRole.entities.Staff.create({
          name,
          email: emailFromName(name),
          phone: '',
          worker_type: 'subcontractor',
          team_id: ENABLING_TEAM_ID,
          is_active: true,
          system_role: 'field',
          email_notifications_enabled: true,
          invite_sent: false,
        });
        staffByName[key] = newStaff;
        createdStaffNames.push(name);
      } catch (e) {
        // If create fails (e.g. duplicate email), try to find by email
        const email = emailFromName(name);
        const matches = await base44.asServiceRole.entities.Staff.filter({ email });
        if (matches && matches.length > 0) {
          staffByName[key] = matches[0];
        }
      }
    }

    // --- Load existing RotaAssignments for this job (to dedupe) ---
    const existingAssignments = await base44.asServiceRole.entities.RotaAssignment.filter({ job_id }, '-assigned_date', 500);
    const assignmentKeys = new Set();
    for (const a of existingAssignments) {
      assignmentKeys.add(`${a.staff_id}|${a.assigned_date}`);
    }

    // --- Build RotaAssignment payload (one per person per working day) ---
    const rotaPayload = [];
    for (const cr of crewRows) {
      for (const name of cr.names) {
        const staff = staffByName[name.toLowerCase().trim()];
        if (!staff) continue;
        const d = new Date(cr.start.getTime());
        while (d <= cr.end) {
          const day = d.getUTCDay();
          if (day !== 0 && day !== 6) {
            const isoDate = toISODate(d);
            const key = `${staff.id}|${isoDate}`;
            if (!assignmentKeys.has(key)) {
              rotaPayload.push({
                job_id,
                staff_id: staff.id,
                assigned_date: isoDate,
                week_start: getWeekStart(d),
                status: 'completed',
                shift_status: 'confirmed',
                notes: `${IMPORT_TAG} · £${cr.rate}/day`,
              });
              assignmentKeys.add(key);
            }
          }
          d.setUTCDate(d.getUTCDate() + 1);
        }
      }
    }

    // --- Build HotelBooking payload ---
    const hotelPayload = [];
    for (const hr of hotelRows) {
      const staff = staffByName[hr.name.toLowerCase().trim()];
      hotelPayload.push({
        job_id,
        job_name: job.name,
        assigned_staff_ids: staff ? [staff.id] : [],
        assigned_staff_names: [hr.name],
        hotel_name: 'EWR Site Accommodation',
        check_in_date: toISODate(hr.start),
        check_out_date: toISODate(hr.end),
        booking_reference: hr.bookingRef,
        room_count: 1,
        cost_per_night: hr.rate,
        notes: `${IMPORT_TAG} · ${hr.nights} nights · Net £${hr.netTotal}`,
      });
    }

    // --- Bulk create (batches of 500) ---
    let rotaCreated = 0;
    for (let i = 0; i < rotaPayload.length; i += 500) {
      const batch = rotaPayload.slice(i, i + 500);
      if (batch.length > 0) {
        await base44.asServiceRole.entities.RotaAssignment.bulkCreate(batch);
        rotaCreated += batch.length;
      }
    }

    let hotelCreated = 0;
    for (let i = 0; i < hotelPayload.length; i += 500) {
      const batch = hotelPayload.slice(i, i + 500);
      if (batch.length > 0) {
        await base44.asServiceRole.entities.HotelBooking.bulkCreate(batch);
        hotelCreated += batch.length;
      }
    }

    return Response.json({
      status: 'success',
      job_id,
      job_name: job.name,
      staff_created: createdStaffNames.length,
      staff_created_names: createdStaffNames,
      staff_already_existed: allNames.size - createdStaffNames.length,
      rota_assignments_created: rotaCreated,
      hotel_bookings_created: hotelCreated,
      crew_rows_parsed: crewRows.length,
      accommodation_rows_parsed: hotelRows.length,
      unique_people_found: allNames.size,
      debug,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}