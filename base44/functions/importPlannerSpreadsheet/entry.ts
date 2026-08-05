import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import * as XLSX from 'npm:xlsx@0.18.5';
import { buildContractorMaps, findOrCreateAgency, findOrCreateSubcontractor, buildAssetMaps, fuzzyFindAsset, assetRole, fuzzyFindStaff, fuzzyFindJob } from '../../shared/entityRegistry.ts';
import { findRigRateCardItem } from '../../shared/rigRateMatcher.ts';
import { cellToDate, getWeekStart, categorizeNonJobCell, isSectionHeader, isNonPersonName, looksLikeCompanyName, looksLikePersonName, looksLikeAssetName, normalizeName, nameKey, findProjectForJob, extractSiteName, isActualTrainingCourse, extractTrainingCourseTitle, inferTrainingCategory, isLikelyRealJob, canonicalJobKey } from '../../shared/spreadsheetParser.ts';

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
  'cable': 'drilling', 'cable percussion': 'drilling',
  'rotary': 'drilling', 'coring': 'drilling',
  'groundworks': 'groundworks', 'groundworker': 'groundworks',
  'trial pit': 'groundworks', 'trial_pit': 'groundworks',
  'enabling': 'groundworks', 'enabling works': 'groundworks',
  'depot': 'groundworks', 'yard': 'groundworks', 'yard/depot': 'groundworks',
  'dartford': 'groundworks', 'warehouse': 'groundworks',
  'annual leave': 'groundworks', 'holiday': 'groundworks',
  'leave/sick': 'groundworks', 'leave': 'groundworks', 'sick': 'groundworks',
  'fitter': 'groundworks', 'plant fitter': 'groundworks',
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

