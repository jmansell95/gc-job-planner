import { Truck, Grid3x3, Users, BarChart3, PoundSterling, Wrench, CalendarClock, ShieldCheck, Shield, Cog, Boxes } from 'lucide-react';

export const WIDGET_REGISTRY = {
  'delivery-stats': { title: 'Delivery & Collection', icon: Truck },
  'kpi-stats': { title: 'Key Metrics', icon: Grid3x3 },
  'compliance-overview': { title: 'Compliance Snapshot', icon: ShieldCheck },
  'supervisor-overview': { title: 'Supervisor Overview', icon: Shield },
  'field-crews': { title: 'Field Crews Today', icon: Users },
  'charts': { title: 'Charts', icon: BarChart3 },
  'cost-analytics': { title: 'Cost Analytics', icon: PoundSterling },
  'vehicle-alerts': { title: 'Vehicle Maintenance', icon: Wrench },
  'maintenance-quick-view': { title: 'Upcoming Bookings', icon: CalendarClock },
  'rig-tracker': { title: 'Rig Locations', icon: Cog },
  'job-assets': { title: 'Job Assets', icon: Boxes },
};

export const DEFAULT_WIDGET_ORDER = [
  'delivery-stats',
  'kpi-stats',
  'compliance-overview',
  'supervisor-overview',
  'field-crews',
  'charts',
  'cost-analytics',
  'vehicle-alerts',
  'maintenance-quick-view',
  'rig-tracker',
  'job-assets',
];