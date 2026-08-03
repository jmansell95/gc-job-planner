import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import * as XLSX from 'npm:xlsx@0.18.5';
import { buildContractorMaps, findOrCreateAgency } from '../../shared/entityRegistry.ts';
import { cellToDate, getWeekStart, categorizeNonJobCell, isSectionHeader, isNonPersonName, looksLikeCompanyName, looksLikePersonName, normalizeName, nameKey, findProjectForJob, extractSiteName, isActualTrainingCourse, extractTrainingCourseTitle, inferTrainingCategory } from '../../shared/spreadsheetParser.ts';

// ---------------------------------------------------------------------------
// Team & Plant Planner Spreadsheet Import — Clean-Slate Edition
// ---------------------------------------------------------------------------
// Parses the Team & Plant Planner Excel file and synchronises the database
// to match it exactly. Every import is a FULL OVERWRITE:
//
//   • ALL existing RotaAssignments are deleted
//   • ALL auto-created Staff (no linked user_id) are deleted
//   • ALL JobAssetAssignments are deleted
//   • Staff with linked logins not in the spreadsheet → marked is_active=false
//   • Jobs are auto-statused: all past dates → completed, any today/future → in_progress
//   • A full audit breakdown is returned so you can verify before applying
//
// Two modes:
//   dry_run: true  → full breakdown preview, no writes
//   dry_run: false → apply everything, return summary
// ---------------------------------------------------------------------------

const DEFAULT_DOMAIN = 'ground-control.co.uk';
const PLACEHOLDER_LOCATION = 'TBC — imported from planner';
const TODAY = new Date().toISOString().slice(0, 10);

const SUBCONTRACTOR_TEAM_NAME = 'Subcontractors';
const DIRECT_EMPLOYEE_TEAM_NAME = 'Direct Employees';
const AGENCY_TEAM_NAME = 'Agency Workers';
const DEPOT_TEAM_NAME = 'Dartford Depot';
const DEPOT_ALIASES = ['dartford', 'yard', 'depot', 'warehouse'];
const ANNUAL_LEAVE_TEAM_NAME = 'Annual Leave';

const CREW_SECTION_TO_JOB_TYPE = {
  'cable': 'cp_drilling', 'cable percussion': 'cp_drilling',
  'rotary': 'rotary_drilling', 'groundworks': 'groundworks', 'groundworker': 'groundworks',
  'coring': 'coring', 'trial pit': 'trial_pit', 'trial_pit': 'trial_pit',
  'enabling': 'enabling_works', 'enabling works': 'enabling_works',
  'depot': 'depot', 'yard': 'depot', 'yard/depot': 'depot',
  'dartford': 'depot', 'warehouse': 'depot',
  'annual leave': 'depot', 'holiday': 'depot',
  'leave/sick': 'depot', 'leave': 'depot', 'sick': 'depot',
  'fitter': 'depot', 'plant fitter': 'depot',
};

const CREW_SECTION_TO_JOB_TITLE = {
  'cable': 'Cable Percussion Driller', 'cable percussion': 'Cable Percussion Driller',
  'rotary': 'Rotary Driller', 'groundworks': 'Groundworker', 'groundworker': 'Groundworker',
  'coring': 'Coring Driller', 'trial pit': 'Trial Pit Operative', 'trial_pit': 'Trial Pit Operative',
  'enabling': 'Enabling Works Operative', 'enabling works': 'Enabling Works Operative',
  'depot': 'Yard/Depot Staff', 'yard': 'Yard/Depot Staff', 'yard/depot': 'Yard/Depot Staff',
  'dartford': 'Yard/Depot Staff', 'warehouse': 'Yard/Depot Staff',
  'annual leave': '', 'holiday': '',
  'leave/sick': '', 'leave': '', 'sick': '',
  'fitter': 'Plant Fitter', 'plant fitter': 'Plant Fitter',
};

const CREW_SECTION_TO_DRILLING_METHOD = {
  'cable': 'cp', 'cable percussion': 'cp', 'rotary': 'rotary', 'coring': 'rotary',
  'groundworks': 'not_applicable', 'groundworker': 'not_applicable',
  'trial pit': 'not_applicable', 'trial_pit': 'not_applicable',
  'enabling': 'not_applicable', 'enabling works': 'not_applicable',
  'depot': 'not_applicable', 'yard': 'not_applicable', 'yard/depot': 'not_applicable',
  'dartford': 'not_applicable', 'warehouse': 'not_applicable',
  'annual leave': 'not_applicable', 'holiday': 'not_applicable',
  'leave/sick': 'not_applicable', 'leave': 'not_applicable', 'sick': 'not_applicable',
  'fitter': 'not_applicable', 'plant fitter': 'not_applicable',
};

// Non-work section headers — these are NOT teams/crews. Staff listed under
// them are on annual leave, sick, training, etc. They should be assigned to
// their real crew team (or fallback), not a team named "Annual Leave".
const NON_WORK_SECTION_KEYWORDS = [
  'annual leave', 'leave', 'sick', 'holiday', 'holidays', 'bh',
  'bank holiday', 'leave/sick', 'absence',
];

const SUBCONTRACTOR_PATTERNS = ['subbies', 'subcontractor', 'sub-contractor', 'subby', 'sub.con', 'sub con', 'sub-con'];

function isSubcontractor(name) {
  const lower = normalizeName(name).toLowerCase();
  if (SUBCONTRACTOR_PATTERNS.some(p => lower.includes(p))) return true;
  return looksLikeCompanyName(name);
}

function isAgencySection(name) {
  if (!name) return false;
  const lower = normalizeName(name).toLowerCase();
  return lower.includes('agency');
}

function isDepotSection(name) {
  if (!name) return false;
  const lower = normalizeName(name).toLowerCase();
  return DEPOT_ALIASES.some(a => lower === a || lower.includes(a));
}

function isNonWorkSection(name) {
  if (!name) return false;
  const lower = normalizeName(name).toLowerCase().trim();
  return NON_WORK_SECTION_KEYWORDS.some(kw => lower === kw || lower.includes(kw));
}

function normalizeSection(section) {
  if (!section) return section;
  if (isNonWorkSection(section)) return ''; // Non-work sections are NOT teams
  if (isDepotSection(section)) return DEPOT_TEAM_NAME;
  return section;
}

function generateEmail(name, existingEmails) {
  const clean = normalizeName(name).toLowerCase().replace(/[^a-z0-9\s.-]/g, '').trim();
  if (!clean) return `imported.staff@${DEFAULT_DOMAIN}`;
  const parts = clean.split(/\s+/);
  const first = parts[0] || '';
  const last = parts.slice(1).join('') || parts[0] || '';
  let base = `${first}.${last}@${DEFAULT_DOMAIN}`;
  // Ensure uniqueness against existing emails and already-generated ones
  if (existingEmails && existingEmails.has(base.toLowerCase())) {
    let i = 2;
    while (existingEmails.has(`${first}.${last}${i}@${DEFAULT_DOMAIN}`.toLowerCase())) i++;
    base = `${first}.${last}${i}@${DEFAULT_DOMAIN}`;
  }
  return base;
}

