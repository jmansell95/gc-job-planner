// Central definition of all admin tool/section capabilities.
// Used by TeamManager (settings UI), AdminNav (filtering), and Home (routing).

export const TEAM_CATEGORIES = [
  { value: 'field_ops', label: 'Field Operations', description: 'Drillers, groundworkers, enabling crews — see their schedule first' },
  { value: 'depot', label: 'Depot', description: 'Managers, fitters, depot staff — see the admin dashboard first' },
  { value: 'management', label: 'Management', description: 'Senior leadership with full access to everything' },
];

export const LANDING_PAGES = [
  { value: '/staff-schedule', label: 'My Schedule', description: 'Staff see their personal schedule first' },
  { value: '/admin', label: 'Admin Dashboard', description: 'Staff see the management dashboard first' },
];

// Every admin section that can be toggled per team.
export const CAPABILITY_KEYS = [
  { key: 'overview', label: 'Dashboard', description: 'Operational overview and stats' },
  { key: 'jobs', label: 'Jobs', description: 'Create and manage jobs' },
  { key: 'rota', label: 'Rota Builder', description: 'Build and publish weekly rotas' },
  { key: 'calendar', label: 'Calendar', description: 'Full calendar view of all assignments' },
  { key: 'timesheets', label: 'Timesheets', description: 'View and approve all staff timesheets' },
  { key: 'compliance', label: 'Compliance', description: 'Track certifications and compliance items' },
  { key: 'insights', label: 'Insights', description: 'Weekly performance and cost insights' },
  { key: 'settings', label: 'Settings', description: 'Configure staff, vehicles, crews, costs and alerts' },
  { key: 'staff_schedule', label: 'Schedule View', description: 'Access the personal staff schedule view' },
];

// Default capabilities when a new team is created, based on category.
export const DEFAULT_CAPABILITIES = {
  field_ops: ['staff_schedule', 'timesheets'],
  depot: ['overview', 'jobs', 'rota', 'calendar', 'timesheets', 'compliance', 'insights', 'settings'],
  management: CAPABILITY_KEYS.map(c => c.key),
};

// Default landing page per category.
export const DEFAULT_LANDING_PAGE = {
  field_ops: '/staff-schedule',
  depot: '/admin',
  management: '/admin',
};

// Check if a team has access to a specific capability.
// Admins (user.role === 'admin') always have full access.
export function hasCapability(team, capabilityKey, isAdmin = false) {
  if (isAdmin) return true;
  if (!team) return false;
  if (!team.allowed_tool_access || team.allowed_tool_access.length === 0) return false;
  return team.allowed_tool_access.includes(capabilityKey);
}

// Resolve where a user should land first.
// Priority: team.default_landing_page → role-based fallback.
export function resolveLandingPage(team, isAdmin) {
  if (team?.default_landing_page) return team.default_landing_page;
  if (isAdmin) return '/admin';
  return '/staff-schedule';
}