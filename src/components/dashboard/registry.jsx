import { Truck, Grid3x3, Users, BarChart3, PoundSterling, CalendarClock, ShieldCheck, Shield, Boxes } from 'lucide-react';

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
];

// Tabbed groups for the dashboard. Each widget is assigned to one tab.
export const DASHBOARD_TABS = [
  { id: 'operations', label: 'Operations', icon: Grid3x3, widgets: ['kpi-stats', 'field-crews', 'job-assets', 'delivery-stats', 'supervisor-overview'] },
  { id: 'insights', label: 'Insights', icon: BarChart3, widgets: ['charts', 'cost-analytics'] },
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
};