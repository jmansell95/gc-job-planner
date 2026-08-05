import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Activity, Wrench, Clock, TrendingUp, AlertTriangle } from 'lucide-react';
import WidgetShell from '@/components/dashboard/WidgetShell';
import { format } from 'date-fns';

export default function AssetUtilizationWidget() {
  const { data: assets = [] } = useQuery({ queryKey: ['site-assets'], queryFn: () => base44.entities.SiteAsset.list() });
  const { data: assignments = [] } = useQuery({ queryKey: ['job-asset-assignments'], queryFn: () => base44.entities.JobAssetAssignment.list() });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });

  const rigs = assets.filter(a => a.asset_type === 'rig' && a.is_active !== false);
  const activeJobs = jobs.filter(j => (j.status || 'planning') === 'in_progress');
  const activeJobIds = new Set(activeJobs.map(j => j.id));

  // Rigs currently on site (assigned to active jobs)
  const rigsOnSite = assignments.filter(a => activeJobIds.has(a.job_id) && a.asset_type === 'rig' && a.status !== 'returned');
  const rigsOnSiteIds = new Set(rigsOnSite.map(a => a.asset_id));
  const rigsInYard = rigs.filter(r => !rigsOnSiteIds.has(r.id));

  const utilizationPct = rigs.length > 0 ? Math.round((rigsOnSiteIds.size / rigs.length) * 100) : 0;

  // Operating hours analysis
  const rigsByHours = rigs.map(r => ({
    ...r,
    hours: r.operating_hours || 0,
    sinceService: r.hours_since_last_service || 0,
    interval: r.service_interval_hours || 250,
  })).sort((a, b) => b.hours - a.hours);

  const totalHours = rigsByHours.reduce((sum, r) => sum + r.hours, 0);
  const avgHours = rigs.length > 0 ? Math.round(totalHours / rigs.length) : 0;
  const overdueService = rigsByHours.filter(r => r.interval > 0 && r.sinceService >= r.interval);
  const dueSoon = rigsByHours.filter(r => r.interval > 0 && r.sinceService >= r.interval * 0.8 && r.sinceService < r.interval);

  // Idle rigs (in yard with 0 hours in recent assignments)
  const idleRigs = rigsInYard.filter(r => (r.operating_hours || 0) === 0);

  return (
    <WidgetShell
      widgetId="asset-utilization"
      title="Asset Utilization"
      icon={Activity}
      subtitle={`${rigs.length} rigs · ${utilizationPct}% on site`}
    >
      <div className="space-y-3">
        {/* Utilization gauge */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-emerald-50 rounded-lg p-2.5 text-center">
            <p className="text-xl font-bold text-emerald-700 tabular-nums">{rigsOnSiteIds.size}</p>
            <p className="text-[10px] text-emerald-600 font-medium uppercase tracking-wide">On Site</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-2.5 text-center">
            <p className="text-xl font-bold text-slate-600 tabular-nums">{rigsInYard.length}</p>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">In Yard</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-2.5 text-center">
            <p className="text-xl font-bold text-blue-700 tabular-nums">{utilizationPct}%</p>
            <p className="text-[10px] text-blue-600 font-medium uppercase tracking-wide">Utilization</p>
          </div>
        </div>

        {/* Utilization bar */}
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all" style={{ width: `${utilizationPct}%` }} />
        </div>

        {/* Operating hours summary */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-2.5">
            <Clock className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-slate-800 tabular-nums">{totalHours.toLocaleString()}h</p>
              <p className="text-[10px] text-slate-500">Total Engine Hours</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-2.5">
            <TrendingUp className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-slate-800 tabular-nums">{avgHours}h</p>
              <p className="text-[10px] text-slate-500">Avg per Rig</p>
            </div>
          </div>
        </div>

        {/* Service alerts */}
        {(overdueService.length > 0 || dueSoon.length > 0) && (
          <div className="space-y-1.5">
            {overdueService.length > 0 && (
              <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <p className="text-xs text-rose-700 font-medium">{overdueService.length} rig{overdueService.length !== 1 ? 's' : ''} overdue service</p>
              </div>
            )}
            {dueSoon.length > 0 && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <Wrench className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <p className="text-xs text-amber-700 font-medium">{dueSoon.length} rig{dueSoon.length !== 1 ? 's' : ''} due soon (≥80% interval)</p>
              </div>
            )}
          </div>
        )}

        {/* Top rigs by hours */}
        {rigsByHours.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Top Rigs by Hours</p>
            <div className="space-y-1">
              {rigsByHours.slice(0, 4).map(rig => (
                <div key={rig.id} className="flex items-center justify-between text-xs">
                  <span className="text-slate-700 truncate flex-1">{rig.name}</span>
                  <span className="font-semibold text-slate-600 tabular-nums ml-2">{rig.hours}h</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Idle rigs */}
        {idleRigs.length > 0 && (
          <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
            <Wrench className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <p className="text-xs text-slate-500">{idleRigs.length} idle rig{idleRigs.length !== 1 ? 's' : ''} in yard (0 hours logged)</p>
          </div>
        )}
      </div>
    </WidgetShell>
  );
}