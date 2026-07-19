import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CheckCircle2, Clock, AlertTriangle, Users, MapPin, Send, Loader2 } from 'lucide-react';
import { resolveRole } from '@/utils/access';

const fmtTime = (iso) => iso ? format(new Date(iso), 'HH:mm') : '—';

// Daily snapshot of who has done what today — shown at the top of the
// Timesheets page. Admins see all staff; managers see only their direct
// reports (staff whose manager_id matches their own staff id).
export default function DailyStaffSummaryWidget() {
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const { data: profile } = useQuery({ queryKey: ['my-staff-profile'], queryFn: () => base44.functions.invoke('getMyStaffProfile').then(r => r.data) });
  const { data: allStaff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: assignments = [] } = useQuery({ queryKey: ['all-rota-assignments'], queryFn: () => base44.entities.RotaAssignment.list('-created_date', 500) });
  const { data: timesheets = [] } = useQuery({ queryKey: ['all-timesheets-mgr'], queryFn: () => base44.entities.Timesheet.list('-created_date', 500) });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });
  const [sending, setSending] = React.useState(false);
  const [sendResult, setSendResult] = React.useState(null);

  const role = resolveRole(profile) || 'admin';
  const isAdmin = role === 'admin';

  // Scope staff: admins see all, managers see only their reports.
  const scopedStaff = useMemo(() => {
    if (!profile) return [];
    if (isAdmin) return allStaff;
    return allStaff.filter(s => s.manager_id === profile.id);
  }, [profile, allStaff, isAdmin]);

  const rows = useMemo(() => {
    const todays = assignments.filter(a => a.assigned_date === todayStr && scopedStaff.find(s => s.id === a.staff_id));
    const byStaff = {};
    todays.forEach(a => {
      if (!byStaff[a.staff_id]) byStaff[a.staff_id] = [];
      byStaff[a.staff_id].push(a);
    });

    return scopedStaff.map(s => {
      const sAssignments = byStaff[s.id] || [];
      if (sAssignments.length === 0) return null;
      const job = jobs.find(j => j.id === sAssignments[0]?.job_id);
      // Submitted = has a summary timesheet entry submitted/approved for today
      const submittedTs = timesheets.find(t => t.staff_id === s.id && t.date === todayStr && t.is_summary && (t.status === 'submitted' || t.status === 'approved'));
      const arrived = sAssignments.some(a => a.arrived_on_site_at);
      const started = sAssignments.some(a => a.status === 'started');
      const completed = sAssignments.some(a => a.status === 'completed');
      const signedBriefing = sAssignments.some(a => a.briefing_signed);
      const earlyLeave = sAssignments.some(a => a.early_leave_reason);

      let status = 'not_started';
      if (submittedTs) status = 'submitted';
      else if (completed) status = 'in_progress';
      else if (started || (arrived && signedBriefing)) status = 'in_progress';
      else if (arrived) status = 'in_progress';
      else status = 'not_started';

      return {
        staffId: s.id,
        name: s.name,
        jobName: job?.name || '—',
        status,
        arrivedAt: sAssignments.map(a => a.arrived_on_site_at).filter(Boolean).sort()[0] || null,
        submittedAt: submittedTs?.created_date || null,
        earlyLeave,
        earlyLeaveReason: sAssignments.find(a => a.early_leave_reason)?.early_leave_reason || null,
      };
    }).filter(Boolean);
  }, [scopedStaff, assignments, timesheets, jobs, todayStr]);

  const counts = {
    submitted: rows.filter(r => r.status === 'submitted').length,
    in_progress: rows.filter(r => r.status === 'in_progress').length,
    not_started: rows.filter(r => r.status === 'not_started').length,
  };
  const total = rows.length;

  const handleSendNow = async () => {
    setSending(true); setSendResult(null);
    try {
      const res = await base44.functions.invoke('sendDailyTimesheetSummary', { manual: true });
      setSendResult({ ok: true, message: `Summary sent to ${res.data?.recipients || 0} recipient(s).` });
    } catch (e) {
      setSendResult({ ok: false, message: e.message || 'Failed to send summary.' });
    }
    setSending(false);
  };

  if (total === 0) return null;

  const statusMeta = {
    submitted: { label: 'Submitted', icon: CheckCircle2, badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
    in_progress: { label: 'In Progress', icon: Clock, badge: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
    not_started: { label: 'Not Started', icon: AlertTriangle, badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 flex-wrap">
        <Users className="w-5 h-5 text-emerald-700" />
        <h2 className="font-semibold text-slate-900">Daily Staff Summary</h2>
        <span className="text-xs text-slate-400">{format(new Date(), 'EEEE, dd MMM yyyy')}</span>
        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{total} on rota</span>
        {!isAdmin && <span className="text-xs text-slate-400">· Your team only</span>}
        <button onClick={handleSendNow} disabled={sending}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-semibold hover:bg-emerald-800 active:scale-95 transition disabled:opacity-50">
          {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          {sending ? 'Sending…' : 'Send summary email'}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-px bg-slate-100">
        <div className="bg-emerald-50 px-4 py-3">
          <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /><span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Submitted</span></div>
          <p className="text-2xl font-bold text-emerald-900 mt-1">{counts.submitted}</p>
        </div>
        <div className="bg-blue-50 px-4 py-3">
          <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-blue-600" /><span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">In Progress</span></div>
          <p className="text-2xl font-bold text-blue-900 mt-1">{counts.in_progress}</p>
        </div>
        <div className="bg-amber-50 px-4 py-3">
          <div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-600" /><span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Not Started</span></div>
          <p className="text-2xl font-bold text-amber-900 mt-1">{counts.not_started}</p>
        </div>
      </div>

      {sendResult && (
        <div className={`mx-4 mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${sendResult.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {sendResult.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />} {sendResult.message}
        </div>
      )}

      {/* Staff list */}
      <div className="divide-y divide-slate-100">
        {rows.map(r => {
          const meta = statusMeta[r.status];
          const Icon = meta.icon;
          return (
            <div key={r.staffId} className="px-4 sm:px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-slate-600 font-bold text-sm">{r.name.charAt(0)}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{r.name}</p>
                  <p className="text-xs text-slate-400 truncate flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {r.jobName}
                    {r.earlyLeave && <span className="text-amber-600 font-medium"> · left early{r.earlyLeaveReason ? ` (${r.earlyLeaveReason})` : ''}</span>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {r.arrivedAt && r.status !== 'submitted' && <span className="text-[10px] text-slate-400">Arrived {fmtTime(r.arrivedAt)}</span>}
                {r.submittedAt && <span className="text-[10px] text-emerald-600">Submitted {fmtTime(r.submittedAt)}</span>}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 ${meta.badge}`}>
                  <Icon className="w-3 h-3" /> {meta.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}