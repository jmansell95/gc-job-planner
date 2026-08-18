import React from 'react';
import { daysUntil } from '@/utils/rigRollup';

/**
 * Circular SVG progress ring showing days remaining until compliance expiry.
 * Green >30d, amber 7-30d, red <7d or expired.
 */
export default function ComplianceCountdownRing({ expiryDate, size = 128 }) {
  const days = daysUntil(expiryDate);
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const maxDays = 365;
  const pct = days !== null ? Math.max(0, Math.min(1, days / maxDays)) : 0;
  const offset = circumference * (1 - pct);

  const color = days === null
    ? '#94a3b8'
    : days < 0
      ? '#ef4444'
      : days <= 7
        ? '#ef4444'
        : days <= 30
          ? '#f59e0b'
          : '#10b981';

  return (
    <div className="relative flex flex-col items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth="10" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {days === null ? (
          <>
            <span className="text-2xl font-extrabold text-slate-400">—</span>
            <span className="text-[10px] text-slate-400 font-medium mt-0.5">No expiry date</span>
          </>
        ) : days < 0 ? (
          <>
            <span className="text-2xl font-extrabold" style={{ color }}>{Math.abs(days)}</span>
            <span className="text-[10px] text-slate-500 font-medium mt-0.5">days expired</span>
          </>
        ) : (
          <>
            <span className="text-3xl font-extrabold" style={{ color }}>{days}</span>
            <span className="text-[10px] text-slate-500 font-medium mt-0.5">days left</span>
          </>
        )}
      </div>
    </div>
  );
}