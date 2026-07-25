import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, CheckCircle2, TrendingUp, Users, Search, ChevronLeft, ChevronRight, CalendarDays, Ruler, FileText, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import WithdrawnAcknowledgementPanel from '@/components/WithdrawnAcknowledgementPanel';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/StateViews';
import { computeStaffOvertime, buildRateMap, weekKey, entryMinutes } from '@/utils/overtime';
import WeeklyTimesheetCard from '@/components/timesheets/WeeklyTimesheetCard';

const fmtMins = (m) => {
  const mm = Math.round(Number(m) || 0);
  const h = Math.floor(mm / 60), r = mm % 60;
  if (h && r) return `${h}h ${r}m`;
  if (h) return `${h}h`;
  return mm > 0 ? `${r}m` : '—';
};
const meterageOf = (t) => Number(t?.meterage) || 0;

function StatBox({ icon: Icon, label, value, gradient = 'stat-gradient-slate', sub }) {
  return (
    <div className={`${gradient} rounded-xl shadow-md p-4 text-white relative overflow-hidden`}>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0"><Icon className="w-4 h-4 text-white" /></div>
        <p className="text-xs text-white/80 font-medium">{label}</p>
      </div>
      <p className="text-2xl font-bold text-white mt-2">{value}</p>
      {sub && <p className="text-xs text-white/70 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function TimesheetManager() {
  const [staffFilter, setStaffFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, -1 = last week, etc.
  const queryClient = useQueryClient();

  const { data: timesheets = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['timesheets'],
    queryFn: () => base44.entities.Timesheet.list('-created_date', 500)
  });
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: overtimeRates = [] } = useQuery({ queryKey: ['overtime-rates'], queryFn: () => base44.entities.OvertimeRate.list() });
  const { data: overtimeSetting } = useQuery({
    queryKey: ['overtime-setting'],
    queryFn: async () => { const list = await base44.entities.OvertimeSetting.list(); return list[0] || null; }
  });
  const { data: currentUser } = useQuery({ queryKey: ['current-user'], queryFn: () => base44.auth.me() });

  const otRateMap = buildRateMap(overtimeRates);
  const otThreshold = overtimeSetting?.weekly_threshold_hours ?? 40;

  // Compute the visible week (Mon–Sun) from the offset
  const visibleWeekStart = useMemo(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? 6 : day - 1; // back to Monday
    const monday = new Date(d);
    monday.setDate(d.getDate() - diff + weekOffset * 7);
    return format(monday, 'yyyy-MM-dd');
  }, [weekOffset]);

  const visibleWeekEnd = useMemo(() => {
    const d = new Date(visibleWeekStart + 'T00:00:00');
    d.setDate(d.getDate() + 6);
    return d;
  }, [visibleWeekStart]);

  // Work timesheets = non-break, non-merged-granular. Keep weekly summaries.
  const workTimesheets = timesheets.filter((t) => !t.is_break);

  // Overtime breakdowns per staff
  const otBreakdowns = useMemo(() => {
    const map = {};
    staff.forEach((s) => {
      const entries = timesheets.filter((t) => t.staff_id === s.id && (t.status === 'submitted' || t.status === 'approved' || t.status === 'merged'));
      map[s.id] = computeStaffOvertime(entries, otRateMap, otThreshold);
    });
    return map;
  }, [staff, timesheets, otRateMap, otThreshold]);

  // Stats
  const approved = workTimesheets.filter((t) => t.status === 'approved' && !t.is_weekly_summary);
  const approvedMins = approved.reduce((s, t) => s + entryMinutes(t), 0);
  const approvedOtMins = approved.reduce((s, t) => s + (otBreakdowns[t.staff_id]?.[t.id]?.otMins || 0), 0);
  const approvedMeterage = approved.reduce((s, t) => s + meterageOf(t), 0);
  const pendingCount = workTimesheets.filter((t) => t.status === 'submitted').length;
  const mergedCount = workTimesheets.filter((t) => t.is_weekly_summary).length;

  // Group timesheets by staff + week_start (compute week_start if missing)
  const weeklyGroups = useMemo(() => {
    const groups = {};
    workTimesheets.forEach((t) => {
      const wk = t.week_start || weekKey(t.date);
      const key = `${t.staff_id}|${wk}`;
      if (!groups[key]) groups[key] = { staffId: t.staff_id, weekStart: wk, entries: [] };
      groups[key].entries.push(t);
    });
    return Object.values(groups).filter((g) => {
      if (g.weekStart !== visibleWeekStart) return false;
      if (staffFilter !== 'all' && g.staffId !== staffFilter) return false;
      if (search.trim()) {
        const member = staff.find((s) => s.id === g.staffId);
        const q = search.toLowerCase();
        const hasMatch = g.entries.some((t) => {
          const job = jobs.find((j) => j.id === t.job_id);
          return `${member?.name || ''} ${job?.name || ''} ${t.task_description || ''} ${t.notes || ''}`.toLowerCase().includes(q);
        });
        if (!hasMatch) return false;
      }
      return true;
    }).sort((a, b) => {
      const an = staff.find((s) => s.id === a.staffId)?.name || '';
      const bn = staff.find((s) => s.id === b.staffId)?.name || '';
      return an.localeCompare(bn);
    });
  }, [workTimesheets, visibleWeekStart, staffFilter, search, staff, jobs]);

  const handleBulkApprove = async () => {
    const pending = workTimesheets.filter((t) => t.status === 'submitted' && (staffFilter === 'all' || t.staff_id === staffFilter));
    if (pending.length === 0) return;
    if (!confirm(`Approve ${pending.length} submitted timesheet(s)?`)) return;
    const updates = pending.map((t) => ({ id: t.id, status: 'approved', approved_by_name: currentUser?.full_name || '' }));
    await base44.entities.Timesheet.bulkUpdate(updates);
    queryClient.invalidateQueries({ queryKey: ['timesheets'] });
  };

  return (
    <div>
      <SettingsSectionHeader icon={Clock} title="Timesheets" description="Review daily entries, approve the week, then merge & download for payroll" />

      {/* Stat boxes */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <StatBox icon={Clock} label="Pending Approval" value={pendingCount} gradient="stat-gradient-amber" />
        <StatBox icon={CheckCircle2} label="Approved Hours" value={fmtMins(approvedMins)} gradient="stat-gradient-emerald" />
        <StatBox icon={TrendingUp} label="Approved Overtime" value={fmtMins(approvedOtMins)} gradient="stat-gradient-rose" sub="across all crew" />
        <StatBox icon={FileText} label="Merged Weeks" value={mergedCount} gradient="stat-gradient-slate" />
        {approvedMeterage > 0 && (
          <StatBox icon={Ruler} label="Approved Meterage" value={`${approvedMeterage}m`} gradient="stat-gradient-violet" />
        )}
      </div>

      <WithdrawnAcknowledgementPanel timesheets={timesheets} staff={staff} jobs={jobs} currentUser={currentUser} />

      {/* Week navigator + filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4 items-stretch sm:items-center">
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2 py-1.5">
          <button onClick={() => setWeekOffset((w) => w - 1)} className="p-1 text-slate-400 hover:text-slate-700 rounded transition" title="Previous week">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 min-w-[140px] justify-center">
            <CalendarDays className="w-4 h-4 text-emerald-600" />
            {format(new Date(visibleWeekStart + 'T00:00:00'), 'dd MMM')} – {format(visibleWeekEnd, 'dd MMM yyyy')}
          </div>
          <button onClick={() => setWeekOffset((w) => w + 1)} disabled={weekOffset >= 0} className="p-1 text-slate-400 hover:text-slate-700 rounded transition disabled:opacity-30 disabled:cursor-not-allowed" title="Next week">
            <ChevronRight className="w-4 h-4" />
          </button>
          {weekOffset !== 0 && (
            <button onClick={() => setWeekOffset(0)} className="ml-1 p-1 text-slate-400 hover:text-emerald-600 rounded transition" title="Jump to this week">
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
        <select value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-sm border border-slate-200 bg-white text-slate-600 focus:outline-none focus:border-emerald-600 capitalize">
          <option value="all">All staff</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div className="relative flex-1 sm:max-w-xs sm:ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search staff, job or task..."
            className="w-full pl-9 pr-4 py-1.5 rounded-lg text-sm border border-slate-200 bg-white focus:outline-none focus:border-emerald-600" />
        </div>
      </div>

      {/* Bulk approve */}
      {pendingCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button onClick={handleBulkApprove} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition">
            <CheckCircle2 className="w-3.5 h-3.5" /> Approve all submitted ({pendingCount})
          </button>
          <span className="text-[11px] text-slate-400">Approves every submitted day across all crew for quick clearance.</span>
        </div>
      )}

      {/* Weekly cards */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <TableSkeleton rows={4} cols={6} />
        </div>
      ) : isError ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <ErrorState message="Couldn't load timesheets" onRetry={refetch} />
        </div>
      ) : weeklyGroups.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <EmptyState icon={Users} title="No timesheets this week" message="No submitted or approved timesheets for the selected week and filters. Use the arrows to check other weeks." />
        </div>
      ) : (
        <div className="space-y-4">
          {weeklyGroups.map((g) => {
            const member = staff.find((s) => s.id === g.staffId);
            return (
              <WeeklyTimesheetCard
                key={`${g.staffId}|${g.weekStart}`}
                staffMember={member}
                weekStart={g.weekStart}
                dailySummaries={g.entries}
                jobs={jobs}
                otBreakdowns={otBreakdowns[g.staffId] || {}}
                currentUser={currentUser}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}