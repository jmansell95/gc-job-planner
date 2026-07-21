import React from 'react';
import { ArrowDownToLine, Ruler, Layers, Gauge, Ban, Radar, Boxes, ChevronRight, CheckCircle2 } from 'lucide-react';

/**
 * Aggregates today's investigation logs by borehole_ref and shows the latest
 * depth reached for each, with a "Continue" button that pre-fills the form.
 * This is the "Current Rig Status" bar from the continuous logging plan —
 * drillers see at-a-glance where they are and resume with one tap.
 * Also offers an "End of Hole" button per borehole with validation gates.
 */
const logTypeIcon = {
  borehole_progress: ArrowDownToLine,
  sample_collection: Layers,
  window_sampling: Layers,
  standpipe_reading: Gauge,
  geophysical_probing: Radar,
  borehole_decommissioning: Ban,
  core_inspection: Boxes,
};

export default function BoreholeProgressSummary({ todayLogs, onContinue, onEndOfHole, hasAGSData }) {
  if (!todayLogs || todayLogs.length === 0) return null;

  // Group by borehole_ref (or standpipe_ref for standpipe readings)
  const boreholes = {};
  todayLogs.forEach((log) => {
    const ref = log.borehole_ref || log.standpipe_ref || '(unreferenced)';
    if (!boreholes[ref]) {
      boreholes[ref] = { ref, logs: [], maxDepth: 0, lastLogType: null, lastTime: null, isComplete: false };
    }
    boreholes[ref].logs.push(log);
    // Track the maximum depth_to as the current progress
    if (log.depth_to != null && log.depth_to > boreholes[ref].maxDepth) {
      boreholes[ref].maxDepth = log.depth_to;
    }
    // Track the most recent log type and time
    const logTime = log.created_at ? new Date(log.created_at).getTime() : 0;
    if (!boreholes[ref].lastTime || logTime > boreholes[ref].lastTime) {
      boreholes[ref].lastTime = logTime;
      boreholes[ref].lastLogType = log.log_type;
    }
    // A borehole is complete if it has a decommissioning log
    if (log.log_type === 'borehole_decommissioning') {
      boreholes[ref].isComplete = true;
    }
  });

  const boreholeList = Object.values(boreholes).sort((a, b) => (b.lastTime || 0) - (a.lastTime || 0));
  if (boreholeList.length === 0) return null;

  return (
    <div className="mb-4 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <ArrowDownToLine className="w-3.5 h-3.5 text-blue-700" />
        <p className="text-xs font-bold text-blue-800 uppercase tracking-wide">Current Borehole Progress</p>
      </div>
      <div className="space-y-1.5">
        {boreholeList.map((bh) => {
          const Icon = bh.isComplete ? CheckCircle2 : (logTypeIcon[bh.lastLogType] || ArrowDownToLine);
          return (
            <div key={bh.ref} className="w-full flex items-center gap-2.5 p-2.5 bg-white rounded-lg border border-blue-100 transition text-left">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${bh.isComplete ? 'bg-emerald-100' : 'bg-blue-100'}`}>
                <Icon className={`w-3.5 h-3.5 ${bh.isComplete ? 'text-emerald-700' : 'text-blue-700'}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-mono font-bold text-slate-900 truncate">{bh.ref}{bh.isComplete && <span className="ml-1.5 text-[10px] text-emerald-600 font-sans">COMPLETE</span>}</p>
                <p className="text-[11px] text-slate-500">{bh.logs.length} {bh.logs.length === 1 ? 'entry' : 'entries'} today</p>
              </div>
              {bh.maxDepth > 0 && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Ruler className="w-3 h-3 text-blue-600" />
                  <span className="text-sm font-bold text-blue-700 tabular-nums">{bh.maxDepth.toFixed(1)}m</span>
                </div>
              )}
              {!bh.isComplete ? (
                <>
                  {!hasAGSData && (
                    <button
                      type="button"
                      onClick={() => onContinue(bh.ref, bh.maxDepth)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition active:scale-95 flex-shrink-0"
                    >
                      Continue <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {onEndOfHole && (
                    <button
                      type="button"
                      onClick={() => onEndOfHole(bh.ref, bh.logs)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition active:scale-95 flex-shrink-0"
                    >
                      <Ban className="w-3.5 h-3.5" /> End Hole
                    </button>
                  )}
                </>
              ) : (
                <span className="text-xs text-emerald-600 font-medium flex-shrink-0">Sealed</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}