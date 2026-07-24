import { Truck, Grid3x3, Users, BarChart3, PoundSterling, CalendarClock, ShieldCheck, Shield, Boxes, Sparkles, TrendingUp, HardHat, Waves, Activity } from 'lucide-react';

export const WIDGET_REGISTRY = {
  'delivery-stats': { title: 'Delivery & Collection', icon: Truck },
  'kpi-stats': { title: 'Key Metrics', icon: Grid3x3 },
  'compliance-overview': { title: 'Compliance Overview', icon: ShieldCheck },
  'supervisor-overview': { title: 'Supervisor Overview', icon: Shield },
  'field-crews': { title: 'Field Crews Today', icon: Users },
  'charts': { title: 'Weekly Trends', icon: BarChart3 },
  'cost-analytics': { title: 'Cost Analytics', icon: PoundSterling },
  'maintenance-quick-view': { title: 'Fleet Compliance', icon: CalendarClock },
  'job-assets': { title: 'Job Equipment', icon: Boxes },
  'ai-insights': { title: 'AI Weekly Insights', icon: Sparkles },
  'job-profitability': { title: 'Job Profitability', icon: PoundSterling },
  'efficiency-snapshot': { title: 'Efficiency Snapshot', icon: TrendingUp },
  'asset-crew-profitability': { title: 'On Jobs Now', icon: TrendingUp },
  'rig-profitability': { title: 'Rig Profitability', icon: HardHat },
  'site-hazards': { title: 'Site Hazard Map', icon: Waves },
};

export const DEFAULT_WIDGET_ORDER = [
  'delivery-stats',
  'kpi-stats',
  'compliance-overview',
  'supervisor-overview',
  'field-crews',
  'charts',
  'cost-analytics',
  'maintenance-quick-view',
  'job-assets',
  'ai-insights',
  'job-profitability',
  'efficiency-snapshot',
  'asset-crew-profitability',
  'rig-profitability',
  'site-hazards',
];

// Sectioned layout for the dashboard. Widgets are grouped into labelled sections
// rendered top-to-bottom (no tabs). Each section's widgets are filtered by scope
// (global-only widgets are hidden when a specific job is focused) and by cost
// permission, so empty sections automatically collapse out of view.
export const DASHBOARD_SECTIONS = [
  { id: 'overview', label: 'Overview', icon: Grid3x3, widgets: ['kpi-stats', 'field-crews', 'job-assets', 'delivery-stats', 'supervisor-overview', 'site-hazards'] },
  { id: 'performance', label: 'Performance & Insights', icon: TrendingUp, widgets: ['charts', 'cost-analytics', 'job-profitability', 'efficiency-snapshot', 'asset-crew-profitability', 'rig-profitability', 'ai-insights'] },
  { id: 'compliance', label: 'Compliance & Fleet', icon: ShieldCheck, widgets: ['compliance-overview', 'maintenance-quick-view'] },
];

// Map of widget id -> section id (derived from DASHBOARD_SECTIONS).
export const WIDGET_TO_SECTION = Object.fromEntries(
  DASHBOARD_SECTIONS.flatMap(s => s.widgets.map(w => [w, s.id]))
);

export const DEFAULT_WIDGET_SIZES = {
  'kpi-stats': 'md',
  'field-crews': 'lg',
  'charts': 'lg',
  'supervisor-overview': 'lg',
  'compliance-overview': 'md',
  'cost-analytics': 'md',
  'delivery-stats': 'md',
  'maintenance-quick-view': 'md',
  'job-assets': 'md',
  'ai-insights': 'lg',
  'job-profitability': 'lg',
  'efficiency-snapshot': 'lg',
  'asset-crew-profitability': 'lg',
  'rig-profitability': 'lg',
  'site-hazards': 'lg',
};

// Widgets that require costing permission (admin / manager only).
export const COST_WIDGETS = ['cost-analytics', 'job-profitability', 'efficiency-snapshot', 'asset-crew-profitability', 'rig-profitability'];

// Widgets that show company-wide data (not specific to a job). These are hidden
// when the dashboard is focused on a single job, since they don't reflect that
// job's data. The remaining widgets already scope themselves via JobFilterContext.
export const GLOBAL_ONLY_WIDGETS = ['compliance-overview', 'supervisor-overview', 'maintenance-quick-view', 'ai-insights'];

// View profiles — quick-toggle scopes that surface only the widgets relevant to
// one focus area, cutting scroll depth. Applied as an allow-list on top of the
// user's saved widget order (saved customisation still respected within a profile).
export const VIEW_PROFILES = [
  { id: 'operations', label: 'Operations', icon: Activity, widgets: ['kpi-stats', 'field-crews', 'job-assets', 'delivery-stats', 'supervisor-overview', 'site-hazards'] },
  { id: 'financials', label: 'Financials', icon: PoundSterling, widgets: ['kpi-stats', 'efficiency-snapshot', 'job-profitability', 'cost-analytics', 'charts'] },
  { id: 'compliance', label: 'Compliance', icon: ShieldCheck, widgets: ['compliance-overview', 'maintenance-quick-view', 'site-hazards'] },
];