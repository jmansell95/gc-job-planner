import React from 'react';
import { daysUntil } from '@/utils/rigRollup';

/**
 * Compact circular compliance countdown ring for inventory cards.
 * Smaller than the detail-page ComplianceCountdownRing — shows the days
 * number with a tiny "d left" label, colour-coded by urgency.
 */
export default function CardComplianceRing({ expiryDate, size = 56 }) {
  const days = daysUntil(expiryDate);
  const stroke = 6;
  const radius = (size - stroke - 4) / 2;
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
    <div className="relative flex flex-col items-center justify-center rounded-full bg-white shadow-lg ring-2 ring-white" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="white" stroke="#e2e8f0" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="relative flex flex-col items-center justify-center leading-none">
        {days === null ? (
          <span className="text-base font-extrabold text-slate-400">—</span>
        ) : days < 0 ? (
          <>
            <span className="text-base font-extrabold" style={{ color }}>{Math.abs(days)}</span>
            <span className="text-[7px] font-bold text-rose-500 mt-0.5">expired</span>
          </>
        ) : (
          <>
            <span className="text-base font-extrabold" style={{ color }}>{days}</span>
            <span className="text-[7px] font-medium text-slate-500 mt-0.5">d left</span>
          </>
        )}
      </div>
    </div>
  );
}