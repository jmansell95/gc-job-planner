import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  ClipboardList, Clock, Ruler, ChevronDown, Activity, TrendingUp,
  ArrowDownToLine, TestTube, Layers, MapPin, Search, Package, Beaker,
  Undo2, Gauge, Radar, Ban, Boxes, Wrench
} from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton, EmptyState } from '@/components/StateViews';
import { getCrewLabel } from '@/utils/terminology';
import { logTypeConfig } from '@/components/investigation/shared';

const LOG_ICON_MAP = {
  ArrowDownToLine, TestTube, Layers, MapPin, Search, Package, Beaker,
  Wrench, Undo2, Gauge, Radar, Ban, Boxes, ClipboardList,
};

const roleLabels = {
  groundworker: 'Groundworker', cp_driller: 'CP Driller', rotary_driller: 'Rotary Driller',
  enabling_crew: 'Enabling Crew', depot: 'Depot', supervisor: 'Supervisor',
};

const workerTypeBadge = {
  direct_employee: 'bg-emerald-100 text-emerald-700',
  subcontractor: 'bg-orange-100 text-orange-700',
  agency: 'bg-blue-100 text-blue-700',
};

const taskTypeMeta = {
  on_site: { label: 'On site', chip: 'bg-emerald-100 text-emerald-700' },
  travel_to: { label: 'Travel to', chip: 'bg-blue-100 text-blue-700' },
  travel_from: { label: 'Travel home', chip: 'bg-violet-100 text-violet-700' },
};

const minsFromEntry = (t) => Number(t?.task_duration_minutes) || (t?.total_hours ? t.total_hours * 60 : 0);

const fmtDur = (mins) => {
  const m = Math.round(Number(mins) || 0);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h && r) return `${h}h ${r}m`;
  if (h) return `${h}h`;
  return m > 0 ? `${r}m` : '—';
};

