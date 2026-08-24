import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useScopedEntity } from '@/hooks/useScopedEntity';
import { Truck } from 'lucide-react';
import HubShell from '@/components/HubShell';
import RunReportButton from '@/components/reports/RunReportButton';
import FleetCommandHeader from '@/components/vehicles/FleetCommandHeader';
import Vehicles from '@/pages/Vehicles';

/**
 * Fleet Hub — dedicated hub for all vehicles, live GPS tracking,
 * MOT/service schedules, and fleet maintenance.
 * Vehicles are synced from Geotab (Drilling group only) and Holman (MOT/mileage).
 *
 * The command header shows KPI gauges, a live fleet map, and engine-hours/mileage
 * summary tiles. Below that, the Vehicles component renders the card grid with
 * enhanced cards showing full vehicle details.
 */
export default function FleetHub() {
  const { data: vehicles = [] } = useScopedEntity('Vehicle', { queryKey: ['vehicles-fleet-hub'], sort: '-created_date', limit: 500 });

  // Live Geotab data — fresh driving/ignition overlay (mode 'live_fast' for speed)
  const { data: liveData } = useQuery({
    queryKey: ['fleet-hub-live-driving'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getVehicleLocationHistory', { mode: 'live_fast', limit: 500 });
      return res?.data ?? res;
    },
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const liveLocations = liveData?.vehicles || [];

  const liveByVehicle = useMemo(() => {
    const map = {};
    liveLocations.forEach(loc => { if (loc.vehicle_id) map[loc.vehicle_id] = loc; });
    return map;
  }, [liveLocations]);

  return (
    <HubShell
      icon={Truck}
      title="Fleet Hub"
      subtitle="Drilling group vehicles — live GPS tracking, full specs, engine hours & mileage"
      actions={<RunReportButton hub="fleet" />}
    >
      <FleetCommandHeader vehicles={vehicles} liveByVehicle={liveByVehicle} />
      <Vehicles />
    </HubShell>
  );
}