import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import * as XLSX from 'npm:xlsx@0.18.5';

// ---------------------------------------------------------------------------
// Team & Plant Planner Spreadsheet Import
// ---------------------------------------------------------------------------
// Parses a Team & Plant Planner Excel file using direct xlsx parsing.
// Extracts staff/job/rota data from team planner sheets AND rig/plant
// assignments from the Plant Planner sheet.
//
// KEY GUARANTEES:
//   • Single-entry deduplication — staff, jobs, teams, and rotas are never
//     duplicated. All lookup maps are keyed by case-insensitive normalised
//     name so "John Smith", "john smith", and "John  Smith" all resolve to
//     the same record.
//   • Subcontractors (names containing "subbies", "subcontractor",
//     "sub-contractor", or "subby") are classified as worker_type =
//     'subcontractor' and assigned to a dedicated "Subcontractors" team.
//   • Everyone else is classified as worker_type = 'direct_employee' and
//     assigned to their crew-section team (Cable, Rotary, Groundworks, etc.).
//   • Batch creation — new staff and jobs are created via bulkCreate in a
//     single call rather than one-by-one.
//   • Full audit report — the response includes found/new/update counts and
//     a warnings list for any ambiguous rows.
//
// Two modes:
//   dry_run: true  → preview of what would be created/updated/deleted (no writes)
//   dry_run: false → apply all changes
// ---------------------------------------------------------------------------

const DEFAULT_DOMAIN = 'ground-control.co.uk';
const PLACEHOLDER_LOCATION = 'TBC — imported from planner';

const SUBCONTRACTOR_TEAM_NAME = 'Subcontractors';

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

const CREW_SECTION_TO_JOB_TITLE = {
  'cable': 'Cable Percussion Driller',
  'cable percussion': 'Cable Percussion Driller',
  'rotary': 'Rotary Driller',
  'groundworks': 'Groundworker',
  'groundworker': 'Groundworker',
  'coring': 'Coring Driller',
  'trial pit': 'Trial Pit Operative',
  'trial_pit': 'Trial Pit Operative',
  'enabling': 'Enabling Works Operative',
  'enabling works': 'Enabling Works Operative',
  'depot': 'Yard/Depot Staff',
  'yard': 'Yard/Depot Staff',
  'yard/depot': 'Yard/Depot Staff',
  'leave/sick': '',
  'leave': '',
  'sick': '',
};

const CREW_SECTION_TO_DRILLING_METHOD = {
  'cable': 'cp',
  'cable percussion': 'cp',
  'rotary': 'rotary',
  'coring': 'rotary',
  'groundworks': 'not_applicable',
  'groundworker': 'not_applicable',
  'trial pit': 'not_applicable',
  'trial_pit': 'not_applicable',
  'enabling': 'not_applicable',
  'enabling works': 'not_applicable',
  'depot': 'not_applicable',
  'yard': 'not_applicable',
  'yard/depot': 'not_applicable',
  'leave/sick': 'not_applicable',
  'leave': 'not_applicable',
  'sick': 'not_applicable',
};

const SECTION_KEYWORDS = ['cable', 'rotary', 'groundwork', 'coring', 'trial pit', 'trial_pit', 'enabling', 'depot', 'yard', 'leave', 'sick', 'plant'];

// Patterns that identify a subcontractor entry in the planner.
// Matched case-insensitively against the normalised staff name.
const SUBCONTRACTOR_PATTERNS = ['subbies', 'subcontractor', 'sub-contractor', 'subby'];

// --- Helpers ---

function normalizeName(name) {
  if (!name) return '';
  return String(name).trim().replace(/\s+/g, ' ');
}

function nameKey(name) {
  return normalizeName(name).toLowerCase();
}

// Detect whether a planner name refers to a subcontractor crew.
function isSubcontractor(name) {
  const lower = normalizeName(name).toLowerCase();
  return SUBCONTRACTOR_PATTERNS.some(p => lower.includes(p));
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
  return CREW_SECTION_TO_JOB_TYPE[String(crewSection).trim().toLowerCase()] || '';
}

function inferJobTitle(crewSection) {
  if (!crewSection) return '';
  return CREW_SECTION_TO_JOB_TITLE[String(crewSection).trim().toLowerCase()] || '';
}

