import React from 'react';
import { ArrowRight } from 'lucide-react';

/**
 * Unified stat card used across all dashboard widgets and pages.
 * Muted card with a gradient icon tile, bold value, label and optional sub-text.
 * Renders as a <button> when onClick is provided (with hover + active states),
 * otherwise a plain <div>.
 */
export default function StatCard({
  icon: Icon,
  value,
  label,
  sub,
  gradient = 'stat-gradient-emerald',
  onClick,
  active = false,
  arrow = false,
  className = '',
}) {
  const Tag = onClick ? 'button' : 'div';
  const interactive = !!onClick;
  return (
    <Tag
      type={interactive ? 'button' : undefined}
      onClick={onClick}
      className={`rounded-xl border p-3 bg-slate-50 flex items-center gap-3 text-left transition ${active ? 'border-emerald-400 ring-2 ring-emerald-100' : interactive ? 'border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/40 group' : 'border-slate-100'} ${interactive ? 'group' : ''} ${className}`}
    >
      <div className={`w-10 h-10 rounded-lg ${gradient} flex items-center justify-center flex-shrink-0 shadow-sm`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-base font-bold text-slate-900 truncate">{value}</p>
        <p className="text-[11px] text-slate-500 font-medium truncate">{label}</p>
        {sub && <p className="text-[9px] text-slate-400 truncate hidden sm:block">{sub}</p>}
      </div>
      {arrow && <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition flex-shrink-0" />}
    </Tag>
  );
}