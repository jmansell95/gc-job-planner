import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Leaf, Fuel, TrendingDown, Truck } from 'lucide-react';
import WidgetShell from './WidgetShell';
import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip } from 'recharts';

// UK average CO2 emissions by fuel type (g/km) — used as fallback when
// a vehicle's co2_emissions_g_km field is not set.
const FUEL_EMISSIONS = {
  diesel: 168,
  petrol: 170,
  hybrid: 110,
  electric: 0,
  lpg: 150,
  cng: 140,
  unknown: 170,
};

// Assumed average monthly mileage per active vehicle (for estimation).
const AVG_MONTHLY_MILES = 1200;

export default function CarbonFootprintWidget() {
  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles-carbon'],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const stats = useMemo(() => {
    const active = vehicles.filter(v => v.registration_number);
    if (active.length === 0) return null;

    const byFuel = {};
    let totalEmissionsPerKm = 0;
    let totalMonthlyKg = 0;
    const ranked = [];

    for (const v of active) {
      const fuel = v.fuel_type || 'unknown';
      const emissionsPerKm = v.co2_emissions_g_km || FUEL_EMISSIONS[fuel] || FUEL_EMISSIONS.unknown;
      totalEmissionsPerKm += emissionsPerKm;

      // Estimate monthly CO2: monthly miles × emissions g/km / 1000 = kg
      const monthlyKg = (AVG_MONTHLY_MILES * emissionsPerKm) / 1000;
      totalMonthlyKg += monthlyKg;

      byFuel[fuel] = (byFuel[fuel] || { count: 0, emissions: 0, monthlyKg: 0 });
      byFuel[fuel].count++;
      byFuel[fuel].emissions += emissionsPerKm;
      byFuel[fuel].monthlyKg += monthlyKg;

      ranked.push({ name: v.name || v.registration_number, reg: v.registration_number, emissionsPerKm, fuel });
    }

    const avgEmissions = totalEmissionsPerKm / active.length;
    const totalMonthlyTonnes = totalMonthlyKg / 1000;

    const chartData = Object.entries(byFuel).map(([fuel, data]) => ({
      fuel: fuel.charAt(0).toUpperCase() + fuel.slice(1),
      co2: Math.round(data.monthlyKg),
      count: data.count,
    }));

    ranked.sort((a, b) => b.emissionsPerKm - a.emissionsPerKm);
    const dirtiest = ranked.slice(0, 3);

    return { avgEmissions, totalMonthlyTonnes, totalMonthlyKg, chartData, dirtiest, vehicleCount: active.length };
  }, [vehicles]);

  if (!stats) {
    return (
      <WidgetShell icon={Leaf} title="Carbon Footprint" subtitle="Fleet emissions overview">
        <p className="text-sm text-slate-400 text-center py-6">No vehicles on file yet.</p>
      </WidgetShell>
    );
  }

  return (
    <WidgetShell icon={Leaf} title="Carbon Footprint" subtitle={`Estimated monthly fleet emissions · ${stats.vehicleCount} vehicles`}>
      <div className="space-y-4">
        {/* Top stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-3 border border-emerald-100">
            <div className="flex items-center gap-1.5 mb-1">
              <Leaf className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-[10px] uppercase text-emerald-700 font-semibold">Monthly Est.</span>
            </div>
            <p className="text-2xl font-bold text-emerald-900 tabular-nums">{stats.totalMonthlyTonnes.toFixed(1)}<span className="text-sm font-medium ml-1">t CO₂</span></p>
          </div>
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-3 border border-slate-200">
            <div className="flex items-center gap-1.5 mb-1">
              <Fuel className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[10px] uppercase text-slate-600 font-semibold">Fleet Avg.</span>
            </div>
            <p className="text-2xl font-bold text-slate-800 tabular-nums">{Math.round(stats.avgEmissions)}<span className="text-sm font-medium ml-1">g/km</span></p>
          </div>
        </div>

        {/* Chart */}
        {stats.chartData.length > 0 && (
          <div>
            <p className="text-xs font-medium text-slate-500 mb-2">Estimated monthly CO₂ by fuel type (kg)</p>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={stats.chartData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                <XAxis dataKey="fuel" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  formatter={(v) => [`${v} kg CO₂`, 'Monthly']}
                />
                <Bar dataKey="co2" fill="#2E5A1A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Highest emitters */}
        {stats.dirtiest.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingDown className="w-3.5 h-3.5 text-amber-500" />
              <p className="text-xs font-medium text-slate-500">Highest emitters</p>
            </div>
            <div className="space-y-1.5">
              {stats.dirtiest.map((v, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <Truck className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="text-slate-700 font-medium truncate flex-1">{v.reg}</span>
                  <span className="text-amber-600 font-semibold tabular-nums">{v.emissionsPerKm} g/km</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-[10px] text-slate-400 italic">
          Estimates based on assumed {AVG_MONTHLY_MILES.toLocaleString()} mi/month per vehicle. Actual mileage may vary.
        </p>
      </div>
    </WidgetShell>
  );
}