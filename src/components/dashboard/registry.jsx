import { Truck, Grid3x3, Users, BarChart3, PoundSterling, CalendarClock, ShieldCheck, Shield, Boxes, Sparkles, TrendingUp, HardHat, Waves } from 'lucide-react';

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
  'asset-crew-profitability': { title: 'Assets & Crews', icon: TrendingUp },
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
  'asset-crew-profitability',
  'rig-profitability',
  'site-hazards',
];

// Tabbed groups for the dashboard. Each widget is assigned to one tab.
export const DASHBOARD_TABS = [
  { id: 'operations', label: 'Operations', icon: Grid3x3, widgets: ['kpi-stats', 'field-crews', 'job-assets', 'delivery-stats', 'supervisor-overview', 'site-hazards'] },
  { id: 'insights', label: 'Insights', icon: BarChart3, widgets: ['charts', 'cost-analytics', 'ai-insights'] },
  { id: 'finance', label: 'Finance', icon: PoundSterling, widgets: ['job-profitability', 'asset-crew-profitability', 'rig-profitability'] },
  { id: 'compliance', label: 'Compliance & Fleet', icon: ShieldCheck, widgets: ['compliance-overview', 'maintenance-quick-view'] },
];

// Map of widget id -> tab id (derived from DASHBOARD_TABS).
export const WIDGET_TO_TAB = Object.fromEntries(
  DASHBOARD_TABS.flatMap(t => t.widgets.map(w => [w, t.id]))
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
  'asset-crew-profitability': 'lg',
  'rig-profitability': 'lg',
  'site-hazards': 'lg',
};

// Widgets that require costing permission (admin / manager only).
export const COST_WIDGETS = ['cost-analytics', 'job-profitability', 'asset-crew-profitability', 'rig-profitability'];

// Widgets that show company-wide data (not specific to a job). These are hidden
// when the dashboard is focused on a single job, since they don't reflect that
// job's data. The remaining widgets already scope themselves via JobFilterContext.
export const GLOBAL_ONLY_WIDGETS = ['compliance-overview', 'supervisor-overview', 'maintenance-quick-view', 'ai-insights'];