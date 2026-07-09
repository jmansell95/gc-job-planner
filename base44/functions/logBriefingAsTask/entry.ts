import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { staff_id, job_id, assigned_date, briefing_start_at, briefing_signed_at, travel_depart_home, travel_arrive_site } = body;

    if (!staff_id || !job_id || !assigned_date || !briefing_start_at || !briefing_signed_at) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const startDate = new Date(briefing_start_at);
    const signDate = new Date(briefing_signed_at);
    const briefingMins = Math.max(1, Math.round((signDate - startDate) / 60000));
    const fmtTime = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

    const entries = [];

    // Travel to site entry (if provided)
    if (travel_depart_home && travel_arrive_site) {
      const [dh, dm] = travel_depart_home.split(':').map(Number);
      const [ah, am] = travel_arrive_site.split(':').map(Number);
      const travelMins = (ah * 60 + am) - (dh * 60 + dm);
      if (travelMins > 0) {
        entries.push({
          staff_id,
          date: assigned_date,
          job_id,
          task_description: 'Travel to site',
          task_type: 'travel_to',
          start_time: travel_depart_home,
          end_time: travel_arrive_site,
          task_duration_minutes: travelMins,
          total_hours: Math.round((travelMins / 60) * 100) / 100,
          status: 'draft',
          travel_depart_home,
          travel_arrive_site
        });
      }
    }

    // Site briefing entry — always created as the first on-site task
    entries.push({
      staff_id,
      date: assigned_date,
      job_id,
      task_description: 'Site Briefing',
      task_type: 'on_site',
      start_time: fmtTime(startDate),
      end_time: fmtTime(signDate),
      task_duration_minutes: briefingMins,
      total_hours: Math.round((briefingMins / 60) * 100) / 100,
      status: 'draft'
    });

    const created = await base44.asServiceRole.entities.Timesheet.bulkCreate(entries);
    return Response.json({ success: true, count: created.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});