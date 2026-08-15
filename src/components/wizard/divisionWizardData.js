// Shared constants for the Division Wizard — single source of truth for
// division types, hubs, labels and smart defaults used across the wizard steps.

export const DIVISION_TYPES = [
  { value: 'geotechnical', label: 'Geotechnical', color: '#2E5A1A', icon: 'Mountain', blurb: 'Boreholes, AGS, site investigation' },
  { value: 'environmental', label: 'Environmental', color: '#0d9488', icon: 'Leaf', blurb: 'Contaminated land & monitoring' },
  { value: 'surveys', label: 'Surveys', color: '#2563eb', icon: 'Map', blurb: 'Topographic & utility surveys' },
  { value: 'structural', label: 'Structural', color: '#7c3aed', icon: 'Building', blurb: 'Structural inspections' },
  { value: 'renewables', label: 'Renewables', color: '#d97706', icon: 'Sun', blurb: 'Wind, solar & energy' },
  { value: 'general', label: 'General', color: '#475569', icon: 'Briefcase', blurb: 'General construction ops' },
];

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

export const INTEGRATIONS = [
  { key: 'enable_geotab_tracking', label: 'Geotab GPS', desc: 'Vehicle tracking & geofencing', geotechOnly: false },
  { key: 'enable_safetyculture', label: 'SafetyCulture', desc: 'iAuditor audit sync', geotechOnly: false },
  { key: 'enable_asset_panda', label: 'Asset Panda', desc: 'Inventory stock sync', geotechOnly: false },
  { key: 'enable_open_ground', label: 'OpenGround', desc: 'Borehole data sync', geotechOnly: true },
  { key: 'enable_keylogbook', label: 'KeyLogBook', desc: 'AGS webhook import', geotechOnly: true },
];

export const COLOR_SWATCHES = ['#2E5A1A', '#0d9488', '#2563eb', '#7c3aed', '#d97706', '#475569', '#dc2626', '#0891b2'];

/** Build smart defaults when a division type is chosen. */
export function defaultsForType(type, navDefaults) {
  const preset = DIVISION_TYPES.find(t => t.value === type);
  const isGeotech = type === 'geotechnical';
  return {
    color: preset?.color || '#475569',
    enabled_hubs: isGeotech ? [...ALL_HUBS] : ALL_HUBS.filter(h => h !== 'investigation'),
    nav_items: [...(navDefaults[type] || navDefaults.general || [])],
    settings: {
      enable_open_ground: isGeotech,
      enable_keylogbook: isGeotech,
    },
  };
}

export function toProperCase(str) {
  return str.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.substring(1).toLowerCase());
}