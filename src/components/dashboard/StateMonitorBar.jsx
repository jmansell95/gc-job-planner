import React from 'react';
import { Briefcase, Users, ClipboardCheck, Truck, ArrowRight } from 'lucide-react';

/**
 * Upgraded "State Monitors" — replaces the old simple pills next to the
 * Customise button. Each monitor is a clickable, real-time status card with
 * an icon, live count, label, and a health tone. Clicking navigates to the
 * relevant section.
 */
export default function StateMonitorBar({ monitors, onNavigate, className = '' }) {
  const tone = {
    emerald: { bar: 'bg-emerald-500', text: 'text-emerald-700', glow: 'shadow-emerald-200/50' },
    blue: { bar: 'bg-blue-500', text: 'text-blue-700', glow: 'shadow-blue-200/50' },
    amber: { bar: 'bg-amber-500', text: 'text-amber-700', glow: 'shadow-amber-200/50' },
    violet: { bar: 'bg-violet-500', text: 'text-violet-700', glow: 'shadow-violet-200/50' },
  };

  return (
    <div className={`grid grid-cols-2 lg:grid-cols-4 gap-2.5 ${className}`}>
      {monitors.map((m) => {
        const Icon = m.icon;
        const t = tone[m.tone] || tone.emerald;
        return (
          <button
            key={m.key}
            type="button"
            onClick={() => onNavigate(m.nav)}
            className="group relative flex items-center gap-3 px-3.5 py-3 rounded-xl bg-white/95 ring-1 ring-white/40 backdrop-blur-sm hover:bg-white hover:shadow-lg hover:-translate-y-0.5 transition-all text-left overflow-hidden"
          >
            <span className={`absolute left-0 top-0 bottom-0 w-1 ${t.bar}`} />
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-slate-50 to-slate-100 ring-1 ring-slate-200/60 ${t.glow}`}>
              <Icon className={`w-4 h-4 ${t.text}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-xl font-bold tabular-nums leading-none ${t.text}`}>{m.value}</p>
              <p className="text-[11px] font-semibold text-slate-500 mt-1 truncate uppercase tracking-wide">{m.label}</p>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition flex-shrink-0" />
          </button>
        );
      })}
    </div>
  );
}