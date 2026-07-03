import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const token = body.portal_token;
    if (!token) return Response.json({ error: 'Token required' }, { status: 400 });

    const base44 = createClientFromRequest(req);
    const jobs = await base44.asServiceRole.entities.Job.filter({ portal_token: token });
    if (jobs.length === 0) return Response.json({ error: 'Job not found' }, { status: 404 });

    const job = jobs[0];
    if (!job.portal_enabled) return Response.json({ error: 'Portal access is disabled for this job' }, { status: 403 });

    const assignments = await base44.asServiceRole.entities.RotaAssignment.filter({ job_id: job.id });
    const allStaff = await base44.asServiceRole.entities.Staff.list();

    let client = null;
    if (job.client_id) {
      const clients = await base44.asServiceRole.entities.Client.filter({ id: job.client_id });
      client = clients[0] || null;
    }

    const schedule = {};
    assignments.forEach(a => {
      if (!schedule[a.assigned_date]) schedule[a.assigned_date] = [];
      const staffMember = allStaff.find(s => s.id === a.staff_id);
      schedule[a.assigned_date].push({
        staff_name: staffMember?.name || 'Unknown',
        role: staffMember?.job_role || '',
        status: a.status || 'assigned',
        meterage: a.meterage || 0
      });
    });

    const total = assignments.length;
    const completed = assignments.filter(a => a.status === 'completed').length;
    const started = assignments.filter(a => a.status === 'started').length;

    return Response.json({
      job: {
        name: job.name,
        location: job.location,
        job_type: job.job_type,
        status: job.status,
        start_date: job.start_date,
        end_date: job.end_date,
        notes: job.notes
      },
      client: client ? { name: client.name, contact_name: client.contact_name } : null,
      schedule,
      progress: { total, completed, started }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});