function inferDrillingMethod(crewSection) {
  if (!crewSection) return 'not_applicable';
  return CREW_SECTION_TO_DRILLING_METHOD[String(crewSection).trim().toLowerCase()] || 'not_applicable';
}

function getMostCommon(arr) {
  if (!arr || arr.length === 0) return '';
  const counts = {};
  let maxCount = 0;
  let maxItem = '';
  for (const item of arr) {
    const key = String(item).toLowerCase().trim();
    counts[key] = (counts[key] || 0) + 1;
    if (counts[key] > maxCount) {
      maxCount = counts[key];
      maxItem = item;
    }
  }
  return maxItem;
}

// Convert an Excel cell value to an ISO date string (YYYY-MM-DD).
// Rejects dates outside 2020-2030 (catches Excel epoch leaks like 1899-12-31).
function cellToDate(cell) {
  if (!cell) return null;
  let iso = null;
  if (cell instanceof Date) {
    iso = cell.toISOString().slice(0, 10);
  } else {
    const s = String(cell).trim();
    if (!s) return null;
    const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      iso = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    } else {
      const num = Number(s);
      if (!isNaN(num) && num > 30000 && num < 80000) {
        const d = new Date(Math.round((num - 25569) * 86400 * 1000));
        iso = d.toISOString().slice(0, 10);
      }
    }
  }
  if (!iso) return null;
  const year = parseInt(iso.slice(0, 4), 10);
  if (year < 2020 || year > 2030) return null;
  return iso;
}

function isSectionHeader(text) {
  if (!text) return false;
  const lower = String(text).toLowerCase().trim();
  return SECTION_KEYWORDS.some(kw => lower === kw || lower.startsWith(kw) || lower.includes(kw));
}

function looksLikeStaffName(text) {
  if (!text) return false;
  const s = String(text).trim();
  if (s.length < 2) return false;
  if (s.length === 1) return false;
  if (cellToDate(s)) return false;
  if (isSectionHeader(s)) return false;
  const lower = s.toLowerCase();
  if (lower === 'team planner' || lower === 'plant planner') return false;
  if (!/[a-zA-Z]/.test(s)) return false;
  return true;
}

function isPlantPlannerSheet(sheetName) {
  return String(sheetName || '').toLowerCase().includes('plant');
}

