import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// Merge Weekly Timesheets
// ============================================================
// Called by an admin from the Timesheets settings page. Once every
// worked day in a staff member's week has been approved, this merges
// all those approved daily summaries into a single weekly record:
//   1. Fetches all approved daily summary entries (is_summary=true,
//      status='approved') for the given staff + week_start.
//   2. Aggregates total minutes, overtime minutes and meterage.
//   3. Creates one weekly summary record (is_weekly_summary=true,
//      status='approved') that the admin can download as a PDF.
//   4. Marks the daily summaries as 'merged' so they leave the
//      approval queue but stay in the audit trail.
//
// Re-running on an already-merged week replaces the weekly summary
// (deletes the old one and un-merges is NOT supported — merged dailies
// stay merged). This keeps payroll immutable once locked.

interface MergePayload {
  staff_id: string;
  week_start: string; // ISO Monday date
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body: MergePayload = await req.json().catch(() => ({}));

    if (!body.staff_id || !body.week_start) {
      return Response.json({ error: 'staff_id and week_start are required' }, { status: 400 });
    }

    // Fetch all daily summaries for this staff + week
    const allSummaries = await base44.asServiceRole.entities.Timesheet.filter({
      staff_id: body.staff_id,
      week_start: body.week_start,
      is_summary: true,
    });

    // Only approved daily summaries can be merged. Reject any that are still
    // pending/rejected so the admin knows to finish approving first.
    const approved = allSummaries.filter((t: any) => t.status === 'approved' && !t.is_weekly_summary);
    const notApproved = allSummaries.filter((t: any) => t.status !== 'approved' && t.status !== 'merged' && !t.is_weekly_summary);

    if (approved.length === 0) {
      return Response.json({
        error: notApproved.length > 0
          ? `${notApproved.length} day(s) are still pending or rejected. Approve every day first, then merge the week.`
          : 'No approved daily summaries found for this week.',
      }, { status: 422 });
    }

    // Aggregate totals
    const totalMins = approved.reduce((s: number, t: any) => s + (Number(t.task_duration_minutes) || 0), 0);
    const onSiteMins = approved.reduce((s: number, t: any) => s + (Number(t.on_site_minutes) || 0), 0);
    const travelMins = approved.reduce((s: number, t: any) => s + (Number(t.payable_travel_minutes) || 0), 0);
    const meterage = approved.reduce((s: number, t: any) => s + (Number(t.meterage) || 0), 0);
    const payableMins = onSiteMins + travelMins;

    // Fetch the caller for the approved_by_name audit
    let approverName = '';
    try {
      const user = await base44.auth.me();
      approverName = user?.full_name || user?.email || '';
    } catch (e) { /* proceed without */ }

    // Delete any previous weekly summary for this staff+week (re-merge support)
    try {
      const prevWeekly = await base44.asServiceRole.entities.Timesheet.filter({
        staff_id: body.staff_id,
        week_start: body.week_start,
        is_weekly_summary: true,
      });
      for (const w of prevWeekly) {
        await base44.asServiceRole.entities.Timesheet.delete(w.id);
      }
    } catch (e) { /* continue */ }

    // Fetch staff name for the record
    let staffName = '';
    try {
      const staff = await base44.asServiceRole.entities.Staff.get(body.staff_id);
      staffName = staff?.name || '';
    } catch (e) { /* skip */ }

    // Create the weekly summary record
    const weekly = await base44.asServiceRole.entities.Timesheet.create({
      staff_id: body.staff_id,
      date: body.week_start,
      week_start: body.week_start,
      task_description: 'Weekly Summary',
      task_duration_minutes: payableMins,
      total_hours: Math.round((payableMins / 60) * 100) / 100,
      on_site_minutes: onSiteMins,
      payable_travel_minutes: travelMins,
      meterage,
      status: 'approved',
      is_summary: true,
      is_weekly_summary: true,
      weekly_entry_ids: approved.map((t: any) => t.id).join(','),
      weekly_total_minutes: payableMins,
      weekly_meterage: meterage,
      approved_by_name: approverName,
      notes: `Merged ${approved.length} approved day(s) for ${staffName || 'staff'} · week of ${body.week_start}`,
    });

    // Mark the daily summaries as merged (they leave the approval queue)
    await base44.asServiceRole.entities.Timesheet.bulkUpdate(
      approved.map((t: any) => ({ id: t.id, status: 'merged' }))
    );

    return Response.json({
      status: 'success',
      staff_id: body.staff_id,
      staff_name: staffName,
      week_start: body.week_start,
      weekly_id: weekly.id,
      days_merged: approved.length,
      total_minutes: payableMins,
      meterage,
      message: `Merged ${approved.length} approved day(s) into one weekly timesheet${staffName ? ` for ${staffName}` : ''}.`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});