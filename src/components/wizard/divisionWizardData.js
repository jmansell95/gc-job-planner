// Shared constants for the Division Wizard — single source of truth for
// division types, blueprints, hubs, labels and smart defaults.
//
// DIVISION_TYPES is the master registry: each entry contains the UI display
// info (label, icon, blurb) AND the operational blueprint (color, tagline,
// enabled_hubs, nav_items, settings). defaultsForType() returns a clean copy
// of the blueprint fields so the wizard can apply them atomically when the
// user switches division type. No defaults are duplicated elsewhere.

export const ALL_HUBS = ['overview', 'jobs', 'scheduling', 'staff', 'logistics', 'assets', 'fleet', 'investigation', 'compliance', 'billing', 'settings'];

export const HUB_LABELS = {
  overview: 'Dashboard', jobs: 'Jobs', scheduling: 'Scheduling', staff: 'Staff',
  logistics: 'Deliveries', assets: 'Assets', fleet: 'Fleet', investigation: 'Investigation',
  compliance: 'Compliance', billing: 'Billing', settings: 'Settings',
};

export const HUB_DESCRIPTIONS = {
  overview: 'KPIs & live rollup',
  jobs: 'Job pipeline & details',
  scheduling: 'Rota builder & crews',
  staff: 'Directory & compliance',
  logistics: 'Deliveries & routes',
  assets: 'Rigs, plant & gear',
  fleet: 'Vehicles & tracking',
  investigation: 'Boreholes & AGS (geotech)',
  compliance: 'Audits, safety & certs',
  billing: 'Invoices & rate cards',
  settings: 'Division configuration',
};

// Base settings shared by every division type — ensures every new division
// starts with the same foundational configuration as Geotechnical.
const BASE_SETTINGS = {
  vat_rate: 20,
  default_markup_percentage: 0,
  require_briefing_signature: true,
  allow_timesheet_edit: true,
  enable_geotab_tracking: false,
  enable_safetyculture: false,
  enable_asset_panda: false,
  enable_open_ground: false,
  enable_keylogbook: false,
};

