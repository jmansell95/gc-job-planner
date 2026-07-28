import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Resilient auth: if auth.me() fails on the published site (token timing,
    // cold start, transient auth service issue), return a minimal default
    // profile instead of a 500. The frontend treats !profile as fail-open
    // (shows all UI), so a default profile with is_admin derived from the
    // user object is sufficient. If auth.me() throws, we return a profile
    // with no_staff_profile: true so the frontend can handle gracefully.
    let user: any = null;
    try { user = await base44.auth.me(); } catch (_) { user = null; }
    if (!user) {
      return Response.json({
        id: null, name: null, email: null, job_role: null, worker_type: null,
        team_id: null, team: null, is_admin: false, no_staff_profile: true,
        email_notifications_enabled: true, delivery_dashboard_enabled: false,
        system_role: null, last_acknowledged_week: null,
      });
    }

    // Match robustly using the service role (avoids any RLS edge cases) with
    // a case-insensitive email comparison and a user_id fallback. A manually
    // created Staff record often has user_id blank, and the user-context email
    // filter can miss exact-but-different-case matches — so we do both.
    const allStaff = await base44.asServiceRole.entities.Staff.list('-created_date', 500);
    let staff = [];
    if (user.id) {
      staff = allStaff.filter(s => s.user_id && s.user_id === user.id);
    }
    if (staff.length === 0 && user.email) {
      const lc = user.email.toLowerCase();
      staff = allStaff.filter(s => s.email && s.email.toLowerCase() === lc);
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
        email_notifications_enabled: true,
        delivery_dashboard_enabled: false,
        system_role: null,
          last_acknowledged_week: null
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

    // Fetch the team's linked permission group so the frontend can enforce
    // granular read/write/none access per admin module.
    let permissionGroup = null;
    if (team?.permission_group_id) {
      try {
        const pgList = await base44.asServiceRole.entities.PermissionGroup.filter({ id: team.permission_group_id });
        permissionGroup = pgList[0] || null;
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
        allowed_tool_access: team.allowed_tool_access || [],
        permission_group_id: team.permission_group_id || null,
        permission_group: permissionGroup ? {
          id: permissionGroup.id,
          name: permissionGroup.name,
          is_read_only: permissionGroup.is_read_only === true,
          is_system: permissionGroup.is_system === true,
          permissions: permissionGroup.permissions || {}
        } : null
      } : null,
      is_admin: isAdmin,
      email_notifications_enabled: s.email_notifications_enabled !== false,
      delivery_dashboard_enabled: s.delivery_dashboard_enabled === true,
      system_role: s.system_role || null,
      last_acknowledged_week: s.last_acknowledged_week || null
    });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : (typeof error === 'string' ? error : 'Internal server error');
    return Response.json({ error: msg }, { status: 500 });
  }
});