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

const SECTION_KEYWORDS = [
  'cable', 'rotary', 'groundwork', 'coring', 'trial pit', 'trial_pit',
  'enabling',   'depot', 'yard', 'dartford', 'warehouse', 'leave', 'sick', 'holiday', 'plant',
  'subbies', 'subcontractor', 'sub-contractor', 'subby', 'drilling subbies',
  'sub.con', 'sub con', 'sub-con', 'field teams',
  'agency', 'bh', 'bank holiday', 'absence',
];

// Non-work section headers — these are NOT teams/crews. Staff listed under
// them are on annual leave, sick, training, etc. They should be assigned to
// their real crew team (or fallback), not a team named "Annual Leave".
const NON_WORK_SECTION_KEYWORDS = [
  'annual leave', 'leave', 'sick', 'holiday', 'holidays', 'bh',
  'bank holiday', 'leave/sick', 'absence',
];

const SUBCONTRACTOR_PATTERNS = ['subbies', 'subcontractor', 'sub-contractor', 'subby', 'sub.con', 'sub con', 'sub-con'];

const NON_PERSON_WORDS = [
  'team', 'teams', 'crew', 'driver', 'supervisor', 'excavator', 'excavtion',
  'operative', 'labourer', 'labour', 'helper', 'assistant',
  'mobilisation', 'mobilization', 'mobil', 'sampling',
  'fitter', 'mechanic', 'groundworker', 'groundworker+', 'ground',
  'man', 'ex', 'subbies', 'subcontractor', 'sub-contractor',
  'sub.con', 'sub', 'eng', 'field', 'drilling',
  // Role labels and job titles that aren't people
  'agent', 'manager', 'engineer', 'engineers', 'operator', 'operators',
  'inspector', 'surveyor', 'technician', 'analyst', 'consultant',
  'site', 'plant', 'safety', 'welfare', 'office', 'admin', 'administration',
  'lead', 'senior', 'junior', 'trainee', 'apprentice', 'master',
  'night', 'day', 'early', 'late', 'shift', 'rota',
  'chargehand', 'foreman', 'ganger', 'charge',
  'driller', 'drillers', 'piling', 'pile', 'coring', 'cable', 'rotary',
  'groundworks', 'enabling', 'depot', 'yard', 'dartford', 'warehouse', 'leave', 'sick',
  'holiday', 'absence', 'off', 'rest', 'break',
  'tbc', 'tba', 'tbd', 'unknown', 'n/a', 'na', 'none',
  'no', 'yes', 'am', 'pm', 'hrs', 'hours',
  'resource', 'resources', 'allocation', 'allocated', 'unallocated',
  'cover', 'covering', 'spare', 'backup', 'relief',
  'staff', 'personnel', 'workforce', 'gang', 'squad', 'unit',
  'agency', 'workers', 'worker', 'driller', 'drillers',
  'base', 'area', 'rig', 'type', 'number', 'asset',
  'opratives', 'operatives', 'full name',
  'job', 'title',
];

// Keywords that indicate a company name rather than a person name.
// If any word in a cell matches one of these, the cell is treated as a
// subcontractor company (e.g. "DJ Drilling", "ABC Services Ltd").
const COMPANY_KEYWORDS = [
  'drilling', 'services', 'ltd', 'limited', 'construction', 'groundwork',
  'groundworks', 'engineering', 'solutions', 'group', 'plant', 'hire',
  'contractors', 'contracting', 'uk', 'co', 'trading', 'enterprises',
  'holdings', 'developments', 'foundations', 'piling', 'civils',
  'geotechnical', 'environmental', 'consulting', 'associates', 'partners',
  'subbies', 'subcontractor', 'sub-contractor', 'subby',
  'logistics', 'transport', 'haulage', 'demolition', 'excavation',
  'remediation', 'specialists', 'industries', 'works',
  'investigations', 'investigation', 'geo', 'surveying', 'testing',
];

