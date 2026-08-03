import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Activity, Calendar, TrendingDown } from 'lucide-react';
import { format, subDays, parseISO, isWithinInterval } from 'date-fns';

/**
 * FleetUtilizationHeatmap — Phase 3 Fleet Intelligence.
 *
 * 30-day calendar heatmap showing every rig as a row and each day as a
 * column. Green = on job, grey = idle. Per-rig utilization % on the right
 * highlights underutilized assets so managers can redeploy or sell them.
 */
const DAYS = 30;

export default function FleetUtilizationHeatmap({ assets }) {
  const rigs = useMemo(() => assets.filter(a => a.asset_type === 'rig'), [assets]);

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['fleet-util-30d', rigs.map(r => r.id).join('|')],
    queryFn: async () => {
      const all = [];
      for (const rig of rigs) {
        const items = await base44.entities.JobAssetAssignment.filter({ asset_id: rig.id });
        all.push(...items);
      }
      return all;
    },
    enabled: rigs.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const dayLabels = useMemo(() => {
    const today = new Date();
    return Array.from({ length: DAYS }, (_, i) => {
      const d = subDays(today, DAYS - 1 - i);
      return { date: format(d, 'yyyy-MM-dd'), label: format(d, 'd'), month: format(d, 'MMM'), isWeekend: d.getDay() === 0 || d.getDay() === 6 };
    });
  }, []);

  const rigRows = useMemo(() => {
    const today = new Date();
    return rigs.map(rig => {
      const rigAssignments = assignments.filter(a => a.asset_id === rig.id);
      const cells = dayLabels.map(({ date, isWeekend }) => {
        const dayDate = parseISO(date);
        const onJob = rigAssignments.some(a => {
          if (!a.assigned_date) return false;
          const start = parseISO(a.assigned_date);
          const end = a.returned_date ? parseISO(a.returned_date) : today;
          try { return isWithinInterval(dayDate, { start, end }); } catch { return false; }
        });
        return { date, onJob, isWeekend };
      });
      const utilizedDays = cells.filter(c => c.onJob).length;
      const pct = Math.round((utilizedDays / DAYS) * 100);
      return { rig, cells, utilizedDays, pct };
    }).sort((a, b) => b.pct - a.pct);
  }, [rigs, assignments, dayLabels]);

  const fleetAvg = rigRows.length > 0
    ? Math.round(rigRows.reduce((s, r) => s + r.pct, 0) / rigRows.length)
    : 0;
  const underutilized = rigRows.filter(r => r.pct < 40);

  // Month boundary markers for the header
  const monthMarkers = useMemo(() => {
    const markers = [];
    for (let i = 1; i < dayLabels.length; i++) {
      if (dayLabels[i].month !== dayLabels[i - 1].month) {
        markers.push({ idx: i, label: dayLabels[i].month });
      }
    }
    return markers;
  }, [dayLabels]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="h-6 w-48 bg-slate-100 rounded animate-pulse mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 bg-slate-50 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (rigRows.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <Activity className="w-10 h-10 text-slate-200 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-700">No rigs to analyze</p>
        <p className="text-xs text-slate-400 mt-1">Add rig assets to see fleet utilization.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0">
            <Calendar className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-800">Fleet Utilization — Last 30 Days</h3>
            <p className="text-[11px] text-slate-400">Green = on job · Grey = idle · Sorted by utilization</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <p className="text-lg font-bold text-slate-700 tabular-nums">{fleetAvg}%</p>
            <p className="text-[10px] text-slate-400 uppercase font-medium">Fleet Avg</p>
          </div>
          {underutilized.length > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 rounded-lg border border-amber-200">
              <TrendingDown className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-xs font-semibold text-amber-700">{underutilized.length} under 40%</span>
            </div>
          )}
        </div>
      </div>

      {/* Heatmap grid — horizontal scroll on mobile */}
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          {/* Day header row */}
          <div className="flex items-center border-b border-slate-100 bg-slate-50/50">
            <div className="w-32 sm:w-40 flex-shrink-0 px-3 py-2">
              <p className="text-[10px] uppercase font-semibold text-slate-400">Rig</p>
            </div>
            <div className="flex flex-1">
              {dayLabels.map((d, i) => (
                <div key={i} className="flex-1 text-center py-1 relative">
                  {i % 5 === 0 && <span className="text-[9px] text-slate-400 font-medium">{d.label}</span>}
                  {monthMarkers.find(m => m.idx === i) && (
                    <span className="absolute -top-0 left-0 text-[8px] text-slate-500 font-bold uppercase">{monthMarkers.find(m => m.idx === i).label}</span>
                  )}
                </div>
              ))}
            </div>
            <div className="w-14 flex-shrink-0 px-2 py-1 text-right">
              <p className="text-[10px] uppercase font-semibold text-slate-400">Util</p>
            </div>
          </div>

          {/* Rig rows */}
          {rigRows.map(({ rig, cells, pct }) => (
            <div key={rig.id} className="flex items-center border-b border-slate-50 hover:bg-slate-50/30 transition">
              <div className="w-32 sm:w-40 flex-shrink-0 px-3 py-2.5 min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">{rig.name}</p>
                {rig.rig_type && rig.rig_type !== 'n/a' && (
                  <p className="text-[10px] text-slate-400 uppercase">{rig.rig_type}</p>
                )}
              </div>
              <div className="flex flex-1 gap-px py-1.5">
                {cells.map((c, i) => (
                  <div
                    key={i}
                    className={`flex-1 h-6 rounded-sm transition-all ${c.onJob ? 'bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E]' : c.isWeekend ? 'bg-slate-100' : 'bg-slate-50'} hover:scale-125 hover:z-10 hover:ring-1 hover:ring-slate-300`}
                    title={`${format(parseISO(c.date), 'EEE dd MMM')}: ${c.onJob ? 'On job' : 'Idle'}`}
                  />
                ))}
              </div>
              <div className="w-14 flex-shrink-0 px-2 py-2.5 text-right">
                <span className={`text-xs font-bold tabular-nums ${pct >= 70 ? 'text-emerald-600' : pct >= 40 ? 'text-amber-600' : 'text-rose-600'}`}>
                  {pct}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Underutilized rigs callout */}
      {underutilized.length > 0 && (
        <div className="px-4 py-3 bg-amber-50/50 border-t border-amber-100">
          <div className="flex items-start gap-2">
            <TrendingDown className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-amber-800">
                {underutilized.length} rig{underutilized.length > 1 ? 's' : ''} below 40% utilization
              </p>
              <p className="text-[11px] text-amber-600 mt-0.5">
                {underutilized.map(r => r.rig.name).join(', ')} — consider redeploying or reviewing.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}