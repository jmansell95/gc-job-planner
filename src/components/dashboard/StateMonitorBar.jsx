import React from 'react';
import { ArrowRight } from 'lucide-react';

/**
 * State Monitor Bar — full-width, intelligence-rich status cards.
 * Each card grows to fill available width (flex-1) and shows a primary
 * metric, a contextual sublabel, and an optional trend hint.
 */
export default function StateMonitorBar({ monitors, onNavigate, className = '' }) {
  const tone = {
    emerald: { bar: 'from-emerald-500 to-emerald-600', text: 'text-emerald-700', soft: 'bg-emerald-50', ring: 'ring-emerald-200' },
    blue:    { bar: 'from-blue-500 to-blue-600',    text: 'text-blue-700',    soft: 'bg-blue-50',    ring: 'ring-blue-200' },
    amber:   { bar: 'from-amber-500 to-amber-600',   text: 'text-amber-700',   soft: 'bg-amber-50',   ring: 'ring-amber-200' },
    rose:    { bar: 'from-rose-500 to-rose-600',     text: 'text-rose-700',    soft: 'bg-rose-50',    ring: 'ring-rose-200' },
    violet:  { bar: 'from-violet-500 to-violet-600', text: 'text-violet-700',  soft: 'bg-violet-50',  ring: 'ring-violet-200' },
    slate:   { bar: 'from-slate-500 to-slate-600',   text: 'text-slate-700',   soft: 'bg-slate-50',   ring: 'ring-slate-200' },
  };

  return (
    <div className={`grid grid-cols-2 lg:flex lg:flex-wrap gap-2.5 sm:gap-3 ${className}`}>
      {monitors.map((m) => {
        const Icon = m.icon;
        const t = tone[m.tone] || tone.emerald;
        return (
          <button
            key={m.key}
            type="button"
            onClick={() => onNavigate(m.nav)}
            className="group relative lg:flex-1 min-w-0 lg:min-w-[220px] text-left insight-card rounded-2xl p-3 sm:p-4 overflow-hidden hover:-translate-y-0.5 transition-all"
          >
            <span className={`absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b ${t.bar}`} />
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${t.soft} ring-1 ${t.ring}`}>
                <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${t.text}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-xl sm:text-2xl font-bold tabular-nums leading-none ${t.text}`}>{m.value}{m.unit || ''}</p>
                <p className="text-xs font-bold text-slate-600 mt-1 sm:mt-1.5 truncate">{m.label}</p>
                {m.sublabel && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{m.sublabel}</p>}
              </div>
              <ArrowRight className="hidden lg:block w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition flex-shrink-0" />
            </div>
          </button>
        );
      })}
    </div>
  );
}