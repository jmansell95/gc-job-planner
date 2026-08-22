// ============================================================
// Shared KeyLogBook → Timesheet generation logic
// ============================================================
// Used by BOTH:
//   • receiveKeyLogBookData (webhook)  — auto-generates the timesheet
//     immediately after inserting site logs (fully automatic, no manual
//     manager review step)
//   • approveKeyLogBookLogs (manual)   — re-generates the timesheet
//     when a manager re-approves after editing logs
//
// Aggregates all keylogbook_remarks logs for a given job+date into a
// single SUBMITTED daily summary timesheet, and marks the logs as
// approved.

// Monday of the week for a given ISO date
export function weekKey(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(d);
  monday.setDate(d.getDate() - diff);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, '0');
  const dd = String(monday.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export interface GenerateTimesheetResult {
  status: 'success' | 'no_logs';
  approved: number;
  timesheets_created: number;
  staff_name: string;
  message: string;
}

/**
 * Generate (or re-generate) a submitted daily summary timesheet from
 * keylogbook_remarks site logs for a given job+date.
 *
 * - Fetches all keylogbook_remarks logs for job+date (any review status)
 * - Sorts by start_time
 * - Resolves the staff_id from the rota (or uses the provided staffId)
 * - Deletes any existing draft/submitted/rejected summary for this staff+date+job
 * - Creates a single submitted daily summary timesheet
 * - Marks all logs as approved
 *
 * Pass autoApprove=true to mark logs as approved regardless of their
 * current review status (used by the webhook for fully-automatic flow).
 */
export async function generateKeyLogBookTimesheet(
  base44: any,
  jobId: string,
  date: string,
  staffIdOverride?: string
): Promise<GenerateTimesheetResult> {
  // Fetch all keylogbook_remarks logs for this job+date (any review status)
  const logs = await base44.asServiceRole.entities.InvestigationLog.filter({
    job_id: jobId,
    date,
    source: 'keylogbook_remarks',
  });

  if (logs.length === 0) {
    return {
      status: 'no_logs',
      approved: 0,
      timesheets_created: 0,
      staff_name: '',
      message: 'No site logs to process',
    };
  }

  // Sort by start_time so the summary reads chronologically
  logs.sort((a: any, b: any) => (a.start_time || '99:99').localeCompare(b.start_time || '99:99'));

  // Find the rota assignment for this job+date to get the staff_id
  const assignments = await base44.asServiceRole.entities.RotaAssignment.filter({
    job_id: jobId,
    assigned_date: date,
  });

  let staffId = staffIdOverride || (logs[0]?.staff_id) || (assignments[0]?.staff_id) || '';
  let staffName = '';
  let isOvertime = false;
  let rateMultiplier: number | null = null;

  if (staffId) {
    try {
      const staff = await base44.asServiceRole.entities.Staff.get(staffId);
      staffName = staff?.name || '';
    } catch (e) { /* skip */ }
  }

  // Inherit overtime flag from the matching rota assignment
  const matchingAssignment = assignments.find((a: any) => a.staff_id === staffId);
  if (matchingAssignment && matchingAssignment.is_overtime) {
    isOvertime = true;
    if (matchingAssignment.rate_multiplier != null && matchingAssignment.rate_multiplier !== '') {
      rateMultiplier = Number(matchingAssignment.rate_multiplier);
    }
  }

  // Delete any existing submitted/draft/rejected summary entries for this staff+date+job
  // (overwrite mode — re-generating replaces the previous summary)
  try {
    const existing = await base44.asServiceRole.entities.Timesheet.filter({
      staff_id: staffId,
      date,
      job_id: jobId,
      is_summary: true,
    });
    const toRemove = existing.filter((t: any) =>
      t.status === 'submitted' || t.status === 'draft' || t.status === 'rejected'
    );
    for (const t of toRemove) {
      await base44.asServiceRole.entities.Timesheet.delete(t.id);
    }
  } catch (e) { /* continue */ }

  // Aggregate all activities into one daily summary
  const onSiteMins = logs.reduce((s: number, l: any) => s + (Number(l.duration_minutes) || 0), 0);
  const activityNotes = logs
    .map((l: any) => l.description || 'Site activity')
    .filter(Boolean)
    .join(' · ');
  const firstStart = logs.find((l: any) => l.start_time)?.start_time || '';
  const lastEnd = [...logs].reverse().find((l: any) => l.end_time)?.end_time || '';
  const wk = weekKey(date);

  const summaryData: Record<string, any> = {
    staff_id: staffId,
    job_id: jobId,
    date,
    week_start: wk,
    task_description: 'Daily Summary',
    task_duration_minutes: onSiteMins,
    total_hours: Math.round((onSiteMins / 60) * 100) / 100,
    on_site_minutes: onSiteMins,
    start_time: firstStart || null,
    end_time: lastEnd || null,
    status: 'submitted',
    is_summary: true,
    notes: activityNotes || 'Auto-generated from KeyLogBook site logs',
  };

  if (isOvertime) {
    summaryData.is_overtime = true;
    if (rateMultiplier != null) summaryData.rate_multiplier = rateMultiplier;
  }

  await base44.asServiceRole.entities.Timesheet.create(summaryData);

  // Mark every log as approved
  const now = new Date().toISOString();
  for (const log of logs) {
    await base44.asServiceRole.entities.InvestigationLog.update(log.id, {
      manager_review_status: 'approved',
      manager_reviewed_at: now,
      manager_review_note: 'Auto-approved — timesheet generated automatically',
    });
  }

  return {
    status: 'success',
    approved: logs.length,
    timesheets_created: 1,
    staff_name: staffName,
    message: `Auto-approved ${logs.length} site log${logs.length === 1 ? '' : 's'} and generated 1 submitted daily summary${staffName ? ` for ${staffName}` : ''}.`,
  };
}