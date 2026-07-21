import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  Droplets, TestTube, Calculator, Layers, Mountain,
  ArrowDownToLine, ChevronRight, Tablet, Search, Boxes, Package, Gauge
} from 'lucide-react';
import { Skeleton, EmptyState } from '@/components/StateViews';
import BoreholeDetailModal from '@/components/borehole/BoreholeDetailModal';

export default function BoreholeDrillDown({ job }) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['investigation-logs', job.id],
    queryFn: () => base44.entities.InvestigationLog.filter({ job_id: job.id }),
  });

  // Group all logs by borehole_ref
  const boreholes = useMemo(() => {
    const map = {};
    logs.forEach(l => {
      if (!l.borehole_ref) return;
      if (!map[l.borehole_ref]) map[l.borehole_ref] = [];
      map[l.borehole_ref].push(l);
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [logs]);

  const [selectedRef, setSelectedRef] = useState(null);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return boreholes;
    const q = search.toLowerCase();
    return boreholes.filter(([ref]) => ref.toLowerCase().includes(q));
  }, [boreholes, search]);

  const activeLogs = selectedRef ? boreholes.find(([ref]) => ref === selectedRef)?.[1] || [] : [];

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <Skeleton className="h-8 w-48 mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (boreholes.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <EmptyState
          icon={Mountain}
          title="No boreholes yet"
          message="Borehole data will appear here once an admin imports the AGS file from KeyLogBook, or once drilling crews start logging borehole progress."
        />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 flex-wrap">
        <Mountain className="w-5 h-5 text-emerald-700" />
        <h2 className="font-semibold text-slate-900">Borehole Data Explorer</h2>
        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
          {boreholes.length} borehole{boreholes.length !== 1 ? 's' : ''}
        </span>
        <div className="ml-auto relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search borehole ref…"
            className="pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 w-48 sm:w-56"
          />
        </div>
      </div>

      {/* Card grid */}
      <div className="p-4">
        {filtered.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No boreholes match "{search}".</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(([ref, refLogs]) => {
              const summary = getBoreholeSummary(refLogs);
              const isAgs = summary.source === 'ags_import';
              return (
                <button
                  key={ref}
                  onClick={() => setSelectedRef(ref)}
                  className="group text-left p-4 rounded-xl border border-slate-200 bg-white hover:border-emerald-400 hover:shadow-md transition-all duration-200"
                >
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition">
                      <Mountain className="w-4 h-4 text-emerald-700" />
                    </div>
                    <span className="font-mono font-bold text-slate-900 text-base">{ref}</span>
                    <ChevronRight className="w-4 h-4 ml-auto text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition" />
                  </div>

                  {/* Source badge */}
                  {isAgs && (
                    <span className="inline-flex items-center gap-1 text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium mb-3">
                      <Tablet className="w-2.5 h-2.5" /> KeyLogBook
                    </span>
                  )}

                  {/* Key depth */}
                  <div className="flex items-center gap-2 mb-3">
                    {summary.maxDepth != null && (
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-slate-700">
                        <ArrowDownToLine className="w-3.5 h-3.5 text-blue-600" />
                        {summary.maxDepth}m
                      </span>
                    )}
                    {summary.groundwaterDepth != null && (
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-cyan-700">
                        <Droplets className="w-3.5 h-3.5" />
                        {summary.groundwaterDepth}m
                      </span>
                    )}
                  </div>

                  {/* Data type chips */}
                  <div className="flex items-center gap-2 flex-wrap text-[11px]">
                    {summary.strataCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 font-medium">
                        <Layers className="w-2.5 h-2.5" />{summary.strataCount}
                      </span>
                    )}
                    {summary.sptCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-violet-50 text-violet-700 font-medium">
                        <Calculator className="w-2.5 h-2.5" />{summary.sptCount}
                      </span>
                    )}
                    {summary.coreCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-fuchsia-50 text-fuchsia-700 font-medium">
                        <Boxes className="w-2.5 h-2.5" />{summary.coreCount}
                      </span>
                    )}
                    {summary.sampleCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-700 font-medium">
                        <TestTube className="w-2.5 h-2.5" />{summary.sampleCount}
                      </span>
                    )}
                    {summary.installCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-medium">
                        <Package className="w-2.5 h-2.5" />{summary.installCount}
                      </span>
                    )}
                    {summary.waterReadingCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-teal-50 text-teal-700 font-medium">
                        <Gauge className="w-2.5 h-2.5" />{summary.waterReadingCount}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {selectedRef && (
        <BoreholeDetailModal
          boreholeRef={selectedRef}
          logs={activeLogs}
          onClose={() => setSelectedRef(null)}
        />
      )}
    </div>
  );
}

function getBoreholeSummary(logs) {
  const progressLogs = logs.filter(l => l.log_type === 'borehole_progress' && !l.strata_description_detail);
  const strataLogs = logs.filter(l => l.strata_descriptor || l.strata_description_detail);
  const sampleLogs = logs.filter(l => l.log_type === 'sample_collection');
  const sptLogs = logs.filter(l => l.spt_n_value != null || (l.spt_blows && l.spt_blows.length > 0));
  const coreLogs = logs.filter(l => l.log_type === 'core_inspection');
  const installLogs = logs.filter(l => l.log_type === 'installation');
  const waterReadingLogs = logs.filter(l => l.log_type === 'standpipe_reading');

  const allDepths = [
    ...progressLogs.map(l => l.depth_to),
    ...strataLogs.map(l => l.depth_to),
    ...sptLogs.map(l => l.depth_to),
    ...sampleLogs.map(l => l.depth_from),
    ...coreLogs.map(l => l.depth_to),
  ].filter(d => d != null);

  return {
    maxDepth: allDepths.length ? Math.max(...allDepths) : null,
    groundwaterDepth: progressLogs[0]?.groundwater_strike_depth,
    sampleCount: sampleLogs.length,
    sptCount: sptLogs.length,
    strataCount: strataLogs.length,
    coreCount: coreLogs.length,
    installCount: installLogs.length,
    waterReadingCount: waterReadingLogs.length,
    source: logs[0]?.source,
  };
}