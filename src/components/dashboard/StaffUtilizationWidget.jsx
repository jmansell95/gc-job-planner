import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2, TrendingUp, Users, Clock, AlertCircle } from 'lucide-react';

/**
 * StaffUtilizationWidget — shows billable vs non-billable hours per staff
 * member for the current week, plus an overall utilization rate.
 *
 * Billable = timesheet entries with chargeable=true and job_id set.
 * Non-billable = entries without chargeable or without job_id (breaks excluded).
 */
export default function StaffUtilizationWidget() {
  const weekStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  }, []);

  const { data: staff = [], isLoading: staffLoading } = useQuery({
    queryKey: ['staff-util-widget'],
    queryFn: () => base44.entities.Staff.filter({ is_active: true }),
  });
  const { data: timesheets = [], isLoading: tsLoading } = useQuery({
    queryKey: ['timesheets-util', weekStart],
    queryFn: () => base44.entities.Timesheet.filter({ week_start: weekStart, status: 'approved' }),
  });

  const isLoading = staffLoading || tsLoading;

  const utilization = useMemo(() => {
    const byStaff = {};
    for (const t of timesheets) {
      if (t.is_break) continue;
      const sid = t.staff_id;
      if (!byStaff[sid]) byStaff[sid] = { billable: 0, nonBillable: 0, total: 0 };
      const hours = Number(t.total_hours) || (Number(t.task_duration_minutes) || 0) / 60;
      byStaff[sid].total += hours;
      if (t.chargeable && t.job_id) byStaff[sid].billable += hours;
      else byStaff[sid].nonBillable += hours;
    }
    return byStaff;
  }, [timesheets]);

  const ranked = useMemo(() => {
    return staff
      .map(s => {
        const u = utilization[s.id] || { billable: 0, nonBillable: 0, total: 0 };
        const rate = u.total > 0 ? Math.round((u.billable / u.total) * 100) : 0;
        return { ...s, ...u, rate };
      })
      .filter(s => s.total > 0)
      .sort((a, b) => b.billable - a.billable);
  }, [staff, utilization]);

  const overall = useMemo(() => {
    const totalBillable = ranked.reduce((s, r) => s + r.billable, 0);
    const totalAll = ranked.reduce((s, r) => s + r.total, 0);
    return {
      rate: totalAll > 0 ? Math.round((totalBillable / totalAll) * 100) : 0,
      billable: totalBillable,
      total: totalAll,
      activeStaff: ranked.length,
    };
  }, [ranked]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="space-y-3">
      {/* Overall utilization */}
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${overall.rate >= 70 ? 'bg-emerald-100' : overall.rate >= 50 ? 'bg-amber-100' : 'bg-rose-100'}`}>
          <TrendingUp className={`w-6 h-6 ${overall.rate >= 70 ? 'text-emerald-600' : overall.rate >= 50 ? 'text-amber-600' : 'text-rose-600'}`} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-slate-900">{overall.rate}% Utilization</p>
          <p className="text-xs text-slate-400">{overall.billable.toFixed(1)}h billable of {overall.total.toFixed(1)}h total · {overall.activeStaff} staff</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
        <div className="h-full bg-emerald-500 rounded-l-full" style={{ width: `${overall.rate}%` }} />
        <div className="h-full bg-slate-300 rounded-r-full" style={{ width: `${100 - overall.rate}%` }} />
      </div>

      {/* Per-staff breakdown */}
      {ranked.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <AlertCircle className="w-8 h-8 text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">No approved timesheets this week</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
          {ranked.slice(0, 15).map(s => (
            <div key={s.id} className="flex items-center gap-2.5">
              <p className="text-xs font-medium text-slate-700 truncate w-24 flex-shrink-0">{s.name}</p>
              <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden flex">
                <div className="h-full bg-emerald-500 flex items-center justify-center text-[9px] text-white font-bold" style={{ width: `${s.rate}%` }} title={`${s.billable.toFixed(1)}h billable`}>
                  {s.rate > 15 && `${s.rate}%`}
                </div>
                <div className="h-full bg-slate-300 flex items-center justify-center text-[9px] text-slate-600 font-bold" style={{ width: `${100 - s.rate}%` }} title={`${s.nonBillable.toFixed(1)}h non-billable`}>
                  {s.rate < 85 && s.nonBillable > 0 && `${100 - s.rate}%`}
                </div>
              </div>
              <p className="text-xs text-slate-500 tabular-nums w-12 text-right flex-shrink-0">{s.total.toFixed(1)}h</p>
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-emerald-500" />
          <span className="text-slate-500">Billable</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-slate-300" />
          <span className="text-slate-500">Non-billable</span>
        </div>
      </div>
    </div>
  );
}