// Partial-match inference: tries exact match first, then checks if the
// section name contains any keyword (longest keyword first for specificity).
// This handles names like "Cable Percussive Crew 1" → matches "cable".
function inferFromMap(crewSection, map, defaultVal) {
  if (!crewSection) return defaultVal;
  const lower = String(crewSection).trim().toLowerCase();
  if (map[lower]) return map[lower];
  const keys = Object.keys(map).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (map[key] && lower.includes(key)) return map[key];
  }
  return defaultVal;
}
function inferJobType(crewSection) {
  return inferFromMap(crewSection, CREW_SECTION_TO_JOB_TYPE, '');
}
function inferJobTitle(crewSection) {
  return inferFromMap(crewSection, CREW_SECTION_TO_JOB_TITLE, '');
}
function inferDrillingMethod(crewSection) {
  return inferFromMap(crewSection, CREW_SECTION_TO_DRILLING_METHOD, 'not_applicable');
}

function getMostCommon(arr) {
  if (!arr || arr.length === 0) return '';
  const counts = {};
  let maxCount = 0, maxItem = '';
  for (const item of arr) {
    const key = String(item).toLowerCase().trim();
    counts[key] = (counts[key] || 0) + 1;
    if (counts[key] > maxCount) { maxCount = counts[key]; maxItem = item; }
  }
  return maxItem;
}

// Determine job status from its assignment dates:
//   all past  → completed
//   any today/future → in_progress
//   no dates → planning
function determineJobStatus(dates) {
  if (!dates || dates.length === 0) return 'planning';
  const allPast = dates.every(d => d < TODAY);
  if (allPast) return 'completed';
  return 'in_progress';
}

function isPlantPlannerSheet(sheetName) {
  return String(sheetName || '').toLowerCase().includes('plant');
}

// Target sheet patterns — only these tabs are imported. All other tabs
// are treated as prehistoric/legacy data and skipped.
//   • "Team Planner 2026_GW+Depot" → Groundworkers and Depot Staff
//   • "Drillers" → Drilling team (latest)
const TARGET_SHEET_PATTERNS = [
  /team\s*planner.*2026.*(gw|depot)/i,
  /driller/i,
];

function isTargetSheet(sheetName) {
  return TARGET_SHEET_PATTERNS.some(p => p.test(String(sheetName || '')));
}

function parseJobName(rawName) {
  const name = normalizeName(rawName);
  const match = name.match(/^(.+?)\s+is\s+(.+)$/i);
  if (match) {
    return { name, job_reference: match[1].trim(), location: match[2].trim() };
  }
  return { name, job_reference: '', location: '' };
}

