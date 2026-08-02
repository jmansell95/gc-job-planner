import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Auth check: if auth.me() fails (token timing, cold start, transient
    // auth issue on the published site), return 401 — NOT a fallback profile.
    // The frontend's try/catch catches 401, keeps profile null, and
    // canAccessSection(null) returns true (fail-open), so the admin nav
    // stays visible while the profile retries. Returning a fallback profile
    // with system_role: null would resolve to 'field' role and hide all nav.
    let user: any = null;
    try { user = await base44.auth.me(); } catch (_) { user = null; }
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
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
        avatar_url: null,
        job_role: null,
        worker_type: null,
        team_id: null,
        team: null,
        is_admin: isAdmin,
        no_staff_profile: true,
        email_notifications_enabled: true,
        // Platform admins can always access the delivery dashboard — default
        // to true so the Truck icon shows even when the Staff record is missing.
        // Non-admins default to false (their Staff record must explicitly enable it).
        delivery_dashboard_enabled: isAdmin,
        // Platform admins without a Staff record get super_admin so the
        // admin nav stays visible. Non-admin users without a Staff record
        // get 'user' (basic office read access) instead of null (which
        // resolves to 'field' and hides all nav items).
        system_role: isAdmin ? 'super_admin' : 'user',
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

    // Fetch the staff member's direct permission group (takes precedence
    // over the crew type's permission group). Falls back to the team's group.
    let directPermissionGroup = null;
    if (s.permission_group_id) {
      try {
        const pgList = await base44.asServiceRole.entities.PermissionGroup.filter({ id: s.permission_group_id });
        directPermissionGroup = pgList[0] || null;
      } catch (_) {}
    }

    // Fetch the team's linked permission group as a fallback.
    let teamPermissionGroup = null;
    if (team?.permission_group_id) {
      try {
        const pgList = await base44.asServiceRole.entities.PermissionGroup.filter({ id: team.permission_group_id });
        teamPermissionGroup = pgList[0] || null;
      } catch (_) {}
    }

    const effectivePermissionGroup = directPermissionGroup || teamPermissionGroup;

    // Derive system_role from the permission group name for system groups,
    // so the existing role-based access logic keeps working seamlessly.
    const GROUP_NAME_TO_ROLE: Record<string, string> = {
      'Super Admin': 'super_admin',
      'Admin': 'admin',
      'Management': 'management',
      'User': 'user',
      'Field Staff': 'field',
      'Field': 'field',
      'Read Only': 'read_only',
    };
    const derivedRole = effectivePermissionGroup
      ? (GROUP_NAME_TO_ROLE[effectivePermissionGroup.name] || s.system_role || 'field')
      : (s.system_role || 'field');

    return Response.json({
      id: s.id,
      name: s.name,
      email: s.email,
      avatar_url: s.avatar_url || null,
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
        permission_group: teamPermissionGroup ? {
          id: teamPermissionGroup.id,
          name: teamPermissionGroup.name,
          is_read_only: teamPermissionGroup.is_read_only === true,
          is_system: teamPermissionGroup.is_system === true,
          permissions: teamPermissionGroup.permissions || {}
        } : null
      } : null,
      is_admin: isAdmin,
      email_notifications_enabled: s.email_notifications_enabled !== false,
      delivery_dashboard_enabled: s.delivery_dashboard_enabled === true,
      system_role: derivedRole,
      permission_group: effectivePermissionGroup ? {
        id: effectivePermissionGroup.id,
        name: effectivePermissionGroup.name,
        is_read_only: effectivePermissionGroup.is_read_only === true,
        is_system: effectivePermissionGroup.is_system === true,
        permissions: effectivePermissionGroup.permissions || {}
      } : null,
      last_acknowledged_week: s.last_acknowledged_week || null
    });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : (typeof error === 'string' ? error : 'Internal server error');
    return Response.json({ error: msg }, { status: 500 });
  }
});