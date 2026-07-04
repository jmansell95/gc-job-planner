import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const staff = await base44.entities.Staff.filter({ email: user.email });
    if (staff.length === 0) {
      return Response.json({ error: 'No staff profile found for this user' }, { status: 404 });
    }
    const s = staff[0];
    return Response.json({
      id: s.id,
      name: s.name,
      email: s.email,
      job_role: s.job_role,
      worker_type: s.worker_type,
      team_id: s.team_id
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});