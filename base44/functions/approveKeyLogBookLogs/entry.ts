import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// Approve KeyLogBook Site Logs → Generate Timesheets
// ============================================================
// Called by an admin from the Site Logs tab after reviewing the
// AI-professionalised driller activities. For each pending
// keylogbook_remarks log, this function:
//   1. Creates a draft Timesheet entry (on_site task) using the
//      parsed start_time, end_time and duration_minutes.
//   2. Marks the log as approved (manager_review_status='approved').
//
// The admin can edit the log descriptions/times before approving —
// those edits are preserved and flow into the timesheet.

interface ApprovePayload {
  job_id: string;
  date: string;
  staff_id?: string; // optional: restrict to one staff member
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

    // Sort by start_time so timesheet entries are chronological
    pendingLogs.sort((a: any, b: any) => (a.start_time || '99:99').localeCompare(b.start_time || '99:99'));

    // Find the rota assignment for this job+date to get the staff_id
    const assignments = await base44.asServiceRole.entities.RotaAssignment.filter({
      job_id: body.job_id,
      assigned_date: body.date,
    });

    let staffId = body.staff_id || (assignments[0]?.staff_id || '');
    let staffName = '';
    if (staffId) {
      try {
        const staff = await base44.asServiceRole.entities.Staff.get(staffId);
        staffName = staff?.name || '';
      } catch (e) { /* skip */ }
    }

    // Delete any existing draft timesheets for this staff+date+job (overwrite mode)
    try {
      const existingTimesheets = await base44.asServiceRole.entities.Timesheet.filter({
        staff_id: staffId,
        date: body.date,
        job_id: body.job_id,
      });
      const drafts = existingTimesheets.filter((t: any) => t.status === 'draft' || t.status === 'submitted');
      if (drafts.length > 0) {
        for (const t of drafts) {
          await base44.asServiceRole.entities.Timesheet.delete(t.id);
        }
      }
    } catch (e) { /* continue */ }

    // Create a draft timesheet entry for each approved activity
    let timesheetsCreated = 0;
    const now = new Date().toISOString();

    for (const log of pendingLogs) {
      const startTime = log.start_time || '';
      const endTime = log.end_time || '';
      const durationMins = log.duration_minutes || 0;
      const description = log.description || 'Site activity';

      // Skip entries with no duration and no times (can't build a timesheet from them)
      if (!startTime && !endTime && !durationMins) continue;

      await base44.asServiceRole.entities.Timesheet.create({
        staff_id: staffId,
        job_id: body.job_id,
        date: body.date,
        task_description: description,
        task_type: 'on_site',
        start_time: startTime || null,
        end_time: endTime || null,
        task_duration_minutes: durationMins,
        total_hours: Math.round((durationMins / 60) * 100) / 100,
        status: 'draft',
        is_summary: false,
        notes: `Auto-generated from KeyLogBook site log (approved)`,
      });
      timesheetsCreated++;

      // Mark the log as approved
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
      timesheets_created: timesheetsCreated,
      staff_name: staffName,
      message: `Approved ${pendingLogs.length} site log${pendingLogs.length === 1 ? '' : 's'} and generated ${timesheetsCreated} timesheet entr${timesheetsCreated === 1 ? 'y' : 'ies'}${staffName ? ` for ${staffName}` : ''}.`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});