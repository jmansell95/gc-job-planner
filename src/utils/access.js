// Central access control utility.
// Determines what a user can see and do based on their system_role
// (admin/manager/viewer) or team capabilities for field staff.

export const SYSTEM_ROLES = [
  { value: 'admin', label: 'Admin', description: 'Full access to everything including settings and crews' },
  { value: 'manager', label: 'Manager', description: 'Manage jobs, rotas, timesheets and compliance — no settings' },
  { value: 'viewer', label: 'Viewer', description: 'Read-only access to dashboards and jobs' },
];

// Admin sections visible to each role.
export const ROLE_SECTIONS = {
  admin: ['overview', 'jobs', 'rota', 'calendar', 'timesheets', 'compliance', 'insights', 'teams', 'settings'],
  manager: ['overview', 'jobs', 'rota', 'calendar', 'timesheets', 'compliance', 'insights'],
  viewer: ['overview', 'jobs', 'calendar', 'compliance', 'insights'],
};

// Resolve the effective role from profile + platform admin flag.
export function resolveRole(profile, isPlatformAdmin) {
  if (!profile) return null;
  if (isPlatformAdmin || profile.is_admin) return 'admin';
  return profile.system_role || null;
}

// Check if a user can access a specific admin section.
export function canAccessSection(profile, sectionId, isPlatformAdmin) {
  const role = resolveRole(profile, isPlatformAdmin);
  if (role) {
    if (sectionId === 'staff_schedule') return true;
    return ROLE_SECTIONS[role]?.includes(sectionId) || false;
  }
  // Field staff — fall back to team capabilities
  return profile?.team?.allowed_tool_access?.includes(sectionId) || false;
}

// Check if user has edit permissions (create/update/delete).
export function canEdit(profile, isPlatformAdmin) {
  const role = resolveRole(profile, isPlatformAdmin);
  return role === 'admin' || role === 'manager';
}

// Check if user is an admin.
export function isAdmin(profile, isPlatformAdmin) {
  return resolveRole(profile, isPlatformAdmin) === 'admin';
}

// Resolve landing page based on role.
export function resolveRoleLandingPage(profile, isPlatformAdmin) {
  const role = resolveRole(profile, isPlatformAdmin);
  if (role === 'admin' || role === 'manager' || role === 'viewer') return '/admin';
  if (profile?.team?.default_landing_page) return profile.team.default_landing_page;
  if (isPlatformAdmin) return '/admin';
  return '/staff-schedule';
}