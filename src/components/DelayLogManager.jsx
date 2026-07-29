import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, AlertTriangle, CheckCircle2, XCircle, Loader2, Plus, CalendarClock, Sparkles, HardHat } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import DelayLogForm from '@/components/DelayLogForm';

const DELAY_LABELS = {
  ground_conditions: 'Ground Conditions', utility_clash: 'Utility Clash', weather: 'Weather',
  mechanical_failure: 'Mechanical Failure', access_issue: 'Access Issue', client_request: 'Client Request',
  third_party: 'Third Party', other: 'Other',
};

const STATUS_STYLE = {
  pending: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pending' },
  approved: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Approved' },
  rejected: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected' },
};

// Per-job delay log viewer + approver. Shown on the job Schedule tab so managers
// can see pending delays, approve them (which auto-shifts the rota via the
// approveDelayLog backend function), or reject. Also lets a manager log a delay
// taken over the phone.
export default function DelayLogManager({ job }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [scanning, setScanning] = useState(false);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['job-delay-logs', job.id],
    queryFn: () => base44.entities.JobDelayLog.filter({ job_id: job.id }),
  });

  const { data: profile } = useQuery({
    queryKey: ['my-staff-profile'],
    queryFn: async () => { const res = await base44.functions.invoke('getMyStaffProfile'); return res.data; },
  });

  const sorted = [...logs].sort((a, b) => (b.reported_at || '').localeCompare(a.reported_at || ''));
  const pending = sorted.filter(l => (l.manager_review_status || 'pending') === 'pending');
  const resolved = sorted.filter(l => l.manager_review_status !== 'pending');

  const totalApprovedDays = logs
    .filter(l => l.manager_review_status === 'approved')
    .reduce((s, l) => s + (Number(l.impacted_days) || 0), 0);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['job-delay-logs', job.id] });
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
    queryClient.invalidateQueries({ queryKey: ['rotas-for-job', job.id] });
    queryClient.invalidateQueries({ queryKey: ['job-rotas', job.id] });
  };

  const approve = async (log) => {
    setBusyId(log.id);
    try {
      const res = await base44.functions.invoke('approveDelayLog', { delay_log_id: log.id, action: 'approve' });
      const d = res.data || {};
      toast({
        title: 'Delay approved — rota shifted',
        description: d.shifted ? `${d.shifted} future shift(s) moved by ${d.days} working day(s).` : 'Logged (no day impact).',
      });
      invalidate();
    } catch (e) {
      toast({ title: e?.response?.data?.error || 'Could not approve', variant: 'destructive' });
    }
    setBusyId(null);
  };

  const reject = async (log) => {
    setBusyId(log.id);
    try {
      await base44.entities.JobDelayLog.update(log.id, {
        manager_review_status: 'rejected',
        manager_reviewed_by: profile?.name || '',
        manager_reviewed_at: new Date().toISOString(),
      });
      toast({ title: 'Delay rejected' });
      invalidate();
    } catch (e) {
      toast({ title: 'Could not reject', variant: 'destructive' });
    }
    setBusyId(null);
  };

  const scanRemarks = async () => {
    setScanning(true);
    try {
      const res = await base44.functions.invoke('generateDelayLogFromRemarks', { job_id: job.id, job_name: job.name });
      const d = res.data || res;
      toast({
        title: d.created > 0 ? `${d.created} delay(s) auto-logged` : 'Scan complete',
        description: d.message || `Scanned ${d.scanned || 0} remark(s).`,
      });
      invalidate();
    } catch (e) {
      toast({ title: e?.response?.data?.error || 'Scan failed', variant: 'destructive' });
    }
    setScanning(false);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0"><AlertTriangle className="w-4 h-4 text-amber-600" /></div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 text-sm">Site Delays</h3>
          <p className="text-xs text-slate-400">
            {pending.length} pending{totalApprovedDays > 0 ? ` · ${totalApprovedDays} day(s) added to schedule` : ''}
          </p>
        </div>
        <button onClick={scanRemarks} disabled={scanning}
          className="inline-flex items-center gap-1 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-semibold hover:bg-violet-700 transition disabled:opacity-50">
          {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {scanning ? 'Scanning…' : 'Scan remarks'}
        </button>
        <button onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 transition">
          <Plus className="w-3.5 h-3.5" /> Log Delay
        </button>
      </div>

      {isLoading ? (
        <div className="p-6 text-center"><Loader2 className="w-5 h-5 animate-spin text-slate-300 mx-auto" /></div>
      ) : sorted.length === 0 ? (
        <div className="p-6 text-center">
          <Clock className="w-8 h-8 text-slate-200 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No delays logged for this job.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {pending.map(log => (
            <DelayRow key={log.id} log={log} onApprove={() => approve(log)} onReject={() => reject(log)} busy={busyId === log.id} />
          ))}
          {resolved.map(log => <DelayRow key={log.id} log={log} />)}
        </div>
      )}

      <DelayLogForm
        open={showForm}
        onOpenChange={setShowForm}
        jobId={job.id}
        jobName={job.name}
        staffId={profile?.id || ''}
        staffName={profile?.name || ''}
        onSaved={invalidate}
      />
    </div>
  );
}

function DelayRow({ log, onApprove, onReject, busy }) {
  const st = STATUS_STYLE[log.manager_review_status || 'pending'];
  const impact = [];
  if (Number(log.impacted_days) > 0) impact.push(`${log.impacted_days} day${log.impacted_days !== 1 ? 's' : ''}`);
  if (Number(log.impacted_hours) > 0) impact.push(`${log.impacted_hours}h`);
  const impactStr = impact.join(' + ') || '—';

  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${st.bg} ${st.text}`}>{st.label}</span>
            {log.reported_by_role === 'subcontractor' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-700 font-semibold inline-flex items-center gap-0.5">
                <HardHat className="w-2.5 h-2.5" /> Sub-con
              </span>
            )}
            <span className="text-xs font-semibold text-slate-800">{DELAY_LABELS[log.delay_type] || log.delay_type}</span>
            {log.rota_adjusted && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium inline-flex items-center gap-0.5">
                <CalendarClock className="w-2.5 h-2.5" /> Rota shifted
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 mt-1">{log.description}</p>
          <p className="text-[10px] text-slate-400 mt-1">
            {log.reported_at ? format(new Date(log.reported_at), 'dd MMM yyyy HH:mm') : ''}
            {' · '}by {log.reported_by_role === 'subcontractor' ? (log.subcontractor_name || 'Sub-contractor') : (log.staff_name || 'Staff')}
            {' · '}Impact: <b className="text-amber-700">+{impactStr}</b>
          </p>
        </div>
        {(log.manager_review_status || 'pending') === 'pending' && onApprove && (
          <div className="flex gap-1.5 flex-shrink-0">
            <button onClick={onApprove} disabled={busy}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-[11px] font-semibold hover:bg-emerald-700 transition disabled:opacity-50">
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />} Approve
            </button>
            <button onClick={onReject} disabled={busy}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-[11px] font-semibold hover:bg-slate-50 transition disabled:opacity-50">
              <XCircle className="w-3 h-3" /> Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
}