import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, CheckCircle2, XCircle, Ruler, PoundSterling, TrendingUp, Users, Search, CalendarDays, FileText } from 'lucide-react';
import { format } from 'date-fns';
import PageHeader from '@/components/PageHeader';
import TodayTimeBoard from '@/components/TodayTimeBoard';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/StateViews';
import { computeStaffOvertime, buildRateMap } from '@/utils/overtime';

const statusConfig = {
  draft: { label: 'Draft', badge: 'bg-slate-100 text-slate-600' },
  submitted: { label: 'Submitted', badge: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Approved', badge: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rejected', badge: 'bg-red-100 text-red-700' },
  deleted: { label: 'Withdrawn', badge: 'bg-slate-200 text-slate-500 line-through' }
};

const minsOf = (t) => Number(t?.task_duration_minutes) || (t?.total_hours ? t.total_hours * 60 : 0);
const fmtMins = (m) => {
  const mm = Math.round(Number(m) || 0);
  const h = Math.floor(mm / 60), r = mm % 60;
  if (h && r) return `${h}h ${r}m`;
  if (h) return `${h}h`;
  return mm > 0 ? `${r}m` : '—';
};
const fmtCost = (n) => '£' + (Math.round((n || 0) * 100) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 });
const meterageOf = (t) => Number(t?.meterage) || 0;

