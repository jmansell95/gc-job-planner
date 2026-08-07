import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Auto-break detection — scans a day's timesheet entries for gaps ≥30 minutes
// between tasks that should have been a break, and flags non-compliant working
// patterns (no break after 6 hours, or shifts >11 hours without a 20-min break).
// Returns a report; does not modify timesheets — the manager approves the
// suggested break insertion.

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const staffId = body.staff_id;
    const date = body.date;
    if (!staffId || !date) {
      return Response.json({ error: 'staff_id and date are required' }, { status: 400 });
    }

    // Fetch all timesheet entries for this staff member on this date
    const entries = await base44.asServiceRole.entities.Timesheet.filter({
      staff_id: staffId,
      work_date: date,
    });

    if (!entries.length) {
      return Response.json({ ok: true, message: 'No timesheet entries found for this date', issues: [] });
    }

    // Sort by start time
    const sorted = entries
      .filter(e => e.start_time || e.clock_in)
      .sort((a, b) => (a.start_time || a.clock_in || '').localeCompare(b.start_time || b.clock_in || ''));

    const issues = [];
    let totalWorkMinutes = 0;
    let hasBreak = false;

    for (let i = 0; i < sorted.length; i++) {
      const entry = sorted[i];
      if (entry.is_break) {
        hasBreak = true;
        continue;
      }
      // Calculate duration
      const start = entry.start_time || entry.clock_in;
      const end = entry.end_time || entry.clock_out;
      if (start && end) {
        const [sh, sm] = start.split(':').map(Number);
        const [eh, em] = end.split(':').map(Number);
        const durMin = (eh * 60 + em) - (sh * 60 + sm);
        if (durMin > 0) totalWorkMinutes += durMin;
      }

      // Check for gaps between consecutive entries
      if (i < sorted.length - 1) {
        const next = sorted[i + 1];
        const thisEnd = entry.end_time || entry.clock_out;
        const nextStart = next.start_time || next.clock_in;
        if (thisEnd && nextStart && !next.is_break) {
          const [eh1, em1] = thisEnd.split(':').map(Number);
          const [sh2, sm2] = nextStart.split(':').map(Number);
          const gapMin = (sh2 * 60 + sm2) - (eh1 * 60 + em1);
          if (gapMin >= 30 && gapMin <= 120) {
            issues.push({
              type: 'unrecorded_break',
              severity: 'warning',
              message: `Gap of ${gapMin} minutes between ${thisEnd} and ${nextStart} — likely a missed break.`,
              suggested_break: { start: thisEnd, end: nextStart, duration_minutes: gapMin },
            });
          }
        }
      }
    }

    // Compliance checks
    if (!hasBreak && totalWorkMinutes > 360) {
      issues.push({
        type: 'no_break_over_6h',
        severity: 'critical',
        message: `Worked ${Math.floor(totalWorkMinutes / 60)}h ${totalWorkMinutes % 60}m with no recorded break — UK working time regulations require a 20-min break after 6 hours.`,
      });
    }

    if (totalWorkMinutes > 660) {
      issues.push({
        type: 'long_shift_no_break',
        severity: 'critical',
        message: `Shift exceeds 11 hours — ensure adequate rest breaks were taken.`,
      });
    }

    return Response.json({
      ok: true,
      staff_id: staffId,
      date,
      total_work_minutes: totalWorkMinutes,
      has_break: hasBreak,
      entry_count: sorted.length,
      issues,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}