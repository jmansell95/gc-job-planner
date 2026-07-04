import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const staff = await base44.asServiceRole.entities.Staff.list();
    const jobs = await base44.asServiceRole.entities.Job.list();
    const vehicles = await base44.asServiceRole.entities.Vehicle.list();

    const todayStr = new Date().toISOString().slice(0, 10);
    const todaysRotas = await base44.asServiceRole.entities.RotaAssignment.filter({ assigned_date: todayStr });

    const byStaff = {};
    todaysRotas.forEach(r => {
      if (!byStaff[r.staff_id]) byStaff[r.staff_id] = [];
      byStaff[r.staff_id].push(r);
    });

    let notified = 0;
    const skipped = [];

    for (const member of staff) {
      if (!member.email) { skipped.push({ name: member.name, reason: 'no email' }); continue; }
      const assignments = byStaff[member.id] || [];
      if (assignments.length === 0) continue;

      const lines = assignments.map(a => {
        const job = jobs.find(j => j.id === a.job_id);
        const vehicle = vehicles.find(v => v.id === a.vehicle_id);
        const jobName = job ? job.name : 'Unknown job';
        const location = job ? job.location : '';
        const time = (a.start_time || a.end_time) ? ` · ${a.start_time || '—'}–${a.end_time || '—'}` : '';
        const reg = vehicle ? ` · ${vehicle.registration_number}` : '';
        const notes = a.notes ? `\n      Notes: ${a.notes}` : '';
        return `   • ${jobName}${location ? ' — ' + location : ''}${time}${reg}${notes}`;
      }).join('\n');

      const body = `Hello ${member.name},\n\nHere is your schedule for today (${todayStr}):\n\n${lines}\n\nHave a safe shift.\n\nGC Job Planner`;

      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: member.email,
          subject: `Your schedule for today — ${assignments.length} assignment${assignments.length > 1 ? 's' : ''}`,
          body
        });
        notified++;
      } catch (err) {
        skipped.push({ name: member.email, reason: err.message });
      }
    }

    return Response.json({ sent: true, date: todayStr, notified, totalAssignments: todaysRotas.length, skipped });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});