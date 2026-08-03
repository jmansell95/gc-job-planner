import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import * as XLSX from 'npm:xlsx@0.18.5';

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

const CREW_SECTION_TO_JOB_TYPE = {
  'cable': 'cp_drilling', 'cable percussion': 'cp_drilling',
  'rotary': 'rotary_drilling', 'groundworks': 'groundworks', 'groundworker': 'groundworks',
  'coring': 'coring', 'trial pit': 'trial_pit', 'trial_pit': 'trial_pit',
  'enabling': 'enabling_works', 'enabling works': 'enabling_works',
  'depot': 'depot', 'yard': 'depot', 'yard/depot': 'depot',
  'leave/sick': 'depot', 'leave': 'depot', 'sick': 'depot',
};

const CREW_SECTION_TO_JOB_TITLE = {
  'cable': 'Cable Percussion Driller', 'cable percussion': 'Cable Percussion Driller',
  'rotary': 'Rotary Driller', 'groundworks': 'Groundworker', 'groundworker': 'Groundworker',
  'coring': 'Coring Driller', 'trial pit': 'Trial Pit Operative', 'trial_pit': 'Trial Pit Operative',
  'enabling': 'Enabling Works Operative', 'enabling works': 'Enabling Works Operative',
  'depot': 'Yard/Depot Staff', 'yard': 'Yard/Depot Staff', 'yard/depot': 'Yard/Depot Staff',
  'leave/sick': '', 'leave': '', 'sick': '',
};

const CREW_SECTION_TO_DRILLING_METHOD = {
  'cable': 'cp', 'cable percussion': 'cp', 'rotary': 'rotary', 'coring': 'rotary',
  'groundworks': 'not_applicable', 'groundworker': 'not_applicable',
  'trial pit': 'not_applicable', 'trial_pit': 'not_applicable',
  'enabling': 'not_applicable', 'enabling works': 'not_applicable',
  'depot': 'not_applicable', 'yard': 'not_applicable', 'yard/depot': 'not_applicable',
  'leave/sick': 'not_applicable', 'leave': 'not_applicable', 'sick': 'not_applicable',
};

const SECTION_KEYWORDS = [
  'cable', 'rotary', 'groundwork', 'coring', 'trial pit', 'trial_pit',
  'enabling', 'depot', 'yard', 'leave', 'sick', 'plant',
  'subbies', 'subcontractor', 'sub-contractor', 'subby', 'drilling subbies',
  'sub.con', 'sub con', 'sub-con', 'field teams',
];

const SUBCONTRACTOR_PATTERNS = ['subbies', 'subcontractor', 'sub-contractor', 'subby', 'sub.con', 'sub con', 'sub-con'];

const NON_PERSON_WORDS = [
  'team', 'teams', 'crew', 'driver', 'supervisor', 'excavator', 'excavtion',
  'operative', 'labourer', 'labour', 'helper', 'assistant',
  'mobilisation', 'mobilization', 'mobil', 'sampling',
  'fitter', 'mechanic', 'groundworker', 'groundworker+', 'ground',
  'man', 'ex', 'subbies', 'subcontractor', 'sub-contractor',
  'sub.con', 'sub', 'eng', 'field', 'drilling',
];

// --- Helpers ---

function normalizeName(name) {
  if (!name) return '';
  return String(name).trim().replace(/\s+/g, ' ');
}
function nameKey(name) { return normalizeName(name).toLowerCase(); }

function isSubcontractor(name) {
  const lower = normalizeName(name).toLowerCase();
  return SUBCONTRACTOR_PATTERNS.some(p => lower.includes(p));
}

