import React from 'react';
import { ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * State Monitor Bar — Command Centre edition.
 * Full-width, high-contrast gradient stat tiles with live pulse indicators,
 * trend hints, and contextual sublabels. Each tile is a clickable navigation
 * card that grows to fill available width (flex-1) on desktop and stacks
 * 2-per-row on mobile.
 */
export default function StateMonitorBar({ monitors, onNavigate, className = '' }) {
  const tone = {
    emerald: { gradient: 'stat-gradient-emerald', glow: 'shadow-emerald-500/30', ring: 'ring-emerald-300/40' },
    blue:    { gradient: 'stat-gradient-blue',    glow: 'shadow-blue-500/30',    ring: 'ring-blue-300/40' },
    amber:   { gradient: 'stat-gradient-amber',   glow: 'shadow-amber-500/30',   ring: 'ring-amber-300/40' },
    rose:    { gradient: 'stat-gradient-rose',    glow: 'shadow-rose-500/30',    ring: 'ring-rose-300/40' },
    violet:  { gradient: 'stat-gradient-violet',  glow: 'shadow-violet-500/30',  ring: 'ring-violet-300/40' },
    teal:    { gradient: 'stat-gradient-teal',    glow: 'shadow-teal-500/30',    ring: 'ring-teal-300/40' },
    orange:  { gradient: 'stat-gradient-orange',  glow: 'shadow-orange-500/30',  ring: 'ring-orange-300/40' },
    brand:   { gradient: 'stat-gradient-brand',   glow: 'shadow-emerald-700/30', ring: 'ring-emerald-300/40' },
    slate:   { gradient: 'stat-gradient-slate',   glow: 'shadow-slate-500/30',   ring: 'ring-slate-300/40' },
  };

  return (
    <div className={`grid grid-cols-2 lg:flex lg:flex-wrap gap-2.5 sm:gap-3 ${className}`}>
      {monitors.map((m) => {
        const Icon = m.icon;
        const t = tone[m.tone] || tone.emerald;
        const TrendIcon = m.trend === 'up' ? TrendingUp : m.trend === 'down' ? TrendingDown : null;
        return (
          <button
            key={m.key}
            type="button"
            onClick={() => onNavigate(m.nav)}
            className={`group relative lg:flex-1 min-w-0 lg:min-w-[220px] text-left rounded-2xl p-3 sm:p-4 overflow-hidden transition-all hover:-translate-y-1 ${t.gradient} ${t.glow} shadow-lg ring-1 ${t.ring} hover:shadow-xl`}
          >
            {/* Decorative pulse ring for live feel */}
            {m.live && (
              <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-white/90 pulse-ring" />
            )}
            {/* Subtle top sheen */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-transparent pointer-events-none" />
            <div className="relative z-10 flex items-center gap-2.5 sm:gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-white/20 ring-1 ring-white/30 backdrop-blur-sm">
                <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5">
                  <p className="text-xl sm:text-2xl font-bold tabular-nums leading-none text-white">{m.value}{m.unit || ''}</p>
                  {TrendIcon && <TrendIcon className="w-3.5 h-3.5 text-white/80 flex-shrink-0" />}
                </div>
                <p className="text-xs font-bold text-white/95 mt-1 sm:mt-1.5 truncate">{m.label}</p>
                {m.sublabel && <p className="text-[11px] text-white/70 mt-0.5 truncate">{m.sublabel}</p>}
              </div>
              <ArrowRight className="hidden lg:block w-4 h-4 text-white/50 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition flex-shrink-0" />
            </div>
          </button>
        );
      })}
    </div>
  );
}