// Master registry — single source of truth for all division types.
// Each entry defines both the UI display info and the operational blueprint.
export const DIVISION_TYPES = [
  {
    value: 'geotechnical',
    label: 'Geotechnical',
    icon: 'Mountain',
    blurb: 'Boreholes, AGS, site investigation',
    color: '#2E5A1A',
    tagline: 'Ground Investigation Specialists',
    enabled_hubs: [...ALL_HUBS],
    nav_items: ['home', 'schedule', 'scan', 'ai_hub', 'profile'],
    settings: { ...BASE_SETTINGS, enable_geotab_tracking: true, enable_open_ground: true, enable_keylogbook: true },
  },
  {
    value: 'land_water',
    label: 'Land & Water',
    icon: 'Waves',
    blurb: 'Marine, waterway & flood risk',
    color: '#0d9488',
    tagline: 'Marine & Waterway Specialists',
    enabled_hubs: [...ALL_HUBS.filter(h => h !== 'investigation')],
    nav_items: ['home', 'schedule', 'scan', 'ai_hub', 'profile'],
    settings: { ...BASE_SETTINGS, enable_geotab_tracking: true },
  },
  {
    value: 'infrastructure',
    label: 'Infrastructure',
    icon: 'Construction',
    blurb: 'Civil, highways & infrastructure',
    color: '#2563eb',
    tagline: 'Civil Infrastructure Solutions',
    enabled_hubs: [...ALL_HUBS.filter(h => h !== 'investigation')],
    nav_items: ['home', 'schedule', 'scan', 'ai_hub', 'profile'],
    settings: { ...BASE_SETTINGS, enable_geotab_tracking: true },
  },
  {
    value: 'lde',
    label: 'LDE',
    icon: 'FlaskConical',
    blurb: 'Laboratory testing & engineering',
    color: '#7c3aed',
    tagline: 'Laboratory & Engineering Services',
    enabled_hubs: [...ALL_HUBS.filter(h => h !== 'investigation' && h !== 'fleet')],
    nav_items: ['home', 'schedule', 'ai_hub', 'profile'],
    settings: { ...BASE_SETTINGS },
  },
  {
    value: 'environmental',
    label: 'Environmental',
    icon: 'Leaf',
    blurb: 'Contaminated land & monitoring',
    color: '#0d9488',
    tagline: 'Environmental Specialists',
    enabled_hubs: [...ALL_HUBS.filter(h => h !== 'investigation')],
    nav_items: ['home', 'schedule', 'scan', 'ai_hub', 'profile'],
    settings: { ...BASE_SETTINGS, enable_geotab_tracking: true },
  },
  {
    value: 'surveys',
    label: 'Surveys',
    icon: 'Map',
    blurb: 'Topographic & utility surveys',
    color: '#2563eb',
    tagline: 'Survey Specialists',
    enabled_hubs: [...ALL_HUBS.filter(h => h !== 'investigation')],
    nav_items: ['home', 'schedule', 'deliveries', 'ai_hub', 'profile'],
    settings: { ...BASE_SETTINGS, enable_geotab_tracking: true },
  },
  {
    value: 'structural',
    label: 'Structural',
    icon: 'Building',
    blurb: 'Structural inspections',
    color: '#7c3aed',
    tagline: 'Structural Specialists',
    enabled_hubs: [...ALL_HUBS.filter(h => h !== 'investigation')],
    nav_items: ['home', 'schedule', 'ai_hub', 'profile'],
    settings: { ...BASE_SETTINGS },
  },
  {
    value: 'renewables',
    label: 'Renewables',
    icon: 'Sun',
    blurb: 'Wind, solar & energy',
    color: '#d97706',
    tagline: 'Renewables Specialists',
    enabled_hubs: [...ALL_HUBS.filter(h => h !== 'investigation')],
    nav_items: ['home', 'schedule', 'scan', 'ai_hub', 'profile'],
    settings: { ...BASE_SETTINGS, enable_geotab_tracking: true },
  },
  {
    value: 'general',
    label: 'General',
    icon: 'Briefcase',
    blurb: 'General construction ops',
    color: '#475569',
    tagline: '',
    enabled_hubs: [...ALL_HUBS.filter(h => h !== 'investigation')],
    nav_items: ['home', 'schedule', 'ai_hub', 'profile'],
    settings: { ...BASE_SETTINGS },
  },
];

// Derive labels map for use across the app (avoids duplicating type labels)
export const DIVISION_TYPE_LABELS = Object.fromEntries(
  DIVISION_TYPES.map(t => [t.value, t.label])
);

export const INTEGRATIONS = [
  { key: 'enable_geotab_tracking', label: 'Geotab GPS', desc: 'Vehicle tracking & geofencing', restrictedTypes: null },
  { key: 'enable_safetyculture', label: 'SafetyCulture', desc: 'iAuditor audit sync', restrictedTypes: null },
  { key: 'enable_asset_panda', label: 'Asset Panda', desc: 'Inventory stock sync', restrictedTypes: null },
  { key: 'enable_open_ground', label: 'OpenGround', desc: 'Borehole data sync', restrictedTypes: ['geotechnical'] },
  { key: 'enable_keylogbook', label: 'KeyLogBook', desc: 'AGS webhook import', restrictedTypes: ['geotechnical'] },
];

export const COLOR_SWATCHES = ['#2E5A1A', '#0d9488', '#2563eb', '#7c3aed', '#d97706', '#475569', '#dc2626', '#0891b2'];

/** Build smart defaults when a division type is chosen. Returns a clean copy
 *  of the blueprint fields (color, tagline, enabled_hubs, nav_items, settings). */
export function defaultsForType(type) {
  const preset = DIVISION_TYPES.find(t => t.value === type) || DIVISION_TYPES.find(t => t.value === 'general');
  return {
    color: preset.color,
    tagline: preset.tagline,
    enabled_hubs: [...preset.enabled_hubs],
    nav_items: [...preset.nav_items],
    settings: { ...preset.settings },
  };
}

export function toProperCase(str) {
  return str.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.substring(1).toLowerCase());
}