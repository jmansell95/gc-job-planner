import React from 'react';
import { ArrowRight, Layers } from 'lucide-react';
import { STATUS_STYLES } from './enterpriseConstants';

/**
 * BusinessUnitCard — large, prominent card for a top-level business unit on
 * the Enterprise Dashboard's first level. Shows the unit's accent colour as a
 * gradient header, the unit name, tagline, and a count of divisions inside.
 * Clicking it navigates to the second level showing that unit's divisions.
 */
export default function BusinessUnitCard({ unit, childCount, onEnter }) {
  const d = unit;
  const st = STATUS_STYLES[d.status || 'setup'] || STATUS_STYLES.setup;
  const divColor = d.color || '#2E5A1A';
  const headerGradient = `linear-gradient(135deg, ${divColor}, ${divColor}cc)`;

  return (
    <button
      onClick={() => onEnter(d)}
      className="insight-card relative rounded-3xl overflow-hidden text-left group w-full"
    >
      {/* Gradient header — taller than division cards for prominence */}
      <div className="h-24 sm:h-28 px-5 sm:px-6 flex items-center justify-between relative overflow-hidden" style={{ background: headerGradient }}>
        <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, rgba(255,255,255,0.35) 0%, transparent 60%)' }} />
        {/* Decorative layers icon watermark */}
        <div className="absolute right-3 top-3 opacity-15">
          <Layers className="w-16 h-16 text-white" />
        </div>
        <div className="relative flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0 shadow-lg ring-1 ring-white/30">
            <Layers className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base sm:text-xl font-extrabold text-white truncate drop-shadow-sm">{d.name}</h3>
            <p className="text-[10px] sm:text-xs text-white/80 font-semibold uppercase tracking-wide truncate mt-0.5">Business Unit · {d.code}</p>
          </div>
        </div>
        <span className="relative inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] sm:text-[10px] font-bold bg-white/20 backdrop-blur-sm text-white ring-1 ring-white/30 flex-shrink-0">
          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} /> {st.label}
        </span>
      </div>

      {/* Body */}
      <div className="p-4 sm:p-5">
        {d.tagline && <p className="text-xs sm:text-sm text-slate-500 font-medium truncate mb-3 sm:mb-4">{d.tagline}</p>}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-lg sm:text-xl font-extrabold text-slate-900 tabular-nums">{childCount}</span>
              <span className="text-xs text-slate-400 font-semibold ml-1">{childCount === 1 ? 'Division' : 'Divisions'}</span>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[#2E5A1A] group-hover:gap-2.5 transition-all">
            View Divisions <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </span>
        </div>
      </div>
    </button>
  );
}