// Parse a single sheet. Scans all rows for the date header row, then walks
// every subsequent row tracking section headers and staff names.
function parseSheet(sheet, sheetName) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
  if (rows.length < 5) return [];

  // Find the date header row: the row with the most date-like values.
  // Scan up to 30 rows to handle sheets that list section headers (Cable,
  // Rotary, Groundworkers, etc.) above the date grid.
  let dateHeaderRowIdx = -1;
  let maxDates = 0;
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    let dateCount = 0;
    for (const cell of rows[i]) {
      if (cellToDate(cell)) dateCount++;
    }
    if (dateCount > maxDates) { maxDates = dateCount; dateHeaderRowIdx = i; }
  }
  if (dateHeaderRowIdx === -1 || maxDates < 3) return [];

  // Build column → date mapping from the date header row
  const colToDate = {};
  for (let c = 0; c < rows[dateHeaderRowIdx].length; c++) {
    const d = cellToDate(rows[dateHeaderRowIdx][c]);
    if (d) colToDate[c] = d;
  }

  // If dates are weekly (every 7 columns), interpolate daily dates for the
  // columns in between. This handles sheets that only show week-start dates
  // in the header but have daily staff assignments in every column.
  const dateCols = Object.keys(colToDate).map(Number).sort((a, b) => a - b);
  if (dateCols.length >= 2) {
    const gap = dateCols[1] - dateCols[0];
    if (gap === 7) {
      // Weekly headers — fill in daily dates between each pair
      for (let i = 0; i < dateCols.length - 1; i++) {
        const startCol = dateCols[i];
        const endCol = dateCols[i + 1];
        const startDate = new Date(colToDate[startCol] + 'T00:00:00Z');
        for (let offset = 1; offset < 7; offset++) {
          const fillCol = startCol + offset;
          if (fillCol < endCol && !colToDate[fillCol]) {
            const d = new Date(startDate);
            d.setUTCDate(d.getUTCDate() + offset);
            colToDate[fillCol] = d.toISOString().slice(0, 10);
          }
        }
      }
      // Also fill the last week (6 days after the last weekly date)
      const lastCol = dateCols[dateCols.length - 1];
      const lastDate = new Date(colToDate[lastCol] + 'T00:00:00Z');
      for (let offset = 1; offset <= 6; offset++) {
        const fillCol = lastCol + offset;
        if (!colToDate[fillCol]) {
          const d = new Date(lastDate);
          d.setUTCDate(d.getUTCDate() + offset);
          colToDate[fillCol] = d.toISOString().slice(0, 10);
        }
      }
    }
  }

  const assignments = [];
  const sectionsFound = new Set();
  let currentSection = '';
  let isSubSection = false;
  let isAgencySectionFlag = false;
  let currentAgencyName = '';

  // Pre-scan rows between the title row and the date header row for section
  // headers (some sheets list sections above the date grid).
  for (let r = 2; r < dateHeaderRowIdx; r++) {
    const row = rows[r];
    if (!row) continue;
    for (let c = 0; c < 6 && c < row.length; c++) {
      if (isSectionHeader(row[c])) {
        currentSection = normalizeSection(String(row[c]).trim());
        isSubSection = isSubcontractor(currentSection);
        isAgencySectionFlag = isAgencySection(currentSection);
        if (!isAgencySectionFlag) currentAgencyName = '';
        if (currentSection) sectionsFound.add(currentSection);
      }
    }
  }

  for (let r = dateHeaderRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const firstCells = [row[0], row[1], row[2], row[3], row[4], row[5]].filter(v => v !== null && v !== undefined && String(v).trim() !== '');

    let hasAssignment = false;
    for (const colStr of Object.keys(colToDate)) {
      const c = Number(colStr);
      if (row[c] && String(row[c]).trim()) { hasAssignment = true; break; }
    }

    // Check for section header
    let foundSection = false;
    for (const cell of firstCells) {
      if (isSectionHeader(cell)) {
        currentSection = normalizeSection(String(cell).trim());
        isSubSection = isSubcontractor(currentSection);
        isAgencySectionFlag = isAgencySection(currentSection);
        if (!isAgencySectionFlag) currentAgencyName = '';
        if (currentSection) sectionsFound.add(currentSection);
        foundSection = true;
        break;
      }
    }
    if (foundSection && !hasAssignment) continue;

    // Find the entity name in cols 0-5 — either a person name (direct staff)
    // or a company name (subcontractor). Company names are tagged so they
    // route to the Subcontractors team during resolution.
    let entityName = null;
    let isCompanyName = false;
    for (let c = 0; c < 6; c++) {
      if (looksLikePersonName(row[c])) { entityName = normalizeName(row[c]); isCompanyName = false; break; }
      if (looksLikeCompanyName(row[c])) { entityName = normalizeName(row[c]); isCompanyName = true; break; }
    }
    if (!entityName) continue;

    // Within an agency section, company names are the agency supplier —
    // track it and skip the row (don't create assignments for the agency
    // company itself). Person names after it are linked to that agency.
    if (isAgencySectionFlag && isCompanyName) {
      currentAgencyName = entityName;
      continue;
    }

    const entityIsSubbie = isSubSection || isCompanyName;
    const entityIsAgency = isAgencySectionFlag;
    const entityAgencyName = isAgencySectionFlag ? currentAgencyName : '';

    let hadAssignment = false;
    for (const [colStr, date] of Object.entries(colToDate)) {
      const c = Number(colStr);
      const cellVal = row[c];
      if (!cellVal) continue;
      const jobName = normalizeName(cellVal);
      if (!jobName || jobName.length < 1) continue;
      if (jobName.length === 1) continue;
      const nonJobType = categorizeNonJobCell(jobName);
      assignments.push({
        staff_name: entityName,
        job_name: nonJobType ? null : jobName,
        non_job_type: nonJobType || undefined,
        non_job_label: nonJobType ? jobName : undefined,
        date,
        crew_section: currentSection, is_subcontractor_section: entityIsSubbie,
        is_agency_section: entityIsAgency,
        agency_name: entityAgencyName || undefined,
      });
      hadAssignment = true;
    }

    if (!hadAssignment) {
      assignments.push({
        staff_name: entityName, job_name: null, date: null,
        crew_section: currentSection, is_subcontractor_section: entityIsSubbie,
        is_agency_section: entityIsAgency,
        agency_name: entityAgencyName || undefined,
      });
    }
  }

  // Attach diagnostics + sections to the first assignment for the caller
  if (assignments.length > 0) {
    assignments[0]._sections = [...sectionsFound];
    assignments[0]._diag = {
      dateHeaderRowIdx,
      dateColumnCount: Object.keys(colToDate).length,
      sampleCols: Object.entries(colToDate).slice(0, 5).map(([c, d]) => ({ col: Number(c), date: d })),
    };
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
    if (!fileUrl) return Response.json({ error: 'file_url is required' }, { status: 400 });

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
    const allSectionsDetected = new Set();
    const sheetBreakdown = [];
    const skippedSheets = [];

    for (const sheetName of workbook.SheetNames) {
      if (!isTargetSheet(sheetName)) {
        skippedSheets.push(sheetName);
        warnings.push(`Skipped sheet "${sheetName}" — prehistoric data, not a target tab.`);
        continue;
      }
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      sheetNames.push(sheetName);
      const sheetAssignments = parseSheet(sheet, sheetName);
      if (sheetAssignments.length > 0 && sheetAssignments[0]._sections) {
        for (const s of sheetAssignments[0]._sections) allSectionsDetected.add(s);
      }
      for (const a of sheetAssignments) {
        if (a.crew_section) allSectionsDetected.add(a.crew_section);
      }
      const sheetDates = sheetAssignments.map(a => a.date).filter(Boolean).sort();
      const diag = sheetAssignments.length > 0 ? sheetAssignments[0]._diag : null;
      sheetBreakdown.push({
        sheet: sheetName,
        is_plant: isPlantPlannerSheet(sheetName),
        assignments: sheetAssignments.length,
        sections: [...new Set(sheetAssignments.map(a => a.crew_section).filter(Boolean))],
        date_range: sheetDates.length ? { from: sheetDates[0], to: sheetDates[sheetDates.length - 1] } : null,
        diag: diag || { dateHeaderRowIdx: -1, dateColumnCount: 0, sampleCols: [] },
      });
      if (isPlantPlannerSheet(sheetName)) {
        plantAssignments = plantAssignments.concat(sheetAssignments);
      } else {
        teamAssignments = teamAssignments.concat(sheetAssignments);
      }
    }

    const allAssignments = teamAssignments.concat(plantAssignments);

    if (allAssignments.length === 0) {
      return Response.json({ error: `No assignment rows could be read from the target tabs. Looked for tabs matching "Team Planner 2026_GW+Depot" (Groundworkers & Depot) and "Drillers" (drilling team). Sheets in file: ${workbook.SheetNames.join(', ')}. Skipped: ${skippedSheets.join(', ') || 'none'}` }, { status: 422 });
    }

    const allDates = allAssignments.map(a => a.date).filter(Boolean).sort();
    const dateFrom = allDates[0];
    const dateTo = allDates[allDates.length - 1];

    // -----------------------------------------------------------------------
    // 2. PURGE — full wipe: delete ALL staff, teams, jobs, crews, rotas
    // -----------------------------------------------------------------------
    let purgeSummary = { rotas_deleted: 0, staff_deleted: 0, teams_deleted: 0, jobs_deleted: 0, crews_deleted: 0, asset_assignments_deleted: 0, training_bookings_deleted: 0 };
    const allRotas = await base44.asServiceRole.entities.RotaAssignment.list('-created_date', 5000);
    const allStaff = await base44.asServiceRole.entities.Staff.list('-created_date', 5000);
    const allTeams = await base44.asServiceRole.entities.Team.list('-created_date', 5000);
    const allJobs = await base44.asServiceRole.entities.Job.list('-created_date', 5000);
    const allCrews = await base44.asServiceRole.entities.DrillingCrew.list('-created_date', 5000);
    const allAssetAssignments = await base44.asServiceRole.entities.JobAssetAssignment.list('-created_date', 5000);
    const allTrainingBookings = await base44.asServiceRole.entities.TrainingBooking.list('-created_date', 5000);
    purgeSummary.rotas_deleted = allRotas.length;
    purgeSummary.staff_deleted = allStaff.length;
    purgeSummary.teams_deleted = allTeams.length;
    purgeSummary.jobs_deleted = allJobs.length;
    purgeSummary.crews_deleted = allCrews.length;
    purgeSummary.asset_assignments_deleted = allAssetAssignments.length;
    purgeSummary.training_bookings_deleted = allTrainingBookings.length;
    if (!dryRun) {
      if (allRotas.length > 0) await base44.asServiceRole.entities.RotaAssignment.deleteMany({});
      if (allStaff.length > 0) await base44.asServiceRole.entities.Staff.deleteMany({});
      if (allTeams.length > 0) await base44.asServiceRole.entities.Team.deleteMany({});
      if (allJobs.length > 0) await base44.asServiceRole.entities.Job.deleteMany({});
      if (allCrews.length > 0) await base44.asServiceRole.entities.DrillingCrew.deleteMany({});
      if (allAssetAssignments.length > 0) await base44.asServiceRole.entities.JobAssetAssignment.deleteMany({});
      if (allTrainingBookings.length > 0) await base44.asServiceRole.entities.TrainingBooking.deleteMany({});
      warnings.push(`Full wipe: deleted ${purgeSummary.rotas_deleted} rotas, ${purgeSummary.staff_deleted} staff, ${purgeSummary.teams_deleted} teams, ${purgeSummary.jobs_deleted} jobs, ${purgeSummary.crews_deleted} crews, ${purgeSummary.asset_assignments_deleted} asset assignments, ${purgeSummary.training_bookings_deleted} training bookings.`);
    }

    // -----------------------------------------------------------------------
    // 3. Resolve Teams
    // -----------------------------------------------------------------------
    const crewSections = [...new Set(teamAssignments.map(a => a.crew_section).filter(Boolean))];
    const existingTeams = []; // After full wipe, no existing teams
    const teamByLabel = {};
    for (const t of existingTeams) teamByLabel[String(t.name).toLowerCase().trim()] = t;

    const teamMap = {};
    const newTeamNames = [];

    let subconTeam = teamByLabel[SUBCONTRACTOR_TEAM_NAME.toLowerCase()];
    if (!subconTeam) {
      if (!dryRun) {
        subconTeam = await base44.asServiceRole.entities.Team.create({
          name: SUBCONTRACTOR_TEAM_NAME, category: 'field_ops', default_landing_page: '/staff-schedule'
        });
      } else {
        subconTeam = { id: 'temp_team_subcon', name: SUBCONTRACTOR_TEAM_NAME };
      }
      newTeamNames.push(SUBCONTRACTOR_TEAM_NAME);
    }

    let agencyTeam = teamByLabel[AGENCY_TEAM_NAME.toLowerCase()];
    if (!agencyTeam) {
      if (!dryRun) {
        agencyTeam = await base44.asServiceRole.entities.Team.create({
          name: AGENCY_TEAM_NAME, category: 'field_ops', default_landing_page: '/staff-schedule'
        });
      } else {
        agencyTeam = { id: 'temp_team_agency', name: AGENCY_TEAM_NAME };
      }
      newTeamNames.push(AGENCY_TEAM_NAME);
    }
    teamByLabel[AGENCY_TEAM_NAME.toLowerCase()] = agencyTeam;

    for (const section of crewSections) {
      const key = section.toLowerCase().trim();
      if (teamMap[section]) continue;
      let team = teamByLabel[key];
      if (!team && !dryRun) {
        const jobType = inferJobType(section);
        team = await base44.asServiceRole.entities.Team.create({
          name: section, job_type: jobType || undefined,
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

    let fallbackTeam = teamByLabel[DIRECT_EMPLOYEE_TEAM_NAME.toLowerCase()] || teamByLabel['imported staff'];
    if (!fallbackTeam) {
      if (!dryRun) {
        fallbackTeam = await base44.asServiceRole.entities.Team.create({
          name: DIRECT_EMPLOYEE_TEAM_NAME, category: 'field_ops', default_landing_page: '/staff-schedule'
        });
      } else {
        fallbackTeam = { id: 'temp_team_fallback', name: DIRECT_EMPLOYEE_TEAM_NAME };
      }
    }

    // -----------------------------------------------------------------------
    // 4. Resolve Staff + Leaver Detection
    // -----------------------------------------------------------------------
    const uniqueStaffKeys = new Set();
    const staffNameByKey = {};
    for (const a of teamAssignments) {
      const key = nameKey(a.staff_name);
      uniqueStaffKeys.add(key);
      staffNameByKey[key] = a.staff_name;
    }

    // After full wipe, no existing staff — all will be created fresh
    const existingStaff = [];
    const staffByName = new Map();
    const staffByEmail = new Map();
    for (const s of existingStaff) {
      if (s.name) staffByName.set(nameKey(s.name), s);
      if (s.email) staffByEmail.set(s.email.toLowerCase(), s);
    }

    // Leaver detection: staff with linked logins not in the spreadsheet
    const leavers = existingStaff
      .filter(s => s.user_id && s.is_active !== false && !uniqueStaffKeys.has(nameKey(s.name)))
      .map(s => ({ id: s.id, name: s.name, email: s.email, team_id: s.team_id }));

    // Load existing contractors (agencies + subcontractors) — these survive
    // the full wipe so agency relationships persist across re-imports.
    const existingContractors = await base44.asServiceRole.entities.Contractor.list('-created_date', 5000);
    const contractorMaps = buildContractorMaps(existingContractors);
    const newAgencies = [];

    const staffMap = new Map();
    const newStaffPayloads = [];
    const newStaffKeys = [];
    const staffUpdates = [];
    let staffFoundCount = 0;

    // Track all known emails (DB + generated) to prevent email collisions
    const allKnownEmails = new Set();
    for (const s of existingStaff) {
      if (s.email) allKnownEmails.add(s.email.toLowerCase());
    }

    for (const key of uniqueStaffKeys) {
      const name = staffNameByKey[key];
      let staff = staffByName.get(key);
      if (!staff) {
        const email = generateEmail(name, allKnownEmails);
        staff = staffByEmail.get(email.toLowerCase());
      }

      const staffAssignments = teamAssignments.filter(a => nameKey(a.staff_name) === key);
      const inSubSection = staffAssignments.some(a => a.is_subcontractor_section);
      const inAgencySection = staffAssignments.some(a => a.is_agency_section);
      const subbie = isSubcontractor(name) || inSubSection;
      const agency = inAgencySection;
      const workerType = agency ? 'agency' : (subbie ? 'subcontractor' : 'direct_employee');
      const crewSectionCounts = staffAssignments.map(a => a.crew_section).filter(Boolean);
      const mostCommonSection = getMostCommon(crewSectionCounts);
      const jobTitle = inferJobTitle(mostCommonSection);
      const team = agency ? agencyTeam : (subbie ? subconTeam : (teamMap[mostCommonSection] || fallbackTeam));

      // Resolve the agency (Contractor) for agency workers. The agency name
      // comes from the company-name row above the worker in the spreadsheet.
      let agencyId = undefined;
      let agencyNameResolved = '';
      if (agency) {
        const agencyNames = staffAssignments.map(a => a.agency_name).filter(Boolean);
        agencyNameResolved = getMostCommon(agencyNames) || 'Unknown Agency';
        const agencyRec = await findOrCreateAgency(base44, agencyNameResolved, contractorMaps, dryRun);
        agencyId = agencyRec.id;
        if (!existingContractors.find(c => c.id === agencyRec.id) && !newAgencies.find(a => a.id === agencyRec.id)) {
          newAgencies.push(agencyRec);
        }
      }

      if (!staff) {
        const email = generateEmail(name, allKnownEmails);
        allKnownEmails.add(email.toLowerCase());
        newStaffPayloads.push({
          name, email, worker_type: workerType,
          agency_id: agencyId, job_title: jobTitle || undefined,
          team_id: team.id, is_active: true,
        });
        newStaffKeys.push(key);
      } else {
        staffFoundCount++;
        const updates = {};
        if (jobTitle && !staff.job_title) updates.job_title = jobTitle;
        if (!staff.worker_type) updates.worker_type = workerType;
        if (agency && agencyId && !staff.agency_id) updates.agency_id = agencyId;
        if (subbie && staff.team_id && staff.team_id !== subconTeam.id) updates.team_id = subconTeam.id;
        if (!staff.is_active) updates.is_active = true; // reactivate if returning

        if (Object.keys(updates).length > 0) {
          staffUpdates.push({ id: staff.id, name: staff.name, updates });
          if (!dryRun) await base44.asServiceRole.entities.Staff.update(staff.id, updates);
        }
        staffMap.set(key, staff);
      }
    }

    if (newStaffPayloads.length > 0) {
      // Safety: deduplicate by email (paranoia — the loop above should
      // already guarantee uniqueness, but this is a final guard)
      const seenEmails = new Set();
      const dedupedStaffPayloads = [];
      const dedupedStaffKeys = [];
      for (let i = 0; i < newStaffPayloads.length; i++) {
        const emailKey = newStaffPayloads[i].email.toLowerCase();
        if (seenEmails.has(emailKey)) continue;
        seenEmails.add(emailKey);
        dedupedStaffPayloads.push(newStaffPayloads[i]);
        dedupedStaffKeys.push(newStaffKeys[i]);
      }
      let createdStaff;
      if (!dryRun) {
        createdStaff = await base44.asServiceRole.entities.Staff.bulkCreate(dedupedStaffPayloads);
      } else {
        createdStaff = dedupedStaffPayloads.map((p, i) => ({
          id: `temp_staff_${dedupedStaffKeys[i]}`, name: p.name, email: p.email,
          worker_type: p.worker_type, job_title: p.job_title, team_id: p.team_id,
        }));
      }
      for (let i = 0; i < createdStaff.length; i++) staffMap.set(dedupedStaffKeys[i], createdStaff[i]);
    }

    const newStaff = newStaffKeys.map(k => staffMap.get(k));

    // Mark leavers as inactive
    let leaversMarked = 0;
    if (!dryRun && leavers.length > 0) {
      for (const l of leavers) {
        await base44.asServiceRole.entities.Staff.update(l.id, { is_active: false });
        leaversMarked++;
      }
    }

    // -----------------------------------------------------------------------
    // 5. Resolve Jobs — with date-aware status
    // -----------------------------------------------------------------------
    const uniqueJobKeys = new Set();
    const jobNameByKey = {};
    const jobDatesByKey = {};
    for (const a of allAssignments) {
      if (!a.job_name) continue;
      const key = nameKey(a.job_name);
      uniqueJobKeys.add(key);
      jobNameByKey[key] = a.job_name;
      if (a.date) {
        if (!jobDatesByKey[key]) jobDatesByKey[key] = [];
        jobDatesByKey[key].push(a.date);
      }
    }

    const existingJobs = []; // After full wipe, no existing jobs
    const jobByName = new Map();
    const jobByReference = new Map();
    for (const j of existingJobs) {
      if (j.name) jobByName.set(nameKey(j.name), j);
      if (j.job_reference) jobByReference.set(j.job_reference.toLowerCase(), j);
    }

    const jobMap = new Map();
    const newJobPayloads = [];
    const newJobKeys = [];
    const jobUpdates = [];
    let jobFoundCount = 0;

    for (const key of uniqueJobKeys) {
      const rawName = jobNameByKey[key];
      const parsed = parseJobName(rawName);
      const jobDates = (jobDatesByKey[key] || []).sort();
      const jobStatus = determineJobStatus(jobDates);

      let job = null;
      if (parsed.job_reference) job = jobByReference.get(parsed.job_reference.toLowerCase());
      if (!job) job = jobByName.get(key);

      const jobCrewSections = teamAssignments
        .filter(a => nameKey(a.job_name) === key)
        .map(a => a.crew_section).filter(Boolean);
      const mostCommonSection = getMostCommon(jobCrewSections);
      const drillingMethod = inferDrillingMethod(mostCommonSection);
      const jobType = inferJobType(mostCommonSection);
      const jobStart = jobDates.length ? jobDates[0] : dateFrom;
      const jobEnd = jobDates.length ? jobDates[jobDates.length - 1] : dateTo;

      if (!job) {
        newJobPayloads.push({
          name: parsed.name,
          job_reference: parsed.job_reference || undefined,
          location: parsed.location || PLACEHOLDER_LOCATION,
          start_date: jobStart,
          end_date: jobEnd,
          status: jobStatus,
          drilling_method: drillingMethod,
          job_type: jobType || undefined,
        });
        newJobKeys.push(key);
      } else {
        jobFoundCount++;
        const updates = {};
        if (parsed.location && (job.location === PLACEHOLDER_LOCATION || !job.location)) updates.location = parsed.location;
        if (parsed.job_reference && !job.job_reference) updates.job_reference = parsed.job_reference;
        if (drillingMethod !== 'not_applicable' && (!job.drilling_method || job.drilling_method === 'not_applicable')) updates.drilling_method = drillingMethod;
        if (jobType && !job.job_type) updates.job_type = jobType;
        // Always sync dates and status from the spreadsheet
        updates.start_date = jobStart;
        updates.end_date = jobEnd;
        updates.status = jobStatus;

        if (Object.keys(updates).length > 0) {
          jobUpdates.push({ id: job.id, name: job.name, updates });
          if (!dryRun) await base44.asServiceRole.entities.Job.update(job.id, updates);
        }
        jobMap.set(key, job);
      }
    }

    if (newJobPayloads.length > 0) {
      // Safety: deduplicate by name key (final guard against duplicate job names)
      const seenJobKeys = new Set();
      const dedupedJobPayloads = [];
      const dedupedJobKeys = [];
      for (let i = 0; i < newJobPayloads.length; i++) {
        const jk = nameKey(newJobPayloads[i].name);
        if (seenJobKeys.has(jk)) continue;
        seenJobKeys.add(jk);
        dedupedJobPayloads.push(newJobPayloads[i]);
        dedupedJobKeys.push(newJobKeys[i]);
      }
      let createdJobs;
      if (!dryRun) {
        createdJobs = await base44.asServiceRole.entities.Job.bulkCreate(dedupedJobPayloads);
      } else {
        createdJobs = dedupedJobPayloads.map((p, i) => ({
          id: `temp_job_${dedupedJobKeys[i]}`, name: p.name,
          job_reference: p.job_reference || '', location: p.location,
          drilling_method: p.drilling_method, job_type: p.job_type || '',
          start_date: p.start_date, end_date: p.end_date, status: p.status,
        }));
      }
      for (let i = 0; i < createdJobs.length; i++) jobMap.set(dedupedJobKeys[i], createdJobs[i]);
    }

    const newJobs = newJobKeys.map(k => jobMap.get(k));

    // -----------------------------------------------------------------------
    // 5b. Link Jobs to Projects by site name
    // -----------------------------------------------------------------------
    // Projects survive the full wipe (only Staff/Team/Job/Rota/Crew are purged),
    // so we load them after the wipe and match every job to a project by site
    // name. Matched jobs get project_id set; unmatched sites get a new project
    // created and linked. This ensures jobs are always grouped under their
    // site project after every import.
    const allProjects = await base44.asServiceRole.entities.Project.list('-created_date', 5000);
    const jobProjectUpdates = [];
    const unmatchedSiteGroups = {}; // siteName → [jobIds]
    for (const [key, job] of jobMap) {
      if (job.project_id) continue;
      const project = findProjectForJob(job.name, allProjects);
      if (project) {
        jobProjectUpdates.push({ id: job.id, project_id: project.id });
      } else {
        const site = extractSiteName(job.name);
        if (!unmatchedSiteGroups[site]) unmatchedSiteGroups[site] = [];
        unmatchedSiteGroups[site].push(job.id);
      }
    }
    if (jobProjectUpdates.length > 0 && !dryRun) {
      for (let i = 0; i < jobProjectUpdates.length; i += 400) {
        await base44.asServiceRole.entities.Job.bulkUpdate(jobProjectUpdates.slice(i, i + 400));
      }
    }
    let newProjectsCreated = 0;
    const unmatchedSiteNames = Object.keys(unmatchedSiteGroups);
    if (unmatchedSiteNames.length > 0 && !dryRun) {
      const newProjectPayloads = unmatchedSiteNames.map(name => ({ name, status: 'active' }));
      const createdProjects = await base44.asServiceRole.entities.Project.bulkCreate(newProjectPayloads);
      newProjectsCreated = createdProjects.length;
      const newProjectLinks = [];
      for (let i = 0; i < createdProjects.length; i++) {
        for (const jobId of unmatchedSiteGroups[unmatchedSiteNames[i]]) {
          newProjectLinks.push({ id: jobId, project_id: createdProjects[i].id });
        }
      }
      for (let i = 0; i < newProjectLinks.length; i += 400) {
        await base44.asServiceRole.entities.Job.bulkUpdate(newProjectLinks.slice(i, i + 400));
      }
    }

    // -----------------------------------------------------------------------
    // 6. Resolve Rigs from Plant Planner → JobAssetAssignment
    // -----------------------------------------------------------------------
    const existingRigs = await base44.asServiceRole.entities.SiteAsset.filter({ is_rig: true });
    const rigByName = new Map();
    for (const r of existingRigs) {
      if (r.name) {
        const rk = nameKey(r.name);
        // If multiple rigs share the same name, keep the first active one
        if (!rigByName.has(rk) || (rigByName.get(rk).is_active === false && r.is_active !== false)) {
          rigByName.set(rk, r);
        }
      }
    }

    const rigAssignments = [];
    for (const pa of plantAssignments) {
      if (!pa.job_name || !pa.staff_name) continue;
      const job = jobMap.get(nameKey(pa.job_name));
      const rig = rigByName.get(nameKey(pa.staff_name));
      if (job && rig) {
        rigAssignments.push({
          job_id: job.id, job_name: job.name, asset_id: rig.id, asset_name: rig.name,
          assigned_date: pa.date,
        });
      }
    }

    // Deduplicate by (job_id, asset_id, assigned_date) — one assignment per rig per job per date
    const rigAssignmentMap = new Map();
    for (const ra of rigAssignments) {
      const key = `${ra.job_id}|${ra.asset_id}|${ra.assigned_date || ''}`;
      if (!rigAssignmentMap.has(key)) rigAssignmentMap.set(key, ra);
    }
    // Further deduplicate by (job_id, asset_id) keeping the earliest date
    const rigByJobAsset = new Map();
    for (const ra of rigAssignmentMap.values()) {
      const key = `${ra.job_id}|${ra.asset_id}`;
      if (!rigByJobAsset.has(key) || (ra.assigned_date && (!rigByJobAsset.get(key).assigned_date || ra.assigned_date < rigByJobAsset.get(key).assigned_date))) {
        rigByJobAsset.set(key, ra);
      }
    }
    const dedupedRigAssignments = [...rigByJobAsset.values()];

    // -----------------------------------------------------------------------
    // 7. Build desired rota set
    // -----------------------------------------------------------------------
    const desiredKeys = new Set();
    const rotasToCreate = [];
    let duplicateRotaRows = 0;
    const nonJobCounts = { annual_leave: 0, sick: 0, training: 0 };
    for (const a of teamAssignments) {
      if (!a.date) continue;
      const staff = staffMap.get(nameKey(a.staff_name));
      if (!staff) continue;
      if (a.non_job_type) {
        const key = `${staff.id}|${a.date}|${a.non_job_type}`;
        if (desiredKeys.has(key)) { duplicateRotaRows++; continue; }
        desiredKeys.add(key);
        rotasToCreate.push({
          staff_id: staff.id, assigned_date: a.date,
          week_start: getWeekStart(a.date), status: 'assigned',
          assignment_type: a.non_job_type,
          non_job_label: a.non_job_label || undefined,
        });
        nonJobCounts[a.non_job_type]++;
      } else if (a.job_name) {
        const job = jobMap.get(nameKey(a.job_name));
        if (!job) continue;
        const key = `${staff.id}|${a.date}|${job.id}`;
        if (desiredKeys.has(key)) { duplicateRotaRows++; continue; }
        desiredKeys.add(key);
        rotasToCreate.push({
          staff_id: staff.id, job_id: job.id, assigned_date: a.date,
          week_start: getWeekStart(a.date), status: 'assigned'
        });
      }
    }
    if (duplicateRotaRows > 0) {
      warnings.push(`${duplicateRotaRows} duplicate rota row(s) collapsed into single entries.`);
    }

    // -----------------------------------------------------------------------
    // 7b. Create Training Courses + Bookings from training-type assignments
    // -----------------------------------------------------------------------
    // Training entries (non-job cells categorised as 'training' that are
    // actual training courses — not overheads/meetings/audits) become
    // TrainingCourse + TrainingBooking records. Past dates → completed
    // course with 'attended' booking. Future dates → scheduled course
    // with 'booked' booking. Courses are deduplicated by title + start_date;
    // bookings by course_id + staff_id. TrainingCourse records survive the
    // wipe (only TrainingBookings are purged since they link to wiped staff).
    const trainingEntries = teamAssignments.filter(
      a => a.non_job_type === 'training' && a.date && a.non_job_label && isActualTrainingCourse(a.non_job_label)
    );
    // Group by (title, week_start) — same training in the same week = one course
    const trainingGroups = {};
    for (const a of trainingEntries) {
      const title = extractTrainingCourseTitle(a.non_job_label);
      if (!title) continue;
      const staffKey = nameKey(a.staff_name);
      const ws = getWeekStart(a.date);
      const key = `${nameKey(title)}|${ws}`;
      if (!trainingGroups[key]) trainingGroups[key] = { title, week_start: ws, dates: [], staffDates: {} };
      trainingGroups[key].dates.push(a.date);
      if (!trainingGroups[key].staffDates[staffKey]) trainingGroups[key].staffDates[staffKey] = [];
      trainingGroups[key].staffDates[staffKey].push(a.date);
    }

    // Load existing training courses for deduplication (they survive the wipe)
    const existingCourses = await base44.asServiceRole.entities.TrainingCourse.list('-created_date', 5000);
    const courseByTitleDate = new Map();
    for (const c of existingCourses) {
      if (c.title && c.start_date) courseByTitleDate.set(`${nameKey(c.title)}|${c.start_date}`, c);
    }

    const trainingCourseMap = new Map();
    const newCoursePayloads = [];
    const newCourseKeys = [];
    let trainingCoursesMatched = 0;
    for (const [key, group] of Object.entries(trainingGroups)) {
      const dates = group.dates.sort();
      const startDate = dates[0];
      const endDate = dates[dates.length - 1];
      const isPast = endDate < TODAY;
      const status = isPast ? 'completed' : 'scheduled';
      const category = inferTrainingCategory(group.title);

      const dedupeKey = `${nameKey(group.title)}|${startDate}`;
      let course = courseByTitleDate.get(dedupeKey);
      if (course) {
        trainingCoursesMatched++;
      } else {
        newCoursePayloads.push({ title: group.title, category, start_date: startDate, end_date: endDate, status });
        newCourseKeys.push(key);
        course = null;
      }
      if (course) trainingCourseMap.set(key, course);
    }

    let createdCourses = [];
    if (newCoursePayloads.length > 0 && !dryRun) {
      createdCourses = await base44.asServiceRole.entities.TrainingCourse.bulkCreate(newCoursePayloads);
    } else if (dryRun) {
      createdCourses = newCoursePayloads.map((p, i) => ({ id: `temp_course_${newCourseKeys[i]}`, ...p }));
    }
    for (let i = 0; i < createdCourses.length; i++) trainingCourseMap.set(newCourseKeys[i], createdCourses[i]);

    // Create bookings — one per (course, staff), deduplicated
    const newBookingPayloads = [];
    const bookingKeys = new Set();
    for (const [key, group] of Object.entries(trainingGroups)) {
      const course = trainingCourseMap.get(key);
      if (!course) continue;
      for (const [staffKey, staffDates] of Object.entries(group.staffDates)) {
        const staff = staffMap.get(staffKey);
        if (!staff) continue;
        const bKey = `${course.id}|${staff.id}`;
        if (bookingKeys.has(bKey)) continue;
        bookingKeys.add(bKey);
        const sortedDates = staffDates.sort();
        const isPast = sortedDates[sortedDates.length - 1] < TODAY;
        newBookingPayloads.push({
          course_id: course.id,
          staff_id: staff.id,
          staff_name: staff.name,
          status: isPast ? 'attended' : 'booked',
        });
      }
    }

    let createdTrainingBookings = 0;
    if (newBookingPayloads.length > 0 && !dryRun) {
      for (let i = 0; i < newBookingPayloads.length; i += 400) {
        const batch = newBookingPayloads.slice(i, i + 400);
        await base44.asServiceRole.entities.TrainingBooking.bulkCreate(batch);
        createdTrainingBookings += batch.length;
      }
    } else {
      createdTrainingBookings = newBookingPayloads.length;
    }

    // -----------------------------------------------------------------------
    // 8. Build full audit breakdown
    // -----------------------------------------------------------------------
    const subbieCount = [...uniqueStaffKeys].filter(k => {
      const name = staffNameByKey[k];
      const inSub = teamAssignments.some(a => nameKey(a.staff_name) === k && a.is_subcontractor_section);
      return isSubcontractor(name) || inSub;
    }).length;

    const agencyCount = [...uniqueStaffKeys].filter(k =>
      teamAssignments.some(a => nameKey(a.staff_name) === k && a.is_agency_section)
    ).length;

    // Group agency workers by their supplying agency
    const agencyBreakdown = {};
    for (const key of uniqueStaffKeys) {
      const sAssignments = teamAssignments.filter(a => nameKey(a.staff_name) === key && a.is_agency_section);
      if (sAssignments.length === 0) continue;
      const agencyNames = sAssignments.map(a => a.agency_name).filter(Boolean);
      const agencyName = getMostCommon(agencyNames) || 'Unknown Agency';
      if (!agencyBreakdown[agencyName]) agencyBreakdown[agencyName] = { workers: 0, assignments: 0 };
      agencyBreakdown[agencyName].workers++;
      agencyBreakdown[agencyName].assignments += sAssignments.length;
    }

    // Per-staff breakdown: name, email, team, type, assignment count, dates worked
    const staffBreakdown = [...uniqueStaffKeys].map(key => {
      const staff = staffMap.get(key);
      const name = staffNameByKey[key];
      const sAssignments = teamAssignments.filter(a => nameKey(a.staff_name) === key && a.date);
      const jobs = [...new Set(sAssignments.map(a => a.job_name).filter(Boolean))];
      const dates = sAssignments.map(a => a.date).sort();
      const sections = [...new Set(sAssignments.map(a => a.crew_section).filter(Boolean))];
      const inSub = sAssignments.some(a => a.is_subcontractor_section);
      const inAgency = sAssignments.some(a => a.is_agency_section);
      const subbie = isSubcontractor(name) || inSub;
      const agency = inAgency;
      const agencyNames = sAssignments.map(a => a.agency_name).filter(Boolean);
      const agencyName = agency ? (getMostCommon(agencyNames) || 'Unknown Agency') : '';
      return {
        name,
        email: staff?.email || generateEmail(name),
        worker_type: agency ? 'agency' : (subbie ? 'subcontractor' : 'direct_employee'),
        agency_name: agencyName,
        agency_id: staff?.agency_id || '',
        team: agency ? AGENCY_TEAM_NAME : (subbie ? SUBCONTRACTOR_TEAM_NAME : (sections[0] || DIRECT_EMPLOYEE_TEAM_NAME)),
        job_title: staff?.job_title || inferJobTitle(sections[0]) || '',
        assignment_count: sAssignments.length,
        date_range: dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null,
        jobs: jobs.slice(0, 20),
        sections,
        status: newStaffKeys.includes(key) ? 'new' : 'existing',
        non_job_days: sAssignments.filter(a => a.non_job_type).map(a => ({ date: a.date, type: a.non_job_type, label: a.non_job_label })),
      };
    });

    // Per-job breakdown: name, ref, location, status, dates, staff count
    const jobsBreakdown = [...uniqueJobKeys].map(key => {
      const job = jobMap.get(key);
      const rawName = jobNameByKey[key];
      const parsed = parseJobName(rawName);
      const dates = (jobDatesByKey[key] || []).sort();
      const jAssignments = allAssignments.filter(a => a.job_name && nameKey(a.job_name) === key);
      const staffList = [...new Set(jAssignments.map(a => a.staff_name))];
      const sections = [...new Set(jAssignments.map(a => a.crew_section).filter(Boolean))];
      return {
        name: parsed.name,
        reference: parsed.job_reference || '',
        location: parsed.location || '',
        status: determineJobStatus(dates),
        start_date: dates.length ? dates[0] : '',
        end_date: dates.length ? dates[dates.length - 1] : '',
        assignment_count: dates.length,
        staff_count: staffList.length,
        drilling_method: job?.drilling_method || inferDrillingMethod(sections[0]),
        crew_sections: sections,
        status_new: newJobKeys.includes(key) ? 'new' : 'existing',
      };
    });

    const summary = {
      total_assignments_parsed: allAssignments.length,
      team_assignments: teamAssignments.length,
      plant_assignments: plantAssignments.length,
      sheets_parsed: sheetNames,
      date_range: { from: dateFrom, to: dateTo },
      today: TODAY,
      sheet_breakdown: sheetBreakdown.map(s => ({
        sheet: s.sheet, assignments: s.assignments,
        date_range: s.date_range, sections: s.sections.length,
        diag: s.diag,
      })),
      purge: purgeSummary,
      staff: {
        total: uniqueStaffKeys.size,
        found: staffFoundCount,
        new: newStaffPayloads.length,
        updates: staffUpdates.length,
        subcontractors: subbieCount,
        agency: agencyCount,
        direct_employees: uniqueStaffKeys.size - subbieCount - agencyCount,
        leavers_detected: leavers.length,
        leavers_marked_inactive: dryRun ? 0 : leaversMarked,
      },
      jobs: {
        total: uniqueJobKeys.size,
        found: jobFoundCount,
        new: newJobPayloads.length,
        updates: jobUpdates.length,
        completed: jobsBreakdown.filter(j => j.status === 'completed').length,
        in_progress: jobsBreakdown.filter(j => j.status === 'in_progress').length,
        planning: jobsBreakdown.filter(j => j.status === 'planning').length,
      },
      teams: { total: crewSections.length + 1, new: newTeamNames.length },
      projects: {
        existing_matched: jobProjectUpdates.length,
        new_created: dryRun ? unmatchedSiteNames.length : newProjectsCreated,
        new_site_names: unmatchedSiteNames,
      },
      rotas: {
        to_create: rotasToCreate.length,
        duplicates_collapsed: duplicateRotaRows,
      },
      non_job_assignments: nonJobCounts,
      training: {
        courses_new: newCoursePayloads.length,
        courses_matched: trainingCoursesMatched,
        bookings_created: newBookingPayloads.length,
        completed_courses: newCoursePayloads.filter(c => c.status === 'completed').length,
        scheduled_courses: newCoursePayloads.filter(c => c.status === 'scheduled').length,
      },
      rig_assignments: {
        total: dedupedRigAssignments.length,
      },
      agencies: {
        total: Object.keys(agencyBreakdown).length,
        new: newAgencies.length,
        breakdown: agencyBreakdown,
      },
      sections_detected: [...allSectionsDetected],
      skipped_sheets: skippedSheets,
      target_tabs: sheetNames,
      warnings,
    };

    if (dryRun) {
      return Response.json({
        status: 'success',
        dry_run: true,
        summary,
        sheet_breakdown: sheetBreakdown,
        staff_breakdown: staffBreakdown,
        jobs_breakdown: jobsBreakdown,
        leavers,
        new_staff: newStaff.map(s => ({
          name: s.name, email: s.email, job_title: s.job_title,
          worker_type: s.worker_type,
          team: s.team_id === agencyTeam.id ? AGENCY_TEAM_NAME
            : (s.team_id === subconTeam.id ? SUBCONTRACTOR_TEAM_NAME : 'Direct Employee')
        })),
        new_jobs: newJobs.map(j => ({
          name: j.name, location: j.location, job_reference: j.job_reference,
          drilling_method: j.drilling_method, job_type: j.job_type,
          status: j.status, start_date: j.start_date, end_date: j.end_date,
        })),
        staff_updates: staffUpdates,
        job_updates: jobUpdates,
        new_teams: newTeamNames,
        new_rig_assignments: dedupedRigAssignments.map(ra => ({
          job_name: ra.job_name, asset_name: ra.asset_name, assigned_date: ra.assigned_date
        })),
        training_breakdown: Object.entries(trainingGroups).map(([key, group]) => {
          const course = trainingCourseMap.get(key);
          const dates = group.dates.sort();
          const isPast = dates[dates.length - 1] < TODAY;
          return {
            title: group.title,
            category: inferTrainingCategory(group.title),
            start_date: dates[0],
            end_date: dates[dates.length - 1],
            status: isPast ? 'completed' : 'scheduled',
            staff_count: Object.keys(group.staffDates).length,
            staff_names: Object.keys(group.staffDates).map(sk => staffMap.get(sk)?.name || sk).filter(Boolean),
            is_new: newCourseKeys.includes(key),
          };
        }),
      });
    }

    // --- Apply ---
    let createdCount = 0;
    if (rotasToCreate.length > 0) {
      for (let i = 0; i < rotasToCreate.length; i += 400) {
        const batch = rotasToCreate.slice(i, i + 400);
        await base44.asServiceRole.entities.RotaAssignment.bulkCreate(batch);
        createdCount += batch.length;
      }
    }

    let rigAssignmentCount = 0;
    for (const ra of dedupedRigAssignments) {
      await base44.asServiceRole.entities.JobAssetAssignment.create({
        job_id: ra.job_id, job_name: ra.job_name, asset_id: ra.asset_id, asset_name: ra.asset_name,
        asset_type: 'rig', role: 'primary_rig', status: 'assigned', assigned_date: ra.assigned_date,
      });
      rigAssignmentCount++;
    }

    return Response.json({
      status: 'success',
      dry_run: false,
      summary: {
        ...summary,
        rotas: { created: createdCount, duplicates_collapsed: duplicateRotaRows },
        rig_assignments: { created: rigAssignmentCount, total: dedupedRigAssignments.length },
        staff: { ...summary.staff, leavers_marked_inactive: leaversMarked },
        training: { ...summary.training, bookings_created: createdTrainingBookings },
      },
      sheet_breakdown: sheetBreakdown,
      staff_breakdown: staffBreakdown,
      jobs_breakdown: jobsBreakdown,
      new_staff: newStaff.map(s => ({
        name: s.name, email: s.email, job_title: s.job_title,
        worker_type: s.worker_type,
        team: s.team_id === agencyTeam.id ? AGENCY_TEAM_NAME
          : (s.team_id === subconTeam.id ? SUBCONTRACTOR_TEAM_NAME : 'Direct Employee')
      })),
      new_jobs: newJobs.map(j => ({
        name: j.name, location: j.location, job_reference: j.job_reference,
        drilling_method: j.drilling_method, job_type: j.job_type,
        status: j.status, start_date: j.start_date, end_date: j.end_date,
      })),
      new_teams: newTeamNames,
      training_breakdown: Object.entries(trainingGroups).map(([key, group]) => {
        const course = trainingCourseMap.get(key);
        const dates = group.dates.sort();
        const isPast = dates[dates.length - 1] < TODAY;
        return {
          title: group.title,
          category: inferTrainingCategory(group.title),
          start_date: dates[0],
          end_date: dates[dates.length - 1],
          status: isPast ? 'completed' : 'scheduled',
          staff_count: Object.keys(group.staffDates).length,
          staff_names: Object.keys(group.staffDates).map(sk => staffMap.get(sk)?.name || sk).filter(Boolean),
          is_new: newCourseKeys.includes(key),
        };
      }),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}