// Strong role words that NEVER appear in a company name. Used to reject
// role labels like "Drilling Supervisor" or "Engineering Staff" even when
// the text also contains a company keyword. Words like "site" or "ground"
// are deliberately NOT here because they can appear in company names
// (e.g. "SDA Site Investigations", "Ground Engineering Ltd").
const STRONG_ROLE_WORDS = [
  'supervisor', 'manager', 'agent', 'crew', 'team', 'teams', 'staff',
  'operator', 'operators', 'driver', 'labourer', 'labour', 'mechanic',
  'fitter', 'inspector', 'surveyor', 'technician', 'analyst', 'consultant',
  'lead', 'senior', 'junior', 'trainee', 'apprentice', 'master',
  'chargehand', 'foreman', 'ganger', 'operative', 'helper', 'assistant',
  'charge', 'night', 'day', 'shift', 'rota', 'holiday', 'absence',
  'sick', 'leave', 'cover', 'covering', 'spare', 'backup', 'relief',
  'personnel', 'workforce', 'gang', 'squad', 'unit', 'resource',
  'resources', 'allocation', 'allocated', 'unallocated',
  'driller', 'drillers', 'agency', 'workers', 'worker',
  'type', 'number', 'base', 'area', 'asset',
];

// --- Helpers ---

