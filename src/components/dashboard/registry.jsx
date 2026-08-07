import { LayoutDashboard, AlertTriangle, Warehouse, AlertOctagon, MapPin, Sparkles, Brain, CloudSun, Star, BarChart3, Radar } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════
//  STREAMLINED DASHBOARD REGISTRY
//  Only widgets that DON'T have a dedicated page live on the dashboard.
//  Everything else (jobs, billing, compliance, assets, vehicles,
//  scheduling, logistics, timesheets, settings) is accessed via the
//  sidebar nav and removed from the dashboard to reduce clutter.
// ═══════════════════════════════════════════════════════════════════
export const WIDGET_REGISTRY = {
  'executive-snapshot': { title: 'Executive Snapshot', icon: LayoutDashboard, fullWidth: true },
  'mission-control': { title: 'Mission Control Center', icon: Radar, fullWidth: true },
  'field-priorities': { title: 'Field Priorities', icon: AlertTriangle },
  'yard-control': { title: 'Yard Control', icon: Warehouse },
  'exception-monitor': { title: 'Needs Attention', icon: AlertOctagon, fullWidth: true },
  'live-site-map': { title: 'Live Site Map', icon: MapPin, fullWidth: true },
  'ai-insights': { title: 'AI Weekly Insights', icon: Sparkles },
  'predictive-insights': { title: 'Predictive AI Insights', icon: Brain },
  'site-weather': { title: 'Site Weather Conditions', icon: CloudSun },
  'client-feedback': { title: 'Client Feedback', icon: Star },
  'benchmark-comparisons': { title: 'Benchmark Comparisons', icon: BarChart3 },
  'geo-heatmap': { title: 'Geotechnical Risk', icon: MapPin },
};

// ═══════════════════════════════════════════════════════════════════
//  TWO-TIER DASHBOARD LAYOUT
//  Tier 1 — At a Glance: live operational widgets for quick situational awareness
//  Tier 2 — Insights & Analysis: AI predictions, benchmarks, and deeper analysis
// ═══════════════════════════════════════════════════════════════════
export const TIER_GLANCE = [
  'executive-snapshot',
  'mission-control',
  'field-priorities',
  'yard-control',
  'exception-monitor',
  'live-site-map',
];

export const TIER_INSIGHTS = [
  'ai-insights',
  'predictive-insights',
  'site-weather',
  'client-feedback',
  'benchmark-comparisons',
  'geo-heatmap',
];

export const DEFAULT_WIDGETS = [
  ...TIER_GLANCE,
  ...TIER_INSIGHTS,
];

// Tier metadata for section headers
export const TIER_META = {
  glance: { label: 'At a Glance', icon: Radar, color: 'emerald' },
  insights: { label: 'Insights & Analysis', icon: Brain, color: 'blue' },
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
  'executive-snapshot', 'mission-control', 'field-priorities', 'yard-control',
  'exception-monitor', 'live-site-map', 'ai-insights', 'predictive-insights',
  'client-feedback', 'benchmark-comparisons', 'geo-heatmap',
];