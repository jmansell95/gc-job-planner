import React from 'react';
import { PieChart, Pie, Cell } from 'recharts';

const COLORS = { compliant: '#10b981', expiring: '#f59e0b', expired: '#ef4444', unknown: '#94a3b8' };
const LABELS = { compliant: 'Compliant', expiring: 'Expiring', expired: 'Expired', unknown: 'Unknown' };

/**
 * Colourful donut showing the fleet's compliance status breakdown.
 * Sits on the dark hero gradient of the Fleet Hub alongside the health gauge.
 */
export default function FleetComplianceDonut({ counts, size = 116, onSegmentClick }) {
  const data = Object.keys(counts)
    .map(k => ({ name: LABELS[k], value: counts[k], key: k }))
    .filter(d => d.value > 0);
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  return (
    <div className="flex items-center gap-4">
      <div style={{ width: size, height: size }} className="relative">
        <PieChart width={size} height={size}>
          <Pie data={data} dataKey="value" innerRadius={size * 0.32} outerRadius={size * 0.5} paddingAngle={2} stroke="none" cx="50%" cy="50%">
            {data.map(d => (
              <Cell key={d.key} fill={COLORS[d.key]}
                onClick={() => onSegmentClick?.(d.key)}
                style={{ cursor: onSegmentClick ? 'pointer' : 'default' }} />
            ))}
          </Pie>
        </PieChart>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold text-slate-900 tabular-nums leading-none">{total}</span>
          <span className="text-[9px] text-slate-500 font-semibold uppercase tracking-wide mt-0.5">Assets</span>
        </div>
      </div>
      <div className="space-y-1.5 hidden sm:block">
        {data.map(d => (
          <button key={d.key} type="button" onClick={() => onSegmentClick?.(d.key)} disabled={!onSegmentClick}
            className={`flex items-center gap-1.5 text-[11px] text-slate-700 font-medium whitespace-nowrap ${onSegmentClick ? 'hover:scale-105 transition cursor-pointer' : 'cursor-default'}`}>
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[d.key] }} />
            {d.name} <span className="text-slate-400 tabular-nums">{d.value}</span>
          </button>
        ))}
      </div>
    </div>
  );
}