import React, { useState } from 'react';
import { startOfWeek, format } from 'date-fns';
import WeeklyRotaBuilder from '@/components/WeeklyRotaBuilder';
import RotaJobPool from '@/components/rota/RotaJobPool';
import { Zap, X } from 'lucide-react';

/**
 * Unified Rota Builder — merges the full-featured WeeklyRotaBuilder
 * with the visual Quick-Assign Job Pool.
 *
 * The Quick-Assign Pool opens as a centered popup modal so the rota
 * builder gets full width. The manager taps "Quick Assign", picks a
 * job + crew + day in the popup, and the assignment lands on the grid.
 */
export default function UnifiedRotaBuilder() {
  const [showPool, setShowPool] = useState(false);
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  return (
    <div className="flex flex-col">
      {/* Toggle pool button */}
      <button
        onClick={() => setShowPool(true)}
        className="mb-3 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#2E5A1A] text-white hover:bg-[#1c4a12] shadow-sm transition w-fit"
      >
        <Zap className="w-4 h-4" /> Quick Assign
      </button>

      {/* Main rota builder — full width */}
      <WeeklyRotaBuilder />

      {/* Quick Assign popup modal */}
      {showPool && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 pt-8 sm:pt-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowPool(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto animate-pop-in">
            <div className="sticky top-0 bg-white rounded-t-2xl z-10 border-b border-slate-200 px-5 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Quick Assign</h3>
                  <p className="text-[11px] text-slate-400">Tap a job, pick crew, assign</p>
                </div>
              </div>
              <button onClick={() => setShowPool(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="p-4">
              <RotaJobPool weekStart={weekStart} embedded />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}