export default function StaffActivityBreakdown({ job, assignedStaff, primaryType }) {
  const [expandedStaff, setExpandedStaff] = useState({});

  const { data: timesheets = [], isLoading: tsLoading } = useQuery({
    queryKey: ['timesheets-for-job', job.id],
    queryFn: () => base44.entities.Timesheet.filter({ job_id: job.id })
  });
  const { data: invLogs = [], isLoading: ilLoading } = useQuery({
    queryKey: ['inv-logs-for-job-activity', job.id],
    queryFn: () => base44.entities.InvestigationLog.filter({ job_id: job.id }, '-created_at', 500)
  });

  const isLoading = tsLoading || ilLoading;

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <Skeleton className="h-6 w-48 mb-4" />
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
      </div>
    );
  }

  const validTs = (timesheets || [])
    .filter(t => (t.status === 'submitted' || t.status === 'approved') && !t.is_break)
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  // Group timesheets by staff
  const tsByStaff = {};
  validTs.forEach(t => {
    if (!tsByStaff[t.staff_id]) tsByStaff[t.staff_id] = [];
    tsByStaff[t.staff_id].push(t);
  });

  // Group investigation logs by staff
  const ilByStaff = {};
  (invLogs || []).forEach(l => {
    if (!ilByStaff[l.staff_id]) ilByStaff[l.staff_id] = [];
    ilByStaff[l.staff_id].push(l);
  });

  // Build staff activity records — only staff who have logged something
  const staffWithActivity = assignedStaff.filter(s => tsByStaff[s.id] || ilByStaff[s.id]);

  if (staffWithActivity.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <EmptyState
          icon={ClipboardList}
          title="No activity logged yet"
          message="Once your crew logs daily tasks and site activities, you'll see a per-person breakdown here."
        />
      </div>
    );
  }

  const toggleStaff = (id) => setExpandedStaff(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
          <Activity className="w-4 h-4 text-emerald-700" />
        </div>
        <h3 className="font-semibold text-slate-900 text-sm">Staff Activity Breakdown</h3>
        <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
          {staffWithActivity.length} {staffWithActivity.length === 1 ? 'person' : 'people'}
        </span>
      </div>

      <div className="divide-y divide-slate-100">
        {staffWithActivity.map(member => {
          const ts = tsByStaff[member.id] || [];
          const il = ilByStaff[member.id] || [];
          const totalTime = ts.reduce((s, t) => s + minsFromEntry(t), 0);
          const totalMeterage = ts.reduce((s, t) => s + (Number(t.meterage) || 0), 0);
          const isOpen = expandedStaff[member.id];

          // Group timesheets by date
          const tsByDate = {};
          ts.forEach(t => {
            if (!tsByDate[t.date]) tsByDate[t.date] = [];
            tsByDate[t.date].push(t);
          });
          const tsDates = Object.keys(tsByDate).sort().reverse();

          // Group investigation logs by date
          const ilByDate = {};
          il.forEach(l => {
            const d = l.date || (l.created_at ? l.created_at.slice(0, 10) : null);
            if (!d) return;
            if (!ilByDate[d]) ilByDate[d] = [];
            ilByDate[d].push(l);
          });

          return (
            <div key={member.id}>
              {/* Staff summary row */}
              <button
                onClick={() => toggleStaff(member.id)}
                className="w-full px-5 py-4 flex items-center gap-3 hover:bg-slate-50 transition text-left"
              >
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-emerald-700 font-bold text-sm">{member.name.charAt(0)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 truncate">{member.name}</p>
                  <p className="text-xs text-slate-500">{roleLabels[member.job_role] || getCrewLabel(primaryType, 1)}</p>
                </div>
                {/* Quick stats */}
                <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
                  {totalTime > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-600 font-medium">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />{fmtDur(totalTime)}
                    </span>
                  )}
                  {totalMeterage > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                      <Ruler className="w-3.5 h-3.5" />{totalMeterage}m
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 text-xs text-violet-600 font-medium">
                    <TrendingUp className="w-3.5 h-3.5" />{ts.length + il.length} logs
                  </span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${workerTypeBadge[member.worker_type] || 'bg-slate-100 text-slate-600'}`}>
                  {member.worker_type?.replace(/_/g, ' ')}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Expanded daily breakdown */}
              {isOpen && (
                <div className="px-5 pb-4 bg-slate-50/40 space-y-4">
                  {/* Mobile quick stats */}
                  <div className="flex sm:hidden items-center gap-4 pt-2 text-xs">
                    {totalTime > 0 && <span className="inline-flex items-center gap-1 text-slate-600 font-medium"><Clock className="w-3.5 h-3.5" />{fmtDur(totalTime)}</span>}
                    {totalMeterage > 0 && <span className="inline-flex items-center gap-1 text-amber-600 font-medium"><Ruler className="w-3.5 h-3.5" />{totalMeterage}m</span>}
                    <span className="inline-flex items-center gap-1 text-violet-600 font-medium"><TrendingUp className="w-3.5 h-3.5" />{ts.length + il.length} logs</span>
                  </div>

                  {tsDates.map(date => {
                    const d = new Date(date + 'T00:00:00');
                    const dayTasks = tsByDate[date];
                    const dayLogs = ilByDate[date] || [];
                    return (
                      <div key={date} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                        <div className="px-4 py-2.5 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
                          <span className="text-sm font-semibold text-slate-700">{format(d, 'EEEE, dd MMM yyyy')}</span>
                          <span className="text-xs text-slate-400">{dayTasks.length + dayLogs.length} {dayTasks.length + dayLogs.length === 1 ? 'entry' : 'entries'}</span>
                        </div>
                        <div className="divide-y divide-slate-100">
                          {/* Timesheet tasks */}
                          {dayTasks.map(t => {
                            const meta = taskTypeMeta[t.task_type] || taskTypeMeta.on_site;
                            const mins = minsFromEntry(t);
                            const mtr = Number(t.meterage) || 0;
                            return (
                              <div key={t.id} className="px-4 py-2.5 flex items-start gap-2.5">
                                <div className="w-6 h-6 rounded-md bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                                  <ClipboardList className="w-3 h-3 text-emerald-600" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm text-slate-800">{t.task_description || 'Work recorded'}</p>
                                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${meta.chip}`}>{meta.label}</span>
                                    {mins > 0 && <span className="text-xs text-slate-500 inline-flex items-center gap-0.5"><Clock className="w-3 h-3" />{fmtDur(mins)}</span>}
                                    {mtr > 0 && <span className="text-xs text-amber-600 font-medium inline-flex items-center gap-0.5"><Ruler className="w-3 h-3" />{mtr}m</span>}
                                    {t.status === 'approved' && <span className="text-[10px] text-emerald-600 font-medium">✓ approved</span>}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {/* Investigation logs */}
                          {dayLogs.map(l => {
                            const cfg = logTypeConfig[l.log_type] || { label: l.log_type?.replace(/_/g, ' '), icon: 'ClipboardList', badge: 'bg-slate-100 text-slate-600' };
                            const Icon = LOG_ICON_MAP[cfg.icon] || Activity;
                            return (
                              <div key={l.id} className="px-4 py-2.5 flex items-start gap-2.5">
                                <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.badge}`}>
                                  <Icon className="w-3 h-3" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm text-slate-800">
                                    {cfg.label}
                                    {l.borehole_ref && <span className="text-slate-500"> · {l.borehole_ref}</span>}
                                  </p>
                                  {l.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{l.description}</p>}
                                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    {l.depth_from != null && l.depth_to != null && <span className="text-xs text-slate-500">{l.depth_from}–{l.depth_to}m</span>}
                                    {l.units_completed > 0 && <span className="text-xs text-slate-500">{l.units_completed} {l.units_label || 'units'}</span>}
                                    {l.sample_id && <span className="text-xs text-blue-600 font-medium">Sample: {l.sample_id}</span>}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}