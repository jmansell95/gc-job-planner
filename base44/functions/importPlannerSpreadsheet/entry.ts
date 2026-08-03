import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import * as XLSX from 'npm:xlsx@0.18.5';

// ---------------------------------------------------------------------------
// Team Planner Spreadsheet Import
// ---------------------------------------------------------------------------
// Parses a Team & Plant Planner Excel file using direct xlsx parsing,
// extracts staff/job/rota data, reconciles against existing entities, and
// (on confirm) syncs the database for the date range covered by the sheet.
//
// Two modes:
//   dry_run: true  → preview of what would be created/updated/deleted
//   dry_run: false → apply changes
// ---------------------------------------------------------------------------

const DEFAULT_DOMAIN = 'ground-control.co.uk';

const CREW_SECTION_TO_JOB_TYPE = {
  'cable': 'cp_drilling',
  'cable percussion': 'cp_drilling',
  'rotary': 'rotary_drilling',
  'groundworks': 'groundworks',
  'groundworker': 'groundworks',
  'coring': 'coring',
  'trial pit': 'trial_pit',
  'trial_pit': 'trial_pit',
  'enabling': 'enabling_works',
  'enabling works': 'enabling_works',
  'depot': 'depot',
  'yard': 'depot',
  'yard/depot': 'depot',
  'leave/sick': 'depot',
  'leave': 'depot',
  'sick': 'depot',
};

// Keywords that identify a row as a section header (not a staff member)
const SECTION_KEYWORDS = ['cable', 'rotary', 'groundwork', 'coring', 'trial pit', 'trial_pit', 'enabling', 'depot', 'yard', 'leave', 'sick', 'plant'];

function normalizeName(name) {
  if (!name) return '';
  return String(name).trim().replace(/\s+/g, ' ');
}

function generateEmail(name) {
  const clean = normalizeName(name).toLowerCase()
    .replace(/[^a-z0-9\s.-]/g, '')
    .trim();
  if (!clean) return `imported.staff@${DEFAULT_DOMAIN}`;
  const parts = clean.split(/\s+/);
  const first = parts[0] || '';
  const last = parts.slice(1).join('') || parts[0] || '';
  return `${first}.${last}@${DEFAULT_DOMAIN}`;
}

function getWeekStart(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function inferJobType(crewSection) {
  if (!crewSection) return '';
  const key = String(crewSection).trim().toLowerCase();
  return CREW_SECTION_TO_JOB_TYPE[key] || '';
}

// Convert an Excel cell value to an ISO date string (YYYY-MM-DD).
// Rejects dates outside 2020-2030 (catches Excel epoch leaks like 1899-12-31).
function cellToDate(cell) {
  if (!cell) return null;
  let iso = null;
  // Date objects
  if (cell instanceof Date) {
    iso = cell.toISOString().slice(0, 10);
  } else {
    const s = String(cell).trim();
    if (!s) return null;
    // Already ISO format
    const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      iso = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    } else {
      // Excel serial date number
      const num = Number(s);
      if (!isNaN(num) && num > 30000 && num < 80000) {
        const d = new Date(Math.round((num - 25569) * 86400 * 1000));
        iso = d.toISOString().slice(0, 10);
      }
    }
  }
  if (!iso) return null;
  // Sanity check: reject dates outside a reasonable planner range
  const year = parseInt(iso.slice(0, 4), 10);
  if (year < 2020 || year > 2030) return null;
  return iso;
}

// Check if a string looks like a section header keyword
function isSectionHeader(text) {
  if (!text) return false;
  const lower = String(text).toLowerCase().trim();
  return SECTION_KEYWORDS.some(kw => lower === kw || lower.startsWith(kw) || lower.includes(kw));
}

// Check if a cell value looks like a staff name (not a date, not a section, not a day letter)
function looksLikeStaffName(text) {
  if (!text) return false;
  const s = String(text).trim();
  if (s.length < 2) return false;
  // Skip single letters (day-of-week)
  if (s.length === 1) return false;
  // Skip dates
  if (cellToDate(s)) return false;
  // Skip section headers
  if (isSectionHeader(s)) return false;
  // Skip "Team Planner" and similar
  const lower = s.toLowerCase();
  if (lower === 'team planner' || lower === 'plant planner') return false;
  // Must contain at least one letter
  if (!/[a-zA-Z]/.test(s)) return false;
  return true;
}

