import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  ArrowDownToLine, TestTube, Layers, Ruler, Droplets, Calculator, Gauge, Ban,
  Boxes, Radar, Tablet, Info, Waves, FileX, Beaker
} from 'lucide-react';
import { Skeleton, EmptyState } from '@/components/StateViews';
import { strataConfig, fluidLossConfig, obstructionConfig } from './shared';

// Read-only viewer for borehole log data imported from KeyLogBook (AGS).
// Drillers no longer input borehole data manually — it all comes from
// KeyLogBook and is imported by an admin via the AGS Import tool.
export default function DrillerLogViewer({ jobId, job, staffName }) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['investigation-logs', jobId],
    queryFn: () => base44.entities.InvestigationLog.filter({ job_id: jobId }),
  });

  const agsLogs = logs.filter(l => l.source === 'ags_import');
  const byDate = {};
  agsLogs.forEach(l => {
    if (!byDate[l.date]) byDate[l.date] = [];
    byDate[l.date].push(l);
  });
  const sortedDates = Object.keys(byDate).sort().reverse();

  const totalDepth = agsLogs.reduce((sum, l) => {
    if (l.depth_from != null && l.depth_to != null) return sum + (l.depth_to - l.depth_from);
    return sum;
  }, 0);
  const uniqueBoreholes = [...new Set(agsLogs.filter(l => l.borehole_ref).map(l => l.borehole_ref))];
  const totalSamples = agsLogs.filter(l => l.sample_type && l.sample_type !== 'none').length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
          <Tablet className="w-4 h-4 text-indigo-700" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-slate-900">Borehole Log</h3>
          <p className="text-xs text-slate-400">Imported from KeyLogBook · Read-only</p>
        </div>
        {agsLogs.length > 0 && (
          <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">{agsLogs.length} entries</span>
        )}
      </div>

      {/* Guidance banner */}
      <div className="p-3 rounded-lg border bg-blue-50 border-blue-200 flex items-start gap-2.5 mb-4">
        <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-800">Borehole data is managed in KeyLogBook</p>
          <p className="text-[11px] text-slate-600 mt-0.5">
            All strata, SPT, samples and borehole progress come from the AGS import. To add or correct
            this data, update your tablet in KeyLogBook and ask an admin to re-import the file.
          </p>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-32 w-full rounded-xl" />
      ) : agsLogs.length === 0 ? (
        <EmptyState
          icon={FileX}
          title="No borehole data imported yet"
          message="Borehole logs will appear here once an admin uploads the AGS file from KeyLogBook."
        />
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="text-center p-2 bg-slate-50 rounded-xl">
              <p className="text-xs text-slate-400 uppercase font-medium">Depth</p>
              <p className="text-base font-bold text-blue-700">{totalDepth.toFixed(1)}m</p>
            </div>
            <div className="text-center p-2 bg-slate-50 rounded-xl">
              <p className="text-xs text-slate-400 uppercase font-medium">Boreholes</p>
              <p className="text-base font-bold text-slate-800">{uniqueBoreholes.length}</p>
            </div>
            <div className="text-center p-2 bg-slate-50 rounded-xl">
              <p className="text-xs text-slate-400 uppercase font-medium">Samples</p>
              <p className="text-base font-bold text-purple-700">{totalSamples}</p>
            </div>
          </div>

          {/* Logs by date */}
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {sortedDates.map(date => {
              const dayLogs = byDate[date].sort((a, b) => (a.depth_from || 0) - (b.depth_from || 0));
              const d = new Date(date + 'T00:00:00');
              return (
                <div key={date}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{format(d, 'EEEE, dd MMM yyyy')}</span>
                    <span className="text-xs text-slate-400">{dayLogs.length} entries</span>
                  </div>
                  <div className="space-y-2">
                    {dayLogs.map(log => (
                      <AGSLogRow key={log.id} log={log} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function AGSLogRow({ log }) {
  const strata = log.strata_descriptor && strataConfig[log.strata_descriptor];
  const photos = (log.photo_urls || '').split(',').filter(Boolean);

  return (
    <div className="flex items-start gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[9px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5 flex-shrink-0">
            <Tablet className="w-2.5 h-2.5" /> AGS
          </span>
          <span className="text-xs font-mono font-bold text-blue-700">{log.borehole_ref || '—'}</span>
          {log.depth_from != null && log.depth_to != null && (
            <span className="text-xs text-slate-600 inline-flex items-center gap-0.5">
              <Ruler className="w-2.5 h-2.5" /> {log.depth_from}→{log.depth_to}m
            </span>
          )}
          {log.spt_n_value != null && (
            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
              <Calculator className="w-2.5 h-2.5" /> N={log.spt_n_value}
            </span>
          )}
          {log.sample_id && (
            <span className="text-xs font-mono font-bold text-purple-700 inline-flex items-center gap-0.5">
              <TestTube className="w-2.5 h-2.5" /> {log.sample_id}
            </span>
          )}
          {log.sample_type && log.sample_type !== 'none' && (
            <span className="text-xs bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">{log.sample_type}</span>
          )}
          {strata && strata.label && log.strata_descriptor !== 'other' && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${strata.color}`}>{strata.label}</span>
          )}
          {log.groundwater_strike_depth != null && (
            <span className="text-xs bg-cyan-50 text-cyan-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
              <Droplets className="w-2.5 h-2.5" /> {log.groundwater_strike_depth}m
            </span>
          )}
          {log.groundwater_static_level != null && (
            <span className="text-xs bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded-full font-medium">
              Static {log.groundwater_static_level}m
            </span>
          )}
          {log.coring_recovery != null && (
            <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
              <Layers className="w-2.5 h-2.5" /> {log.coring_recovery}%
            </span>
          )}
          {log.coring_rqd != null && (
            <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium">RQD {log.coring_rqd}%</span>
          )}
          {log.core_box_number && (
            <span className="text-xs font-mono font-bold text-fuchsia-700 inline-flex items-center gap-0.5">
              <Boxes className="w-2.5 h-2.5" /> {log.core_box_number}
            </span>
          )}
          {log.standpipe_ref && (
            <span className="text-xs bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
              <Gauge className="w-2.5 h-2.5" /> {log.standpipe_ref}{log.standpipe_reading_m != null ? ` · ${log.standpipe_reading_m}m` : ''}
            </span>
          )}
          {log.sensor_type && (
            <span className="text-xs bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
              <Radar className="w-2.5 h-2.5" /> {log.sensor_type}{log.probe_depth != null ? ` · ${log.probe_depth}m` : ''}
            </span>
          )}
          {log.drilling_fluid_loss && log.drilling_fluid_loss !== 'none' && fluidLossConfig[log.drilling_fluid_loss] && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${fluidLossConfig[log.drilling_fluid_loss].badge}`}>
              {fluidLossConfig[log.drilling_fluid_loss].label}
            </span>
          )}
          {log.refusal_encountered && (
            <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
              <Ban className="w-2.5 h-2.5" /> Refusal
            </span>
          )}
          {log.obstruction_type && log.obstruction_type !== 'none' && obstructionConfig[log.obstruction_type] && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${obstructionConfig[log.obstruction_type].badge}`}>
              {obstructionConfig[log.obstruction_type].label}
            </span>
          )}
          {log.seal_depth != null && (
            <span className="text-xs bg-stone-100 text-stone-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
              <Ban className="w-2.5 h-2.5" /> Seal {log.seal_depth}m
            </span>
          )}
          {log.mixer_type && log.mixer_type !== 'none' && (
            <span className="text-xs bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
              <Beaker className="w-2.5 h-2.5" /> {log.mixer_type === 'machine_mixer' ? 'Machine' : log.mixer_type === 'hand_mix' ? 'Hand' : 'Premix'}
              {log.grout_volume != null ? ` · ${log.grout_volume}L` : ''}
            </span>
          )}
          {photos.length > 0 && (
            <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-medium">
              {photos.length} photo(s)
            </span>
          )}
        </div>
        {log.strata_description_detail && <p className="text-xs text-slate-600 mt-1">{log.strata_description_detail}</p>}
        {log.description && <p className="text-xs text-slate-500 mt-0.5">{log.description}</p>}
        {log.backfill_material && <p className="text-xs text-slate-500 mt-0.5">Backfill: {log.backfill_material}</p>}
      </div>
    </div>
  );
}