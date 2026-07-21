import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Ruler, Droplets, TestTube, Calculator, Layers, Gauge,
  ArrowDownToLine, Calendar, ChevronRight, Tablet, Waves,
  Ban, AlertTriangle, Mountain, Activity, TrendingDown, ClipboardList
} from 'lucide-react';
import { Skeleton, EmptyState } from '@/components/StateViews';
import { strataConfig, logTypeConfig, reviewStatusConfig } from '@/components/investigation/shared';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

// Strata colors for the visual column — hex values matching strataConfig badges
const strataColors = {
  topsoil: '#a3a300', made_ground: '#64748b', clay_soft: '#a16207', clay_firm: '#854d0e',
  clay_stiff: '#c2410c', sand_loose: '#d97706', sand_medium_dense: '#b45309', sand_dense: '#ea580c',
  gravel: '#78716c', silt: '#6b7280', peat: '#78350f', chalk: '#cbd5e1', mudstone: '#4b5563',
  sandstone: '#c2410c', limestone: '#94a3b8', granite: '#be185d', concrete: '#475569',
  tarmac: '#1e293b', other: '#94a3b8',
};

const sampleTypeConfig = {
  disturbed: { label: 'Disturbed', badge: 'bg-amber-100 text-amber-700' },
  undisturbed: { label: 'Undisturbed', badge: 'bg-blue-100 text-blue-700' },
  water: { label: 'Water', badge: 'bg-cyan-100 text-cyan-700' },
  none: { label: 'No sample', badge: 'bg-slate-100 text-slate-500' },
};

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
  const activeRef = selectedRef || boreholes[0]?.[0] || null;
  const activeLogs = activeRef ? boreholes.find(([ref]) => ref === activeRef)?.[1] || [] : [];

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-96 w-full rounded-lg" />
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
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 flex-wrap">
        <Mountain className="w-5 h-5 text-emerald-700" />
        <h2 className="font-semibold text-slate-900">Borehole Data Explorer</h2>
        <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
          {boreholes.length} borehole{boreholes.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex flex-col lg:flex-row min-h-[500px]">
        {/* Borehole sidebar */}
        <div className="lg:w-56 lg:border-r border-slate-100 bg-slate-50/50 lg:max-h-[600px] overflow-y-auto">
          <div className="p-3 space-y-1.5">
            {boreholes.map(([ref, refLogs]) => {
              const summary = getBoreholeSummary(refLogs);
              const isActive = ref === activeRef;
              return (
                <button
                  key={ref}
                  onClick={() => setSelectedRef(ref)}
                  className={`w-full text-left p-3 rounded-lg border transition ${
                    isActive
                      ? 'border-emerald-400 bg-emerald-50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/30'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`font-mono font-bold text-sm ${isActive ? 'text-emerald-800' : 'text-slate-800'}`}>{ref}</span>
                    <ChevronRight className={`w-3.5 h-3.5 ml-auto ${isActive ? 'text-emerald-600' : 'text-slate-300'}`} />
                  </div>
                  <div className="flex items-center gap-2.5 text-[11px] text-slate-500">
                    {summary.maxDepth != null && (
                      <span className="inline-flex items-center gap-0.5"><Ruler className="w-2.5 h-2.5" />{summary.maxDepth}m</span>
                    )}
                    {summary.sampleCount > 0 && (
                      <span className="inline-flex items-center gap-0.5"><TestTube className="w-2.5 h-2.5" />{summary.sampleCount}</span>
                    )}
                    {summary.sptCount > 0 && (
                      <span className="inline-flex items-center gap-0.5"><Calculator className="w-2.5 h-2.5" />{summary.sptCount}</span>
                    )}
                  </div>
                  {summary.source === 'ags_import' && (
                    <span className="mt-1.5 inline-flex items-center gap-0.5 text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium">
                      <Tablet className="w-2 h-2" /> KeyLogBook
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Borehole detail */}
        <div className="flex-1 p-5 lg:max-h-[600px] overflow-y-auto">
          <BoreholeDetail boreholeRef={activeRef} logs={activeLogs} />
        </div>
      </div>
    </div>
  );
}

function getBoreholeSummary(logs) {
  const progressLogs = logs.filter(l => l.log_type === 'borehole_progress' && !l.strata_description_detail);
  const strataLogs = logs.filter(l => l.strata_descriptor || l.strata_description_detail);
  const sampleLogs = logs.filter(l => l.log_type === 'sample_collection');
  const sptLogs = logs.filter(l => l.spt_n_value != null || (l.spt_blows && l.spt_blows.length > 0));

  const allDepths = [
    ...progressLogs.map(l => l.depth_to),
    ...strataLogs.map(l => l.depth_to),
    ...sptLogs.map(l => l.depth_to),
    ...sampleLogs.map(l => l.depth_from),
  ].filter(d => d != null);

  return {
    maxDepth: allDepths.length ? Math.max(...allDepths) : null,
    sampleCount: sampleLogs.length,
    sptCount: sptLogs.length,
    strataCount: strataLogs.length,
    source: logs[0]?.source,
    progressLogs,
    strataLogs,
    sampleLogs,
    sptLogs,
  };
}

function safeFormat(dateStr, fmt) {
  if (!dateStr) return '';
  const d = new Date(dateStr.length === 8 && /^\d{8}$/.test(dateStr)
    ? `${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}T00:00:00`
    : (dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00'));
  if (isNaN(d.getTime())) return dateStr;
  try { return format(d, fmt); } catch { return dateStr; }
}

function BoreholeDetail({ boreholeRef: bhRef, logs }) {
  const s = getBoreholeSummary(logs);
  const progressLog = s.progressLogs[0];
  const allStrata = s.strataLogs.sort((a, b) => (a.depth_from || 0) - (b.depth_from || 0));
  const allSamples = s.sampleLogs.sort((a, b) => (a.depth_from || 0) - (b.depth_from || 0));
  const allSpts = s.sptLogs.sort((a, b) => (a.depth_from || 0) - (b.depth_from || 0));

  // SPT chart data (N-value vs depth)
  const sptChartData = allSpts
    .filter(l => l.depth_from != null && l.spt_n_value != null)
    .map(l => ({ depth: l.depth_from, n: l.spt_n_value }));

  // Earliest + latest dates
  const dates = logs.map(l => l.date).filter(Boolean).sort();
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-xl font-bold text-slate-900 font-mono">{bhRef}</h3>
            {progressLog?.source === 'ags_import' && (
              <span className="inline-flex items-center gap-0.5 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                <Tablet className="w-3 h-3" /> KeyLogBook Import
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
            {progressLog?.log_type && logTypeConfig[progressLog.log_type] && (
              <span className={`px-2 py-0.5 rounded-full font-medium ${logTypeConfig[progressLog.log_type].badge}`}>
                {logTypeConfig[progressLog.log_type].label}
              </span>
            )}
            {startDate && (
              <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" />
                {safeFormat(startDate, 'dd MMM yyyy')}
                {endDate && endDate !== startDate && ` → ${safeFormat(endDate, 'dd MMM yyyy')}`}
              </span>
            )}
            <span className="inline-flex items-center gap-1"><Layers className="w-3 h-3" />{s.strataCount} strata</span>
            <span className="inline-flex items-center gap-1"><Calculator className="w-3 h-3" />{s.sptCount} SPTs</span>
          </div>
        </div>
      </div>

      {/* Key stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile icon={ArrowDownToLine} label="Final Depth" value={progressLog?.depth_to != null ? `${progressLog.depth_to}m` : (s.maxDepth != null ? `${s.maxDepth}m` : '—')} color="text-blue-700 bg-blue-50" />
        <StatTile icon={Droplets} label="Groundwater Strike" value={progressLog?.groundwater_strike_depth != null ? `${progressLog.groundwater_strike_depth}m` : '—'} color="text-cyan-700 bg-cyan-50" />

      </div>

      {/* Visual strata column + data */}
      {allStrata.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Visual strata column */}
          <div className="md:col-span-1">
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wide inline-flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" /> Strata Profile
                </p>
              </div>
              <StrataColumn strataLogs={allStrata} maxDepth={s.maxDepth} groundwaterDepth={progressLog?.groundwater_strike_depth} />
            </div>
          </div>

          {/* Strata table */}
          <div className="md:col-span-2">
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wide inline-flex items-center gap-1.5">
                  <Mountain className="w-3.5 h-3.5" /> Strata Detail ({allStrata.length})
                </p>
              </div>
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {allStrata.map((l, i) => {
                  const sc = l.strata_descriptor && strataConfig[l.strata_descriptor];
                  const thickness = (l.depth_from != null && l.depth_to != null) ? (l.depth_to - l.depth_from).toFixed(2) : null;
                  return (
                    <div key={l.id || i} className="flex items-start gap-3 px-3 py-2.5">
                      <div className="w-3 h-12 rounded-sm flex-shrink-0 mt-0.5" style={{ backgroundColor: strataColors[l.strata_descriptor] || strataColors.other }} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {sc && l.strata_descriptor !== 'other' && (
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${sc.color}`}>{sc.label}</span>
                          )}
                          <span className="text-xs text-slate-500 inline-flex items-center gap-0.5">
                            <Ruler className="w-2.5 h-2.5" />{l.depth_from ?? '?'}–{l.depth_to ?? '?'}m
                          </span>
                          {thickness && <span className="text-xs text-slate-400">· {thickness}m thick</span>}
                        </div>
                        {l.strata_description_detail && (
                          <p className="text-xs text-slate-700 mt-1 leading-relaxed">{l.strata_description_detail}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SPT chart */}
      {sptChartData.length > 0 && (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wide inline-flex items-center gap-1.5">
              <Calculator className="w-3.5 h-3.5" /> SPT N-Values vs Depth ({allSpts.length})
            </p>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={sptChartData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" dataKey="n" domain={[0, 'dataMax + 5']} tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" label={{ value: 'N-value', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#64748b' }} />
                <YAxis type="number" dataKey="depth" reversed domain={[0, 'dataMax + 1']} tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" label={{ value: 'Depth (m)', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#64748b', dy: 30 }} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  formatter={(v, name) => name === 'n' ? [`${v} (N-value)`, 'SPT'] : [`${v}m`, 'Depth']}
                  labelFormatter={() => ''}
                />
                <Bar dataKey="n" radius={[0, 4, 4, 0]} fill="#3b82f6">
                  {sptChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.n > 50 ? '#ef4444' : entry.n > 30 ? '#f59e0b' : '#3b82f6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500 justify-center">
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> N ≤ 30</span>
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> 30–50</span>
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> N {'>'} 50 (very dense)</span>
            </div>
          </div>
        </div>
      )}

      {/* SPT data table */}
      {allSpts.length > 0 && (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wide inline-flex items-center gap-1.5">
              <TrendingDown className="w-3.5 h-3.5" /> SPT Blow Counts ({allSpts.length})
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/80 text-slate-500">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-xs">Depth (m)</th>
                  <th className="text-left px-3 py-2 font-medium text-xs">Blow Count (per 75mm)</th>
                  <th className="text-left px-3 py-2 font-medium text-xs">N-Value</th>
                  <th className="text-left px-3 py-2 font-medium text-xs">Density</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allSpts.map((l, i) => (
                  <tr key={l.id || i} className="hover:bg-slate-50/50">
                    <td className="px-3 py-2 text-slate-700 font-mono">
                      {l.depth_from != null ? `${l.depth_from}m` : '—'}
                    </td>
                    <td className="px-3 py-2 text-slate-600 font-mono text-xs">
                      {(l.spt_blows || []).length > 0 ? `[${l.spt_blows.join(', ')}]` : '—'}
                    </td>
                    <td className="px-3 py-2">
                      {l.spt_n_value != null ? (
                        <span className={`font-bold font-mono px-2 py-0.5 rounded-full text-xs ${
                          l.spt_n_value > 50 ? 'bg-red-100 text-red-700'
                          : l.spt_n_value > 30 ? 'bg-amber-100 text-amber-700'
                          : 'bg-blue-100 text-blue-700'
                        }`}>{l.spt_n_value}</span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {l.spt_n_value != null ? getSptDensityLabel(l.spt_n_value) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Samples table */}
      {allSamples.length > 0 && (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wide inline-flex items-center gap-1.5">
              <TestTube className="w-3.5 h-3.5" /> Samples ({allSamples.length})
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/80 text-slate-500">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-xs">Sample ID</th>
                  <th className="text-left px-3 py-2 font-medium text-xs">Depth (m)</th>
                  <th className="text-left px-3 py-2 font-medium text-xs">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allSamples.map((l, i) => {
                  const stc = sampleTypeConfig[l.sample_type] || sampleTypeConfig.none;
                  return (
                    <tr key={l.id || i} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2 font-mono font-bold text-purple-700 text-xs">
                        {l.sample_id || '—'}
                      </td>
                      <td className="px-3 py-2 text-slate-700 font-mono text-xs">
                        {l.depth_from != null ? `${l.depth_from}m` : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stc.badge}`}>{stc.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Groundwater & anomalies */}
      {(progressLog?.groundwater_strike_depth != null || logs.some(l => l.refusal_encountered || l.drilling_fluid_loss !== 'none')) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {progressLog?.groundwater_strike_depth != null && (
            <div className="rounded-xl border border-cyan-200 bg-cyan-50/50 p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <Droplets className="w-4 h-4 text-cyan-700" />
                <p className="text-sm font-bold text-cyan-900">Groundwater</p>
              </div>
              <p className="text-2xl font-bold text-cyan-700">{progressLog.groundwater_strike_depth}m</p>
              <p className="text-xs text-cyan-600 mt-0.5">Depth to first water strike</p>
              {progressLog.groundwater_static_level != null && (
                <p className="text-xs text-cyan-600 mt-1">Static level: <span className="font-semibold">{progressLog.groundwater_static_level}m</span></p>
              )}
            </div>
          )}
          {logs.filter(l => l.refusal_encountered || (l.drilling_fluid_loss && l.drilling_fluid_loss !== 'none')).length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-700" />
                <p className="text-sm font-bold text-amber-900">Drilling Notes</p>
              </div>
              <div className="space-y-1.5">
                {logs.filter(l => l.refusal_encountered).map((l, i) => (
                  <p key={`r${i}`} className="text-xs text-amber-800 inline-flex items-center gap-1">
                    <Ban className="w-3 h-3" /> Refusal at {l.depth_from != null ? `${l.depth_from}m` : 'unknown depth'}
                  </p>
                ))}
                {logs.filter(l => l.drilling_fluid_loss && l.drilling_fluid_loss !== 'none').map((l, i) => (
                  <p key={`f${i}`} className="text-xs text-amber-800 inline-flex items-center gap-1">
                    <Waves className="w-3 h-3" /> {l.drilling_fluid_loss === 'total' ? 'Total' : 'Partial'} fluid loss at {l.depth_from != null ? `${l.depth_from}m` : '—'}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Other logs (core, standpipe, decommissioning, etc.) */}
      {(() => {
        const otherLogs = logs.filter(l =>
          l.log_type && !['borehole_progress', 'sample_collection'].includes(l.log_type) &&
          !l.strata_descriptor && !l.strata_description_detail
        );
        if (otherLogs.length === 0) return null;
        return (
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide inline-flex items-center gap-1.5">
                <ClipboardList className="w-3.5 h-3.5" /> Other Activity ({otherLogs.length})
              </p>
            </div>
            <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
              {otherLogs.map((l, i) => {
                const ltc = logTypeConfig[l.log_type];
                const rc = reviewStatusConfig[l.manager_review_status || 'pending'];
                return (
                  <div key={l.id || i} className="px-4 py-2.5 flex items-center gap-3">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${ltc?.badge || 'bg-slate-100 text-slate-600'}`}>
                      {ltc?.label || l.log_type}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${rc.badge}`}>{rc.label}</span>
                    <span className="text-xs text-slate-600 flex-1 truncate">
                      {l.description || l.strata_description_detail || '—'}
                    </span>
                    {l.depth_from != null && <span className="text-xs text-slate-400 font-mono">{l.depth_from}m</span>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Source attribution */}
      <div className="text-xs text-slate-400 pt-1 border-t border-slate-100">
        {logs.filter(l => l.source === 'ags_import').length} of {logs.length} entries imported from KeyLogBook AGS · {logs.filter(l => l.source !== 'ags_import').length} logged in-app
      </div>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, color }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3 bg-white">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-1.5 ${color}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <p className="text-[10px] text-slate-400 uppercase font-medium tracking-wide">{label}</p>
      <p className="text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}

function getSptDensityLabel(n) {
  if (n < 4) return 'Very loose';
  if (n < 10) return 'Loose';
  if (n < 30) return 'Medium dense';
  if (n < 50) return 'Dense';
  return 'Very dense';
}

// Visual strata column — vertical stack of colored blocks scaled by layer thickness
function StrataColumn({ strataLogs, maxDepth, groundwaterDepth }) {
  const top = maxDepth || Math.max(...strataLogs.map(l => l.depth_to || 0), 1);
  const totalHeight = 360; // px
  const pxPerM = totalHeight / top;

  return (
    <div className="flex p-3">
      {/* Depth scale */}
      <div className="w-10 flex-shrink-0 relative" style={{ height: totalHeight }}>
        {[0, 0.25, 0.5, 0.75, 1].map(frac => {
          const depth = (top * frac).toFixed(1);
          return (
            <div key={frac} className="absolute left-0 right-0 flex items-center" style={{ top: `${frac * 100}%` }}>
              <span className="text-[9px] text-slate-400 font-mono">{depth}m</span>
              <div className="flex-1 border-t border-dashed border-slate-200 ml-1" />
            </div>
          );
        })}
      </div>
      {/* Strata blocks */}
      <div className="flex-1 relative" style={{ height: totalHeight }}>
        {strataLogs.map((l, i) => {
          const from = l.depth_from || 0;
          const to = l.depth_to || from;
          const topPx = from * pxPerM;
          const heightPx = Math.max(2, (to - from) * pxPerM);
          const color = strataColors[l.strata_descriptor] || strataColors.other;
          const sc = l.strata_descriptor && strataConfig[l.strata_descriptor];
          return (
            <div
              key={l.id || i}
              className="absolute left-0 right-0 border-b border-white/40 flex items-center justify-center overflow-hidden group"
              style={{ top: topPx, height: heightPx, backgroundColor: color }}
              title={`${sc?.label || 'Strata'}: ${from}–${to}m\n${l.strata_description_detail || ''}`}
            >
              {heightPx > 18 && (
                <span className="text-[9px] font-bold text-white/90 truncate px-1 leading-tight">
                  {sc?.label && l.strata_descriptor !== 'other' ? sc.label : ''}
                </span>
              )}
            </div>
          );
        })}
        {/* Groundwater marker */}
        {groundwaterDepth != null && (
          <div className="absolute left-0 right-0 border-t-2 border-cyan-400 border-dashed" style={{ top: groundwaterDepth * pxPerM }}>
            <Droplets className="w-3 h-3 text-cyan-500 absolute -right-0.5 -top-1.5 bg-white rounded-full p-0.5" />
          </div>
        )}
      </div>
    </div>
  );
}