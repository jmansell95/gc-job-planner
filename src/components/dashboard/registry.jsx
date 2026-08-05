import { Truck, Users, BarChart3, PoundSterling, CalendarClock, ShieldCheck, Boxes, Sparkles, TrendingUp, HardHat, Activity, LayoutDashboard, MapPin, FileClock, FolderKanban, AlertTriangle, Scale, ClipboardCheck, Gauge, ShieldAlert, Brain, Navigation, AlertOctagon } from 'lucide-react';

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
  'project-financials': { title: 'Project Financials', icon: FolderKanban },
  'subcon-margin-guard': { title: 'Subcon Margin Guard', icon: AlertTriangle },
  'financial-reconciliation': { title: 'Financial Reconciliation', icon: Scale },
  'billing-readiness': { title: 'Billing Readiness Gate', icon: ClipboardCheck },
  'outstanding-receivables': { title: 'Outstanding Receivables', icon: PoundSterling },
  // Phase 3-8 roadmap widgets
  'field-priorities': { title: 'Field Priorities', icon: AlertTriangle },
  'cash-flow-forecast': { title: 'Cash Flow Forecast', icon: PoundSterling },
  'drilling-performance': { title: 'Drilling Performance', icon: Gauge },
  'safety-dashboard': { title: 'Safety Dashboard', icon: ShieldAlert },
  'predictive-insights': { title: 'Predictive AI Insights', icon: Brain },
  'traffic-heatmap': { title: 'Mission Command — Traffic Heatmap', icon: Navigation },
  'profitability-alerts': { title: 'Profitability Alerts', icon: AlertOctagon },
  'compliance-expiry': { title: 'Compliance Expiry', icon: ShieldAlert },
  'staff-utilization': { title: 'Staff Utilization', icon: Users },
};

export const DEFAULT_WIDGET_ORDER = [
  'executive-snapshot',
  'field-crews',
  'field-priorities',
  'job-assets',
  'delivery-stats',
  'efficiency-snapshot',
  'drilling-performance',
  'rig-profitability',
  'unbilled-wip',
  'subcon-margin-guard',
  'financial-reconciliation',
  'billing-readiness',
  'outstanding-receivables',
  'cash-flow-forecast',
  'geo-heatmap',
  'predictive-insights',
  'compliance-overview',
  'maintenance-quick-view',
  'safety-dashboard',
  'project-financials',
];

// Sectioned layout for the dashboard. Widgets are grouped into labelled sections
// rendered top-to-bottom (no tabs). Each section's widgets are filtered by scope
// (global-only widgets are hidden when a specific job is focused) and by cost
// permission, so empty sections automatically collapse out of view.
export const DASHBOARD_SECTIONS = [
  { id: 'overview', label: 'Operations', icon: Activity, widgets: ['executive-snapshot', 'field-crews', 'field-priorities', 'job-assets', 'delivery-stats', 'traffic-heatmap', 'geo-heatmap'] },
  { id: 'performance', label: 'Performance & Financials', icon: TrendingUp, widgets: ['billing-readiness', 'outstanding-receivables', 'cash-flow-forecast', 'financial-reconciliation', 'project-financials', 'subcon-margin-guard', 'efficiency-snapshot', 'drilling-performance', 'rig-profitability', 'unbilled-wip', 'predictive-insights', 'staff-utilization'] },
  { id: 'compliance', label: 'Compliance & Fleet', icon: ShieldCheck, widgets: ['compliance-overview', 'compliance-expiry', 'maintenance-quick-view', 'safety-dashboard'] },
  { id: 'alerts', label: 'Alerts', icon: AlertTriangle, widgets: ['profitability-alerts'] },
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
  'subcon-margin-guard': 'md',
  'financial-reconciliation': 'lg',
  'billing-readiness': 'lg',
  'outstanding-receivables': 'lg',
  'project-financials': 'lg',
  'field-priorities': 'md',
  'cash-flow-forecast': 'lg',
  'drilling-performance': 'lg',
  'safety-dashboard': 'md',
  'predictive-insights': 'lg',
  'traffic-heatmap': 'lg',
  'profitability-alerts': 'md',
  'compliance-expiry': 'md',
  'staff-utilization': 'md',
};

// Widgets that require costing permission (admin / manager only).
export const COST_WIDGETS = ['job-profitability', 'efficiency-snapshot', 'rig-profitability', 'unbilled-wip', 'project-financials', 'subcon-margin-guard', 'financial-reconciliation', 'billing-readiness', 'outstanding-receivables', 'cash-flow-forecast', 'profitability-alerts', 'staff-utilization'];

// Widgets that show company-wide data (not specific to a job). These are hidden
// when the dashboard is focused on a single job, since they don't reflect that
// job's data. The remaining widgets already scope themselves via JobFilterContext.
export const GLOBAL_ONLY_WIDGETS = ['executive-snapshot', 'compliance-overview', 'compliance-expiry', 'maintenance-quick-view', 'ai-insights', 'geo-heatmap', 'unbilled-wip', 'project-financials', 'subcon-margin-guard', 'financial-reconciliation', 'billing-readiness', 'outstanding-receivables', 'field-priorities', 'cash-flow-forecast', 'drilling-performance', 'safety-dashboard', 'predictive-insights', 'profitability-alerts', 'staff-utilization'];

// View profiles — quick-toggle scopes that surface only the widgets relevant to
// one focus area, cutting scroll depth. Applied as an allow-list on top of the
// user's saved widget order (saved customisation still respected within a profile).
export const VIEW_PROFILES = [
  { id: 'operations', label: 'Operations', icon: Activity, widgets: ['executive-snapshot', 'field-crews', 'field-priorities', 'job-assets', 'delivery-stats', 'traffic-heatmap', 'drilling-performance'] },
  { id: 'financials', label: 'Financials', icon: PoundSterling, widgets: ['profitability-alerts', 'outstanding-receivables', 'billing-readiness', 'cash-flow-forecast', 'financial-reconciliation', 'project-financials', 'subcon-margin-guard', 'efficiency-snapshot', 'rig-profitability', 'unbilled-wip', 'predictive-insights', 'staff-utilization'] },
  { id: 'compliance', label: 'Compliance', icon: ShieldCheck, widgets: ['compliance-overview', 'compliance-expiry', 'maintenance-quick-view', 'safety-dashboard'] },
];