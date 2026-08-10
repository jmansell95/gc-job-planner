import React, { useState } from 'react';
import { startOfWeek, format } from 'date-fns';
import WeeklyRotaBuilder from '@/components/WeeklyRotaBuilder';
import RotaJobPool from '@/components/rota/RotaJobPool';
import { Briefcase, PanelLeftClose, PanelLeft, Zap } from 'lucide-react';

/**
 * Unified Rota Builder — merges the full-featured WeeklyRotaBuilder
 * with the visual Quick-Assign Job Pool.
 *
 * On desktop (xl+): the pool sits in a collapsible left sidebar.
 * On mobile: the pool is a full-width panel toggled by a prominent
 * floating button, so it doesn't eat vertical space until you need it.
 */
export default function UnifiedRotaBuilder() {
  const [showPool, setShowPool] = useState(false);
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  return (
    <div className="flex flex-col xl:flex-row gap-3">
      {/* Quick-Assign Pool — sidebar on desktop, collapsible panel on mobile */}
      {showPool && (
        <div className="xl:w-72 flex-shrink-0">
          <RotaJobPool weekStart={weekStart} />
        </div>
      )}

      {/* Main rota builder */}
      <div className="flex-1 min-w-0">
        {/* Toggle pool button — prominent on mobile, subtle on desktop */}
        <button
          onClick={() => setShowPool(!showPool)}
          className={`mb-3 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm ${
            showPool
              ? 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              : 'bg-[#2E5A1A] text-white hover:bg-[#1c4a12]'
          }`}
        >
          {showPool ? <PanelLeftClose className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
          {showPool ? 'Hide' : 'Quick Assign'}
          <span className="hidden sm:inline text-xs opacity-70">{showPool ? 'Pool' : 'Pool'}</span>
        </button>
        <WeeklyRotaBuilder />
      </div>
    </div>
  );
}