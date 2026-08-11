import React from 'react';

/**
 * Circular SVG gauge showing the fleet's overall compliance health %.
 * Designed to sit on the dark hero gradient of the Fleet Hub.
 */
export default function FleetHealthGauge({ percent, size = 116 }) {
  const stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = c - (clamped / 100) * c;
  const color = clamped >= 85 ? '#10b981' : clamped >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(15,23,42,0.08)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span style={{ fontSize: size * 0.26 }} className="font-bold text-slate-900 tabular-nums leading-none">
          {Math.round(clamped)}<span style={{ fontSize: size * 0.15 }}>%</span>
        </span>
        <span style={{ fontSize: Math.max(7, size * 0.1) }} className="text-slate-500 font-semibold uppercase tracking-wide mt-0.5">Fleet Health</span>
      </div>
    </div>
  );
}