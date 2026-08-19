import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// syncPermanentCrew — auto-generates RotaAssignment rows for the
// job's permanent recurring crew whenever the job's date span is
// extended or the permanent crew rule is updated.
//
// Triggered by an entity automation on Job update (end_date change)
// and can also be invoked directly from the Quick Assign modal.
//
// For each permanent crew member, for each working day in their
// weekly pattern between the job's start_date and end_date (or their
// own end_date if set), if no RotaAssignment already exists for that
// staff+date+job, one is created. Existing assignments are never
// duplicated or overwritten.
// ============================================================

const computeWeekStart = (dateStr: string): string => {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diff);
  return monday.toISOString().slice(0, 10);
};

const buildDateList = (startStr: string, endStr: string, workingDays: number[]): string[] => {
  const days: string[] = [];
  const d = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T00:00:00');
  while (d <= end) {
    // getUTCDay: 0=Sun, 1=Mon ... 6=Sat
    // workingDays uses 1=Mon ... 7=Sun
    const jsDay = d.getUTCDay();
    const patternDay = jsDay === 0 ? 7 : jsDay;
    if (workingDays.includes(patternDay)) {
      days.push(d.toISOString().slice(0, 10));
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return days;
};

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Support two call modes:
    // 1. Automation payload: { event, data, old_data }
    // 2. Direct invoke: { job_id }
    let jobId: string | undefined;
    let jobData: any;
    let oldData: any = null;

    if (body.event && body.data) {
      // Entity automation payload
      jobId = body.data.id || body.event?.entity_id;
      jobData = body.data;
      oldData = body.old_data;
    } else {
      jobId = body.job_id;
      if (!jobId) return Response.json({ error: 'job_id is required' }, { status: 400 });
      try {
        jobData = await base44.asServiceRole.entities.Job.get(jobId);
      } catch (_) {
        return Response.json({ error: 'Job not found' }, { status: 404 });
      }
    }

    if (!jobData) return Response.json({ skipped: true, reason: 'No job data' });

    const permanentCrew = Array.isArray(jobData.permanent_crew) ? jobData.permanent_crew : [];
    if (permanentCrew.length === 0) {
      return Response.json({ skipped: true, reason: 'No permanent crew on this job' });
    }

    const jobStart = jobData.start_date;
    const jobEnd = jobData.end_date;
    if (!jobStart || !jobEnd) {
      return Response.json({ skipped: true, reason: 'Job has no start/end date' });
    }

    // Determine the date range to fill. If old_data has an end_date and the
    // new end_date is later, only fill from the old end_date forward (incremental).
    // Otherwise fill the whole span (new rule or start date changed).
    let fillFrom = jobStart;
    if (oldData?.end_date && oldData.end_date < jobEnd) {
      fillFrom = oldData.end_date;
    }

    // Load existing rota assignments for this job to avoid duplicates
    let existing: any[] = [];
    try {
      existing = await base44.asServiceRole.entities.RotaAssignment.filter({ job_id: jobId });
    } catch (_) {}
    const existingKey = new Set(existing.map((a: any) => `${a.staff_id}|${a.assigned_date}`));

    const divisionId = jobData.division_id || undefined;
    const toCreate: any[] = [];

    for (const member of permanentCrew) {
      if (!member.staff_id || !Array.isArray(member.working_days) || member.working_days.length === 0) continue;
      const memberEnd = member.end_date || jobEnd;
      const effectiveEnd = memberEnd < jobEnd ? memberEnd : jobEnd;
      if (effectiveEnd < fillFrom) continue;
      const dates = buildDateList(fillFrom, effectiveEnd, member.working_days);
      for (const date of dates) {
        if (existingKey.has(`${member.staff_id}|${date}`)) continue;
        toCreate.push({
          job_id: jobId,
          staff_id: member.staff_id,
          assigned_date: date,
          week_start: computeWeekStart(date),
          status: 'assigned',
          assignment_type: 'job',
          division_id: divisionId,
        });
        existingKey.add(`${member.staff_id}|${date}`);
      }
    }

    let created = 0;
    if (toCreate.length > 0) {
      for (let i = 0; i < toCreate.length; i += 100) {
        try {
          await base44.asServiceRole.entities.RotaAssignment.bulkCreate(toCreate.slice(i, i + 100));
          created += toCreate.slice(i, i + 100).length;
        } catch (e) {
          console.error('bulkCreate error:', (e as Error).message);
        }
      }
    }

    return Response.json({
      success: true,
      job_id: jobId,
      generated: created,
      checked: toCreate.length + (existing.length),
    });
  } catch (error) {
    const msg = (error && typeof error === 'object' && (error as any).message) ? (error as any).message : String(error);
    return Response.json({ error: msg }, { status: 500 });
  }
}