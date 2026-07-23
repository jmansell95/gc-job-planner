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
  admin: ['overview', 'jobs', 'rota', 'calendar', 'scheduling', 'timesheets', 'compliance', 'log-qc', 'teams', 'billing', 'settings'],
  manager: ['overview', 'jobs', 'rota', 'calendar', 'scheduling', 'timesheets', 'compliance', 'log-qc', 'billing', 'settings'],
  viewer: ['overview', 'jobs', 'calendar', 'scheduling', 'compliance', 'log-qc', 'settings'],
};

// Resolve the effective role from profile + platform admin flag.
export function resolveRole(profile, isPlatformAdmin) {
  if (!profile) return null;
  if (isPlatformAdmin || profile.is_admin) return 'admin';
  return profile.system_role || null;
}

// Check if a user can access a specific admin section.
export function canAccessSection(profile, sectionId, isPlatformAdmin) {
  // While the profile is still loading, show all standard nav items so the
  // sidebar isn't blank. Items are re-filtered once the profile resolves.
  if (!profile) return true;
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

// Check if user is authorized to view financial/costing data.
// Only admins and managers can see cost, billing, and profitability information.
export function canViewCostings(profile, isPlatformAdmin) {
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
  // Sub-contractors get the minimalist logging portal — they don't see scheduling or admin data
  if (profile?.worker_type === 'subcontractor') return '/subcontractor';
  if (profile?.team?.default_landing_page) return profile.team.default_landing_page;
  if (isPlatformAdmin) return '/admin';
  return '/staff-schedule';
}