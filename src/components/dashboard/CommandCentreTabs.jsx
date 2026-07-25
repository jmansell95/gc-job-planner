import React from 'react';
import { VIEW_PROFILES } from '@/components/dashboard/registry';

/**
 * Full-width "Command Centre" tab bar.
 * Replaces the old narrow view-profile toggle with a responsive, equal-width
 * segmented control that spans the full content area — built on CSS flexbox so
 * the tabs distribute evenly on any screen width.
 */
export default function CommandCentreTabs({ activeId, onChange, className = '' }) {
  return (
    <div className={`mb-4 ${className}`}>
      <div className="flex gap-1.5 bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-800 shadow-lg p-1.5">
        {VIEW_PROFILES.map((p, idx) => {
          const Icon = p.icon;
          const active = activeId === p.id;
          const divider = idx > 0 && (
            <div className="hidden sm:flex items-center px-0.5">
              <div className="w-px h-8 bg-slate-700/60" />
            </div>
          );
          return (
            <React.Fragment key={p.id}>
              {divider}
              <button
                type="button"
                onClick={() => onChange(p.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 sm:px-5 py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.98] ${
                  active
                    ? 'bg-gradient-to-r from-[#2E5A1A] to-[#5A8C1E] text-white shadow-md ring-1 ring-[#8DC63F]/40'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-[#8DC63F]' : 'text-slate-500'}`} />
                <span className="truncate">{p.label}</span>
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}