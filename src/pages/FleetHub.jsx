import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Truck, CheckCircle2, AlertTriangle, XCircle, Wrench, Navigation } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import HubStatsBar from '@/components/dashboard/HubStatsBar';
import Vehicles from '@/pages/Vehicles';
import { differenceInDays } from 'date-fns';

function getVehicleStatus(v) {
  const today = new Date();
  const issues = [];
  const motExpiry = (v.mot_expiry && v.mot_expiry !== 'null' && v.mot_expiry !== 'None') ? v.mot_expiry : null;
  if (motExpiry) {
    const d = differenceInDays(new Date(motExpiry + 'T00:00:00'), today);
    if (!isNaN(d)) {
      if (d < 0) issues.push({ severity: 'expired' });
      else if (d <= 30) issues.push({ severity: 'warning' });
    }
  }
  if (v.service_due_date && v.service_due_date !== 'null' && v.service_due_date !== 'None') {
    const d = differenceInDays(new Date(v.service_due_date + 'T00:00:00'), today);
    if (!isNaN(d)) {
      if (d < 0) issues.push({ severity: 'expired' });
      else if (d <= 30) issues.push({ severity: 'warning' });
    }
  }
  const level = issues.find(i => i.severity === 'expired') ? 'expired'
    : issues.find(i => i.severity === 'warning') ? 'warning'
    : 'compliant';
  return level;
}

/**
 * Fleet Hub — dedicated hub for all vehicles, live GPS tracking,
 * MOT/service schedules, and fleet maintenance.
 * Vehicles are synced from Geotab (live tracking) and Holman (MOT/mileage).
 */
export default function FleetHub() {
  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles-fleet-hub'],
    queryFn: () => base44.entities.Vehicle.list('-created_date', 500),
  });

  const stats = React.useMemo(() => {
    let compliant = 0, warning = 0, expired = 0, driving = 0;
    vehicles.forEach(v => {
      const level = getVehicleStatus(v);
      if (level === 'expired') expired++;
      else if (level === 'warning') warning++;
      else compliant++;
      if (v.current_operator_name) driving++;
    });
    return { total: vehicles.length, compliant, warning, expired, driving };
  }, [vehicles]);

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Truck}
        title="Fleet Hub"
        subtitle="Vehicles, live GPS tracking, MOT & service schedules — Geotab & Holman synced"
      />

      {/* Fleet KPI Bar */}
      {stats.total > 0 && (
        <HubStatsBar tiles={[
          { icon: Truck, label: 'Total Vehicles', value: stats.total, sublabel: 'In fleet', color: 'brand' },
          { icon: CheckCircle2, label: 'Compliant', value: stats.compliant, sublabel: 'MOT & service OK', color: 'emerald' },
          { icon: AlertTriangle, label: 'Attention', value: stats.warning, sublabel: 'Due within 30d', color: 'amber' },
          { icon: XCircle, label: 'Critical', value: stats.expired, sublabel: 'Overdue', color: 'rose' },
          { icon: Navigation, label: 'Driving Now', value: stats.driving, sublabel: 'Live operators', color: 'blue' },
        ]} />
      )}

      <Vehicles />
    </div>
  );
}