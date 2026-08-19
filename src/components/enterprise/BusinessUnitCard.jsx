import React from 'react';
import { ArrowRight, Layers, Users, ChevronRight } from 'lucide-react';
import { STATUS_STYLES } from './enterpriseConstants';

/**
 * BusinessUnitCard — prominent Level-1 card for a top-level business unit.
 * Shows the BU's aggregated staff total (sum of child divisions) and a preview
 * strip of its child divisions (name + staff count). Clicking navigates to the
 * dedicated BU drill-down page.
 */
export default function BusinessUnitCard({ unit, childStats, onEnter }) {
  const d = unit;
  const st = STATUS_STYLES[d.status || 'setup'] || STATUS_STYLES.setup;
  const divColor = d.color || '#2E5A1A';
  const headerGradient = `linear-gradient(135deg, ${divColor}, ${divColor}dd)`;

  const totalStaff = childStats.reduce((s, c) => s + (c.staffCount || 0), 0);
  const totalActive = childStats.reduce((s, c) => s + (c.activeStaff || 0), 0);
  const childCount = childStats.length;

  return (
    <button
      onClick={() => onEnter(d)}
      className="insight-card relative rounded-3xl overflow-hidden text-left group w-full"
    >
      {/* Gradient header */}
      <div className="h-20 sm:h-24 px-5 sm:px-6 flex items-center justify-between relative overflow-hidden" style={{ background: headerGradient }}>
        <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, rgba(255,255,255,0.35) 0%, transparent 60%)' }} />
        <div className="absolute right-3 top-3 opacity-15">
          <Layers className="w-14 h-14 text-white" />
        </div>
        <div className="relative flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0 shadow-lg ring-1 ring-white/30">
            <Layers className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] sm:text-[10px] text-white/70 font-bold uppercase tracking-widest">Business Unit</p>
            <h3 className="text-base sm:text-xl font-extrabold text-white truncate drop-shadow-sm leading-tight">{d.name}</h3>
            <p className="text-[10px] sm:text-xs text-white/80 font-semibold truncate mt-0.5">{childCount} business streams housed</p>
          </div>
        </div>
        <span className="relative inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] sm:text-[10px] font-bold bg-white/20 backdrop-blur-sm text-white ring-1 ring-white/30 flex-shrink-0">
          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} /> {st.label}
        </span>
      </div>

      {/* Body */}
      <div className="p-4 sm:p-5">
        {d.tagline && <p className="text-xs sm:text-sm text-slate-500 font-medium truncate mb-3 sm:mb-4">{d.tagline}</p>}

        {/* Aggregated staff total — the headline metric per the PRD */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm" style={{ background: `${divColor}15` }}>
            <Users className="w-6 h-6" style={{ color: divColor }} />
          </div>
          <div className="min-w-0">
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums leading-none">{totalStaff}</p>
            <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Total Crew · <span className="text-emerald-600 font-bold">{totalActive} active</span></p>
          </div>
        </div>

        {/* Division preview strip */}
        <div className="space-y-1.5 mb-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Business Streams</p>
          {childStats.slice(0, 4).map((c) => (
            <div key={c.division.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 group-hover:bg-white transition">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.division.color || divColor }} />
                <span className="text-xs font-semibold text-slate-700 truncate">{c.division.name}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-xs font-extrabold text-slate-900 tabular-nums">{c.staffCount}</span>
                <span className="text-[10px] text-slate-400">crew</span>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-medium">View all business streams</span>
          <span className="inline-flex items-center gap-1 text-sm font-bold text-[#2E5A1A] group-hover:gap-2 transition-all">
            Drill Down <ArrowRight className="w-4 h-4" />
          </span>
        </div>
      </div>
    </button>
  );
}