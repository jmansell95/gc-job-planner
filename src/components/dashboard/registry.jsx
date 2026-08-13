import { LayoutDashboard, AlertTriangle, AlertOctagon, MapPin, Sparkles, CloudSun, Drill, HeartPulse, Layers } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════
//  STREAMLINED DASHBOARD REGISTRY
//  Only widgets that DON'T have a dedicated page live on the dashboard.
//  Moved to dedicated pages:
//   - site-readiness-gate, crew-cert-pulse, carbon-footprint → Compliance
//   - yard-control, predictive-maintenance, predictive-insights → Assets
//   - financial-reconciliation, benchmark-comparisons, reports-hub,
//     project-health, client-feedback → Billing
//   - staff-utilization → Staff
// ═══════════════════════════════════════════════════════════════════
export const WIDGET_REGISTRY = {
  'executive-snapshot': { title: 'Executive Snapshot', icon: LayoutDashboard, fullWidth: true },
  'field-priorities': { title: 'Field Priorities', icon: AlertTriangle },
  'exception-monitor': { title: 'Needs Attention', icon: AlertOctagon, fullWidth: true },
  'borehole-progress': { title: 'Borehole Progress', icon: Drill },
  'live-site-map': { title: 'Live Site Map', icon: MapPin, fullWidth: true },
  'ai-insights': { title: 'AI Weekly Insights', icon: Sparkles },
  'site-weather': { title: 'Site Weather Conditions', icon: CloudSun },
  'geo-heatmap': { title: 'Geotechnical Risk', icon: MapPin },
  'system-health': { title: 'System Health & Integrity', icon: HeartPulse },
  'workload-ownership': { title: 'Workload Ownership', icon: Layers },
};

// ═══════════════════════════════════════════════════════════════════
//  TWO-TIER DASHBOARD LAYOUT
//  Tier 1 — At a Glance: live operational widgets for quick situational awareness
//  Tier 2 — Insights & Analysis: AI predictions, benchmarks, and deeper analysis
// ═══════════════════════════════════════════════════════════════════
export const TIER_GLANCE = [
  'executive-snapshot',
  'field-priorities',
  'exception-monitor',
];

export const TIER_INSIGHTS = [
  'borehole-progress',
  'live-site-map',
  'ai-insights',
  'site-weather',
  'geo-heatmap',
  'system-health',
  'workload-ownership',
];

export const DEFAULT_WIDGETS = [
  ...TIER_GLANCE,
  ...TIER_INSIGHTS,
];

// By default, only the 4 At-a-Glance widgets are visible. All Insights
// widgets start hidden — users enable them via the Customise button.
export const DEFAULT_HIDDEN = [...TIER_INSIGHTS];

// Tier metadata for section headers
export const TIER_META = {
  glance: { label: 'At a Glance', icon: MapPin, color: 'emerald' },
  insights: { label: 'Insights & Analysis', icon: Sparkles, color: 'blue' },
};

// Map each widget to its tier
export const WIDGET_TIER = {};
TIER_GLANCE.forEach(id => WIDGET_TIER[id] = 'glance');
TIER_INSIGHTS.forEach(id => WIDGET_TIER[id] = 'insights');

// Backward compat — kept for any code still importing these
export const TIER_OPERATIONAL = TIER_GLANCE;
export const TIER_ALERTS = [];
export const TIER_ANALYTICS = TIER_INSIGHTS;
export const PRIMARY_WIDGETS = TIER_GLANCE;
export const SECONDARY_WIDGETS = TIER_INSIGHTS;

// No cost-gated widgets remain on the dashboard — all financial widgets
// have been moved to the dedicated Billing page.
export const COST_WIDGETS = [];

// Widgets that show company-wide data (not specific to a job). Hidden when
// the dashboard is focused on a single job.
export const GLOBAL_ONLY_WIDGETS = [
  'executive-snapshot', 'field-priorities', 'exception-monitor',
  'borehole-progress', 'live-site-map', 'ai-insights', 'geo-heatmap', 'system-health',
];