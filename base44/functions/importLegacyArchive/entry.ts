import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import * as XLSX from 'npm:xlsx@0.18.5';
import { nameKey, normalizeName, buildStaffMaps, buildJobMaps } from '../../shared/entityRegistry.ts';
import { cellToDate, getWeekStart, categorizeNonJobCell, isSectionHeader, looksLikePersonName } from '../../shared/spreadsheetParser.ts';

// ---------------------------------------------------------------------------
// Legacy Archive Import — Prehistoric Spreadsheet Data
// ---------------------------------------------------------------------------
// Parses ALL tabs that importPlannerSpreadsheet skips (everything except
// "Team Planner 2026_GW+Depot" and "Drillers"). For each assignment row:
//
//   • Matches the staff name to an EXISTING Staff record (by normalised name key)
//   • Matches the job name to an EXISTING Job record (by name key or reference)
//   • Creates a historical RotaAssignment for every matched staff+job+date
//   • Unmatched staff or jobs are reported as warnings — NOT created
//
// This is a NON-DESTRUCTIVE import: it never wipes, never creates staff,
// never creates jobs. It only fills in historical rota assignments for
// entities that already exist in the system from the active planner import.
//
// Two modes:
//   dry_run: true  → preview what would be imported, no writes
//   dry_run: false → create the matched rota assignments
// ---------------------------------------------------------------------------

const TARGET_SHEET_PATTERNS = [
  /team\s*planner.*2026.*(gw|depot)/i,
  /driller/i,
];

function isTargetSheet(sheetName) {
  return TARGET_SHEET_PATTERNS.some(p => p.test(String(sheetName || '')));
}