// Infer a job title from the sheet name when no crew section is available
// (staff who only appear under "Leave/Sick" with no real crew assignments).
// "Drillers" / "Team Planner 2026_Drilling" → Driller
// "Team Planner 2026_GW+Depot" → Groundworker (default for GW+Depot sheet)
function inferJobTitleFromSheet(sheetName) {
  if (!sheetName) return '';
  const lower = String(sheetName).toLowerCase().trim();
  if (lower.includes('driller') || lower.includes('drilling')) return 'Driller';
  if (lower.includes('gw') || lower.includes('groundwork')) return 'Groundworker';
  if (lower.includes('depot')) return 'Yard/Depot Staff';
  return '';
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

// Force-complete markers — planners can add [DONE], [CLOSED], [COMPLETE] or
// [COMPLETED] to a job name in the spreadsheet to force it to completed status
// regardless of its dates. This gives planners explicit control over job lifecycle.
const FORCE_COMPLETE_MARKERS = ['[done]', '[closed]', '[complete]', '[completed]'];

function hasForceCompleteMarker(jobName) {
  if (!jobName) return false;
  const lower = normalizeName(jobName).toLowerCase();
  return FORCE_COMPLETE_MARKERS.some(m => lower.includes(m));
}

// Determine job status from its assignment dates:
//   force-complete marker  → completed (explicit planner override)
//   no dates               → planning
//   no activity in 30 days → completed (stale — not worked recently)
//   any today/future        → in_progress (actively being worked)
// The 30-day inactivity rule prevents old jobs with only historical dates from
// being held open indefinitely just because they still appear in the planner.
function determineJobStatus(dates, jobName) {
  if (hasForceCompleteMarker(jobName)) return 'completed';
  if (!dates || dates.length === 0) return 'planning';
  const sorted = [...dates].sort();
  const lastDate = sorted[sorted.length - 1];
  // Stale threshold: 30 days ago. If the last assignment was before this, the
  // job hasn't been worked on in over a month → mark as completed.
  const staleThreshold = new Date(TODAY + 'T00:00:00Z');
  staleThreshold.setUTCDate(staleThreshold.getUTCDate() - 30);
  const staleThresholdStr = staleThreshold.toISOString().slice(0, 10);
  if (lastDate < staleThresholdStr) return 'completed';
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
  /team\s*planner.*2026.*gw\+depot/i,
  /^drillers$/i,
];

function isTargetSheet(sheetName) {
  return TARGET_SHEET_PATTERNS.some(p => p.test(String(sheetName || '')));
}

function parseJobName(rawName) {
  const name = normalizeName(rawName);
  // "REF is LOCATION" separator
  const isMatch = name.match(/^(.+?)\s+is\s+(.+)$/i);
  if (isMatch) {
    return { name, job_reference: isMatch[1].trim(), location: isMatch[2].trim() };
  }
  // "REF - LOCATION" separator when left side looks like a job reference
  // (1-3 letters followed by 4-6 digits, e.g. "I260124 - EWR")
  const dashMatch = name.match(/^([A-Za-z]{1,3}\d{4,6})\s*[-–—]\s*(.+)$/);
  if (dashMatch) {
    const ref = dashMatch[1].trim();
    // Strip quantity suffix from location (e.g., "EWR - 3 No. 2 Monday" → "EWR")
    const rawLocation = dashMatch[2].trim();
    const cleanLocation = rawLocation.replace(/\s*[-–—]\s*\d+\s*No\.?\s*.*$/i, '').trim() || rawLocation;
    return { name: `${ref} - ${cleanLocation}`, job_reference: ref, location: cleanLocation };
  }
  // No ref — strip quantity suffix from the name itself (e.g., "EWR - 1No." → "EWR")
  const stripped = name.replace(/\s*[-–—]\s*\d+\s*No\.?\s*.*$/i, '').trim() || name;
  return { name: stripped, job_reference: '', location: '' };
}

// Extract a base grouping key from a job name so that sub-entries like
// "EWR - 1No.", "EWR - 2No.", "EWR Site" and the master "I260124 - EWR" all
// consolidate into one master job. Delegates to the shared canonicalJobKey
// which strips references, quantity suffixes, and noise suffix words (site,
// project, works, etc.) for robust deduplication.
function extractJobBaseKey(jobName) {
  return canonicalJobKey(jobName);
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

  // Interpolate daily dates between date columns. The planner shows
  // week-start dates in the header (e.g. every 7 columns) but staff
  // assignments appear in every daily column. Without interpolation, only
  // the columns with explicit date headers get mapped — daily assignments
  // in between are silently skipped, causing "no crews on site today".
  //
  // For each pair of consecutive date columns, if the column gap matches
  // the day difference (each column = one day), fill in the intermediate
  // columns with the correct daily dates. This handles weekly headers
  // (gap 7 = 7 days) robustly regardless of which pair is checked first.
  const dateCols = Object.keys(colToDate).map(Number).sort((a, b) => a - b);
  if (dateCols.length >= 2) {
    let lastColGap = 0;
    for (let i = 0; i < dateCols.length - 1; i++) {
      const startCol = dateCols[i];
      const endCol = dateCols[i + 1];
      const colGap = endCol - startCol;
      const startDate = new Date(colToDate[startCol] + 'T00:00:00Z');
      const endDate = new Date(colToDate[endCol] + 'T00:00:00Z');
      const dayDiff = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));
      if (colGap === dayDiff && colGap > 1) {
        lastColGap = colGap;
        for (let offset = 1; offset < colGap; offset++) {
          const fillCol = startCol + offset;
          if (!colToDate[fillCol]) {
            const d = new Date(startDate);
            d.setUTCDate(d.getUTCDate() + offset);
            colToDate[fillCol] = d.toISOString().slice(0, 10);
          }
        }
      }
    }
    // Extrapolate after the last date column (fill the final week)
    if (lastColGap > 1) {
      const lastCol = dateCols[dateCols.length - 1];
      const lastDate = new Date(colToDate[lastCol] + 'T00:00:00Z');
      for (let offset = 1; offset < lastColGap; offset++) {
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
  let rawSection = '';
  let isSubSection = false;
  let isAgencySectionFlag = false;
  let currentAgencyName = '';
  let currentSubcontractorName = '';

  // Pre-scan rows between the title row and the date header row for section
  // headers (some sheets list sections above the date grid).
  for (let r = 2; r < dateHeaderRowIdx; r++) {
    const row = rows[r];
    if (!row) continue;
    for (let c = 0; c < 6 && c < row.length; c++) {
      if (isSectionHeader(row[c])) {
        rawSection = String(row[c]).trim();
        currentSection = normalizeSection(rawSection);
        isSubSection = isSubcontractor(currentSection);
        isAgencySectionFlag = isAgencySection(currentSection);
        if (!isAgencySectionFlag) currentAgencyName = '';
        currentSubcontractorName = '';
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
        rawSection = String(cell).trim();
        currentSection = normalizeSection(rawSection);
        isSubSection = isSubcontractor(currentSection);
        isAgencySectionFlag = isAgencySection(currentSection);
        if (!isAgencySectionFlag) currentAgencyName = '';
        currentSubcontractorName = '';
        if (currentSection) sectionsFound.add(currentSection);
        foundSection = true;
        break;
      }
    }
    if (foundSection && !hasAssignment) continue;

    // Find the entity name in cols 0-5 — either a person name (direct staff),
    // a company name (subcontractor), or a rig/equipment name (plant).
    // Rig names often contain digits (asset numbers) which the person/company
    // checks reject, so looksLikeAssetName is the fallback that captures them.
    let entityName = null;
    let isCompanyName = false;
    let isAssetName = false;
    // Check for company names FIRST — company names like "PJ Drilling" match
    // both looksLikePersonName and looksLikeCompanyName, but the company check
    // is keyword-based and more specific. This applies to all sections since
    // a name containing "Drilling" or "Ltd" is always a company, never a person.
    for (let c = 0; c < 6; c++) {
      if (looksLikeCompanyName(row[c])) { entityName = normalizeName(row[c]); isCompanyName = true; break; }
    }
    // In subcontractor sections, also check for subbie-specific abbreviations
    // (e.g. "SI" = Site Investigations) that looksLikeCompanyName misses
    if (!entityName && isSubSection) {
      for (let c = 0; c < 6; c++) {
        const val = row[c];
        if (!val || val instanceof Date) continue;
        const s = String(val).trim();
        if (s.length < 2 || cellToDate(s) || isSectionHeader(s)) continue;
        if (!/[a-zA-Z]/.test(s) || /\d/.test(s)) continue;
        const words = s.toLowerCase().split(/\s+/);
        if (words.some(w => ['si', 'geo', 'specialists'].includes(w))) {
          entityName = normalizeName(s); isCompanyName = true; break;
        }
      }
    }
    if (!entityName) {
      for (let c = 0; c < 6; c++) {
        if (looksLikePersonName(row[c])) { entityName = normalizeName(row[c]); isCompanyName = false; break; }
        if (looksLikeCompanyName(row[c])) { entityName = normalizeName(row[c]); isCompanyName = true; break; }
        if (looksLikeAssetName(row[c])) { entityName = normalizeName(row[c]); isAssetName = true; break; }
      }
    }
    if (!entityName) continue;

    // Within an agency section, company names are the agency supplier —
    // track it and skip the row (don't create assignments for the agency
    // company itself). Person names after it are linked to that agency.
    if (isAgencySectionFlag && isCompanyName) {
      currentAgencyName = entityName;
      continue;
    }

    // Company names are always subcontractor companies — track and skip the row.
    // Person names after a company name are linked to that contractor.
    if (isCompanyName) {
      currentSubcontractorName = entityName;
      continue;
    }

    const entityIsSubbie = isSubSection || (!!currentSubcontractorName);
    const entityIsAgency = isAgencySectionFlag;
    const entityAgencyName = isAgencySectionFlag ? currentAgencyName : '';
    const entitySubcontractorName = (!entityIsAgency && currentSubcontractorName) ? currentSubcontractorName : '';

    let hadAssignment = false;
    for (const [colStr, date] of Object.entries(colToDate)) {
      const c = Number(colStr);
      const cellVal = row[c];
      if (!cellVal) continue;
      const jobName = normalizeName(cellVal);
      if (!jobName || jobName.length < 1) continue;
      if (jobName.length === 1) continue;
      let nonJobType = categorizeNonJobCell(jobName);
      let filteredAsNonJob = false;
      // Second-layer filter: cells that pass categorizeNonJobCell but still
      // aren't real client jobs (rig names, placeholders, overhead markers)
      // are treated as non-job overhead days so they don't create Job entities.
      if (!nonJobType && !isLikelyRealJob(jobName)) {
        nonJobType = 'training'; // overhead/internal — same bucket as yard/depot
        filteredAsNonJob = true;
      }
      assignments.push({
        staff_name: entityName,
        job_name: nonJobType ? null : jobName,
        non_job_type: nonJobType || undefined,
        non_job_label: nonJobType ? jobName : undefined,
        filtered_as_non_job: filteredAsNonJob,
        date,
        crew_section: currentSection, raw_crew_section: rawSection,
        sheet_name: sheetName,
        is_subcontractor_section: entityIsSubbie,
        is_agency_section: entityIsAgency,
        agency_name: entityAgencyName || undefined,
        subcontractor_name: entitySubcontractorName || undefined,
        is_potential_asset: isAssetName,
      });
      hadAssignment = true;
    }

    if (!hadAssignment) {
      assignments.push({
        staff_name: entityName, job_name: null, date: null,
        crew_section: currentSection, raw_crew_section: rawSection,
        sheet_name: sheetName,
        is_subcontractor_section: entityIsSubbie,
        is_agency_section: entityIsAgency,
        agency_name: entityAgencyName || undefined,
        subcontractor_name: entitySubcontractorName || undefined,
        is_potential_asset: isAssetName,
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
    const legacySheetNames = [];
    const warnings = [];
    const allSectionsDetected = new Set();
    const sheetBreakdown = [];

    // Process ALL tabs — target tabs (Team Planner 2026_GW+Depot, Drillers)
    // are the primary source. All other tabs are processed as legacy data:
    // their staff and jobs are created alongside target-tab data, and their
    // rota assignments are added as historical (completed) entries. One
    // upload does everything — no separate legacy import needed.
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const isTarget = isTargetSheet(sheetName);
      if (!isTarget) continue; // Only process target tabs — skip all others
      sheetNames.push(sheetName);
      const sheetAssignments = parseSheet(sheet, sheetName);
      for (const a of sheetAssignments) a.is_legacy = false;
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
        is_legacy: false,
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
      return Response.json({ error: `No assignment rows could be read from any tab in this file. Sheets found: ${workbook.SheetNames.join(', ')}` }, { status: 422 });
    }

    const allDates = allAssignments.map(a => a.date).filter(Boolean).sort();
    const dateFrom = allDates[0];
    const dateTo = allDates[allDates.length - 1];

    // -----------------------------------------------------------------------
    // 1b. Post-process: move rig/equipment rows from team planner sheets into
    // plantAssignments so they are linked to jobs as assets, not staff.
    // Rigs in the drilling sheets appear as row entries (name in cols 0-5,
    // job/site in date columns) but were previously skipped because their
    // names contain digits. Now looksLikeAssetName captures them, and here
    // we match each against SiteAssets to decide: asset → plantAssignments,
    // non-matching potential-asset → dropped (not a person), everything else
    // stays in teamAssignments for staff/rota resolution.
    // -----------------------------------------------------------------------
    // Parallel fetch — avoids sequential API round-trips that trigger rate limits
    const [allAssets, allRateCardItems] = await Promise.all([
      base44.asServiceRole.entities.SiteAsset.list('-created_date', 5000),
      base44.asServiceRole.entities.RateCardItem.list('-created_date', 5000),
    ]);
    const assetMaps = buildAssetMaps(allAssets);
    const assetById = new Map();
    for (const a of allAssets) assetById.set(a.id, a);

    const movedToPlant = [];
    const droppedPotentialAssets = new Set();
    const remainingTeamAssignments = [];
    for (const a of teamAssignments) {
      if (!a.staff_name || !a.is_potential_asset) {
        remainingTeamAssignments.push(a);
        continue;
      }
      const match = fuzzyFindAsset(a.staff_name, allAssets, assetMaps);
      // Move ALL potential assets to plantAssignments — even unmatched ones.
      // Unmatched ones are logged but still processed in step 6 so we can
      // report which rig names couldn't be matched to SiteAssets.
      movedToPlant.push(a);
      if (!match) {
        droppedPotentialAssets.add(a.staff_name);
      }
    }
    teamAssignments = remainingTeamAssignments;
    plantAssignments = plantAssignments.concat(movedToPlant);
    if (droppedPotentialAssets.size > 0) {
      warnings.push(`${droppedPotentialAssets.size} potential rig/equipment name(s) in the team planner did not match any SiteAsset: ${[...droppedPotentialAssets].slice(0, 10).join(', ')}${droppedPotentialAssets.size > 10 ? '…' : ''}`);
    }
    if (movedToPlant.length > 0) {
      warnings.push(`${movedToPlant.length} rig/equipment assignment(s) moved from team planner to plant matching (linked to jobs as assets).`);
    }

    // -----------------------------------------------------------------------
    // 2. PURGE — full wipe: delete ALL staff, teams, jobs, crews, rotas
    // -----------------------------------------------------------------------
    let purgeSummary = { rotas_deleted: 0, staff_deleted: 0, teams_deleted: 0, jobs_deleted: 0, crews_deleted: 0, asset_assignments_deleted: 0, training_bookings_deleted: 0, absences_deleted: 0 };
    // Parallel fetch all entity lists — 9 round-trips collapsed into 1 batch
    // to avoid hitting the platform API rate limit on large datasets.
    const [allRotas, allStaff, allTeams, allJobs, allCrews, allAssetAssignments, allCostItems, allTrainingBookings, allAbsences, allUsers] = await Promise.all([
      base44.asServiceRole.entities.RotaAssignment.list('-created_date', 5000),
      base44.asServiceRole.entities.Staff.list('-created_date', 5000),
      base44.asServiceRole.entities.Team.list('-created_date', 5000),
      base44.asServiceRole.entities.Job.list('-created_date', 5000),
      base44.asServiceRole.entities.DrillingCrew.list('-created_date', 5000),
      base44.asServiceRole.entities.JobAssetAssignment.list('-created_date', 5000),
      base44.asServiceRole.entities.JobCostItem.list('-created_date', 5000),
      base44.asServiceRole.entities.TrainingBooking.list('-created_date', 5000),
      base44.asServiceRole.entities.Absence.list('-created_date', 5000),
      base44.asServiceRole.entities.User.list('-created_date', 5000),
    ]);
    // Save existing user emails so we don't re-invite users who already have accounts.
    // User accounts persist across the full wipe (only Staff records are deleted),
    // so we check User emails directly — not Staff.user_id which gets wiped.
    const existingUserEmails = new Set();
    const userIdByEmail = new Map();
    for (const u of allUsers) {
      if (u.email) {
        existingUserEmails.add(u.email.toLowerCase());
        userIdByEmail.set(u.email.toLowerCase(), u.id);
      }
    }
    purgeSummary.rotas_deleted = allRotas.length;
    purgeSummary.staff_deleted = allStaff.length;
    purgeSummary.teams_deleted = allTeams.length;
    purgeSummary.jobs_deleted = allJobs.length;
    purgeSummary.crews_deleted = allCrews.length;
    purgeSummary.asset_assignments_deleted = allAssetAssignments.length;
    purgeSummary.cost_items_deleted = allCostItems.length;
    purgeSummary.training_bookings_deleted = allTrainingBookings.length;
    purgeSummary.absences_deleted = allAbsences.length;
    if (!dryRun) {
      // Parallel delete — 9 round-trips collapsed into 1 batch
      const deleteOps = [];
      if (allRotas.length > 0) deleteOps.push(base44.asServiceRole.entities.RotaAssignment.deleteMany({}));
      if (allStaff.length > 0) deleteOps.push(base44.asServiceRole.entities.Staff.deleteMany({}));
      if (allTeams.length > 0) deleteOps.push(base44.asServiceRole.entities.Team.deleteMany({}));
      if (allJobs.length > 0) deleteOps.push(base44.asServiceRole.entities.Job.deleteMany({}));
      if (allCrews.length > 0) deleteOps.push(base44.asServiceRole.entities.DrillingCrew.deleteMany({}));
      if (allAssetAssignments.length > 0) deleteOps.push(base44.asServiceRole.entities.JobAssetAssignment.deleteMany({}));
      if (allCostItems.length > 0) deleteOps.push(base44.asServiceRole.entities.JobCostItem.deleteMany({}));
      if (allTrainingBookings.length > 0) deleteOps.push(base44.asServiceRole.entities.TrainingBooking.deleteMany({}));
      if (allAbsences.length > 0) deleteOps.push(base44.asServiceRole.entities.Absence.deleteMany({}));
      if (deleteOps.length > 0) await Promise.all(deleteOps);
      warnings.push(`Full wipe: deleted ${purgeSummary.rotas_deleted} rotas, ${purgeSummary.staff_deleted} staff, ${purgeSummary.teams_deleted} teams, ${purgeSummary.jobs_deleted} jobs, ${purgeSummary.crews_deleted} crews, ${purgeSummary.asset_assignments_deleted} asset assignments, ${purgeSummary.cost_items_deleted} cost items, ${purgeSummary.training_bookings_deleted} training bookings, ${purgeSummary.absences_deleted} absences.`);
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
      // Fuzzy fallback: match to already-created staff with a similar name.
      // Handles typos and variations across tabs (e.g. "Jon Smith" → "John Smith")
      // so the same person isn't created twice under slightly different spellings.
      if (!staff && staffMap.size > 0) {
        const fuzzy = fuzzyFindStaff(name, [...staffMap.values()], 0.70);
        if (fuzzy) {
          staff = fuzzy.staff;
          staffMap.set(key, staff);
        }
      }

      const staffAssignments = teamAssignments.filter(a => nameKey(a.staff_name) === key);
      const inSubSection = staffAssignments.some(a => a.is_subcontractor_section);
      const inAgencySection = staffAssignments.some(a => a.is_agency_section);
      // Worker type is determined by the section the person appears under,
      // NOT by their name. Name-based company detection (isSubcontractor) was
      // too aggressive — it flagged direct employees with company-like surnames
      // (e.g. "John Drilling") as subcontractors.
      const subbie = inSubSection;
      const agency = inAgencySection;
      const workerType = agency ? 'agency' : (subbie ? 'subcontractor' : 'direct_employee');
      const crewSectionCounts = staffAssignments.map(a => a.crew_section).filter(Boolean);
      const mostCommonSection = getMostCommon(crewSectionCounts);
      // Fall back to raw crew section (non-work sections like "Leave/Sick" are
      // normalized to '' — use the original section name for job title inference,
      // excluding non-work sections since they don't indicate a real crew role)
      const rawSectionCounts = staffAssignments
        .map(a => a.raw_crew_section)
        .filter(s => s && !isNonWorkSection(s));
      const mostCommonRawSection = getMostCommon(rawSectionCounts);
      // Last resort: infer from the sheet name (Drillers → Driller, GW+Depot → Groundworker)
      const mostCommonSheet = getMostCommon(staffAssignments.map(a => a.sheet_name).filter(Boolean));
      const jobTitle = inferJobTitle(mostCommonSection)
        || inferJobTitle(mostCommonRawSection)
        || inferJobTitleFromSheet(mostCommonSheet);
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

      // Resolve the subcontractor company for subcontractor workers. The
      // company name comes from the company-name row above the worker in the
      // "Field Teams - Drilling Subbies" section.
      let subbieContractorId = undefined;
      if (subbie && !agency) {
        const subbieNames = staffAssignments.map(a => a.subcontractor_name).filter(Boolean);
        const subbieNameResolved = getMostCommon(subbieNames);
        if (subbieNameResolved) {
          const subbieRec = await findOrCreateSubcontractor(base44, subbieNameResolved, contractorMaps, dryRun);
          subbieContractorId = subbieRec.id;
        }
      }

      if (!staff) {
        const email = generateEmail(name, allKnownEmails);
        allKnownEmails.add(email.toLowerCase());
        // Link to existing User account if one exists for this email.
        // User accounts persist across the full wipe; only Staff records are deleted.
        const existingUserId = userIdByEmail.get(email.toLowerCase());
        newStaffPayloads.push({
          name, email, worker_type: workerType,
          agency_id: agencyId || subbieContractorId, job_title: jobTitle || undefined,
          team_id: team.id, is_active: true,
          user_id: existingUserId || undefined,
          invite_sent: !!existingUserId,
        });
        newStaffKeys.push(key);
      } else {
        staffFoundCount++;
        const updates = {};
        if (jobTitle && !staff.job_title) updates.job_title = jobTitle;
        if (!staff.worker_type) updates.worker_type = workerType;
        if (agency && agencyId && !staff.agency_id) updates.agency_id = agencyId;
        if (subbie && !agency && subbieContractorId && !staff.agency_id) updates.agency_id = subbieContractorId;
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

    // Invite direct staff who don't have user accounts yet
    let usersInvited = 0;
    if (!dryRun) {
      for (const staff of newStaff) {
        if (staff.worker_type === 'direct_employee' && staff.email && !existingUserEmails.has(staff.email.toLowerCase())) {
          try {
            await base44.users.inviteUser(staff.email, 'user');
            usersInvited++;
          } catch (e) { /* ignore — staff record still created */ }
        }
      }
    }

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
    const uniqueJobBaseKeys = new Set();
    const jobNameByBaseKey = {};
    const jobDatesByBaseKey = {};
    const jobRefByBaseKey = {};  // canonical base key → job reference (lowercase)
    for (const a of allAssignments) {
      if (!a.job_name) continue;
      const baseKey = extractJobBaseKey(a.job_name);
      uniqueJobBaseKeys.add(baseKey);
      // Prefer a name with a job reference (e.g., "I260124 - EWR" over "EWR - 1No.")
      const parsed = parseJobName(a.job_name);
      if (parsed.job_reference) {
        jobRefByBaseKey[baseKey] = parsed.job_reference.toLowerCase();
      }
      if (!jobNameByBaseKey[baseKey] || (parsed.job_reference && !parseJobName(jobNameByBaseKey[baseKey]).job_reference)) {
        jobNameByBaseKey[baseKey] = a.job_name;
      }
      if (a.date) {
        if (!jobDatesByBaseKey[baseKey]) jobDatesByBaseKey[baseKey] = [];
        jobDatesByBaseKey[baseKey].push(a.date);
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

    for (const baseKey of uniqueJobBaseKeys) {
      const rawName = jobNameByBaseKey[baseKey];
      const parsed = parseJobName(rawName);
      const jobDates = (jobDatesByBaseKey[baseKey] || []).sort();
      const jobStatus = determineJobStatus(jobDates, rawName);

      let job = null;
      if (parsed.job_reference) job = jobByReference.get(parsed.job_reference.toLowerCase());
      if (!job) job = jobByName.get(baseKey);
      // Fuzzy fallback: match to already-created jobs with a similar name.
      // Handles variations across tabs (e.g. "EWR Site" → "I260124 - EWR")
      // so the same job isn't created twice under slightly different names.
      if (!job && jobMap.size > 0) {
        // First try canonical-key substring match — catches cases where
        // one name is a subset of the other (e.g. "Holborn" vs "High Holborn")
        // which the fuzzy string matcher misses because the full name
        // includes a reference number that dilutes the similarity score.
        const canonKey = extractJobBaseKey(rawName);
        if (canonKey.length >= 4) {
          for (const [existingKey, existingJob] of jobMap) {
            if (existingKey === baseKey) continue;
            if (existingKey.length < 4) continue;
            if (canonKey.includes(existingKey) || existingKey.includes(canonKey)) {
              const queryWords = new Set(canonKey.split(/\s+/).filter(w => w.length > 2));
              const existingWords = new Set(existingKey.split(/\s+/).filter(w => w.length > 2));
              let common = 0;
              for (const w of queryWords) if (existingWords.has(w)) common++;
              if (common > 0) { job = existingJob; jobMap.set(baseKey, job); break; }
            }
          }
        }
      }
      if (!job && jobMap.size > 0) {
        const fuzzy = fuzzyFindJob(rawName, [...jobMap.values()], 0.65);
        if (fuzzy) {
          job = fuzzy.job;
          jobMap.set(baseKey, job);
        }
      }

      const jobCrewSections = teamAssignments
        .filter(a => a.job_name && extractJobBaseKey(a.job_name) === baseKey)
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
        newJobKeys.push(baseKey);
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
        jobMap.set(baseKey, job);
      }
    }

    if (newJobPayloads.length > 0) {
      // Safety: deduplicate by base key (final guard against duplicate job names)
      const seenJobKeys = new Set();
      const dedupedJobPayloads = [];
      const dedupedJobKeys = [];
      for (let i = 0; i < newJobPayloads.length; i++) {
        const jk = extractJobBaseKey(newJobPayloads[i].name);
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

    // Multi-index job lookup — allows plant assignments and rota entries to
    // find jobs by reference number OR canonical name OR raw name key OR
    // fuzzy name match. This handles cases where the plant planner uses just
    // the site name ("EWR") while the team planner used a ref ("I260124 - EWR").
    const jobByRef = new Map();
    const jobByCanonName = new Map();
    const jobByNameKey = new Map();
    for (const [baseKey, job] of jobMap) {
      if (jobRefByBaseKey[baseKey]) jobByRef.set(jobRefByBaseKey[baseKey], job);
      if (!jobByCanonName.has(baseKey)) jobByCanonName.set(baseKey, job);
      if (job.name) jobByNameKey.set(nameKey(job.name), job);
    }
    function findJobForAssignment(jobName) {
      if (!jobName) return null;
      const parsed = parseJobName(jobName);
      // 1. Try ref number
      if (parsed.job_reference) {
        const byRef = jobByRef.get(parsed.job_reference.toLowerCase());
        if (byRef) return byRef;
      }
      // 2. Try canonical name key
      const canonKey = extractJobBaseKey(jobName);
      const byCanon = jobByCanonName.get(canonKey);
      if (byCanon) return byCanon;
      // 3. Try raw name key
      const byName = jobByNameKey.get(nameKey(jobName));
      if (byName) return byName;
      // 4. Fuzzy match against all created jobs
      const fuzzy = fuzzyFindJob(jobName, [...jobByCanonName.values()], 0.55);
      if (fuzzy) return fuzzy.job;
      return null;
    }

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
    // 6. Resolve Rigs & Equipment from Plant Planner → JobAssetAssignment
    // -----------------------------------------------------------------------
    // Uses the SiteAssets loaded in step 1b (before staff resolution) to match
    // each plant-planner row to an asset by:
    //   1. Exact name key
    //   2. Serial-number containment (spreadsheet name contains a known serial)
    //   3. Fuzzy name similarity (token + Levenshtein + substring bonus)
    // When a rig is matched, its linked_equipment_ids (lifting gear, trailers)
    // are also pulled in so the job's "Rig & Gear" is fully populated.
    // The matched rig's rig_type also enriches the job's drilling_method.
    // (allAssets, assetMaps, assetById were loaded in step 1b)
    const rigAssignments = [];
    const assetMatchBreakdown = { exact: 0, serial: 0, fuzzy: 0, unmatched: 0 };
    const unmatchedAssetNames = new Set();
    const fuzzyAssetMatches = [];
    const jobDrillingMethodUpdates = []; // { id, drilling_method }

    for (const pa of plantAssignments) {
      if (!pa.job_name || !pa.staff_name) continue;
      const job = findJobForAssignment(pa.job_name);
      if (!job) continue;

      const match = fuzzyFindAsset(pa.staff_name, allAssets, assetMaps);
      if (!match) {
        assetMatchBreakdown.unmatched++;
        unmatchedAssetNames.add(pa.staff_name);
        continue;
      }
      const asset = match.asset;
      if (match.method === 'exact') assetMatchBreakdown.exact++;
      else if (match.method === 'serial') assetMatchBreakdown.serial++;
      else { assetMatchBreakdown.fuzzy++; fuzzyAssetMatches.push({ query: pa.staff_name, matched: asset.name, score: Math.round(match.score * 100), method: match.method }); }

      // Match rig to RateCardItem for day-rate pricing (project-scoped rates first)
      const isRigAsset = asset.is_rig || asset.asset_type === 'rig';
      const rateCardItem = isRigAsset ? findRigRateCardItem(asset, allRateCardItems, job.project_id) : null;
      const rigDayRate = rateCardItem ? (Number(rateCardItem.price) || 0) : 0;
      const rigUnit = rateCardItem?.unit || 'day';

      rigAssignments.push({
        job_id: job.id, job_name: job.name, asset_id: asset.id, asset_name: asset.name,
        asset_type: asset.asset_type || 'rig', rig_type: asset.rig_type || 'n/a',
        role: assetRole(asset), assigned_date: pa.date,
        is_rig: isRigAsset,
        rate_card_item_id: rateCardItem?.id || '',
        unit_cost: rigDayRate,
        unit_label: rigUnit,
        responsible_person: asset.responsible_person || '',
      });

      // Enrich job drilling_method from the matched rig's rig_type
      if (asset.is_rig && asset.rig_type && asset.rig_type !== 'n/a') {
        const current = job.drilling_method;
        if (!current || current === 'not_applicable') {
          jobDrillingMethodUpdates.push({ id: job.id, drilling_method: asset.rig_type });
          job.drilling_method = asset.rig_type; // update in-memory copy
        }
      }

      // Pull in linked equipment (lifting gear, trailers, machinery) so the
      // job's "Rig & Gear" is fully populated in one import.
      if (asset.linked_equipment_ids && asset.linked_equipment_ids.length > 0) {
        for (const eqId of asset.linked_equipment_ids) {
          const eq = assetById.get(eqId);
          if (!eq) continue;
          rigAssignments.push({
            job_id: job.id, job_name: job.name, asset_id: eq.id, asset_name: eq.name,
            asset_type: eq.asset_type || 'machinery', rig_type: 'n/a',
            role: assetRole(eq), assigned_date: pa.date,
            is_rig: false,
            rate_card_item_id: '',
            unit_cost: 0,
            unit_label: 'day',
            responsible_person: eq.responsible_person || '',
          });
        }
      }
    }

    // Deduplicate by (job_id, asset_id, assigned_date) — one assignment per asset per job per date
    const rigAssignmentMap = new Map();
    for (const ra of rigAssignments) {
      const key = `${ra.job_id}|${ra.asset_id}|${ra.assigned_date || ''}`;
      if (!rigAssignmentMap.has(key)) rigAssignmentMap.set(key, ra);
    }
    // Further deduplicate by (job_id, asset_id) keeping the earliest date.
    // Also collect ALL unique on-site dates per (job_id, asset_id) so the rig
    // quantity (day-rate billing) reflects actual days on site — not the full
    // job span which would over-count for active jobs with old history.
    const rigByJobAsset = new Map();
    const rigDatesByJobAsset = new Map();
    for (const ra of rigAssignmentMap.values()) {
      const key = `${ra.job_id}|${ra.asset_id}`;
      if (!rigDatesByJobAsset.has(key)) rigDatesByJobAsset.set(key, new Set());
      if (ra.assigned_date) rigDatesByJobAsset.get(key).add(ra.assigned_date);
      if (!rigByJobAsset.has(key) || (ra.assigned_date && (!rigByJobAsset.get(key).assigned_date || ra.assigned_date < rigByJobAsset.get(key).assigned_date))) {
        rigByJobAsset.set(key, ra);
      }
    }
    const dedupedRigAssignments = [...rigByJobAsset.values()];

    // Apply drilling_method enrichment from matched rigs
    if (jobDrillingMethodUpdates.length > 0 && !dryRun) {
      for (let i = 0; i < jobDrillingMethodUpdates.length; i += 400) {
        await base44.asServiceRole.entities.Job.bulkUpdate(jobDrillingMethodUpdates.slice(i, i + 400));
      }
    }

    // -----------------------------------------------------------------------
    // 7. Build desired rota set
    // -----------------------------------------------------------------------
    const desiredKeys = new Set();
    const rotasToCreate = [];
    const nonJobDays = [];
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
          week_start: getWeekStart(a.date),
          // Legacy (prehistoric) data is always historical → completed
          status: (a.is_legacy || a.date < TODAY) ? 'completed' : 'assigned',
          assignment_type: a.non_job_type,
          non_job_label: a.non_job_label || undefined,
        });
        nonJobCounts[a.non_job_type]++;
        nonJobDays.push({ staff_id: staff.id, staff_name: staff.name, date: a.date, type: a.non_job_type, label: a.non_job_label });
      } else if (a.job_name) {
        const job = findJobForAssignment(a.job_name);
        if (!job) continue;
        const key = `${staff.id}|${a.date}|${job.id}`;
        if (desiredKeys.has(key)) { duplicateRotaRows++; continue; }
        desiredKeys.add(key);
        rotasToCreate.push({
          staff_id: staff.id, job_id: job.id, assigned_date: a.date,
          week_start: getWeekStart(a.date),
          // Legacy (prehistoric) data is always historical → completed.
          // Past shifts are done; today's and future shifts are planned.
          // The dashboard "Crews On Site Today" widget filters by assigned_date
          // === today, so today's assignments appear there regardless of status.
          status: (a.is_legacy || a.date < TODAY) ? 'completed' : 'assigned',
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
    // 7c. Create Absence records from non-job assignments (holiday/sick/training)
    // -----------------------------------------------------------------------
    // Non-job rota days (annual_leave, sick, training) also become Absence
    // records so they appear in the Absence Manager and sync to Bob HR. Grouped
    // by staff + type + week → one absence per staff per type per week.
    const ABSENCE_REASON_MAP = { annual_leave: 'holiday', sick: 'sick', training: 'training' };
    const absencesByStaffTypeWeek = {};
    for (const d of nonJobDays) {
      const ws = getWeekStart(d.date);
      const key = `${d.staff_id}|${d.type}|${ws}`;
      if (!absencesByStaffTypeWeek[key]) absencesByStaffTypeWeek[key] = [];
      absencesByStaffTypeWeek[key].push(d);
    }

    const absencePayloads = [];
    const absenceBreakdown = [];
    for (const [key, days] of Object.entries(absencesByStaffTypeWeek)) {
      const parts = key.split('|');
      const staffId = parts[0];
      const type = parts[1];
      const reason = ABSENCE_REASON_MAP[type] || 'other';
      days.sort((a, b) => a.date.localeCompare(b.date));
      const startDate = days[0].date;
      const endDate = days[days.length - 1].date;
      const labels = [...new Set(days.map(d => d.label).filter(Boolean))];
      absencePayloads.push({
        staff_id: staffId,
        start_date: startDate,
        end_date: endDate,
        reason,
        notes: labels.length > 0 ? labels.join(', ') : undefined,
        status: 'approved',
        source: 'manual',
      });
      absenceBreakdown.push({
        staff_name: days[0].staff_name,
        staff_id: staffId,
        reason,
        type,
        start_date: startDate,
        end_date: endDate,
        days: days.length,
        notes: labels.length > 0 ? labels.join(', ') : '',
      });
    }

    let createdAbsences = 0;
    if (absencePayloads.length > 0 && !dryRun) {
      for (let i = 0; i < absencePayloads.length; i += 400) {
        const batch = absencePayloads.slice(i, i + 400);
        await base44.asServiceRole.entities.Absence.bulkCreate(batch);
        createdAbsences += batch.length;
      }
    } else {
      createdAbsences = absencePayloads.length;
    }

    // -----------------------------------------------------------------------
    // 8. Build full audit breakdown
    // -----------------------------------------------------------------------
    const subbieCount = [...uniqueStaffKeys].filter(k => {
      const inSub = teamAssignments.some(a => nameKey(a.staff_name) === k && a.is_subcontractor_section);
      return inSub;
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
      const subbie = inSub;
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
    const jobsBreakdown = [...uniqueJobBaseKeys].map(key => {
      const job = jobMap.get(key);
      const rawName = jobNameByBaseKey[key];
      const parsed = parseJobName(rawName);
      const dates = (jobDatesByBaseKey[key] || []).sort();
      const jAssignments = allAssignments.filter(a => a.job_name && extractJobBaseKey(a.job_name) === key);
      const staffList = [...new Set(jAssignments.map(a => a.staff_name))];
      const sections = [...new Set(jAssignments.map(a => a.crew_section).filter(Boolean))];
      return {
        name: parsed.name,
        reference: parsed.job_reference || '',
        location: parsed.location || '',
        status: determineJobStatus(dates, rawName),
        start_date: dates.length ? dates[0] : '',
        end_date: dates.length ? dates[dates.length - 1] : '',
        assignment_count: dates.length,
        staff_count: staffList.length,
        drilling_method: job?.drilling_method || inferDrillingMethod(sections[0]),
        crew_sections: sections,
        status_new: newJobKeys.includes(key) ? 'new' : 'existing',
      };
    });

    // -----------------------------------------------------------------------
    // 8b. Build crew JobCostItem payloads (labour + contractor_supplied)
    // -----------------------------------------------------------------------
    // One per (master job, staff/subcontractor). Computed here so the count
    // appears in the dry-run preview; actual bulkCreate happens in the apply step.
    const crewCostItemsByJobStaff = new Map();
    for (const a of teamAssignments) {
      if (!a.job_name || !a.date) continue;
      const job = findJobForAssignment(a.job_name);
      if (!job) continue;
      const baseKey = extractJobBaseKey(a.job_name);
      const staffKey = nameKey(a.staff_name);
      const ciKey = `${baseKey}|${staffKey}`;
      if (!crewCostItemsByJobStaff.has(ciKey)) {
        crewCostItemsByJobStaff.set(ciKey, {
          job_id: job.id, job_base_key: baseKey, staff_key: staffKey,
          staff_name: a.staff_name,
          is_subcontractor: a.is_subcontractor_section || isSubcontractor(a.staff_name),
          subcontractor_name: a.subcontractor_name,
          dates: [],
        });
      }
      crewCostItemsByJobStaff.get(ciKey).dates.push(a.date);
    }
    const crewCostItemPayloads = [];
    for (const ci of crewCostItemsByJobStaff.values()) {
      const dates = ci.dates.sort();
      const startDate = dates[0];
      const endDate = dates[dates.length - 1];
      const quantity = dates.length;
      const job = jobMap.get(ci.job_base_key);
      if (!job) continue;
      if (ci.is_subcontractor) {
        const contractorKey = ci.subcontractor_name ? nameKey(ci.subcontractor_name) : ci.staff_key;
        const contractor = contractorMaps.byNameKey.get(contractorKey);
        crewCostItemPayloads.push({
          job_id: job.id, category: 'contractor_supplied',
          contractor_id: contractor?.id || '',
          description: ci.staff_name,
          start_date: startDate, end_date: endDate,
          unit_cost: 0, quantity, unit_label: 'day',
          notes: 'Auto-created from planner import',
        });
      } else {
        const staff = staffMap.get(ci.staff_key);
        crewCostItemPayloads.push({
          job_id: job.id, category: 'labour',
          staff_id: staff?.id || '',
          description: staff?.job_title || staff?.name || ci.staff_name,
          start_date: startDate, end_date: endDate,
          unit_cost: 0, quantity, unit_label: 'day',
          notes: 'Auto-created from planner import',
        });
      }
    }

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
        users_invited: dryRun ? 0 : usersInvited,
      },
      jobs: {
        total: uniqueJobBaseKeys.size,
        found: jobFoundCount,
        new: newJobPayloads.length,
        updates: jobUpdates.length,
        completed: jobsBreakdown.filter(j => j.status === 'completed').length,
        in_progress: jobsBreakdown.filter(j => j.status === 'in_progress').length,
        planning: jobsBreakdown.filter(j => j.status === 'planning').length,
        filtered_as_non_jobs: allAssignments.filter(a => a.filtered_as_non_job).length,
        filtered_labels: [...new Set(allAssignments.filter(a => a.filtered_as_non_job).map(a => a.non_job_label))].slice(0, 50),
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
      absences: {
        created: absencePayloads.length,
        holiday: absencePayloads.filter(a => a.reason === 'holiday').length,
        sick: absencePayloads.filter(a => a.reason === 'sick').length,
        training: absencePayloads.filter(a => a.reason === 'training').length,
      },
      rig_assignments: {
        total: dedupedRigAssignments.length,
        rigs: dedupedRigAssignments.filter(ra => ra.role === 'primary_rig').length,
        linked_equipment: dedupedRigAssignments.filter(ra => ra.role !== 'primary_rig').length,
        match_breakdown: assetMatchBreakdown,
        unmatched_asset_names: [...unmatchedAssetNames].slice(0, 50),
        fuzzy_matches: fuzzyAssetMatches.slice(0, 50),
        drilling_methods_enriched: jobDrillingMethodUpdates.length,
      },
      crew_cost_items: {
        total: crewCostItemPayloads.length,
        labour: crewCostItemPayloads.filter(ci => ci.category === 'labour').length,
        contractor_supplied: crewCostItemPayloads.filter(ci => ci.category === 'contractor_supplied').length,
      },
      agencies: {
        total: Object.keys(agencyBreakdown).length,
        new: newAgencies.length,
        breakdown: agencyBreakdown,
      },
      sections_detected: [...allSectionsDetected],
      legacy: {
        sheets: legacySheetNames,
        sheet_count: legacySheetNames.length,
        assignment_count: allAssignments.filter(a => a.is_legacy).length,
      },
      target_tabs: sheetNames.filter(n => isTargetSheet(n)),
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
          job_name: ra.job_name, asset_name: ra.asset_name, asset_type: ra.asset_type,
          role: ra.role, rig_type: ra.rig_type, assigned_date: ra.assigned_date,
          is_rig: ra.is_rig, unit_cost: ra.unit_cost || 0, unit_label: ra.unit_label || 'day',
          rate_card_item_id: ra.rate_card_item_id || '',
          on_site_days: (rigDatesByJobAsset.get(`${ra.job_id}|${ra.asset_id}`) || new Set()).size
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
        absence_breakdown: absenceBreakdown,
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

    // Create JobCostItem records (not JobAssetAssignment) so rigs and gear
    // appear in the job's Logistics tab → Equipment & Assets section. This
    // matches the manual "Add Rig & Gear" flow which creates JobCostItem
    // records with category 'internal_equipment' and site_asset_id set.
    let rigAssignmentCount = 0;
    for (const ra of dedupedRigAssignments) {
      const raJob = findJobForAssignment(ra.job_name);
      const jobStart = ra.assigned_date || raJob?.start_date || '';
      const jobEnd = raJob?.end_date || '';
      // Count actual on-site days from the collected assignment dates — not the
      // full job span. This prevents active jobs with months of old history from
      // being billed for every day in the span; only days the rig was actually
      // scheduled count toward the day-rate quantity.
      const rigDates = rigDatesByJobAsset.get(`${ra.job_id}|${ra.asset_id}`);
      let rigQuantity = 1;
      const rigUnitLabel = ra.unit_label || 'day';
      if (rigUnitLabel === 'day' && rigDates && rigDates.size > 0) {
        rigQuantity = rigDates.size;
      }
      await base44.asServiceRole.entities.JobCostItem.create({
        job_id: ra.job_id,
        category: 'internal_equipment',
        description: ra.asset_name,
        site_asset_id: ra.asset_id,
        responsible_person: ra.responsible_person || '',
        rate_card_item_id: ra.rate_card_item_id || '',
        reference_number: '',
        start_date: jobStart,
        end_date: jobEnd,
        unit_cost: ra.unit_cost || 0,
        quantity: rigQuantity,
        unit_label: rigUnitLabel,
        vat_exempt: false,
        hire_status: 'active',
        current_location: 'yard',
        notes: ra.is_rig
          ? `Auto-linked from planner import${ra.rate_card_item_id ? ' — day rate from Our Rate Card' : ''}`
          : 'Included in rig day rate (auto-linked from planner import)',
      });
      rigAssignmentCount++;
    }

    // Create crew JobCostItem records (labour + contractor_supplied) —
    // payloads were built in step 8b so the count appears in the dry-run preview.
    let crewCostItemsCreated = 0;
    if (crewCostItemPayloads.length > 0 && !dryRun) {
      for (let i = 0; i < crewCostItemPayloads.length; i += 400) {
        const batch = crewCostItemPayloads.slice(i, i + 400);
        await base44.asServiceRole.entities.JobCostItem.bulkCreate(batch);
        crewCostItemsCreated += batch.length;
      }
    } else {
      crewCostItemsCreated = crewCostItemPayloads.length;
    }

    // Clean up: remove completed jobs and their rota assignments — only keep in-progress jobs
    let completedJobsRemoved = 0;
    if (!dryRun) {
      const allCreatedJobs = await base44.asServiceRole.entities.Job.list('-created_date', 5000);
      const completedJobs = allCreatedJobs.filter(j => j.status === 'completed');
      for (const job of completedJobs) {
        await base44.asServiceRole.entities.RotaAssignment.deleteMany({ job_id: job.id });
        await base44.asServiceRole.entities.Job.delete(job.id);
        completedJobsRemoved++;
      }
    }

    return Response.json({
      status: 'success',
      dry_run: false,
      summary: {
        ...summary,
        rotas: { created: createdCount, duplicates_collapsed: duplicateRotaRows },
        rig_assignments: { created: rigAssignmentCount, total: dedupedRigAssignments.length },
        crew_cost_items: { created: crewCostItemsCreated, total: crewCostItemPayloads.length },
        staff: { ...summary.staff, leavers_marked_inactive: leaversMarked, users_invited: usersInvited },
        training: { ...summary.training, bookings_created: createdTrainingBookings },
        absences: { ...summary.absences, created: createdAbsences },
        completed_jobs_removed: completedJobsRemoved,
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
      absence_breakdown: absenceBreakdown,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}