function StatBox({ icon: Icon, label, value, accent, sub }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${accent}`}><Icon className="w-4 h-4" /></div>
        <p className="text-xs text-slate-500 font-medium">{label}</p>
      </div>
      <p className="text-2xl font-bold text-slate-900 mt-2">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function TimesheetManager() {
  const [statusFilter, setStatusFilter] = useState('submitted');
  const [staffFilter, setStaffFilter] = useState('all');
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data: timesheets = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['timesheets'],
    queryFn: () => base44.entities.Timesheet.list('-created_date', 200)
  });
  const workTimesheets = timesheets.filter(t => !t.is_break);
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: overtimeRates = [] } = useQuery({ queryKey: ['overtime-rates'], queryFn: () => base44.entities.OvertimeRate.list() });
  const { data: overtimeSetting } = useQuery({
    queryKey: ['overtime-setting'],
    queryFn: async () => { const list = await base44.entities.OvertimeSetting.list(); return list[0] || null; }
  });

  const otRateMap = buildRateMap(overtimeRates);
  const otThreshold = overtimeSetting?.weekly_threshold_hours ?? 40;
  const otBreakdowns = {};
  staff.forEach(s => {
    const entries = timesheets.filter(t => t.staff_id === s.id && (t.status === 'submitted' || t.status === 'approved'));
    const hourlyRate = s.day_rate ? s.day_rate / 8 : 0;
    otBreakdowns[s.id] = computeStaffOvertime(entries, otRateMap, otThreshold, hourlyRate);
  });

  const approved = workTimesheets.filter(t => t.status === 'approved');
  const approvedMins = approved.reduce((s, t) => s + minsOf(t), 0);
  const approvedOtMins = approved.reduce((s, t) => s + (otBreakdowns[t.staff_id]?.[t.id]?.otMins || 0), 0);
  const approvedCost = approved.reduce((s, t) => s + (otBreakdowns[t.staff_id]?.[t.id]?.cost || 0), 0);
  const approvedMeterage = approved.reduce((s, t) => s + meterageOf(t), 0);
  const pendingCount = workTimesheets.filter(t => t.status === 'submitted').length;

  // Per-staff summary (approved)
  const staffSummary = staff.map(s => {
    const entries = approved.filter(t => t.staff_id === s.id);
    if (entries.length === 0) return null;
    let stdMins = 0, otMins = 0, cost = 0;
    entries.forEach(t => {
      const b = otBreakdowns[s.id]?.[t.id] || {};
      stdMins += b.regularMins || 0;
      otMins += b.otMins || 0;
      cost += b.cost || 0;
    });
    return { id: s.id, name: s.name, role: s.job_role, shifts: entries.length, stdMins, otMins, cost, meterage: entries.reduce((x, t) => x + meterageOf(t), 0) };
  }).filter(Boolean).sort((a, b) => b.cost - a.cost);

  const filtered = workTimesheets.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (staffFilter !== 'all' && t.staff_id !== staffFilter) return false;
    if (search.trim()) {
      const member = staff.find(s => s.id === t.staff_id);
      const job = jobs.find(j => j.id === t.job_id);
      const q = search.toLowerCase();
      if (!(`${member?.name || ''} ${job?.name || ''} ${t.task_description || ''} ${t.notes || ''}`.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const handleApprove = async (id) => {
    await base44.entities.Timesheet.update(id, { status: 'approved' });
    queryClient.invalidateQueries({ queryKey: ['timesheets'] });
  };
  const handleReject = async (id) => {
    await base44.entities.Timesheet.update(id, { status: 'rejected' });
    queryClient.invalidateQueries({ queryKey: ['timesheets'] });
  };

  return (
    <div>
      <PageHeader title="Timesheets" icon={Clock} />

      <TodayTimeBoard />

      {/* Stat boxes */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <StatBox icon={Clock} label="Pending Approval" value={pendingCount} accent="bg-amber-100 text-amber-700" />
        <StatBox icon={CheckCircle2} label="Approved Hours" value={fmtMins(approvedMins)} accent="bg-emerald-100 text-emerald-700" />
        <StatBox icon={TrendingUp} label="Approved Overtime" value={fmtMins(approvedOtMins)} accent="bg-orange-100 text-orange-700" sub="across all staff" />
        <StatBox icon={PoundSterling} label="Approved Cost" value={fmtCost(approvedCost)} accent="bg-blue-100 text-blue-700" sub="incl. overtime" />
        <StatBox icon={FileText} label="Total Timesheets" value={workTimesheets.length} accent="bg-slate-100 text-slate-600" />
        {approvedMeterage > 0 && (
          <StatBox icon={Ruler} label="Approved Meterage" value={`${approvedMeterage}m`} accent="bg-purple-100 text-purple-700" />
        )}
      </div>

      {/* Per-staff summary */}
      {staffSummary.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-700" />
            <h2 className="font-semibold text-slate-900">Approved by person</h2>
            <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{staffSummary.length} staff</span>
          </div>
          <div className="divide-y divide-slate-100">
            {staffSummary.map(p => (
              <div key={p.id} className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-700 font-bold text-sm">{p.name.charAt(0)}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{p.name}</p>
                    <p className="text-xs text-slate-400 capitalize">{p.role?.replace(/_/g, ' ')} · {p.shifts} {p.shifts === 1 ? 'entry' : 'entries'}{p.meterage > 0 && ` · ${p.meterage}m`}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm flex-shrink-0">
                  <div className="text-right"><p className="text-[10px] text-slate-400 uppercase">Standard</p><p className="font-semibold text-slate-900">{fmtMins(p.stdMins)}</p></div>
                  <div className="text-right"><p className="text-[10px] text-slate-400 uppercase">Overtime</p><p className={`font-semibold ${p.otMins > 0 ? 'text-amber-600' : 'text-slate-300'}`}>{fmtMins(p.otMins)}</p></div>
                  <div className="text-right"><p className="text-[10px] text-slate-400 uppercase">Cost</p><p className="font-semibold text-emerald-700">{fmtCost(p.cost)}</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="flex gap-2 flex-wrap">
          {['submitted', 'approved', 'rejected', 'deleted', 'all'].map(f => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition capitalize ${statusFilter === f ? 'bg-emerald-700 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {f}
            </button>
          ))}
        </div>
        <select value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-sm border border-slate-200 bg-white text-slate-600 focus:outline-none focus:border-emerald-600 capitalize">
          <option value="all">All staff</option>
          {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div className="relative flex-1 sm:max-w-xs sm:ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search staff, job or task..."
            className="w-full pl-9 pr-4 py-1.5 rounded-lg text-sm border border-slate-200 bg-white focus:outline-none focus:border-emerald-600" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={5} cols={8} />
        ) : isError ? (
          <ErrorState message="Couldn't load timesheets" onRetry={refetch} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Clock} title="No timesheets found" message={statusFilter === 'all' ? 'Timesheets will appear here once staff submit them.' : `No ${statusFilter} timesheets${staffFilter !== 'all' ? ' for this staff member' : ''}.`} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Staff</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Job</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Task</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">Hours</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">Overtime</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Cost</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(ts => {
                  const member = staff.find(s => s.id === ts.staff_id);
                  const job = jobs.find(j => j.id === ts.job_id);
                  const status = statusConfig[ts.status] || statusConfig.draft;
                  const mins = minsOf(ts);
                  const b = otBreakdowns[ts.staff_id]?.[ts.id] || {};
                  const cost = b.cost != null ? b.cost : 0;
                  const mtr = meterageOf(ts);
                  return (
                    <tr key={ts.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-sm font-medium text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-emerald-700 font-bold text-[10px]">{(member?.name || '?').charAt(0)}</span>
                          </div>
                          <span className="truncate max-w-[120px]">{member?.name || 'Unknown'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 truncate max-w-[160px]">{job?.name || '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                          <span>{format(new Date(ts.date + 'T00:00:00'), 'dd MMM')}</span>
                        </div>
                        <span className="text-[10px] text-slate-400">{format(new Date(ts.date + 'T00:00:00'), 'EEE')}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 max-w-[220px]">
                        <p className="truncate">{ts.task_description || <span className="text-slate-400 italic">{ts.start_time ? `${ts.start_time}–${ts.end_time}` : '—'}</span>}</p>
                        {ts.notes && <p className="text-xs text-slate-400 truncate">· {ts.notes}</p>}
                        {ts.status === 'deleted' && ts.deletion_reason && <p className="text-xs text-red-500 truncate mt-0.5">⊘ {ts.deletion_reason}</p>}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-slate-900 text-center whitespace-nowrap">
                        {mtr > 0
                          ? <span className="inline-flex items-center gap-1 text-amber-600"><Ruler className="w-3.5 h-3.5" />{mtr}m</span>
                          : fmtMins(mins)}
                      </td>
                      <td className="px-4 py-3 text-sm text-center whitespace-nowrap">
                        {b.isOvertime
                          ? <span className="inline-flex items-center gap-1 text-amber-600 font-medium"><TrendingUp className="w-3 h-3" />{fmtMins(b.otMins)} <span className="text-[10px]">×{b.multiplier}</span></span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right whitespace-nowrap">
                        {member?.day_rate ? fmtCost(cost) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.badge}`}>{status.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {ts.status === 'submitted' && (
                            <>
                              <button onClick={() => handleApprove(ts.id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition" title="Approve">
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleReject(ts.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition" title="Reject">
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}