// Parse a single legacy sheet — same structure as the planner importer
function parseSheet(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
  if (rows.length < 5) return [];

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

  const colToDate = {};
  for (let c = 0; c < rows[dateHeaderRowIdx].length; c++) {
    const d = cellToDate(rows[dateHeaderRowIdx][c]);
    if (d) colToDate[c] = d;
  }

  // Weekly date interpolation
  const dateCols = Object.keys(colToDate).map(Number).sort((a, b) => a - b);
  if (dateCols.length >= 2) {
    const gap = dateCols[1] - dateCols[0];
    if (gap === 7) {
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
  let currentSection = '';

  for (let r = dateHeaderRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const firstCells = [row[0], row[1], row[2], row[3], row[4], row[5]].filter(v => v !== null && v !== undefined && String(v).trim() !== '');

    let hasAssignment = false;
    for (const colStr of Object.keys(colToDate)) {
      const c = Number(colStr);
      if (row[c] && String(row[c]).trim()) { hasAssignment = true; break; }
    }

    let foundSection = false;
    for (const cell of firstCells) {
      if (isSectionHeader(cell)) {
        currentSection = String(cell).trim();
        foundSection = true;
        break;
      }
    }
    if (foundSection && !hasAssignment) continue;

    let entityName = null;
    for (let c = 0; c < 6; c++) {
      if (looksLikePersonName(row[c])) { entityName = normalizeName(row[c]); break; }
    }
    if (!entityName) continue;

    for (const [colStr, date] of Object.entries(colToDate)) {
      const c = Number(colStr);
      const cellVal = row[c];
      if (!cellVal) continue;
      const jobName = normalizeName(cellVal);
      if (!jobName || jobName.length < 2) continue;
      const nonJobType = categorizeNonJobCell(jobName);
      assignments.push({
        staff_name: entityName,
        job_name: nonJobType ? null : jobName,
        non_job_type: nonJobType || undefined,
        non_job_label: nonJobType ? jobName : undefined,
        date,
        crew_section: currentSection,
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
    if (!fileUrl) return Response.json({ error: 'file_url is required' }, { status: 400 });

    // Fetch and parse the Excel file
    const fileRes = await fetch(fileUrl);
    if (!fileRes.ok) return Response.json({ error: 'Could not download the uploaded file' }, { status: 422 });
    const arrayBuffer = await fileRes.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });

    // Identify legacy sheets (everything NOT matched by the active importer)
    const legacySheetNames = workbook.SheetNames.filter(n => !isTargetSheet(n));
    if (legacySheetNames.length === 0) {
      return Response.json({ error: 'No legacy sheets found. All tabs in this file are already handled by the active planner importer.' }, { status: 422 });
    }

    // Parse all legacy sheets
    const allAssignments = [];
    const sheetBreakdown = [];
    for (const sheetName of legacySheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const sheetAssignments = parseSheet(sheet);
      const sheetDates = sheetAssignments.map(a => a.date).filter(Boolean).sort();
      sheetBreakdown.push({
        sheet: sheetName,
        assignments: sheetAssignments.length,
        date_range: sheetDates.length ? { from: sheetDates[0], to: sheetDates[sheetDates.length - 1] } : null,
      });
      allAssignments.push(...sheetAssignments);
    }

    if (allAssignments.length === 0) {
      return Response.json({
        status: 'success',
        dry_run: dryRun,
        summary: {
          legacy_sheets: legacySheetNames,
          total_assignments: 0,
          matched_staff: 0,
          unmatched_staff: 0,
          matched_jobs: 0,
          unmatched_jobs: 0,
          rotas_to_create: 0,
        },
        sheet_breakdown: sheetBreakdown,
        unmatched_staff: [],
        unmatched_jobs: [],
      });
    }

    // Load existing staff and jobs (do NOT wipe or create)
    const existingStaff = await base44.asServiceRole.entities.Staff.list('-created_date', 5000);
    const existingJobs = await base44.asServiceRole.entities.Job.list('-created_date', 5000);
    const staffMaps = buildStaffMaps(existingStaff);
    const jobMaps = buildJobMaps(existingJobs);

    // Match staff and jobs
    const matchedAssignments = [];
    const unmatchedStaffNames = new Set();
    const unmatchedJobNames = new Set();
    const matchedStaffIds = new Set();
    const matchedJobIds = new Set();

    for (const a of allAssignments) {
      if (!a.date) continue;
      const staffKey = nameKey(a.staff_name);
      const staff = staffMaps.byNameKey.get(staffKey);
      if (!staff) {
        unmatchedStaffNames.add(a.staff_name);
        continue;
      }
      matchedStaffIds.add(staff.id);

      if (a.non_job_type) {
        matchedAssignments.push({
          staff_id: staff.id,
          assigned_date: a.date,
          week_start: getWeekStart(a.date),
          status: 'completed',
          assignment_type: a.non_job_type,
          non_job_label: a.non_job_label || undefined,
        });
      } else if (a.job_name) {
        const jobKey = nameKey(a.job_name);
        const job = jobMaps.byNameKey.get(jobKey);
        if (!job) {
          unmatchedJobNames.add(a.job_name);
          continue;
        }
        matchedJobIds.add(job.id);
        matchedAssignments.push({
          staff_id: staff.id,
          job_id: job.id,
          assigned_date: a.date,
          week_start: getWeekStart(a.date),
          status: 'completed',
        });
      }
    }

    // Deduplicate rota assignments
    const desiredKeys = new Set();
    const rotasToCreate = [];
    let duplicateCount = 0;
    for (const r of matchedAssignments) {
      const key = r.job_id
        ? `${r.staff_id}|${r.assigned_date}|${r.job_id}`
        : `${r.staff_id}|${r.assigned_date}|${r.assignment_type}`;
      if (desiredKeys.has(key)) { duplicateCount++; continue; }
      desiredKeys.add(key);
      rotasToCreate.push(r);
    }

    // Check for existing rota assignments to avoid true duplicates
    const existingRotas = await base44.asServiceRole.entities.RotaAssignment.list('-created_date', 5000);
    const existingRotaKeys = new Set();
    for (const r of existingRotas) {
      const key = r.job_id
        ? `${r.staff_id}|${r.assigned_date}|${r.job_id}`
        : `${r.staff_id}|${r.assigned_date}|${r.assignment_type}`;
      existingRotaKeys.add(key);
    }
    const trulyNewRotas = rotasToCreate.filter(r => {
      const key = r.job_id
        ? `${r.staff_id}|${r.assigned_date}|${r.job_id}`
        : `${r.staff_id}|${r.assigned_date}|${r.assignment_type}`;
      return !existingRotaKeys.has(key);
    });

    // Build absence payloads from non-job assignments (holiday/sick/training)
    const ABSENCE_REASON_MAP = { annual_leave: 'holiday', sick: 'sick', training: 'training' };
    const nonJobRotas = trulyNewRotas.filter(r => r.assignment_type);
    const absencesByStaffTypeWeek = {};
    for (const r of nonJobRotas) {
      const key = `${r.staff_id}|${r.assignment_type}|${r.week_start}`;
      if (!absencesByStaffTypeWeek[key]) absencesByStaffTypeWeek[key] = [];
      absencesByStaffTypeWeek[key].push(r);
    }
    const absencePayloads = [];
    for (const [key, rotas] of Object.entries(absencesByStaffTypeWeek)) {
      const [staffId, type] = key.split('|');
      const reason = ABSENCE_REASON_MAP[type] || 'other';
      const dates = rotas.map(r => r.assigned_date).sort();
      const labels = [...new Set(rotas.map(r => r.non_job_label).filter(Boolean))];
      absencePayloads.push({
        staff_id: staffId,
        start_date: dates[0],
        end_date: dates[dates.length - 1],
        reason,
        notes: labels.length > 0 ? labels.join(', ') : undefined,
        status: 'approved',
        source: 'manual',
      });
    }

    const summary = {
      legacy_sheets: legacySheetNames,
      total_assignments: allAssignments.length,
      matched_staff: matchedStaffIds.size,
      unmatched_staff: unmatchedStaffNames.size,
      matched_jobs: matchedJobIds.size,
      unmatched_jobs: unmatchedJobNames.size,
      rotas_to_create: trulyNewRotas.length,
      duplicates_skipped: rotasToCreate.length - trulyNewRotas.length,
      internal_duplicates_collapsed: duplicateCount,
      absences_to_create: absencePayloads.length,
    };

    if (dryRun) {
      return Response.json({
        status: 'success',
        dry_run: true,
        summary,
        sheet_breakdown: sheetBreakdown,
        unmatched_staff: [...unmatchedStaffNames].slice(0, 100),
        unmatched_jobs: [...unmatchedJobNames].slice(0, 100),
      });
    }

    // Apply — create rota assignments in batches
    let createdCount = 0;
    for (let i = 0; i < trulyNewRotas.length; i += 400) {
      const batch = trulyNewRotas.slice(i, i + 400);
      await base44.asServiceRole.entities.RotaAssignment.bulkCreate(batch);
      createdCount += batch.length;
    }

    // Create Absence records (check for existing to avoid duplicates)
    const existingAbsences = await base44.asServiceRole.entities.Absence.list('-created_date', 5000);
    const existingAbsenceKeys = new Set();
    for (const a of existingAbsences) {
      existingAbsenceKeys.add(`${a.staff_id}|${a.start_date}|${a.end_date}|${a.reason}`);
    }
    const trulyNewAbsences = absencePayloads.filter(a =>
      !existingAbsenceKeys.has(`${a.staff_id}|${a.start_date}|${a.end_date}|${a.reason}`)
    );
    let createdAbsences = 0;
    for (let i = 0; i < trulyNewAbsences.length; i += 400) {
      const batch = trulyNewAbsences.slice(i, i + 400);
      await base44.asServiceRole.entities.Absence.bulkCreate(batch);
      createdAbsences += batch.length;
    }

    return Response.json({
      status: 'success',
      dry_run: false,
      summary: { ...summary, rotas_created: createdCount, absences_created: createdAbsences },
      sheet_breakdown: sheetBreakdown,
      unmatched_staff: [...unmatchedStaffNames].slice(0, 100),
      unmatched_jobs: [...unmatchedJobNames].slice(0, 100),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}