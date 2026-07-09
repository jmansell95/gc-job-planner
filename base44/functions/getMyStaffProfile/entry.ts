import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let staff = await base44.entities.Staff.filter({ email: user.email });
    if (staff.length === 0 && user.id) {
      try { staff = await base44.entities.Staff.filter({ user_id: user.id }); } catch (_) {}
    }

    const isAdmin = user.role === 'admin';

    if (staff.length === 0) {
      return Response.json({
        id: null,
        name: user.full_name || user.email,
        email: user.email,
        job_role: null,
        worker_type: null,
        team_id: null,
        team: null,
        is_admin: isAdmin,
        no_staff_profile: true,
        email_notifications_enabled: true
      });
    }

    const s = staff[0];

    // Fetch the team to include capability/landing info
    let team = null;
    if (s.team_id) {
      try {
        const teamList = await base44.asServiceRole.entities.Team.filter({ id: s.team_id });
        team = teamList[0] || null;
      } catch (_) {}
    }

    return Response.json({
      id: s.id,
      name: s.name,
      email: s.email,
      job_role: s.job_role,
      worker_type: s.worker_type,
      team_id: s.team_id,
      team: team ? {
        id: team.id,
        name: team.name,
        category: team.category || null,
        job_type: team.job_type || null,
        default_landing_page: team.default_landing_page || null,
        allowed_tool_access: team.allowed_tool_access || []
      } : null,
      is_admin: isAdmin,
      email_notifications_enabled: s.email_notifications_enabled !== false
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});