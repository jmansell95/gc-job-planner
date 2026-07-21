import React from 'react';
import { ClipboardCheck, Navigation, DoorOpen, Info, CheckCircle2 } from 'lucide-react';

// A clear, dedicated panel for the end-of-shift trigger.
// The "Finish My Day" button opens the End of Shift wizard which guides
// staff through reviewing tasks, meterage, progress notes, travel home,
// and final submission — one step at a time.
export default function EndOfShiftPanel({ assignment, isDriller, onAdHocVisit, onEarlyLeave, onStartEndOfShift, canPerformActions }) {
  if (!canPerformActions) return null;

  return (
    <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-emerald-100/60 border-b border-emerald-200">
        <ClipboardCheck className="w-4 h-4 text-emerald-700" />
        <p className="text-sm font-bold text-emerald-900 uppercase tracking-wide">End of Shift</p>
      </div>
      <div className="p-4 space-y-3">
        {isDriller && (
          <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-900 leading-relaxed">
              Borehole logs are recorded in <strong>KeyLogBook</strong>. An admin imports the AGS file and the job updates automatically.
            </p>
          </div>
        )}
        <button onClick={() => onStartEndOfShift(assignment.id)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 active:scale-[0.98] transition text-base font-bold touch-manipulation shadow-sm">
          <CheckCircle2 className="w-5 h-5" /> Finish My Day
        </button>
        <div className="flex items-center gap-2">
          {onAdHocVisit && (
            <button onClick={() => onAdHocVisit(assignment.id)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white text-slate-600 rounded-xl hover:bg-slate-50 active:scale-95 transition text-xs font-semibold border border-slate-200 touch-manipulation">
              <Navigation className="w-3.5 h-3.5" /> Quick Visit
            </button>
          )}
          {onEarlyLeave && (
            <button onClick={() => onEarlyLeave(assignment.id)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white text-amber-700 rounded-xl hover:bg-amber-50 active:scale-95 transition text-xs font-semibold border border-amber-200 touch-manipulation">
              <DoorOpen className="w-3.5 h-3.5" /> Leave Early
            </button>
          )}
        </div>
      </div>
    </div>
  );
}