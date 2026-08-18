import React from 'react';

/**
 * Horizontal progress bar showing engine hours since last service vs the
 * service interval. Green <80%, amber 80-100%, red >100% (overdue).
 */
export default function MaintenanceGauge({ hoursSince = 0, intervalHours = 0 }) {
  const pct = intervalHours > 0 ? Math.min(100, (hoursSince / intervalHours) * 100) : 0;
  const color = pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#10b981';
  const label = pct >= 100 ? 'Overdue' : pct >= 80 ? 'Due Soon' : 'On Track';

  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="text-slate-500 font-medium">Since last service</span>
        <span className="font-bold tabular-nums" style={{ color }}>
          {Math.round(hoursSince)}h / {intervalHours}h
        </span>
      </div>
      <div className="h-3.5 bg-slate-100 rounded-full overflow-hidden relative">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${Math.max(2, pct)}%`, background: color }}
        />
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[10px] text-slate-400 font-medium">0h</span>
        <span className="text-[10px] font-bold" style={{ color }}>{label}</span>
        <span className="text-[10px] text-slate-400 font-medium">{intervalHours}h</span>
      </div>
    </div>
  );
}