function normalizeName(name) {
  if (!name) return '';
  return String(name).trim().replace(/\s+/g, ' ');
}
// Aggressive dedup key: lowercases, strips punctuation, and normalises
// "Last, First" → "first last" so the same person isn't imported twice
// under slightly different name formats.
function nameKey(name) {
  let n = normalizeName(name).toLowerCase();
  // "smith, john" → "john smith"
  const commaMatch = n.match(/^([a-z.'-]+),\s*(.+)$/);
  if (commaMatch) n = `${commaMatch[2]} ${commaMatch[1]}`;
  // strip all punctuation except spaces
  n = n.replace(/[.,'"`’‘()]/g, '').replace(/\s+/g, ' ').trim();
  return n;
}

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

// --- Non-job cell detection (date-column values that aren't job names) ---
// "Off", "Golf day", "Holiday" → annual_leave
// "Sick", "Off sick" → sick
// "Training course", "CPD" → training
// These are NOT jobs — they're categorised and stored as non-job RotaAssignments.
const ANNUAL_LEAVE_CELL_KEYWORDS = [
  'off', 'golf', 'golf day', 'holiday', 'holidays', 'al', 'annual leave',
  'leave', 'vacation', 'pto', 'rest day', 'day off', 'rest', 'leave day',
  'bh', 'bank holiday',
];
const SICK_CELL_KEYWORDS = ['sick', 'off sick', 'illness', 'unwell', 'sick leave'];
const TRAINING_CELL_KEYWORDS = ['training', 'training course', 'course', 'cpd', 'training day'];

function categorizeNonJobCell(cellValue) {
  if (!cellValue) return null;
  const lower = normalizeName(cellValue).toLowerCase().trim();
  if (!lower || lower.length < 2) return null;
  if (ANNUAL_LEAVE_CELL_KEYWORDS.includes(lower)) return 'annual_leave';
  if (lower.startsWith('annual leave') || lower.startsWith('golf')) return 'annual_leave';
  if (SICK_CELL_KEYWORDS.includes(lower)) return 'sick';
  if (lower.startsWith('sick')) return 'sick';
  if (TRAINING_CELL_KEYWORDS.includes(lower)) return 'training';
  if (lower.startsWith('training') || lower.startsWith('course ')) return 'training';
  return null;
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

function getWeekStart(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
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
  const s = String(text).trim();
  if (s.length > 50 || /[\r\n]/.test(s)) return false; // long/multi-line text is notes, not a section
  if (/[^a-z0-9\s/.-]/i.test(s)) return false; // special chars like & mean it's a label, not a section
  const lower = s.toLowerCase();
  const words = lower.split(/\s+/);
  // Reject company names (e.g. "Dartford Drilling Services") — they're
  // subcontractor entities, not section headers. Pure depot/yard/dartford/
  // warehouse labels still pass through as section headers.
  if (words.length >= 2 && words.some(w => COMPANY_KEYWORDS.includes(w)) && !words.some(w => STRONG_ROLE_WORDS.includes(w))) {
    return false;
  }
  return SECTION_KEYWORDS.some(kw => lower === kw || lower.startsWith(kw) || lower.includes(kw));
}

function isNonPersonName(text) {
  if (!text) return true;
  const lower = normalizeName(text).toLowerCase();
  const words = lower.split(/\s+/);
  return words.some(w => NON_PERSON_WORDS.includes(w));
}

// Detects company names: "DJ Drilling", "ABC Services Ltd", "Smith & Jones"
// Returns true if the text contains a company keyword or starts with
// all-caps initials (2+ uppercase letters with no lowercase).
function looksLikeCompanyName(text) {
  if (!text) return false;
  const s = String(text).trim();
  if (s.length < 2) return false;
  if (cellToDate(s)) return false;
  if (isSectionHeader(s)) return false;
  if (!/[a-zA-Z]/.test(s)) return false;
  if (/\d/.test(s)) return false;
  const lower = s.toLowerCase();
  const words = lower.split(/\s+/);
  // Reject role labels: if any word is a strong role word (supervisor, crew,
  // staff, etc.) this is a role/label, not a company — even if it also
  // contains a company keyword (e.g. "Drilling Supervisor", "Engineering Staff").
  for (const w of words) {
    if (STRONG_ROLE_WORDS.includes(w)) return false;
  }
  // Contains a company keyword (drilling, services, ltd, etc.)
  if (words.some(w => COMPANY_KEYWORDS.includes(w))) return true;
  // Starts with all-caps initials (e.g. "DJ Drilling", "AB Services")
  const firstWord = s.split(/\s+/)[0];
  if (words.length >= 2 && /^[A-Z]{2,}$/.test(firstWord)) return true;
  return false;
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
  if (looksLikeCompanyName(s)) return false; // company names → subcontractor, not direct staff
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

    const entityIsSubbie = isSubSection || isCompanyName;
    const entityIsAgency = isAgencySectionFlag;

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
      });
      hadAssignment = true;
    }

    if (!hadAssignment) {
      assignments.push({
        staff_name: entityName, job_name: null, date: null,
        crew_section: currentSection, is_subcontractor_section: entityIsSubbie,
        is_agency_section: entityIsAgency,
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
      return Response.json({ error: `No assignment rows could be read from this file. Sheets found: ${sheetNames.join(', ')}` }, { status: 422 });
    }

    const allDates = allAssignments.map(a => a.date).filter(Boolean).sort();
    const dateFrom = allDates[0];
    const dateTo = allDates[allDates.length - 1];

    // -----------------------------------------------------------------------
    // 2. PURGE — full wipe: delete ALL staff, teams, jobs, crews, rotas
    // -----------------------------------------------------------------------
    let purgeSummary = { rotas_deleted: 0, staff_deleted: 0, teams_deleted: 0, jobs_deleted: 0, crews_deleted: 0, asset_assignments_deleted: 0 };
    const allRotas = await base44.asServiceRole.entities.RotaAssignment.list('-created_date', 5000);
    const allStaff = await base44.asServiceRole.entities.Staff.list('-created_date', 5000);
    const allTeams = await base44.asServiceRole.entities.Team.list('-created_date', 5000);
    const allJobs = await base44.asServiceRole.entities.Job.list('-created_date', 5000);
    const allCrews = await base44.asServiceRole.entities.DrillingCrew.list('-created_date', 5000);
    const allAssetAssignments = await base44.asServiceRole.entities.JobAssetAssignment.list('-created_date', 5000);
    purgeSummary.rotas_deleted = allRotas.length;
    purgeSummary.staff_deleted = allStaff.length;
    purgeSummary.teams_deleted = allTeams.length;
    purgeSummary.jobs_deleted = allJobs.length;
    purgeSummary.crews_deleted = allCrews.length;
    purgeSummary.asset_assignments_deleted = allAssetAssignments.length;
    if (!dryRun) {
      if (allRotas.length > 0) await base44.asServiceRole.entities.RotaAssignment.deleteMany({});
      if (allStaff.length > 0) await base44.asServiceRole.entities.Staff.deleteMany({});
      if (allTeams.length > 0) await base44.asServiceRole.entities.Team.deleteMany({});
      if (allJobs.length > 0) await base44.asServiceRole.entities.Job.deleteMany({});
      if (allCrews.length > 0) await base44.asServiceRole.entities.DrillingCrew.deleteMany({});
      if (allAssetAssignments.length > 0) await base44.asServiceRole.entities.JobAssetAssignment.deleteMany({});
      warnings.push(`Full wipe: deleted ${purgeSummary.rotas_deleted} rotas, ${purgeSummary.staff_deleted} staff, ${purgeSummary.teams_deleted} teams, ${purgeSummary.jobs_deleted} jobs, ${purgeSummary.crews_deleted} crews, ${purgeSummary.asset_assignments_deleted} asset assignments.`);
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

      if (!staff) {
        const email = generateEmail(name, allKnownEmails);
        allKnownEmails.add(email.toLowerCase());
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
      return {
        name,
        email: staff?.email || generateEmail(name),
        worker_type: agency ? 'agency' : (subbie ? 'subcontractor' : 'direct_employee'),
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
      rotas: {
        to_create: rotasToCreate.length,
        duplicates_collapsed: duplicateRotaRows,
      },
      non_job_assignments: nonJobCounts,
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