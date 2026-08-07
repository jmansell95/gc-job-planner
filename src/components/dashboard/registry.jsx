import { Truck, Users, BarChart3, PoundSterling, CalendarClock, ShieldCheck, Boxes, Sparkles, TrendingUp, HardHat, Activity, LayoutDashboard, MapPin, FileClock, FolderKanban, AlertTriangle, Scale, ClipboardCheck, Gauge, ShieldAlert, Brain, Navigation, AlertOctagon, Star, Leaf, CloudSun, Settings2, Warehouse, RotateCcw, Radar } from 'lucide-react';

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
  'geofence-feed': { title: 'Geofence Activity', icon: Radar },
  'exception-monitor': { title: 'Needs Attention', icon: AlertOctagon },
  'error-monitor': { title: 'Error Monitor', icon: AlertOctagon },
  'yard-map': { title: 'Yard Management Map', icon: Warehouse },
  'mission-control': { title: 'Mission Control Center', icon: Radar },
  'idle-asset-transfer': { title: 'Idle Asset Transfers', icon: RotateCcw },
  'training-gap-scheduler': { title: 'Training Gap Scheduler', icon: CalendarClock },
};

// ═══════════════════════════════════════════════════════════════════
//  THREE-TIER DASHBOARD LAYOUT
//  Tier 1 — Operational Pulse: live, always-on metrics for quick glance
//  Tier 2 — Alerts & Action: exception-based items needing attention
//  Tier 3 — Deep Dive & Analytics: charts, forecasts, and historical data
// ═══════════════════════════════════════════════════════════════════
export const TIER_OPERATIONAL = [
  'exception-monitor',
  'field-priorities',
  'site-readiness',
  'off-hire-recon',
];

export const TIER_ALERTS = [
  'compliance-expiry',
  'billing-readiness',
  'safety-dashboard',
  'profitability-alerts',
  'error-monitor',
  'missing-rates',
];

export const TIER_ANALYTICS = [
  'executive-snapshot',
  'mission-control',
  'delivery-stats',
  'compliance-overview',
  'yard-control',
  'field-crews',
  'charts',
  'maintenance-quick-view',
  'job-assets',
  'ai-insights',
  'job-profitability',
  'efficiency-snapshot',
  'rig-profitability',
  'geo-heatmap',
  'unbilled-wip',
  'project-financials',
  'subcon-margin-guard',
  'financial-reconciliation',
  'outstanding-receivables',
  'cash-flow-forecast',
  'drilling-performance',
  'predictive-insights',
  'traffic-heatmap',
  'staff-utilization',
  'asset-utilization',
  'live-site-map',
  'client-feedback',
  'audit-score-trends',
  'environmental-impact',
  'predictive-completion',
  'benchmark-comparisons',
  'site-weather',
  'config-health',
  'geofence-feed',
  'yard-map',
  'idle-asset-transfer',
  'training-gap-scheduler',
];

// Backward compat — kept for any code still importing these
export const PRIMARY_WIDGETS = TIER_OPERATIONAL;
export const SECONDARY_WIDGETS = TIER_ANALYTICS;

// The unified list of widgets shown on the dashboard in tier order.
export const DEFAULT_WIDGETS = [
  ...TIER_OPERATIONAL,
  ...TIER_ALERTS,
  ...TIER_ANALYTICS,
];

// Tier metadata for section headers
export const TIER_META = {
  operational: { label: 'Operational Pulse', icon: Activity, color: 'emerald' },
  alerts: { label: 'Alerts & Action', icon: AlertOctagon, color: 'rose' },
  analytics: { label: 'Deep Dive & Analytics', icon: BarChart3, color: 'blue' },
};

// Map each widget to its tier
export const WIDGET_TIER = {};
TIER_OPERATIONAL.forEach(id => WIDGET_TIER[id] = 'operational');
TIER_ALERTS.forEach(id => WIDGET_TIER[id] = 'alerts');
TIER_ANALYTICS.forEach(id => WIDGET_TIER[id] = 'analytics');

// Widgets that require costing permission (admin / manager only).
export const COST_WIDGETS = ['job-profitability', 'efficiency-snapshot', 'rig-profitability', 'unbilled-wip', 'project-financials', 'subcon-margin-guard', 'financial-reconciliation', 'billing-readiness', 'outstanding-receivables', 'cash-flow-forecast', 'profitability-alerts', 'staff-utilization'];

// Widgets that show company-wide data (not specific to a job). These are hidden
// when the dashboard is focused on a single job, since they don't reflect that
// job's data.
export const GLOBAL_ONLY_WIDGETS = ['executive-snapshot', 'exception-monitor', 'compliance-overview', 'compliance-expiry', 'maintenance-quick-view', 'ai-insights', 'geo-heatmap', 'unbilled-wip', 'project-financials', 'subcon-margin-guard', 'financial-reconciliation', 'billing-readiness', 'outstanding-receivables', 'field-priorities', 'cash-flow-forecast', 'drilling-performance', 'safety-dashboard', 'predictive-insights', 'profitability-alerts', 'staff-utilization', 'predictive-completion', 'benchmark-comparisons', 'site-weather', 'config-health', 'missing-rates', 'error-monitor', 'yard-map'];