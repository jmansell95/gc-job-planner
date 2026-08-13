import React from 'react';
import Vehicles from '@/pages/Vehicles';
import PageHeader from '@/components/PageHeader';
import { Truck } from 'lucide-react';

/**
 * Fleet Hub — dedicated hub for all vehicles, live GPS tracking,
 * MOT/service schedules, and fleet maintenance.
 * Vehicles are synced from Geotab (live tracking) and Holman (MOT/mileage).
 */
export default function FleetHub() {
  return (
    <div className="space-y-4">
      <PageHeader
        icon={Truck}
        title="Fleet Hub"
        subtitle="Vehicles, live GPS tracking, MOT & service schedules — Geotab & Holman synced"
      />
      <Vehicles />
    </div>
  );
}