function generateEmail(name) {
  const clean = normalizeName(name).toLowerCase().replace(/[^a-z0-9\s.-]/g, '').trim();
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

function isNonPersonName(text) {
  if (!text) return true;
  const lower = normalizeName(text).toLowerCase();
  const words = lower.split(/\s+/);
  return words.some(w => NON_PERSON_WORDS.includes(w));
}

function looksLikePersonName(text) {
  if (!text) return false;
  const s = String(text).trim();
  if (s.length < 2) return false;
  if (cellToDate(s)) return false;
  if (isSectionHeader(s)) return false;
  const lower = s.toLowerCase();
  if (lower === 'team planner' || lower === 'plant planner') return false;
  if (!/[a-zA-Z]/.test(s)) return false;
  if (/\d/.test(s)) return false;
  if (isNonPersonName(s)) return false;
  const words = s.split(/\s+/);
  if (words.length < 2) return false;
  if (words.length > 5) return false;
  return words.every(w => /^[A-Z]/.test(w));
}

function isPlantPlannerSheet(sheetName) {
  return String(sheetName || '').toLowerCase().includes('plant');
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

  // Find the date header row: the row with the most date-like values
  let dateHeaderRowIdx = -1;
  let maxDates = 0;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    let dateCount = 0;
    for (const cell of rows[i]) {
      if (cellToDate(cell)) dateCount++;
    }
    if (dateCount > maxDates) { maxDates = dateCount; dateHeaderRowIdx = i; }
  }
  if (dateHeaderRowIdx === -1 || maxDates < 3) return [];

  // Build column → date mapping
  const colToDate = {};
  for (let c = 0; c < rows[dateHeaderRowIdx].length; c++) {
    const d = cellToDate(rows[dateHeaderRowIdx][c]);
    if (d) colToDate[c] = d;
  }

  const assignments = [];
  const sectionsFound = new Set();
  let currentSection = '';
  let isSubSection = false;

  // Pre-scan rows between the title row and the date header row for section
  // headers (some sheets list sections above the date grid).
  for (let r = 2; r < dateHeaderRowIdx; r++) {
    const row = rows[r];
    if (!row) continue;
    for (let c = 0; c < 6 && c < row.length; c++) {
      if (isSectionHeader(row[c])) {
        currentSection = String(row[c]).trim();
        isSubSection = isSubcontractor(currentSection);
        sectionsFound.add(currentSection);
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
        currentSection = String(cell).trim();
        isSubSection = isSubcontractor(currentSection);
        sectionsFound.add(currentSection);
        foundSection = true;
        break;
      }
    }
    if (foundSection && !hasAssignment) continue;

    // Find the person name in cols 0-5
    let entityName = null;
    for (let c = 0; c < 6; c++) {
      if (looksLikePersonName(row[c])) { entityName = normalizeName(row[c]); break; }
    }
    if (!entityName) continue;

    let hadAssignment = false;
    for (const [colStr, date] of Object.entries(colToDate)) {
      const c = Number(colStr);
      const cellVal = row[c];
      if (!cellVal) continue;
      const jobName = normalizeName(cellVal);
      if (!jobName || jobName.length < 1) continue;
      if (jobName.length === 1) continue;
      assignments.push({
        staff_name: entityName, job_name: jobName, date,
        crew_section: currentSection, is_subcontractor_section: isSubSection,
      });
      hadAssignment = true;
    }

    if (!hadAssignment) {
      assignments.push({
        staff_name: entityName, job_name: null, date: null,
        crew_section: currentSection, is_subcontractor_section: isSubSection,
      });
    }
  }

  // Attach sections found to the first assignment for collection by the caller
  if (assignments.length > 0) {
    assignments[0]._sections = [...sectionsFound];
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

    for (const sheetName of workbook.SheetNames) {
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
      sheetBreakdown.push({
        sheet: sheetName,
        is_plant: isPlantPlannerSheet(sheetName),
        assignments: sheetAssignments.length,
        sections: [...new Set(sheetAssignments.map(a => a.crew_section).filter(Boolean))],
      });
      if (isPlantPlannerSheet(sheetName)) {
        plantAssignments = plantAssignments.concat(sheetAssignments);
      } else {
        teamAssignments = teamAssignments.concat(sheetAssignments);
      }
    }

    const allAssignments = teamAssignments.concat(plantAssignments);

    if (allAssignments.length === 0) {
      return Response.json({ error: `No assignment rows could be read from this file. Sheets found: ${sheetNames.join(', ')}` }, { status: 422 });
    }

    const allDates = allAssignments.map(a => a.date).filter(Boolean).sort();
    const dateFrom = allDates[0];
    const dateTo = allDates[allDates.length - 1];

    // -----------------------------------------------------------------------
    // 2. PURGE — always wipe old data for a clean slate
    // -----------------------------------------------------------------------
    let purgeSummary = { rotas_deleted: 0, staff_deleted: 0, asset_assignments_deleted: 0 };
    if (!dryRun) {
      const allRotas = await base44.asServiceRole.entities.RotaAssignment.list('-created_date', 5000);
      if (allRotas.length > 0) {
        await base44.asServiceRole.entities.RotaAssignment.deleteMany({});
        purgeSummary.rotas_deleted = allRotas.length;
      }
      const allStaff = await base44.asServiceRole.entities.Staff.list('-created_date', 5000);
      const autoStaff = allStaff.filter(s => !s.user_id);
      if (autoStaff.length > 0) {
        for (const s of autoStaff) {
          await base44.asServiceRole.entities.Staff.delete(s.id);
        }
        purgeSummary.staff_deleted = autoStaff.length;
      }
      const allAssetAssignments = await base44.asServiceRole.entities.JobAssetAssignment.list('-created_date', 5000);
      if (allAssetAssignments.length > 0) {
        await base44.asServiceRole.entities.JobAssetAssignment.deleteMany({});
        purgeSummary.asset_assignments_deleted = allAssetAssignments.length;
      }
      warnings.push(`Purge: deleted ${purgeSummary.rotas_deleted} rota assignments, ${purgeSummary.staff_deleted} auto-created staff, ${purgeSummary.asset_assignments_deleted} asset assignments.`);
    }

    // -----------------------------------------------------------------------
    // 3. Resolve Teams
    // -----------------------------------------------------------------------
    const crewSections = [...new Set(teamAssignments.map(a => a.crew_section).filter(Boolean))];
    const existingTeams = await base44.asServiceRole.entities.Team.list();
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

    const existingStaff = await base44.asServiceRole.entities.Staff.list();
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

    const staffMap = new Map();
    const newStaffPayloads = [];
    const newStaffKeys = [];
    const staffUpdates = [];
    let staffFoundCount = 0;

    for (const key of uniqueStaffKeys) {
      const name = staffNameByKey[key];
      let staff = staffByName.get(key);
      if (!staff) {
        const email = generateEmail(name);
        staff = staffByEmail.get(email.toLowerCase());
      }

      const staffAssignments = teamAssignments.filter(a => nameKey(a.staff_name) === key);
      const inSubSection = staffAssignments.some(a => a.is_subcontractor_section);
      const subbie = isSubcontractor(name) || inSubSection;
      const workerType = subbie ? 'subcontractor' : 'direct_employee';
      const crewSectionCounts = staffAssignments.map(a => a.crew_section).filter(Boolean);
      const mostCommonSection = getMostCommon(crewSectionCounts);
      const jobTitle = inferJobTitle(mostCommonSection);
      const team = subbie ? subconTeam : (teamMap[mostCommonSection] || fallbackTeam);

      if (!staff) {
        const email = generateEmail(name);
        newStaffPayloads.push({
          name, email, worker_type: workerType,
          job_title: jobTitle || undefined, team_id: team.id, is_active: true,
        });
        newStaffKeys.push(key);
      } else {
        staffFoundCount++;
        const updates = {};
        if (jobTitle && !staff.job_title) updates.job_title = jobTitle;
        if (!staff.worker_type) updates.worker_type = workerType;
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
      let createdStaff;
      if (!dryRun) {
        createdStaff = await base44.asServiceRole.entities.Staff.bulkCreate(newStaffPayloads);
      } else {
        createdStaff = newStaffPayloads.map((p, i) => ({
          id: `temp_staff_${newStaffKeys[i]}`, name: p.name, email: p.email,
          worker_type: p.worker_type, job_title: p.job_title, team_id: p.team_id,
        }));
      }
      for (let i = 0; i < createdStaff.length; i++) staffMap.set(newStaffKeys[i], createdStaff[i]);
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

    const existingJobs = await base44.asServiceRole.entities.Job.list();
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
      let createdJobs;
      if (!dryRun) {
        createdJobs = await base44.asServiceRole.entities.Job.bulkCreate(newJobPayloads);
      } else {
        createdJobs = newJobPayloads.map((p, i) => ({
          id: `temp_job_${newJobKeys[i]}`, name: p.name,
          job_reference: p.job_reference || '', location: p.location,
          drilling_method: p.drilling_method, job_type: p.job_type || '',
          start_date: p.start_date, end_date: p.end_date, status: p.status,
        }));
      }
      for (let i = 0; i < createdJobs.length; i++) jobMap.set(newJobKeys[i], createdJobs[i]);
    }

    const newJobs = newJobKeys.map(k => jobMap.get(k));

    // -----------------------------------------------------------------------
    // 6. Resolve Rigs from Plant Planner → JobAssetAssignment
    // -----------------------------------------------------------------------
    const existingRigs = await base44.asServiceRole.entities.SiteAsset.filter({ is_rig: true });
    const rigByName = new Map();
    for (const r of existingRigs) { if (r.name) rigByName.set(nameKey(r.name), r); }

    const rigAssignments = [];
    for (const pa of plantAssignments) {
      const job = jobMap.get(nameKey(pa.job_name));
      const rig = rigByName.get(nameKey(pa.staff_name));
      if (job && rig) {
        rigAssignments.push({
          job_id: job.id, job_name: job.name, asset_id: rig.id, asset_name: rig.name,
          assigned_date: pa.date,
        });
      }
    }

    const rigAssignmentMap = new Map();
    for (const ra of rigAssignments) {
      const key = `${ra.job_id}|${ra.asset_id}`;
      if (!rigAssignmentMap.has(key) || ra.assigned_date < rigAssignmentMap.get(key).assigned_date) {
        rigAssignmentMap.set(key, ra);
      }
    }
    const dedupedRigAssignments = [...rigAssignmentMap.values()];

    // -----------------------------------------------------------------------
    // 7. Build desired rota set
    // -----------------------------------------------------------------------
    const desiredKeys = new Set();
    const rotasToCreate = [];
    let duplicateRotaRows = 0;
    for (const a of teamAssignments) {
      if (!a.date || !a.job_name) continue;
      const staff = staffMap.get(nameKey(a.staff_name));
      const job = jobMap.get(nameKey(a.job_name));
      if (!staff || !job) continue;
      const key = `${staff.id}|${a.date}|${job.id}`;
      if (desiredKeys.has(key)) { duplicateRotaRows++; continue; }
      desiredKeys.add(key);
      rotasToCreate.push({
        staff_id: staff.id, job_id: job.id, assigned_date: a.date,
        week_start: getWeekStart(a.date), status: 'assigned'
      });
    }
    if (duplicateRotaRows > 0) {
      warnings.push(`${duplicateRotaRows} duplicate rota row(s) collapsed into single entries.`);
    }

    // -----------------------------------------------------------------------
    // 8. Build full audit breakdown
    // -----------------------------------------------------------------------
    const subbieCount = [...uniqueStaffKeys].filter(k => {
      const name = staffNameByKey[k];
      const inSub = teamAssignments.some(a => nameKey(a.staff_name) === k && a.is_subcontractor_section);
      return isSubcontractor(name) || inSub;
    }).length;

    // Per-staff breakdown: name, email, team, type, assignment count, dates worked
    const staffBreakdown = [...uniqueStaffKeys].map(key => {
      const staff = staffMap.get(key);
      const name = staffNameByKey[key];
      const sAssignments = teamAssignments.filter(a => nameKey(a.staff_name) === key && a.date);
      const jobs = [...new Set(sAssignments.map(a => a.job_name).filter(Boolean))];
      const dates = sAssignments.map(a => a.date).sort();
      const sections = [...new Set(sAssignments.map(a => a.crew_section).filter(Boolean))];
      const inSub = sAssignments.some(a => a.is_subcontractor_section);
      const subbie = isSubcontractor(name) || inSub;
      return {
        name,
        email: staff?.email || generateEmail(name),
        worker_type: subbie ? 'subcontractor' : 'direct_employee',
        team: subbie ? SUBCONTRACTOR_TEAM_NAME : (sections[0] || DIRECT_EMPLOYEE_TEAM_NAME),
        job_title: staff?.job_title || inferJobTitle(sections[0]) || '',
        assignment_count: sAssignments.length,
        date_range: dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null,
        jobs: jobs.slice(0, 20),
        sections,
        status: newStaffKeys.includes(key) ? 'new' : 'existing',
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
      purge: purgeSummary,
      staff: {
        total: uniqueStaffKeys.size,
        found: staffFoundCount,
        new: newStaffPayloads.length,
        updates: staffUpdates.length,
        subcontractors: subbieCount,
        direct_employees: uniqueStaffKeys.size - subbieCount,
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
      rotas: {
        to_create: rotasToCreate.length,
        duplicates_collapsed: duplicateRotaRows,
      },
      rig_assignments: {
        total: dedupedRigAssignments.length,
      },
      sections_detected: [...allSectionsDetected],
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
          team: s.team_id === subconTeam.id ? SUBCONTRACTOR_TEAM_NAME : 'Direct Employee'
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
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}