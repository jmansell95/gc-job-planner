import { Truck, Grid3x3, Users, BarChart3, PoundSterling, CalendarClock, ShieldCheck, Shield, Boxes } from 'lucide-react';

export const WIDGET_REGISTRY = {
  'delivery-stats': { title: 'Delivery & Collection', icon: Truck },
  'kpi-stats': { title: 'Key Metrics', icon: Grid3x3 },
  'compliance-overview': { title: 'Staff Training Compliance', icon: ShieldCheck },
  'supervisor-overview': { title: 'Supervisor Overview', icon: Shield },
  'field-crews': { title: 'Field Crews Today', icon: Users },
  'charts': { title: 'Charts', icon: BarChart3 },
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

export const DEFAULT_WIDGET_SIZES = {
  'kpi-stats': 'lg',
  'field-crews': 'lg',
  'charts': 'lg',
  'supervisor-overview': 'lg',
  'compliance-overview': 'md',
  'cost-analytics': 'md',
  'delivery-stats': 'md',
  'maintenance-quick-view': 'md',
  'job-assets': 'md',
};