import React from 'react';
import { ArrowDownToLine, Ruler, Layers, Gauge, Ban, Radar, Boxes, ChevronRight } from 'lucide-react';

/**
 * Aggregates today's investigation logs by borehole_ref and shows the latest
 * depth reached for each, with a "Continue" button that pre-fills the form.
 * This is the "Current Rig Status" bar from the continuous logging plan —
 * drillers see at-a-glance where they are and resume with one tap.
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

export default function BoreholeProgressSummary({ todayLogs, onContinue }) {
  if (!todayLogs || todayLogs.length === 0) return null;

  // Group by borehole_ref (or standpipe_ref for standpipe readings)
  const boreholes = {};
  todayLogs.forEach((log) => {
    const ref = log.borehole_ref || log.standpipe_ref || '(unreferenced)';
    if (!boreholes[ref]) {
      boreholes[ref] = { ref, logs: [], maxDepth: 0, lastLogType: null, lastTime: null };
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
          const Icon = logTypeIcon[bh.lastLogType] || ArrowDownToLine;
          return (
            <button
              key={bh.ref}
              type="button"
              onClick={() => onContinue(bh.ref, bh.maxDepth)}
              className="w-full flex items-center gap-2.5 p-2.5 bg-white rounded-lg border border-blue-100 hover:border-blue-300 hover:bg-blue-50/50 transition text-left active:scale-[0.99]"
            >
              <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Icon className="w-3.5 h-3.5 text-blue-700" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-mono font-bold text-slate-900 truncate">{bh.ref}</p>
                <p className="text-[11px] text-slate-500">{bh.logs.length} {bh.logs.length === 1 ? 'entry' : 'entries'} today</p>
              </div>
              {bh.maxDepth > 0 && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Ruler className="w-3 h-3 text-blue-600" />
                  <span className="text-sm font-bold text-blue-700 tabular-nums">{bh.maxDepth.toFixed(1)}m</span>
                </div>
              )}
              <ChevronRight className="w-4 h-4 text-blue-400 flex-shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}