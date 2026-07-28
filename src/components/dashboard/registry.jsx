import { Truck, Users, BarChart3, PoundSterling, CalendarClock, ShieldCheck, Boxes, Sparkles, TrendingUp, HardHat, Activity, LayoutDashboard, MapPin, FileClock } from 'lucide-react';

export const WIDGET_REGISTRY = {
  'executive-snapshot': { title: 'Executive Snapshot', icon: LayoutDashboard },
  'delivery-stats': { title: 'Deliveries & Collections', icon: Truck },
  'compliance-overview': { title: 'Compliance Overview', icon: ShieldCheck },
  'field-crews': { title: 'Field Crews Today', icon: Users },
  'charts': { title: 'Weekly Trends', icon: BarChart3 },
  'maintenance-quick-view': { title: 'Fleet Compliance', icon: CalendarClock },
  'job-assets': { title: 'Job Equipment', icon: Boxes },
  'ai-insights': { title: 'AI Weekly Insights', icon: Sparkles },
  'job-profitability': { title: 'Job Profitability', icon: PoundSterling },
  'efficiency-snapshot': { title: 'Efficiency Snapshot', icon: TrendingUp },
  'rig-profitability': { title: 'Rig Profitability', icon: HardHat },
  'geo-heatmap': { title: 'Geotechnical Risk', icon: MapPin },
  'unbilled-wip': { title: 'Unbilled WIP', icon: FileClock },
};

export const DEFAULT_WIDGET_ORDER = [
  'executive-snapshot',
  'field-crews',
  'job-assets',
  'delivery-stats',
  'charts',
  'efficiency-snapshot',
  'job-profitability',
  'rig-profitability',
  'unbilled-wip',
  'geo-heatmap',
  'ai-insights',
  'compliance-overview',
  'maintenance-quick-view',
];

// Sectioned layout for the dashboard. Widgets are grouped into labelled sections
// rendered top-to-bottom (no tabs). Each section's widgets are filtered by scope
// (global-only widgets are hidden when a specific job is focused) and by cost
// permission, so empty sections automatically collapse out of view.
export const DASHBOARD_SECTIONS = [
  { id: 'overview', label: 'Operations', icon: Activity, widgets: ['executive-snapshot', 'field-crews', 'job-assets', 'delivery-stats', 'geo-heatmap'] },
  { id: 'performance', label: 'Performance & Financials', icon: TrendingUp, widgets: ['charts', 'efficiency-snapshot', 'job-profitability', 'rig-profitability', 'unbilled-wip', 'ai-insights'] },
  { id: 'compliance', label: 'Compliance & Fleet', icon: ShieldCheck, widgets: ['compliance-overview', 'maintenance-quick-view'] },
];

// Map of widget id -> section id (derived from DASHBOARD_SECTIONS).
export const WIDGET_TO_SECTION = Object.fromEntries(
  DASHBOARD_SECTIONS.flatMap(s => s.widgets.map(w => [w, s.id]))
);

export const DEFAULT_WIDGET_SIZES = {
  'executive-snapshot': 'lg',
  'field-crews': 'lg',
  'charts': 'lg',
  'compliance-overview': 'md',
  'delivery-stats': 'md',
  'maintenance-quick-view': 'md',
  'job-assets': 'md',
  'ai-insights': 'lg',
  'job-profitability': 'lg',
  'efficiency-snapshot': 'md',
  'rig-profitability': 'lg',
  'geo-heatmap': 'md',
  'unbilled-wip': 'md',
};

// Widgets that require costing permission (admin / manager only).
export const COST_WIDGETS = ['job-profitability', 'efficiency-snapshot', 'rig-profitability', 'unbilled-wip'];

// Widgets that show company-wide data (not specific to a job). These are hidden
// when the dashboard is focused on a single job, since they don't reflect that
// job's data. The remaining widgets already scope themselves via JobFilterContext.
export const GLOBAL_ONLY_WIDGETS = ['executive-snapshot', 'compliance-overview', 'maintenance-quick-view', 'ai-insights', 'geo-heatmap', 'unbilled-wip'];

// View profiles — quick-toggle scopes that surface only the widgets relevant to
// one focus area, cutting scroll depth. Applied as an allow-list on top of the
// user's saved widget order (saved customisation still respected within a profile).
export const VIEW_PROFILES = [
  { id: 'operations', label: 'Operations', icon: Activity, widgets: ['executive-snapshot', 'field-crews', 'job-assets', 'delivery-stats', 'geo-heatmap'] },
  { id: 'financials', label: 'Financials', icon: PoundSterling, widgets: ['executive-snapshot', 'efficiency-snapshot', 'job-profitability', 'rig-profitability', 'unbilled-wip', 'charts'] },
  { id: 'compliance', label: 'Compliance', icon: ShieldCheck, widgets: ['executive-snapshot', 'compliance-overview', 'maintenance-quick-view', 'geo-heatmap'] },
];