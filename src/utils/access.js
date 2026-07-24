// Central access control utility.
// Determines what a user can see and do based on their system_role
// (admin/manager/viewer) or team capabilities for field staff.

import { SECTION_TO_MODULE, normalizePermissions, resolveModuleLevel, canWriteModule } from '@/utils/permissions';

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
// Priority: platform admin → system role → team permission group → legacy allowed_tool_access.
export function canAccessSection(profile, sectionId, isPlatformAdmin) {
  // While the profile is still loading, show all standard nav items so the
  // sidebar isn't blank. Items are re-filtered once the profile resolves.
  if (!profile) return true;
  const role = resolveRole(profile, isPlatformAdmin);
  // Admins see everything regardless of team
  if (role === 'admin') return true;
  // The "My Schedule" link is available to all office staff
  if (sectionId === 'staff_schedule') return true;

  // Field staff with a permission group — use the granular permission registry.
  // This is the new lockdown engine: the group defines read/write/none per
  // module, superseding the legacy allowed_tool_access list.
  const group = profile?.team?.permission_group;
  if (group) {
    const moduleKey = SECTION_TO_MODULE[sectionId];
    if (moduleKey) {
      const level = group.is_read_only
        ? (normalizePermissions(group.permissions)[moduleKey] === 'none' ? 'none' : 'read')
        : (normalizePermissions(group.permissions)[moduleKey] || 'none');
      return level !== 'none';
    }
  }

  if (role === 'manager' || role === 'viewer') {
    // Office staff: role sections, further restricted by their team's
    // allowed_tool_access when the team defines one.
    const roleSections = ROLE_SECTIONS[role] || [];
    if (!roleSections.includes(sectionId)) return false;
    const teamAccess = profile?.team?.allowed_tool_access;
    if (teamAccess && teamAccess.length > 0) {
      return teamAccess.includes(sectionId);
    }
    return true;
  }
  // Field staff — fall back to team capabilities
  return profile?.team?.allowed_tool_access?.includes(sectionId) || false;
}

// Check if user has edit permissions (create/update/delete).
export function canEdit(profile, isPlatformAdmin) {
  const role = resolveRole(profile, isPlatformAdmin);
  return role === 'admin' || role === 'manager';
}

// Check if user can edit (create/update/delete) within a specific admin module.
// Uses the permission group for field staff; admins/managers always can.
export function canEditModule(profile, isPlatformAdmin, sectionId) {
  const role = resolveRole(profile, isPlatformAdmin);
  if (role === 'admin' || role === 'manager') return true;
  const moduleKey = SECTION_TO_MODULE[sectionId];
  if (!moduleKey) return canEdit(profile, isPlatformAdmin);
  return canWriteModule(profile, isPlatformAdmin, moduleKey);
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

// Check if user is a driver (field staff with delivery dashboard enabled).
// Drivers see ONLY the delivery dashboard — nothing else.
export function isDriver(profile, isPlatformAdmin) {
  if (!profile) return false;
  if (isPlatformAdmin || profile.is_admin) return false;
  const role = resolveRole(profile, isPlatformAdmin);
  return !role && profile.delivery_dashboard_enabled === true;
}

// Check if user is field staff (no system role — schedule & profile only)
export function isFieldStaff(profile, isPlatformAdmin) {
  if (!profile) return false;
  if (isPlatformAdmin || profile.is_admin) return false;
  const role = resolveRole(profile, isPlatformAdmin);
  return !role;
}

// Check if user is office staff (manager/viewer/admin role)
export function isOfficeStaff(profile, isPlatformAdmin) {
  const role = resolveRole(profile, isPlatformAdmin);
  return role === 'admin' || role === 'manager' || role === 'viewer';
}

// Check if a user can access a specific route path.
// Enforces the site-wide lockdown: drivers see deliveries only,
// field staff see their schedule + profile only, office staff see admin.
export function canAccessRoute(profile, isPlatformAdmin, path) {
  if (isPlatformAdmin) return true;
  if (!profile) return false;

  // Help is available to everyone authenticated
  if (path === '/help') return true;

  // Drivers: delivery dashboard ONLY
  if (isDriver(profile)) {
    return path === '/deliveries';
  }

  // Subcontractors: subcontractor portal ONLY
  if (profile.worker_type === 'subcontractor') {
    return path === '/subcontractor';
  }

  const role = resolveRole(profile, isPlatformAdmin);

  // Office staff (admin/manager/viewer): full access to admin + staff views
  if (role === 'admin' || role === 'manager' || role === 'viewer') {
    return true;
  }

  // Field staff: staff dashboard + profile only
  if (path === '/staff-schedule' || path === '/staff-profile') return true;

  return false;
}

// Resolve landing page based on role.
// IMPORTANT: the returned page must always be one that canAccessRoute allows
// for this user — otherwise the RouteGuard redirects back here and loops.
export function resolveRoleLandingPage(profile, isPlatformAdmin) {
  // Drivers go straight to the delivery dashboard — they see nothing else
  if (isDriver(profile)) return '/deliveries';

  const role = resolveRole(profile, isPlatformAdmin);
  if (role === 'admin' || role === 'manager' || role === 'viewer') return '/admin';
  // Sub-contractors get the minimalist logging portal — they don't see scheduling or admin data
  if (profile?.worker_type === 'subcontractor') return '/subcontractor';
  // Field staff — only allow schedule/profile landing pages, never admin.
  // A team may have default_landing_page '/admin' (e.g. a depot team whose
  // member has no system_role), but sending a field-staff user there would
  // cause a redirect loop, so clamp it to their allowed schedule view.
  const teamLanding = profile?.team?.default_landing_page;
  if (teamLanding === '/staff-schedule' || teamLanding === '/staff-profile') return teamLanding;
  if (isPlatformAdmin) return '/admin';
  return '/staff-schedule';
}