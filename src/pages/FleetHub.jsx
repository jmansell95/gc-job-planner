import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useScopedEntity } from '@/hooks/useScopedEntity';
import { Truck, CheckCircle2, AlertTriangle, XCircle, Navigation } from 'lucide-react';
import HubShell from '@/components/HubShell';
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
 *
 * "Driving Now" uses the live Geotab DeviceStatusInfo overlay (mode 'live'),
 * polled every 60s, so it reflects vehicles actually moving right now — not
 * stale delivery-task state.
 */
export default function FleetHub() {
  const { data: vehicles = [] } = useScopedEntity('Vehicle', { queryKey: ['vehicles-fleet-hub'], sort: '-created_date', limit: 500 });

  // Live Geotab data — fresh driving/ignition overlay (mode 'live')
  const { data: liveData } = useQuery({
    queryKey: ['fleet-hub-live-driving'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getVehicleLocationHistory', { mode: 'live', limit: 500 });
      return res?.data ?? res;
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const liveLocations = liveData?.vehicles || [];

  const liveByVehicle = useMemo(() => {
    const map = {};
    liveLocations.forEach(loc => { if (loc.vehicle_id) map[loc.vehicle_id] = loc; });
    return map;
  }, [liveLocations]);

  const stats = useMemo(() => {
    let compliant = 0, warning = 0, expired = 0, driving = 0;
    const drivingNames = [];
    vehicles.forEach(v => {
      const level = getVehicleStatus(v);
      if (level === 'expired') expired++;
      else if (level === 'warning') warning++;
      else compliant++;

      const live = liveByVehicle[v.id];
      const isLiveDriving = live && (live.is_driving_now || (live.speed_kph || 0) > 0);
      if (isLiveDriving) {
        driving++;
        if (live.driver_name) drivingNames.push(live.driver_name);
      } else if (!live && v.current_operator_name) {
        // Fallback only when no live Geotab data exists for this vehicle
        driving++;
        drivingNames.push(v.current_operator_name);
      }
    });
    return { total: vehicles.length, compliant, warning, expired, driving, drivingNames };
  }, [vehicles, liveByVehicle]);

  const drivingSub = stats.drivingNames.length
    ? stats.drivingNames.slice(0, 2).join(', ') + (stats.drivingNames.length > 2 ? ` +${stats.drivingNames.length - 2}` : '')
    : 'Live operators';

  return (
    <HubShell
      icon={Truck}
      title="Fleet Hub"
      subtitle="Vehicles, live GPS tracking, MOT & service schedules — Geotab & Holman synced"
      kpiStrip={
        stats.total > 0 ? (
          <HubStatsBar tiles={[
            { icon: Truck, label: 'Total Vehicles', value: stats.total, sublabel: 'In fleet', color: 'brand' },
            { icon: CheckCircle2, label: 'Compliant', value: stats.compliant, sublabel: 'MOT & service OK', color: 'emerald' },
            { icon: AlertTriangle, label: 'Attention', value: stats.warning, sublabel: 'Due within 30d', color: 'amber' },
            { icon: XCircle, label: 'Critical', value: stats.expired, sublabel: 'Overdue', color: 'rose' },
            { icon: Navigation, label: 'Driving Now', value: stats.driving, sublabel: drivingSub, color: 'blue' },
          ]} />
        ) : null
      }
    >
      <Vehicles />
    </HubShell>
  );
}