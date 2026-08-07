import React, { useState } from 'react';
import { startOfWeek, format } from 'date-fns';
import WeeklyRotaBuilder from '@/components/WeeklyRotaBuilder';
import RotaJobPool from '@/components/rota/RotaJobPool';
import { Briefcase, PanelLeftClose, PanelLeft } from 'lucide-react';

/**
 * Unified Rota Builder — merges the full-featured WeeklyRotaBuilder
 * with the visual Quick-Assign Job Pool from the old DragDropRotaTimeline.
 *
 * The job pool sits in a collapsible left sidebar. Click any active job
 * to open an inline assign form (pick staff + day) that creates a
 * RotaAssignment instantly — no modal round-trip needed.
 *
 * The WeeklyRotaBuilder retains all its existing power: week navigation,
 * publish/draft, team filters, compliance checks, swap, smart fill, and
 * rota warnings.
 */
export default function UnifiedRotaBuilder() {
  const [showPool, setShowPool] = useState(true);
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  return (
    <div className="flex flex-col xl:flex-row gap-3">
      {/* Collapsible Quick-Assign Pool sidebar */}
      {showPool && (
        <div className="xl:w-60 flex-shrink-0">
          <RotaJobPool weekStart={weekStart} />
        </div>
      )}

      {/* Main rota builder */}
      <div className="flex-1 min-w-0">
        {/* Toggle pool button */}
        <button
          onClick={() => setShowPool(!showPool)}
          className="mb-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition shadow-sm"
        >
          {showPool ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeft className="w-3.5 h-3.5" />}
          {showPool ? 'Hide' : 'Show'} Job Pool
        </button>
        <WeeklyRotaBuilder />
      </div>
    </div>
  );
}