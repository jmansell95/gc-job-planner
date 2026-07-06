import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, CheckCircle2, XCircle, TrendingUp, ClipboardCheck, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import { computeStaffOvertime, buildRateMap, entryMinutes } from '@/utils/overtime';

const fmtDur = (mins) => {
  const m = Math.round(Number(mins) || 0);
  const h = Math.floor(m / 60), r = m % 60;
  if (h && r) return `${h}h ${r}m`;
  if (h) return `${h}h`;
  return m > 0 ? `${r}m` : '—';
};
const fmtCost = (n) => '£' + (Math.round((n || 0) * 100) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 });

export default function ManagerTimesheetApprovals({ staffId }) {
  const queryClient = useQueryClient();

  const { data: allStaff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: timesheets = [] } = useQuery({ queryKey: ['all-timesheets-mgr'], queryFn: () => base44.entities.Timesheet.list('-created_date', 500) });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: allAssignments = [] } = useQuery({ queryKey: ['all-assignments-mgr'], queryFn: () => base44.entities.RotaAssignment.list('-created_date', 500) });
  const { data: overtimeRates = [] } = useQuery({ queryKey: ['overtime-rates'], queryFn: () => base44.entities.OvertimeRate.list() });
  const { data: overtimeSetting } = useQuery({
    queryKey: ['overtime-setting'],
    queryFn: async () => { const l = await base44.entities.OvertimeSetting.list(); return l[0] || null; }
  });

  const reporters = allStaff.filter(s => s.manager_id === staffId);
  const reporterIds = reporters.map(s => s.id);
  const pending = timesheets.filter(t => reporterIds.includes(t.staff_id) && t.status === 'submitted');

  if (reporters.length === 0) return null;

  const rateMap = buildRateMap(overtimeRates);
  const threshold = overtimeSetting?.weekly_threshold_hours ?? 40;
  const breakdowns = {};
  reporters.forEach(s => {
    const entries = timesheets.filter(t => t.staff_id === s.id && (t.status === 'submitted' || t.status === 'approved'));
    const hourlyRate = s.day_rate ? s.day_rate / 8 : 0;
    breakdowns[s.id] = computeStaffOvertime(entries, rateMap, threshold, hourlyRate);
  });

  const handleApprove = async (id) => {
    await base44.entities.Timesheet.update(id, { status: 'approved' });
    queryClient.invalidateQueries({ queryKey: ['all-timesheets-mgr'] });
    queryClient.invalidateQueries({ queryKey: ['timesheets'] });
  };
  const handleReject = async (id) => {
    await base44.entities.Timesheet.update(id, { status: 'rejected' });
    queryClient.invalidateQueries({ queryKey: ['all-timesheets-mgr'] });
    queryClient.invalidateQueries({ queryKey: ['timesheets'] });
  };

  return (
    <div className="bg-white rounded-lg p-4 md:p-6 border border-amber-200 shadow-sm mb-6 md:mb-8">
      <div className="flex items-center gap-2 mb-4">
        <ClipboardCheck className="w-5 h-5 text-amber-600" />
        <h2 className="text-lg font-bold text-slate-900">Timesheet Approvals</h2>
        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{pending.length} pending</span>
      </div>

      {pending.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">No timesheets pending your approval right now.</p>
      ) : (
        <div className="space-y-3">
          {pending.map(t => {
            const member = allStaff.find(s => s.id === t.staff_id);
            const job = jobs.find(j => j.id === t.job_id);
            const b = breakdowns[t.staff_id]?.[t.id] || {};
            const mins = entryMinutes(t);
            return (
              <div key={t.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm text-slate-900 truncate">{member?.name || 'Unknown'}</p>
                      <span className="text-[10px] text-slate-400">{format(new Date(t.date + 'T00:00:00'), 'dd MMM yyyy')}</span>
                    </div>
                    <p className="text-sm text-slate-700 mt-0.5 truncate">{job?.name || '—'} · {t.task_description}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                      <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{fmtDur(mins)}</span>
                      {b.isOvertime && <span className="inline-flex items-center gap-1 text-amber-600 font-medium"><TrendingUp className="w-3 h-3" />OT {fmtDur(b.otMins)} ×{b.multiplier}</span>}
                      {(() => { const ra = allAssignments.find(a => a.staff_id === t.staff_id && a.job_id === t.job_id && a.assigned_date === t.date); return ra?.briefing_signed ? <span className="inline-flex items-center gap-1 text-emerald-600 font-medium"><ShieldCheck className="w-3 h-3" />Briefing {ra.briefing_signed_at ? format(new Date(ra.briefing_signed_at), 'HH:mm') : ''}</span> : null; })()}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => handleApprove(t.id)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition" title="Approve"><CheckCircle2 className="w-5 h-5" /></button>
                    <button onClick={() => handleReject(t.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition" title="Reject"><XCircle className="w-5 h-5" /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}