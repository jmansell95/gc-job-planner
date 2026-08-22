import React from 'react';
import { Building2, ArrowRight } from 'lucide-react';
import { STATUS_STYLES } from './enterpriseConstants';
import { DIVISION_TYPE_LABELS } from '@/components/wizard/divisionWizardData';

export default function DivisionCard({ ds, onEnter }) {
  const d = ds.division;
  const st = STATUS_STYLES[d.status || 'setup'] || STATUS_STYLES.setup;
  const divColor = d.color || '#2E5A1A';
  const headerGradient = `linear-gradient(135deg, ${divColor}, ${divColor}cc)`;

  return (
    <button
      onClick={() => onEnter(d)}
      className="insight-card relative rounded-2xl overflow-hidden text-left group w-full"
    >
      {/* Gradient header */}
      <div className="h-16 sm:h-20 px-4 sm:px-5 flex items-center justify-between relative overflow-hidden" style={{ background: headerGradient }}>
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, rgba(255,255,255,0.3) 0%, transparent 60%)' }} />
        <div className="relative flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0 shadow-lg ring-1 ring-white/30">
            <Building2 className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-extrabold text-white truncate drop-shadow-sm">{d.name}</h3>
            <p className="text-[10px] sm:text-[11px] text-white/80 font-semibold uppercase tracking-wide truncate">{DIVISION_TYPE_LABELS[d.division_type] || d.division_type} · {d.code}</p>
          </div>
        </div>
        <span className="relative inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-white/20 backdrop-blur-sm text-white ring-1 ring-white/30 flex-shrink-0">
          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} /> {st.label}
        </span>
      </div>

      {/* Body */}
      <div className="p-3.5 sm:p-5">
        {d.tagline && <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate mb-2.5 sm:mb-3">{d.tagline}</p>}
        <div className="grid grid-cols-4 gap-1.5 mb-3 sm:mb-4">
          <StatBlock value={ds.activeStaff} label="Crew" />
          <StatBlock value={ds.activeJobs} label="Active" />
          <StatBlock value={ds.vehiclesCount} label="Fleet" />
          <StatBlock value={ds.jobsCount} label="Jobs" />
        </div>
        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-end">
          <span className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-[#2E5A1A] group-hover:gap-2 transition-all">
            Enter <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </span>
        </div>
      </div>
    </button>
  );
}

function StatBlock({ value, label }) {
  return (
    <div className="bg-slate-50 rounded-lg sm:rounded-xl p-1.5 sm:p-2 text-center">
      <p className="text-base sm:text-lg font-extrabold text-slate-900 tabular-nums">{value}</p>
      <p className="text-[8px] sm:text-[9px] text-slate-400 uppercase font-bold">{label}</p>
    </div>
  );
}