// Parse a job name that may contain a reference and location.
// Pattern: "I260236 is Kingsnorth Power Station" → ref="I260236", location="Kingsnorth Power Station"
function parseJobName(rawName) {
  const name = normalizeName(rawName);
  const match = name.match(/^(.+?)\s+is\s+(.+)$/i);
  if (match) {
    return {
      name: name,
      job_reference: match[1].trim(),
      location: match[2].trim(),
    };
  }
  return { name, job_reference: '', location: '' };
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

  for (let r = dateHeaderRowIdx + 2; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const firstCells = [row[0], row[1], row[2], row[3]].filter(v => v !== null && v !== undefined && String(v).trim() !== '');

    let hasAssignment = false;
    for (const colStr of Object.keys(colToDate)) {
      const c = Number(colStr);
      if (row[c] && String(row[c]).trim()) {
        hasAssignment = true;
        break;
      }
    }

    // Check for section header
    let foundSection = false;
    for (const cell of firstCells) {
      if (isSectionHeader(cell)) {
        currentSection = String(cell).trim();
        foundSection = true;
        break;
      }
    }
    if (foundSection && !hasAssignment) continue;

    // Find the name (staff or plant) in cols 0-3
    let entityName = null;
    for (let c = 0; c < 4; c++) {
      if (looksLikeStaffName(row[c])) {
        entityName = normalizeName(row[c]);
        break;
      }
    }
    if (!entityName) continue;

    // Extract assignments
    for (const [colStr, date] of Object.entries(colToDate)) {
      const c = Number(colStr);
      const cellVal = row[c];
      if (!cellVal) continue;
      const jobName = normalizeName(cellVal);
      if (!jobName || jobName.length < 1) continue;
      if (jobName.length === 1) continue;
      assignments.push({
        staff_name: entityName,
        job_name: jobName,
        date: date,
        crew_section: currentSection,
      });
    }
  }

  return assignments;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

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
    // 1. Fetch and parse the Excel file
    // -----------------------------------------------------------------------
    const fileRes = await fetch(fileUrl);
    if (!fileRes.ok) return Response.json({ error: 'Could not download the uploaded file' }, { status: 422 });
    const arrayBuffer = await fileRes.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });

    let teamAssignments = [];
    let plantAssignments = [];
    const sheetNames = [];
    const warnings = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      sheetNames.push(sheetName);
      const sheetAssignments = parseSheet(sheet, sheetName);
      if (isPlantPlannerSheet(sheetName)) {
        plantAssignments = plantAssignments.concat(sheetAssignments);
      } else {
        teamAssignments = teamAssignments.concat(sheetAssignments);
      }
    }

    const allAssignments = teamAssignments.concat(plantAssignments);

    if (allAssignments.length === 0) {
      return Response.json({
        error: `No assignment rows could be read from this file. Sheets found: ${sheetNames.join(', ')}`
      }, { status: 422 });
    }

    // Date range covered by the sheet
    const allDates = allAssignments.map(a => a.date).sort();
    const dateFrom = allDates[0];
    const dateTo = allDates[allDates.length - 1];

    // -----------------------------------------------------------------------
    // 2. Resolve Teams (crew-section teams + dedicated Subcontractors team)
    // -----------------------------------------------------------------------
    const crewSections = [...new Set(teamAssignments.map(a => a.crew_section).filter(Boolean))];
    const existingTeams = await base44.asServiceRole.entities.Team.list();
    const teamByLabel = {};
    for (const t of existingTeams) {
      teamByLabel[String(t.name).toLowerCase().trim()] = t;
    }

    const teamMap = {};
    const newTeamNames = [];

    // Ensure the dedicated Subcontractors team exists
    let subconTeam = teamByLabel[SUBCONTRACTOR_TEAM_NAME.toLowerCase()];
    if (!subconTeam) {
      if (!dryRun) {
        subconTeam = await base44.asServiceRole.entities.Team.create({
          name: SUBCONTRACTOR_TEAM_NAME,
          category: 'subcontractor',
          default_landing_page: '/subcontractor'
        });
      } else {
        subconTeam = { id: `temp_team_subcon`, name: SUBCONTRACTOR_TEAM_NAME };
      }
      newTeamNames.push(SUBCONTRACTOR_TEAM_NAME);
    }

    // Create crew-section teams for direct employees
    for (const section of crewSections) {
      const key = section.toLowerCase().trim();
      if (teamMap[section]) continue;
      let team = teamByLabel[key];
      if (!team && !dryRun) {
        const jobType = inferJobType(section);
        team = await base44.asServiceRole.entities.Team.create({
          name: section,
          job_type: jobType || undefined,
          category: jobType === 'depot' ? 'depot' : 'field_ops',
          default_landing_page: jobType === 'depot' ? '/admin' : '/staff-schedule'
        });
        teamByLabel[key] = team;
        newTeamNames.push(section);
      } else if (!team && dryRun) {
        team = { id: `temp_team_${key}`, name: section };
        newTeamNames.push(section);
      }
      teamMap[section] = team;
    }

    // Fallback team for direct employees without a crew section
    let fallbackTeam = teamByLabel['direct employees'] || teamByLabel['imported staff'];
    if (!fallbackTeam) {
      if (!dryRun) {
        fallbackTeam = await base44.asServiceRole.entities.Team.create({
          name: 'Direct Employees',
          category: 'field_ops',
          default_landing_page: '/staff-schedule'
        });
      } else {
        fallbackTeam = { id: 'temp_team_fallback', name: 'Direct Employees' };
      }
    }

    // -----------------------------------------------------------------------
    // 3. Resolve Staff — single entry per person (case-insensitive dedup)
    // -----------------------------------------------------------------------
    // Collect unique staff names using the case-insensitive key so "John
    // Smith" and "john smith" collapse to a single entry.
    const uniqueStaffKeys = new Set();
    const staffNameByKey = {};
    for (const a of teamAssignments) {
      const key = nameKey(a.staff_name);
      uniqueStaffKeys.add(key);
      staffNameByKey[key] = a.staff_name;
    }

    const existingStaff = await base44.asServiceRole.entities.Staff.list();
    const staffByName = new Map();
    const staffByEmail = new Map();
    for (const s of existingStaff) {
      if (s.name) staffByName.set(nameKey(s.name), s);
      if (s.email) staffByEmail.set(s.email.toLowerCase(), s);
    }

    const staffMap = new Map();      // key → staff record
    const newStaffPayloads = [];     // payloads awaiting bulkCreate
    const newStaffKeys = [];          // keys in creation order (to map back)
    const staffUpdates = [];
    let staffFoundCount = 0;

    for (const key of uniqueStaffKeys) {
      const name = staffNameByKey[key];
      let staff = staffByName.get(key);
      if (!staff) {
        const email = generateEmail(name);
        staff = staffByEmail.get(email.toLowerCase());
      }

      const subbie = isSubcontractor(name);
      const workerType = subbie ? 'subcontractor' : 'direct_employee';

      // Derive job title from most common crew section
      const staffAssignments = teamAssignments.filter(a => nameKey(a.staff_name) === key);
      const crewSectionCounts = staffAssignments.map(a => a.crew_section).filter(Boolean);
      const mostCommonSection = getMostCommon(crewSectionCounts);
      const jobTitle = inferJobTitle(mostCommonSection);

      // Team assignment: subcontractors → Subcontractors team;
      // direct employees → their crew-section team (or fallback)
      const team = subbie
        ? subconTeam
        : (teamMap[mostCommonSection] || fallbackTeam);

      if (!staff) {
        // Queue for batch creation
        const email = generateEmail(name);
        newStaffPayloads.push({
          name,
          email,
          worker_type: workerType,
          job_title: jobTitle || undefined,
          team_id: team.id,
          is_active: true,
        });
        newStaffKeys.push(key);
      } else {
        staffFoundCount++;
        // Update existing staff if job_title or worker_type needs filling
        const updates = {};
        if (jobTitle && !staff.job_title) updates.job_title = jobTitle;
        if (!staff.worker_type) updates.worker_type = workerType;
        // Re-team subcontractors that were previously in a crew-section team
        if (subbie && staff.team_id && staff.team_id !== subconTeam.id) {
          updates.team_id = subconTeam.id;
        }

        if (Object.keys(updates).length > 0) {
          staffUpdates.push({ id: staff.id, name: staff.name, updates });
          if (!dryRun) {
            await base44.asServiceRole.entities.Staff.update(staff.id, updates);
          }
        }
        staffMap.set(key, staff);
      }
    }

    // Batch-create all new staff in one call
    if (newStaffPayloads.length > 0) {
      let createdStaff;
      if (!dryRun) {
        createdStaff = await base44.asServiceRole.entities.Staff.bulkCreate(newStaffPayloads);
      } else {
        createdStaff = newStaffPayloads.map((p, i) => ({
          id: `temp_staff_${newStaffKeys[i]}`,
          name: p.name,
          email: p.email,
          worker_type: p.worker_type,
          job_title: p.job_title,
          team_id: p.team_id,
        }));
      }
      for (let i = 0; i < createdStaff.length; i++) {
        staffMap.set(newStaffKeys[i], createdStaff[i]);
      }
    }

    const newStaff = newStaffKeys.map(k => staffMap.get(k));

    // -----------------------------------------------------------------------
    // 4. Resolve Jobs — single entry per job (case-insensitive dedup)
    // -----------------------------------------------------------------------
    // Collect unique job names using the case-insensitive key.
    const uniqueJobKeys = new Set();
    const jobNameByKey = {};
    for (const a of allAssignments) {
      const key = nameKey(a.job_name);
      uniqueJobKeys.add(key);
      jobNameByKey[key] = a.job_name;
    }

    const existingJobs = await base44.asServiceRole.entities.Job.list();
    const jobByName = new Map();
    const jobByReference = new Map();
    for (const j of existingJobs) {
      if (j.name) jobByName.set(nameKey(j.name), j);
      if (j.job_reference) jobByReference.set(j.job_reference.toLowerCase(), j);
    }

    const jobMap = new Map();         // key → job record
    const newJobPayloads = [];
    const newJobKeys = [];
    const jobUpdates = [];
    let jobFoundCount = 0;

    for (const key of uniqueJobKeys) {
      const rawName = jobNameByKey[key];
      const parsed = parseJobName(rawName);

      // Try to match by reference first, then by name
      let job = null;
      if (parsed.job_reference) {
        job = jobByReference.get(parsed.job_reference.toLowerCase());
      }
      if (!job) {
        job = jobByName.get(key);
      }

      // Determine drilling method and job type from crew sections of staff assigned
      const jobCrewSections = teamAssignments
        .filter(a => nameKey(a.job_name) === key)
        .map(a => a.crew_section)
        .filter(Boolean);
      const mostCommonSection = getMostCommon(jobCrewSections);
      const drillingMethod = inferDrillingMethod(mostCommonSection);
      const jobType = inferJobType(mostCommonSection);

      if (!job) {
        // Queue for batch creation
        newJobPayloads.push({
          name: parsed.name,
          job_reference: parsed.job_reference || undefined,
          location: parsed.location || PLACEHOLDER_LOCATION,
          start_date: dateFrom,
          end_date: dateTo,
          status: 'planning',
          drilling_method: drillingMethod,
          job_type: jobType || undefined,
        });
        newJobKeys.push(key);
      } else {
        jobFoundCount++;
        // Update existing job if location/reference is placeholder or empty
        const updates = {};
        if (parsed.location && (job.location === PLACEHOLDER_LOCATION || !job.location)) {
          updates.location = parsed.location;
        }
        if (parsed.job_reference && !job.job_reference) {
          updates.job_reference = parsed.job_reference;
        }
        if (drillingMethod !== 'not_applicable' && (!job.drilling_method || job.drilling_method === 'not_applicable')) {
          updates.drilling_method = drillingMethod;
        }
        if (jobType && !job.job_type) {
          updates.job_type = jobType;
        }

        if (Object.keys(updates).length > 0) {
          jobUpdates.push({ id: job.id, name: job.name, updates });
          if (!dryRun) {
            await base44.asServiceRole.entities.Job.update(job.id, updates);
          }
        }
        jobMap.set(key, job);
      }
    }

    // Batch-create all new jobs in one call
    if (newJobPayloads.length > 0) {
      let createdJobs;
      if (!dryRun) {
        createdJobs = await base44.asServiceRole.entities.Job.bulkCreate(newJobPayloads);
      } else {
        createdJobs = newJobPayloads.map((p, i) => ({
          id: `temp_job_${newJobKeys[i]}`,
          name: p.name,
          job_reference: p.job_reference || '',
          location: p.location,
          drilling_method: p.drilling_method,
          job_type: p.job_type || '',
        }));
      }
      for (let i = 0; i < createdJobs.length; i++) {
        jobMap.set(newJobKeys[i], createdJobs[i]);
      }
    }

    const newJobs = newJobKeys.map(k => jobMap.get(k));

    // -----------------------------------------------------------------------
    // 5. Resolve Rigs from Plant Planner → JobAssetAssignment
    // -----------------------------------------------------------------------
    const existingRigs = await base44.asServiceRole.entities.SiteAsset.filter({ is_rig: true });
    const rigByName = new Map();
    for (const r of existingRigs) {
      if (r.name) rigByName.set(nameKey(r.name), r);
    }

    // Build rig assignments from plant planner sheet
    const rigAssignments = [];
    for (const pa of plantAssignments) {
      const job = jobMap.get(nameKey(pa.job_name));
      const rig = rigByName.get(nameKey(pa.staff_name));
      if (job && rig) {
        rigAssignments.push({
          job_id: job.id,
          job_name: job.name,
          asset_id: rig.id,
          asset_name: rig.name,
          assigned_date: pa.date,
        });
      }
    }

    // Dedupe rig assignments by job_id + asset_id (keep earliest date)
    const rigAssignmentMap = new Map();
    for (const ra of rigAssignments) {
      const key = `${ra.job_id}|${ra.asset_id}`;
      if (!rigAssignmentMap.has(key) || ra.assigned_date < rigAssignmentMap.get(key).assigned_date) {
        rigAssignmentMap.set(key, ra);
      }
    }
    const dedupedRigAssignments = [...rigAssignmentMap.values()];

    // Check existing JobAssetAssignments to avoid duplicates
    const existingAssetAssignments = await base44.asServiceRole.entities.JobAssetAssignment.list();
    const existingAssetAssignmentKeys = new Set(
      existingAssetAssignments.map(a => `${a.job_id}|${a.asset_id}`)
    );

    const newRigAssignments = dedupedRigAssignments.filter(ra =>
      !existingAssetAssignmentKeys.has(`${ra.job_id}|${ra.asset_id}`)
    );

    // -----------------------------------------------------------------------
    // 6. Build desired rota set and compare against existing
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
    let duplicateRotaRows = 0;
    for (const a of teamAssignments) {
      const staff = staffMap.get(nameKey(a.staff_name));
      const job = jobMap.get(nameKey(a.job_name));
      if (!staff || !job) continue;
      const key = `${staff.id}|${a.date}|${job.id}`;
      if (desiredKeys.has(key)) {
        duplicateRotaRows++;
        continue;
      }
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

    if (duplicateRotaRows > 0) {
      warnings.push(`${duplicateRotaRows} duplicate rota row(s) in the spreadsheet were collapsed into single entries.`);
    }

    const rotasToDelete = existingRotas.filter(r => {
      const k = `${r.staff_id}|${r.assigned_date}|${r.job_id}`;
      return !desiredKeys.has(k);
    });

    // -----------------------------------------------------------------------
    // 7. Preview (dry run) or apply
    // -----------------------------------------------------------------------
    const summary = {
      total_assignments_parsed: allAssignments.length,
      team_assignments: teamAssignments.length,
      plant_assignments: plantAssignments.length,
      sheets_parsed: sheetNames,
      date_range: { from: dateFrom, to: dateTo },
      staff: {
        total: uniqueStaffKeys.size,
        found: staffFoundCount,
        new: newStaffPayloads.length,
        updates: staffUpdates.length,
        subcontractors: [...uniqueStaffKeys].filter(k => isSubcontractor(staffNameByKey[k])).length,
      },
      jobs: {
        total: uniqueJobKeys.size,
        found: jobFoundCount,
        new: newJobPayloads.length,
        updates: jobUpdates.length,
      },
      teams: { total: crewSections.length + 1, new: newTeamNames.length },
      rotas: {
        to_create: rotasToCreate.length,
        to_delete: rotasToDelete.length,
        existing_kept: existingRotas.length - rotasToDelete.length,
        duplicates_collapsed: duplicateRotaRows,
      },
      rig_assignments: {
        total: dedupedRigAssignments.length,
        new: newRigAssignments.length,
        existing: dedupedRigAssignments.length - newRigAssignments.length,
      },
      warnings,
    };

    if (dryRun) {
      return Response.json({
        status: 'success',
        dry_run: true,
        summary,
        new_staff: newStaff.map(s => ({ name: s.name, email: s.email, job_title: s.job_title, worker_type: s.worker_type, team: s.team_id === subconTeam.id ? SUBCONTRACTOR_TEAM_NAME : 'Direct Employee' })),
        new_jobs: newJobs.map(j => ({ name: j.name, location: j.location, job_reference: j.job_reference, drilling_method: j.drilling_method, job_type: j.job_type })),
        staff_updates: staffUpdates,
        job_updates: jobUpdates,
        new_teams: newTeamNames,
        new_rig_assignments: newRigAssignments.map(ra => ({ job_name: ra.job_name, asset_name: ra.asset_name, assigned_date: ra.assigned_date })),
      });
    }

    // --- Apply ---

    // Create new rotas in batches
    let createdCount = 0;
    if (rotasToCreate.length > 0) {
      for (let i = 0; i < rotasToCreate.length; i += 400) {
        const batch = rotasToCreate.slice(i, i + 400);
        await base44.asServiceRole.entities.RotaAssignment.bulkCreate(batch);
        createdCount += batch.length;
      }
    }

    // Delete stale rotas
    let deletedCount = 0;
    if (rotasToDelete.length > 0) {
      for (const r of rotasToDelete) {
        await base44.asServiceRole.entities.RotaAssignment.delete(r.id);
        deletedCount++;
      }
    }

    // Create new rig assignments
    let rigAssignmentCount = 0;
    for (const ra of newRigAssignments) {
      await base44.asServiceRole.entities.JobAssetAssignment.create({
        job_id: ra.job_id,
        job_name: ra.job_name,
        asset_id: ra.asset_id,
        asset_name: ra.asset_name,
        asset_type: 'rig',
        role: 'primary_rig',
        status: 'assigned',
        assigned_date: ra.assigned_date,
      });
      rigAssignmentCount++;
    }

    return Response.json({
      status: 'success',
      dry_run: false,
      summary: {
        ...summary,
        rotas: { created: createdCount, deleted: deletedCount, duplicates_collapsed: duplicateRotaRows },
        rig_assignments: { created: rigAssignmentCount, total: dedupedRigAssignments.length },
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}