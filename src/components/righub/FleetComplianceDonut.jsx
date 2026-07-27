import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const COLORS = { compliant: '#10b981', expiring: '#f59e0b', expired: '#ef4444', unknown: '#94a3b8' };
const LABELS = { compliant: 'Compliant', expiring: 'Expiring', expired: 'Expired', unknown: 'Unknown' };

/**
 * Colourful donut showing the fleet's compliance status breakdown.
 * Sits on the dark hero gradient of the Fleet Hub alongside the health gauge.
 */
export default function FleetComplianceDonut({ counts, size = 116 }) {
  const data = Object.keys(counts)
    .map(k => ({ name: LABELS[k], value: counts[k], key: k }))
    .filter(d => d.value > 0);
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  return (
    <div className="flex items-center gap-4">
      <div style={{ width: size, height: size }} className="relative">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={size * 0.32} outerRadius={size * 0.5} paddingAngle={2} stroke="none">
              {data.map(d => <Cell key={d.key} fill={COLORS[d.key]} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold text-white tabular-nums leading-none">{total}</span>
          <span className="text-[9px] text-white/70 font-semibold uppercase tracking-wide mt-0.5">Assets</span>
        </div>
      </div>
      <div className="space-y-1.5 hidden sm:block">
        {data.map(d => (
          <div key={d.key} className="flex items-center gap-1.5 text-[11px] text-white/90 font-medium whitespace-nowrap">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[d.key] }} />
            {d.name} <span className="text-white/60 tabular-nums">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}