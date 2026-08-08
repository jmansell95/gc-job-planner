import React from 'react';
import { Truck, ShieldCheck, ShieldAlert, ShieldX, Satellite, Wrench } from 'lucide-react';

/**
 * FleetQuickStats — modern gradient stat tiles showing fleet-wide health at a glance.
 * Colourful, compact, and instantly scannable. Replaces the old stat ribbon with
 * a premium "command centre" feel.
 */
function StatTile({ icon: Icon, label, value, sublabel, gradient, delay = 0 }) {
  return (
    <div
      className={`${gradient} rounded-2xl p-4 text-white relative overflow-hidden shadow-md transition-transform hover:scale-[1.02] hover:shadow-lg`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Decorative glow */}
      <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-white/10 blur-xl" />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Icon className="w-4 h-4 text-white" />
          </div>
          <span className="text-2xl font-extrabold tabular-nums leading-none">{value}</span>
        </div>
        <p className="text-xs font-bold text-white/90 leading-tight">{label}</p>
        {sublabel && <p className="text-[10px] text-white/60 mt-0.5">{sublabel}</p>}
      </div>
    </div>
  );
}

export default function FleetQuickStats({ stats }) {
  const { total, compliant, warning, expired, geotabSynced, activeBookings } = stats;
  const compliancePct = total > 0 ? Math.round((compliant / total) * 100) : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <StatTile icon={Truck} label="Total Fleet" value={total} sublabel="vehicles" gradient="stat-gradient-brand" delay={0} />
      <StatTile icon={ShieldCheck} label="Compliant" value={compliant} sublabel={`${compliancePct}% healthy`} gradient="stat-gradient-emerald" delay={50} />
      <StatTile icon={ShieldAlert} label="Attention" value={warning} sublabel="due soon" gradient="stat-gradient-amber" delay={100} />
      <StatTile icon={ShieldX} label="Critical" value={expired} sublabel="overdue" gradient="stat-gradient-rose" delay={150} />
      <StatTile icon={Satellite} label="Live Tracking" value={geotabSynced} sublabel="Geotab synced" gradient="stat-gradient-cyan" delay={200} />
      <StatTile icon={Wrench} label="Active Bookings" value={activeBookings} sublabel="maintenance" gradient="stat-gradient-violet" delay={250} />
    </div>
  );
}