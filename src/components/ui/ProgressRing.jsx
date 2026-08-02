import React from 'react';

/**
 * ProgressRing — circular progress indicator (Phase 2 UI primitive).
 *
 * Renders an SVG ring with a coloured progress arc. Useful for showing
 * usage hours, completion percentages, and capacity metrics.
 */
export default function ProgressRing({
  value = 0,
  max = 100,
  size = 64,
  strokeWidth = 6,
  color = '#2E5A1A',
  trackColor = '#e2e8f0',
  label,
  sublabel,
  children,
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const offset = circumference - pct * circumference;

  // Auto-colour based on percentage
  let strokeColor = color;
  if (pct >= 1) strokeColor = '#e11d48'; // rose-600
  else if (pct >= 0.8) strokeColor = '#d97706'; // amber-600

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children || (
          <>
            <span className="text-sm font-bold text-slate-800 tabular-nums leading-none">{label}</span>
            {sublabel && <span className="text-[9px] text-slate-400 uppercase mt-0.5">{sublabel}</span>}
          </>
        )}
      </div>
    </div>
  );
}