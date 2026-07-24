// Central permission registry — the single source of truth for which admin
// modules exist and their access levels. Used by the PermissionGroupManager
// UI and by access.js to resolve what a team can see / do.
//
// Access levels per module:
//   'none'  — module is hidden from this group entirely
//   'read'  — module visible, all create/update/delete/upload disabled
//   'write' — full create / update / delete access

export const ACCESS_LEVELS = [
  { value: 'none', label: 'No Access', color: 'slate' },
  { value: 'read', label: 'Read Only', color: 'amber' },
  { value: 'write', label: 'Full Access', color: 'emerald' },
];

export const PERMISSION_MODULES = [
  { key: 'overview', label: 'Dashboard Overview', icon: 'LayoutGrid', sensitive: false },
  { key: 'jobs', label: 'Jobs', icon: 'Briefcase', sensitive: false },
  { key: 'rota', label: 'Rota Builder', icon: 'CalendarDays', sensitive: true },
  { key: 'calendar', label: 'Calendar', icon: 'Calendar', sensitive: false },
  { key: 'scheduling', label: 'Scheduling', icon: 'CalendarClock', sensitive: true },
  { key: 'timesheets', label: 'Timesheets', icon: 'Clock', sensitive: true },
  { key: 'compliance', label: 'Compliance', icon: 'ShieldCheck', sensitive: true },
  { key: 'log-qc', label: 'Log QC', icon: 'FlaskConical', sensitive: true },
  { key: 'audit-trail', label: 'Audit Trail', icon: 'ClipboardCheck', sensitive: false },
  { key: 'teams', label: 'Crew Types', icon: 'Users', sensitive: true },
  { key: 'billing', label: 'Billing Rules', icon: 'Banknote', sensitive: true },
  { key: 'settings', label: 'Settings', icon: 'Settings', sensitive: true },
  { key: 'ags_import', label: 'AGS / KeyLogBook Upload', icon: 'FileUp', sensitive: true },
];

// Map admin dashboard section ids (from ROLE_SECTIONS / AdminNav) to permission
// module keys, so access.js can check a section against the group.
export const SECTION_TO_MODULE = {
  overview: 'overview',
  jobs: 'jobs',
  rota: 'rota',
  calendar: 'calendar',
  scheduling: 'scheduling',
  timesheets: 'timesheets',
  compliance: 'compliance',
  'log-qc': 'log-qc',
  'audit-trail': 'audit-trail',
  teams: 'teams',
  billing: 'billing',
  settings: 'settings',
  'ags-import': 'ags_import',
};

// Build a default permissions object (all modules = 'none').
export function defaultPermissions() {
  const p = {};
  PERMISSION_MODULES.forEach(m => { p[m.key] = 'none'; });
  return p;
}

// Normalize a stored permissions object so every module key exists.
export function normalizePermissions(p) {
  const out = defaultPermissions();
  if (p && typeof p === 'object') {
    PERMISSION_MODULES.forEach(m => {
      const v = p[m.key];
      if (v === 'none' || v === 'read' || v === 'write') out[m.key] = v;
    });
  }
  return out;
}

// Built-in system groups, seeded on first load and protected from deletion.
export const SYSTEM_GROUPS = [
  {
    name: 'Super Admin',
    description: 'Unrestricted access to every module. Use for trusted leadership only.',
    is_system: true,
    is_read_only: false,
    permissions: Object.fromEntries(PERMISSION_MODULES.map(m => [m.key, 'write'])),
  },
  {
    name: 'Read Only',
    description: 'Strict read-only lockdown — can view dashboards but cannot create, edit, upload or delete anything.',
    is_system: true,
    is_read_only: true,
    permissions: Object.fromEntries(
      PERMISSION_MODULES.map(m => [m.key, m.key === 'overview' || m.key === 'calendar' || m.key === 'audit-trail' ? 'read' : 'none'])
    ),
  },
];

// Resolve the effective access level for a module given a profile + platform flag.
// Returns 'none' | 'read' | 'write'. Admins always get 'write' on everything.
export function resolveModuleLevel(profile, isPlatformAdmin, moduleKey) {
  if (isPlatformAdmin) return 'write';
  if (!profile) return 'none';
  const role = (isPlatformAdmin || profile.is_admin) ? 'admin' : profile.system_role;
  // System roles bypass the group system entirely.
  if (role === 'admin') return 'write';
  if (role === 'manager') return 'write';
  if (role === 'viewer') {
    // Viewers get read on dashboard modules, none on sensitive ones.
    const sensitive = PERMISSION_MODULES.find(m => m.key === moduleKey)?.sensitive;
    return sensitive ? 'none' : 'read';
  }
  // Field staff — resolve from their team's permission group.
  const group = profile?.team?.permission_group;
  if (!group) return 'none';
  if (group.is_read_only) {
    const level = normalizePermissions(group.permissions)[moduleKey];
    return level === 'none' ? 'none' : 'read';
  }
  return normalizePermissions(group.permissions)[moduleKey] || 'none';
}

// Can the user write (create/update/delete) in this module?
export function canWriteModule(profile, isPlatformAdmin, moduleKey) {
  return resolveModuleLevel(profile, isPlatformAdmin, moduleKey) === 'write';
}

// Can the user at least read this module?
export function canReadModule(profile, isPlatformAdmin, moduleKey) {
  return resolveModuleLevel(profile, isPlatformAdmin, moduleKey) !== 'none';
}