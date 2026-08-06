import { Truck, Users, BarChart3, PoundSterling, CalendarClock, ShieldCheck, Boxes, Sparkles, TrendingUp, HardHat, Activity, LayoutDashboard, MapPin, FileClock, FolderKanban, AlertTriangle, Scale, ClipboardCheck, Gauge, ShieldAlert, Brain, Navigation, AlertOctagon, Star, Leaf, CloudSun, Settings2, Warehouse, RotateCcw } from 'lucide-react';

export const WIDGET_REGISTRY = {
  'executive-snapshot': { title: 'Executive Snapshot', icon: LayoutDashboard },
  'delivery-stats': { title: 'Deliveries & Collections', icon: Truck },
  'compliance-overview': { title: 'Compliance Overview', icon: ShieldCheck },
  'yard-control': { title: 'Yard Control', icon: Warehouse },
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
  'field-priorities': { title: 'Field Priorities', icon: AlertTriangle },
  'cash-flow-forecast': { title: 'Cash Flow Forecast', icon: PoundSterling },
  'drilling-performance': { title: 'Drilling Performance', icon: Gauge },
  'safety-dashboard': { title: 'Safety Dashboard', icon: ShieldAlert },
  'predictive-insights': { title: 'Predictive AI Insights', icon: Brain },
  'traffic-heatmap': { title: 'Mission Command — Traffic Heatmap', icon: Navigation },
  'profitability-alerts': { title: 'Profitability Alerts', icon: AlertOctagon },
  'compliance-expiry': { title: 'Compliance Expiry', icon: ShieldAlert },
  'staff-utilization': { title: 'Staff Utilization', icon: Users },
  'asset-utilization': { title: 'Asset Utilization', icon: Activity },
  'live-site-map': { title: 'Live Site Map', icon: MapPin },
  'client-feedback': { title: 'Client Feedback', icon: Star },
  'audit-score-trends': { title: 'Audit Score Trends', icon: ShieldCheck },
  'environmental-impact': { title: 'Environmental Impact', icon: Leaf },
  'predictive-completion': { title: 'Completion Forecast', icon: Brain },
  'benchmark-comparisons': { title: 'Benchmark Comparisons', icon: BarChart3 },
  'site-weather': { title: 'Site Weather Conditions', icon: CloudSun },
  'config-health': { title: 'Configuration Health', icon: Settings2 },
  'missing-rates': { title: 'Missing Day Rates', icon: PoundSterling },
  'site-readiness': { title: 'Site Readiness Gate', icon: ShieldCheck },
  'off-hire-recon': { title: 'Off-Hire Reconciliation', icon: RotateCcw },
  'site-command-cards': { title: 'Site Command Cards', icon: HardHat },
  'crew-deployment': { title: 'Crew Deployment', icon: Users },
};

// ═══════════════════════════════════════════════════════════════════
//  PRIMARY WIDGETS — the operational heartbeat, always visible.
//  Keep this list SHORT. These are the 4 panels a manager needs at
//  a glance: who's working, what needs attention, what's moving,
//  and what's safe.
// ═══════════════════════════════════════════════════════════════════
export const PRIMARY_WIDGETS = [
  'field-crews',
  'field-priorities',
];

// ═══════════════════════════════════════════════════════════════════
//  SECONDARY WIDGETS — deeper-dive analytics, hidden behind a
//  "Show More Insights" toggle. These are useful but not
//  needed for day-to-day operational awareness.
// ═══════════════════════════════════════════════════════════════════
export const SECONDARY_WIDGETS = [
  'live-site-map',
  'site-weather',
];

// The unified list of widgets shown on the dashboard. Users can reorder
// and toggle visibility via the Customize button; order is persisted to
// localStorage. This replaces the old primary/secondary split.
export const DEFAULT_WIDGETS = [
  'crew-deployment',
  'field-priorities',
  'site-readiness',
  'off-hire-recon',
  'live-site-map',
  'site-weather',
];

// Widgets that require costing permission (admin / manager only).
export const COST_WIDGETS = ['job-profitability', 'efficiency-snapshot', 'rig-profitability', 'unbilled-wip', 'project-financials', 'subcon-margin-guard', 'financial-reconciliation', 'billing-readiness', 'outstanding-receivables', 'cash-flow-forecast', 'profitability-alerts', 'staff-utilization'];

// Widgets that show company-wide data (not specific to a job). These are hidden
// when the dashboard is focused on a single job, since they don't reflect that
// job's data.
export const GLOBAL_ONLY_WIDGETS = ['executive-snapshot', 'compliance-overview', 'compliance-expiry', 'maintenance-quick-view', 'ai-insights', 'geo-heatmap', 'unbilled-wip', 'project-financials', 'subcon-margin-guard', 'financial-reconciliation', 'billing-readiness', 'outstanding-receivables', 'field-priorities', 'cash-flow-forecast', 'drilling-performance', 'safety-dashboard', 'predictive-insights', 'profitability-alerts', 'staff-utilization', 'predictive-completion', 'benchmark-comparisons', 'site-weather', 'config-health', 'missing-rates'];