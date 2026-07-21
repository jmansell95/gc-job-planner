import React, { useState } from 'react';
import { CheckCircle2, Ruler, Navigation, DoorOpen, ClipboardCheck, FileText, Info } from 'lucide-react';

// A clear, dedicated panel for end-of-shift logging.
// Separates the daily sign-off (meterage + progress + complete) from
// secondary actions so staff on site can finish their day in one clean flow.
export default function EndOfShiftPanel({
  assignment,
  isDriller,
  meterage,
  onMeterageChange,
  onAdHocVisit,
  onEarlyLeave,
  onComplete,
  canPerformActions,
}) {
  const [progressNote, setProgressNote] = useState(assignment.progress_notes || '');

  if (!canPerformActions) return null;

  return (
    <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-emerald-100/60 border-b border-emerald-200">
        <ClipboardCheck className="w-4 h-4 text-emerald-700" />
        <p className="text-sm font-bold text-emerald-900 uppercase tracking-wide">End of Shift</p>
      </div>

      <div className="p-4 space-y-4">
        {/* AGS guidance for drillers */}
        {isDriller && (
          <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-900 leading-relaxed">
              Borehole logs are recorded in <strong>KeyLogBook</strong>. An admin imports the AGS file
              and the job updates automatically — no need to log strata or samples here.
            </p>
          </div>
        )}

        {/* Meterage — large, clear, labeled */}
        {isDriller && (
          <div>
            <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 mb-1.5">
              <Ruler className="w-4 h-4 text-amber-600" /> Metres drilled today
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="0.1"
                placeholder="0.0"
                value={meterage || ''}
                onChange={(e) => onMeterageChange(assignment.id, e.target.value)}
                className="w-full px-4 py-3 pr-12 border-2 border-slate-200 rounded-xl text-lg font-semibold text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 bg-white"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">m</span>
            </div>
          </div>
        )}

        {/* Progress notes */}
        <div>
          <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 mb-1.5">
            <FileText className="w-4 h-4 text-slate-500" /> Progress notes
          </label>
          <textarea
            value={progressNote}
            onChange={(e) => setProgressNote(e.target.value)}
            rows={2}
            placeholder="What was done today? What's left for the next shift?"
            className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 resize-none bg-white"
          />
        </div>

        {/* Primary action — big, obvious */}
        <button
          onClick={() => onComplete(assignment.id, { progress_notes: progressNote.trim() })}
          className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 active:scale-[0.98] transition text-base font-bold touch-manipulation shadow-sm"
        >
          <CheckCircle2 className="w-5 h-5" /> Complete Shift
        </button>

        {/* Secondary actions — smaller, subdued */}
        <div className="flex items-center gap-2">
          {onAdHocVisit && (
            <button
              onClick={() => onAdHocVisit(assignment.id)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white text-slate-600 rounded-xl hover:bg-slate-50 active:scale-95 transition text-xs font-semibold border border-slate-200 touch-manipulation"
            >
              <Navigation className="w-3.5 h-3.5" /> Quick Visit
            </button>
          )}
          {onEarlyLeave && (
            <button
              onClick={() => onEarlyLeave(assignment.id)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white text-amber-700 rounded-xl hover:bg-amber-50 active:scale-95 transition text-xs font-semibold border border-amber-200 touch-manipulation"
            >
              <DoorOpen className="w-3.5 h-3.5" /> Leave Early
            </button>
          )}
        </div>
      </div>
    </div>
  );
}