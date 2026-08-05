import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Leaf, Recycle, Fuel, Droplets, Zap, AlertTriangle } from 'lucide-react';
import WidgetShell from '@/components/dashboard/WidgetShell';

export default function EnvironmentalImpactWidget() {
  const { data: reports = [] } = useQuery({ queryKey: ['environmental-reports'], queryFn: () => base44.entities.EnvironmentalReport.list('-report_date', 50) });

  const stats = useMemo(() => {
    const total = reports.length;
    const totalWaste = reports.reduce((s, r) => s + (r.waste_tonnage || 0), 0);
    const totalRecycled = reports.reduce((s, r) => s + (r.waste_recycled_tonnage || 0), 0);
    const totalLandfill = reports.reduce((s, r) => s + (r.waste_to_landfill_tonnage || 0), 0);
    const totalCarbon = reports.reduce((s, r) => s + (r.carbon_kg_co2e || 0), 0);
    const totalFuel = reports.reduce((s, r) => s + (r.fuel_litres || 0), 0);
    const totalWater = reports.reduce((s, r) => s + (r.water_litres || 0), 0);
    const totalEnergy = reports.reduce((s, r) => s + (r.energy_kwh || 0), 0);
    const totalSpoil = reports.reduce((s, r) => s + (r.spoil_tonnage || 0), 0);
    const totalIncidents = reports.reduce((s, r) => s + (r.incidents || 0), 0);
    const recyclingRate = totalWaste > 0 ? Math.round((totalRecycled / totalWaste) * 100) : 0;
    const avgSpoilReuse = reports.length > 0 ? Math.round(reports.reduce((s, r) => s + (r.spoil_reused_pct || 0), 0) / reports.length) : 0;
    return { total, totalWaste, totalRecycled, totalLandfill, totalCarbon, totalFuel, totalWater, totalEnergy, totalSpoil, totalIncidents, recyclingRate, avgSpoilReuse };
  }, [reports]);

  return (
    <WidgetShell widgetId="environmental-impact" title="Environmental Impact" icon={Leaf} subtitle={`${stats.total} reports · ${stats.recyclingRate}% recycling`}>
      <div className="space-y-3">
        {/* Key metrics */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 bg-emerald-50 rounded-lg p-2.5">
            <Recycle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-emerald-700 tabular-nums">{stats.totalRecycled.toFixed(1)}t</p>
              <p className="text-[10px] text-emerald-600">Recycled</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-rose-50 rounded-lg p-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-rose-700 tabular-nums">{stats.totalLandfill.toFixed(1)}t</p>
              <p className="text-[10px] text-rose-600">To Landfill</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-2.5">
            <Leaf className="w-4 h-4 text-slate-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-slate-800 tabular-nums">{(stats.totalCarbon / 1000).toFixed(2)}t</p>
              <p className="text-[10px] text-slate-500">CO₂e</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-amber-50 rounded-lg p-2.5">
            <Fuel className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-700 tabular-nums">{stats.totalFuel.toLocaleString()}L</p>
              <p className="text-[10px] text-amber-600">Fuel</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-blue-50 rounded-lg p-2.5">
            <Droplets className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-blue-700 tabular-nums">{stats.totalWater.toLocaleString()}L</p>
              <p className="text-[10px] text-blue-600">Water</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-violet-50 rounded-lg p-2.5">
            <Zap className="w-4 h-4 text-violet-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-violet-700 tabular-nums">{stats.totalEnergy.toLocaleString()}kWh</p>
              <p className="text-[10px] text-violet-600">Energy</p>
            </div>
          </div>
        </div>

        {/* Recycling rate bar */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-500">Recycling Rate</span>
            <span className="text-xs font-bold text-emerald-600 tabular-nums">{stats.recyclingRate}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full" style={{ width: `${stats.recyclingRate}%` }} />
          </div>
        </div>

        {/* Spoil reuse */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-500">Spoil Reuse Rate</span>
            <span className="text-xs font-bold text-blue-600 tabular-nums">{stats.avgSpoilReuse}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full" style={{ width: `${stats.avgSpoilReuse}%` }} />
          </div>
        </div>

        {/* Environmental incidents */}
        {stats.totalIncidents > 0 && (
          <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <p className="text-xs text-rose-700 font-medium">{stats.totalIncidents} environmental incident{stats.totalIncidents !== 1 ? 's' : ''} recorded</p>
          </div>
        )}

        {reports.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Leaf className="w-8 h-8 text-slate-300 mb-2" />
            <p className="text-xs text-slate-500">No environmental reports yet. Start tracking waste, carbon, and resource usage per job.</p>
          </div>
        )}
      </div>
    </WidgetShell>
  );
}