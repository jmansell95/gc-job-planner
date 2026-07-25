import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// Approve KeyLogBook Site Logs → Generate a Submitted Daily Summary
// ============================================================
// Called by an admin from the Site Logs tab after reviewing the
// AI-professionalised driller activities. Instead of creating many
// granular draft entries (which never appeared in the Timesheets
// page because that page filters for submitted/approved), this now
// creates a single SUBMITTED daily summary per staff+date+job —
// identical in shape to what submitDailyTimesheet produces — so the
// approved site log is immediately visible and approvable in the
// Timesheets settings page, and ready for weekly merge.
//
// The admin can edit the log descriptions/times before approving —
// those edits are preserved and flow into the summary's notes.

interface ApprovePayload {
  job_id: string;
  date: string;
  staff_id?: string; // optional: restrict to one staff member
}

// Monday of the week for a given ISO date (matches utils/overtime weekKey)
function weekKey(dateStr: string): string {
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body: ApprovePayload = await req.json().catch(() => ({}));

    if (!body.job_id || !body.date) {
      return Response.json({ error: 'job_id and date are required' }, { status: 400 });
    }

    // Fetch all pending keylogbook_remarks logs for this job+date
    const filter: Record<string, any> = {
      job_id: body.job_id,
      date: body.date,
      source: 'keylogbook_remarks',
      manager_review_status: 'pending',
    };
    const pendingLogs = await base44.asServiceRole.entities.InvestigationLog.filter(filter);

    if (pendingLogs.length === 0) {
      return Response.json({ status: 'success', message: 'No pending site logs to approve', approved: 0, timesheets_created: 0 });
    }

    // Sort by start_time so the summary reads chronologically
    pendingLogs.sort((a: any, b: any) => (a.start_time || '99:99').localeCompare(b.start_time || '99:99'));

    // Find the rota assignment for this job+date to get the staff_id
    const assignments = await base44.asServiceRole.entities.RotaAssignment.filter({
      job_id: body.job_id,
      assigned_date: body.date,
    });

    let staffId = body.staff_id || (assignments[0]?.staff_id || '');
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

    // Delete any existing submitted/draft summary entries for this staff+date+job
    // (overwrite mode — re-approving the day replaces the previous summary)
    try {
      const existing = await base44.asServiceRole.entities.Timesheet.filter({
        staff_id: staffId,
        date: body.date,
        job_id: body.job_id,
        is_summary: true,
      });
      const toRemove = existing.filter((t: any) => t.status === 'submitted' || t.status === 'draft' || t.status === 'rejected');
      for (const t of toRemove) {
        await base44.asServiceRole.entities.Timesheet.delete(t.id);
      }
    } catch (e) { /* continue */ }

    // Aggregate all approved activities into one daily summary
    const onSiteMins = pendingLogs.reduce((s: number, l: any) => s + (Number(l.duration_minutes) || 0), 0);
    const activityNotes = pendingLogs
      .map((l: any) => l.description || 'Site activity')
      .filter(Boolean)
      .join(' · ');
    const firstStart = pendingLogs.find((l: any) => l.start_time)?.start_time || '';
    const lastEnd = [...pendingLogs].reverse().find((l: any) => l.end_time)?.end_time || '';
    const wk = weekKey(body.date);

    const summaryData: Record<string, any> = {
      staff_id: staffId,
      job_id: body.job_id,
      date: body.date,
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
    for (const log of pendingLogs) {
      await base44.asServiceRole.entities.InvestigationLog.update(log.id, {
        manager_review_status: 'approved',
        manager_reviewed_at: now,
        manager_review_note: 'Approved via Site Logs tab — timesheet generated',
      });
    }

    return Response.json({
      status: 'success',
      job_id: body.job_id,
      date: body.date,
      approved: pendingLogs.length,
      timesheets_created: 1,
      staff_name: staffName,
      message: `Approved ${pendingLogs.length} site log${pendingLogs.length === 1 ? '' : 's'} and generated 1 submitted daily summary${staffName ? ` for ${staffName}` : ''}.`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});