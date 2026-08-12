import React from 'react';

/**
 * Circular SVG gauge showing the fleet's overall compliance health %.
 * Larger ring with text that scales to fit comfortably inside.
 */
export default function FleetHealthGauge({ percent, size = 116 }) {
  const stroke = Math.max(10, size * 0.09);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = c - (clamped / 100) * c;
  const color = clamped >= 85 ? '#10b981' : clamped >= 60 ? '#f59e0b' : '#ef4444';

  // Font sizes that fit inside the ring's inner diameter
  const innerDiameter = 2 * r - stroke;
  const numberFontSize = Math.max(14, innerDiameter * 0.32);
  const percentFontSize = numberFontSize * 0.5;
  const labelFontSize = Math.max(8, innerDiameter * 0.13);

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(15,23,42,0.08)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
        <div className="flex items-baseline leading-none">
          <span style={{ fontSize: numberFontSize }} className="font-bold text-slate-900 tabular-nums">
            {Math.round(clamped)}
          </span>
          <span style={{ fontSize: percentFontSize }} className="font-bold text-slate-500">%</span>
        </div>
        <span style={{ fontSize: labelFontSize }} className="text-slate-500 font-semibold uppercase tracking-wide mt-1">
          Fleet Health
        </span>
      </div>
    </div>
  );
}