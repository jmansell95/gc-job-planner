import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { BarChart3, TrendingUp, Gauge, Award } from 'lucide-react';
import WidgetShell from '@/components/dashboard/WidgetShell';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

/**
 * Phase 5 — Analytics: Drilling Performance widget.
 *
 * Shows metres drilled per rig over the last 4 weeks, average metres
 * per day, and top-performing rig. Helps identify productivity trends
 * and compare rig efficiency.
 */
export default function DrillingPerformanceWidget() {
  const fourWeeksAgo = new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['drilling-perf-logs', fourWeeksAgo],
    queryFn: () => base44.entities.InvestigationLog.filter({
      log_type: { $in: ['borehole_progress', 'sample_collection', 'core_inspection'] },
      date: { $gte: fourWeeksAgo },
    }, '-created_date', 500),
  });

  const { data: assets = [] } = useQuery({
    queryKey: ['drilling-perf-assets'],
    queryFn: () => base44.entities.SiteAsset.filter({ asset_type: 'rig' }),
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['drilling-perf-assignments', fourWeeksAgo],
    queryFn: () => base44.entities.JobAssetAssignment.filter({ asset_type: 'rig' }, '-created_date', 500),
  });

  const performance = useMemo(() => {
    // Map logs to rigs via assignments
    const jobToRig = {};
    for (const a of assignments) {
      if (a.asset_id && a.job_id) jobToRig[a.job_id] = a.asset_id;
    }

    const rigStats = {};
    for (const log of logs) {
      const rigId = jobToRig[log.job_id];
      if (!rigId) continue;
      if (!rigStats[rigId]) rigStats[rigId] = { metres: 0, logs: 0, days: new Set() };
      rigStats[rigId].metres += Number(log.depth_to || 0) - Number(log.depth_from || 0);
      rigStats[rigId].logs += 1;
      if (log.date) rigStats[rigId].days.add(log.date);
    }

    const assetMap = {};
    for (const a of assets) assetMap[a.id] = a;

    return Object.entries(rigStats)
      .map(([rigId, stats]) => ({
        rigId,
        name: assetMap[rigId]?.name || 'Unknown Rig',
        metres: Math.round(stats.metres),
        logs: stats.logs,
        activeDays: stats.days.size,
        avgPerDay: stats.days.size > 0 ? Math.round(stats.metres / stats.days.size) : 0,
      }))
      .sort((a, b) => b.metres - a.metres);
  }, [logs, assets, assignments]);

  const totalMetres = performance.reduce((sum, r) => sum + r.metres, 0);
  const topRig = performance[0];
  const avgMetresPerDay = performance.length > 0
    ? Math.round(totalMetres / performance.reduce((sum, r) => sum + r.activeDays, 0))
    : 0;

  return (
    <WidgetShell icon={BarChart3} title="Drilling Performance" subtitle="Metres drilled per rig — last 4 weeks">
      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-slate-50 rounded-lg p-2.5 text-center">
          <p className="text-lg font-bold text-slate-700 tabular-nums">{totalMetres.toLocaleString()}m</p>
          <p className="text-[10px] text-slate-400 uppercase font-medium">Total Drilled</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-2.5 text-center">
          <p className="text-lg font-bold text-blue-600 tabular-nums">{avgMetresPerDay}m</p>
          <p className="text-[10px] text-slate-400 uppercase font-medium">Avg / Day</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-2.5 text-center">
          <p className="text-lg font-bold text-emerald-600 tabular-nums">{performance.length}</p>
          <p className="text-[10px] text-slate-400 uppercase font-medium">Active Rigs</p>
        </div>
      </div>

      {isLoading ? (
        <div className="h-40 animate-pulse bg-slate-100 rounded-lg" />
      ) : performance.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Gauge className="w-8 h-8 text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">No drilling data in the last 4 weeks</p>
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={performance} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} interval={0} angle={-15} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => `${v}m`} />
              <Tooltip
                formatter={(v, name) => name === 'metres' ? [`${v}m`, 'Metres'] : v}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
              <Bar dataKey="metres" fill="#2E5A1A" radius={[4, 4, 0, 0]} name="metres" />
            </BarChart>
          </ResponsiveContainer>

          {topRig && (
            <div className="mt-3 flex items-center gap-2 bg-emerald-50 rounded-lg px-3 py-2 text-xs">
              <Award className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span className="text-slate-700">
                Top rig: <strong>{topRig.name}</strong> — {topRig.metres}m across {topRig.activeDays} active day{topRig.activeDays !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </>
      )}
    </WidgetShell>
  );
}