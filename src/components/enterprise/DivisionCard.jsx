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
      <div className="h-20 px-5 flex items-center justify-between relative overflow-hidden" style={{ background: headerGradient }}>
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, rgba(255,255,255,0.3) 0%, transparent 60%)' }} />
        <div className="relative flex items-center gap-3 min-w-0">
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0 shadow-lg ring-1 ring-white/30">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-extrabold text-white truncate drop-shadow-sm">{d.name}</h3>
            <p className="text-[11px] text-white/80 font-semibold uppercase tracking-wide">{DIVISION_TYPE_LABELS[d.division_type] || d.division_type} · {d.code}</p>
          </div>
        </div>
        <span className="relative inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 backdrop-blur-sm text-white ring-1 ring-white/30 flex-shrink-0">
          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} /> {st.label}
        </span>
      </div>

      {/* Body */}
      <div className="p-5">
        {d.tagline && <p className="text-xs text-slate-500 font-medium truncate mb-3">{d.tagline}</p>}
        <div className="grid grid-cols-4 gap-1.5 mb-4">
          <StatBlock value={ds.activeStaff} label="Crew" />
          <StatBlock value={ds.activeJobs} label="Active" />
          <StatBlock value={ds.vehiclesCount} label="Fleet" />
          <StatBlock value={ds.jobsCount} label="Jobs" />
        </div>
        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-end">
          <span className="inline-flex items-center gap-1 text-sm font-bold text-[#2E5A1A] group-hover:gap-2 transition-all">
            Enter <ArrowRight className="w-4 h-4" />
          </span>
        </div>
      </div>
    </button>
  );
}

function StatBlock({ value, label }) {
  return (
    <div className="bg-slate-50 rounded-xl p-2 text-center">
      <p className="text-lg font-extrabold text-slate-900 tabular-nums">{value}</p>
      <p className="text-[9px] text-slate-400 uppercase font-bold">{label}</p>
    </div>
  );
}