// Parse a single sheet and extract assignments
function parseSheet(sheet, sheetName) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
  if (rows.length < 5) return [];

  // Find the date header row: the row with the most date-like values
  let dateHeaderRowIdx = -1;
  let maxDates = 0;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    let dateCount = 0;
    for (const cell of rows[i]) {
      if (cellToDate(cell)) dateCount++;
    }
    if (dateCount > maxDates) {
      maxDates = dateCount;
      dateHeaderRowIdx = i;
    }
  }
  if (dateHeaderRowIdx === -1 || maxDates < 3) return [];

  // Build column → date mapping from the date header row
  const colToDate = {};
  for (let c = 0; c < rows[dateHeaderRowIdx].length; c++) {
    const d = cellToDate(rows[dateHeaderRowIdx][c]);
    if (d) colToDate[c] = d;
  }

  const assignments = [];
  let currentSection = sheetName || '';

  // Process rows below the header
  for (let r = dateHeaderRowIdx + 2; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    // Check first 4 columns for section header or staff name
    const firstCells = [row[0], row[1], row[2], row[3]].filter(v => v !== null && v !== undefined && String(v).trim() !== '');

    // If the row has text in early columns but no assignments in date columns, it's likely a section header
    let hasAssignment = false;
    for (const colStr of Object.keys(colToDate)) {
      const c = Number(colStr);
      if (row[c] && String(row[c]).trim()) {
        hasAssignment = true;
        break;
      }
    }

    // Check for section header in first cells
    let foundSection = false;
    for (const cell of firstCells) {
      if (isSectionHeader(cell)) {
        currentSection = String(cell).trim();
        foundSection = true;
        break;
      }
    }

    if (foundSection && !hasAssignment) continue; // pure section header row

    // Find the staff name: first cell in cols 0-3 that looks like a name
    let staffName = null;
    for (let c = 0; c < 4; c++) {
      if (looksLikeStaffName(row[c])) {
        staffName = normalizeName(row[c]);
        break;
      }
    }

    if (!staffName) continue;

    // Extract assignments for this staff member
    for (const [colStr, date] of Object.entries(colToDate)) {
      const c = Number(colStr);
      const cellVal = row[c];
      if (!cellVal) continue;
      const jobName = normalizeName(cellVal);
      if (!jobName || jobName.length < 1) continue;
      // Skip if it's just a day letter or repeat of the staff name
      if (jobName.length === 1) continue;
      assignments.push({
        staff_name: staffName,
        job_name: jobName,
        date: date,
        crew_section: currentSection
      });
    }
  }

  return assignments;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json();
    const fileUrl = body.file_url;
    const dryRun = body.dry_run !== false;

    if (!fileUrl) {
      return Response.json({ error: 'file_url is required' }, { status: 400 });
    }

    // -----------------------------------------------------------------------
    // 1. Fetch and parse the Excel file directly
    // -----------------------------------------------------------------------
    const fileRes = await fetch(fileUrl);
    if (!fileRes.ok) return Response.json({ error: 'Could not download the uploaded file' }, { status: 422 });
    const arrayBuffer = await fileRes.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });

    // Parse every sheet and combine assignments
    let assignments = [];
    const sheetNames = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      sheetNames.push(sheetName);
      const sheetAssignments = parseSheet(sheet, sheetName);
      assignments = assignments.concat(sheetAssignments);
    }

    if (assignments.length === 0) {
      return Response.json({
        error: `No assignment rows could be read from this file. Sheets found: ${sheetNames.join(', ')}`
      }, { status: 422 });
    }

    // Date range covered by the sheet
    const allDates = assignments.map(a => a.date).sort();
    const dateFrom = allDates[0];
    const dateTo = allDates[allDates.length - 1];

    // -----------------------------------------------------------------------
    // 2. Resolve Teams (create missing ones based on crew sections)
    // -----------------------------------------------------------------------
    const crewSections = [...new Set(assignments.map(a => a.crew_section).filter(Boolean))];
    const existingTeams = await base44.asServiceRole.entities.Team.list();
    const teamByLabel = {};
    for (const t of existingTeams) {
      teamByLabel[String(t.name).toLowerCase().trim()] = t;
    }

    const teamMap = {};
    const newTeamNames = [];
    for (const section of crewSections) {
      const key = section.toLowerCase().trim();
      if (teamMap[section]) continue;
      let team = teamByLabel[key];
      if (!team) {
        const jobType = inferJobType(section);
        team = await base44.asServiceRole.entities.Team.create({
          name: section,
          job_type: jobType || undefined,
          category: jobType === 'depot' ? 'depot' : 'field_ops',
          default_landing_page: jobType === 'depot' ? '/admin' : '/staff-schedule'
        });
        teamByLabel[key] = team;
        newTeamNames.push(section);
      }
      teamMap[section] = team;
    }

    let fallbackTeam = teamByLabel['depot'];
    if (!fallbackTeam) {
      fallbackTeam = await base44.asServiceRole.entities.Team.create({
        name: 'Imported Staff',
        category: 'field_ops',
        default_landing_page: '/staff-schedule'
      });
      teamByLabel['imported staff'] = fallbackTeam;
    }

    // -----------------------------------------------------------------------
    // 3. Resolve Staff (match by name, then email; create missing)
    // -----------------------------------------------------------------------
    const uniqueStaffNames = [...new Set(assignments.map(a => a.staff_name))];
    const existingStaff = await base44.asServiceRole.entities.Staff.list();
    const staffByName = {};
    const staffByEmail = {};
    for (const s of existingStaff) {
      if (s.name) staffByName[normalizeName(s.name).toLowerCase()] = s;
      if (s.email) staffByEmail[s.email.toLowerCase()] = s;
    }

    const staffMap = {};
    const newStaff = [];
    for (const name of uniqueStaffNames) {
      const key = name.toLowerCase();
      let staff = staffByName[key];
      if (!staff) {
        const email = generateEmail(name);
        staff = staffByEmail[email.toLowerCase()];
      }
      if (!staff) {
        const email = generateEmail(name);
        const firstAssignment = assignments.find(a => a.staff_name === name);
        const team = (firstAssignment && teamMap[firstAssignment.crew_section]) || fallbackTeam;
        staff = await base44.asServiceRole.entities.Staff.create({
          name,
          email,
          worker_type: 'direct_employee',
          team_id: team.id,
          is_active: true
        });
        newStaff.push(staff);
      }
      staffMap[name] = staff;
    }

    // -----------------------------------------------------------------------
    // 4. Resolve Jobs (match by name; create missing)
    // -----------------------------------------------------------------------
    const uniqueJobNames = [...new Set(assignments.map(a => a.job_name))];
    const existingJobs = await base44.asServiceRole.entities.Job.list();
    const jobByName = {};
    for (const j of existingJobs) {
      if (j.name) jobByName[normalizeName(j.name).toLowerCase()] = j;
    }

    const jobMap = {};
    const newJobs = [];
    for (const name of uniqueJobNames) {
      const key = name.toLowerCase();
      let job = jobByName[key];
      if (!job) {
        job = await base44.asServiceRole.entities.Job.create({
          name,
          location: 'TBC — imported from planner',
          start_date: dateFrom,
          end_date: dateTo,
          status: 'planning'
        });
        newJobs.push(job);
      }
      jobMap[name] = job;
    }

    // -----------------------------------------------------------------------
    // 5. Build the desired rota set and compare against existing
    // -----------------------------------------------------------------------
    const existingRotas = await base44.asServiceRole.entities.RotaAssignment.filter({
      assigned_date: { $gte: dateFrom, $lte: dateTo }
    });

    const existingRotaIndex = {};
    for (const r of existingRotas) {
      const k = `${r.staff_id}|${r.assigned_date}|${r.job_id}`;
      existingRotaIndex[k] = r;
    }

    const desiredKeys = new Set();
    const rotasToCreate = [];
    for (const a of assignments) {
      const staff = staffMap[a.staff_name];
      const job = jobMap[a.job_name];
      if (!staff || !job) continue;
      const key = `${staff.id}|${a.date}|${job.id}`;
      desiredKeys.add(key);
      if (!existingRotaIndex[key]) {
        rotasToCreate.push({
          staff_id: staff.id,
          job_id: job.id,
          assigned_date: a.date,
          week_start: getWeekStart(a.date),
          status: 'assigned'
        });
      }
    }

    const rotasToDelete = existingRotas.filter(r => {
      const k = `${r.staff_id}|${r.assigned_date}|${r.job_id}`;
      return !desiredKeys.has(k);
    });

    // -----------------------------------------------------------------------
    // 6. Preview (dry run) or apply
    // -----------------------------------------------------------------------
    if (dryRun) {
      return Response.json({
        status: 'success',
        dry_run: true,
        summary: {
          total_assignments_parsed: assignments.length,
          sheets_parsed: sheetNames,
          date_range: { from: dateFrom, to: dateTo },
          staff: { total: uniqueStaffNames.length, new: newStaff.length },
          jobs: { total: uniqueJobNames.length, new: newJobs.length },
          teams: { total: crewSections.length, new: newTeamNames.length },
          rotas: { to_create: rotasToCreate.length, to_delete: rotasToDelete.length, existing_kept: existingRotas.length - rotasToDelete.length }
        },
        new_staff: newStaff.map(s => ({ name: s.name, email: s.email })),
        new_jobs: newJobs.map(j => ({ name: j.name })),
        new_teams: newTeamNames
      });
    }

    // Apply: create new rotas and delete stale ones
    let createdCount = 0;
    if (rotasToCreate.length > 0) {
      for (let i = 0; i < rotasToCreate.length; i += 400) {
        const batch = rotasToCreate.slice(i, i + 400);
        await base44.asServiceRole.entities.RotaAssignment.bulkCreate(batch);
        createdCount += batch.length;
      }
    }

    let deletedCount = 0;
    if (rotasToDelete.length > 0) {
      for (const r of rotasToDelete) {
        await base44.asServiceRole.entities.RotaAssignment.delete(r.id);
        deletedCount++;
      }
    }

    return Response.json({
      status: 'success',
      dry_run: false,
      summary: {
        total_assignments_parsed: assignments.length,
        date_range: { from: dateFrom, to: dateTo },
        staff: { total: uniqueStaffNames.length, new: newStaff.length },
        jobs: { total: uniqueJobNames.length, new: newJobs.length },
        teams: { total: crewSections.length },
        rotas: { created: createdCount, deleted: deletedCount }
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}