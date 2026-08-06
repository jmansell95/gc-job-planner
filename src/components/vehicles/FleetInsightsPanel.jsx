import React, { useState } from 'react';
import { ChevronDown, ChevronRight, BarChart3 } from 'lucide-react';
import MileageReconciliationWidget from '@/components/vehicles/MileageReconciliationWidget';
import VehicleUtilisationWidget from '@/components/vehicles/VehicleUtilisationWidget';
import IdleVehiclesWidget from '@/components/vehicles/IdleVehiclesWidget';
import PredictiveMaintenanceWidget from '@/components/vehicles/PredictiveMaintenanceWidget';

/**
 * FleetInsightsPanel — a collapsible panel that groups fleet insight
 * widgets (mileage, utilisation, idle, predictive maintenance). Sync controls
 * have been moved to the prominent FleetSyncButtons bar in the page header.
 */
export default function FleetInsightsPanel({ liveData, onShowReport, onSelectVehicle }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-4 rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
      {/* Toggle header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-slate-50 to-white hover:from-slate-100 transition text-left"
      >
        {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        <div className="w-8 h-8 rounded-lg stat-gradient-cyan flex items-center justify-center shadow-sm">
          <BarChart3 className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-slate-800">Fleet Insights</p>
          <p className="text-[11px] text-slate-400">Mileage, utilisation & predictive maintenance</p>
        </div>
        <span className="text-[10px] font-semibold text-slate-400 px-2 py-1 bg-slate-100 rounded-full">
          {open ? 'Hide' : 'Show'}
        </span>
      </button>

      {/* Collapsible content */}
      {open && (
        <div className="p-3 space-y-4 border-t border-slate-100">
          {/* Mileage reconciliation + Utilisation + Idle */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <MileageReconciliationWidget />
            <VehicleUtilisationWidget />
            <IdleVehiclesWidget />
          </div>

          {/* Predictive maintenance */}
          <PredictiveMaintenanceWidget onSelectVehicle={onSelectVehicle} />
        </div>
      )}
    </div>
  );
}