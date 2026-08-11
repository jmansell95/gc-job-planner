import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Loader2, CheckCircle2, ShieldAlert } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import BillingReadinessGate from '@/components/BillingReadinessGate';

const REASON_REQUIRED = ['on_hold', 'cancelled'];
const GATE_STATUSES = ['decommissioning', 'completed'];

const STATUS_OPTIONS = [
  { value: 'planning', label: 'Planning', desc: 'Back to planning stage', tone: 'slate' },
  { value: 'in_progress', label: 'In Progress', desc: 'Work is actively underway', tone: 'emerald' },
  { value: 'decommissioning', label: 'Decommissioning', desc: 'Work done — collecting equipment from site', tone: 'amber' },
  { value: 'completed', label: 'Completed', desc: 'All equipment returned, job finished', tone: 'teal' },
  { value: 'on_hold', label: 'On Hold', desc: 'Temporarily paused — reason required', tone: 'amber' },
  { value: 'cancelled', label: 'Cancelled', desc: 'Job cancelled — reason required', tone: 'red' },
];

const toneCls = {
  slate: 'border-slate-300 bg-slate-50 text-slate-700',
  emerald: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  teal: 'border-teal-300 bg-teal-50 text-teal-700',
  amber: 'border-amber-300 bg-amber-50 text-amber-700',
  red: 'border-red-300 bg-red-50 text-red-700',
  orange: 'border-orange-300 bg-orange-50 text-orange-700',
};

export default function JobStatusModal({ job, onClose, onSave }) {
  const [selectedStatus, setSelectedStatus] = useState(job?.status || 'planning');
  const [reason, setReason] = useState(job?.status_reason || '');
  const [saving, setSaving] = useState(false);
  const [readiness, setReadiness] = useState(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    setSelectedStatus(job?.status || 'planning');
    setReason(job?.status_reason || '');
    setReadiness(null);
  }, [job]);

  const needsReason = REASON_REQUIRED.includes(selectedStatus);
  const isGateStatus = GATE_STATUSES.includes(selectedStatus);

  useEffect(() => {
    if (!isGateStatus || !job?.id) { setReadiness(null); return; }
    let cancelled = false;
    (async () => {
      setChecking(true);
      try {
        const res = await base44.functions.invoke('checkBillingReadiness', { job_id: job.id });
        if (!cancelled) setReadiness(res.data);
      } catch (e) {
        if (!cancelled) setReadiness({ ready: true, blockers: [], error: true });
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedStatus, job?.id, isGateStatus]);

  const hasBlockingGate = readiness?.has_blocking === true;

  const handleSave = async () => {
    if (needsReason && !reason.trim()) return;
    setSaving(true);
    try {
      await onSave({
        status: selectedStatus,
        status_reason: needsReason ? reason.trim() : '',
        status_changed_at: new Date().toISOString(),
      });
      onClose();
    } catch (e) {
      console.error('Status update error:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain p-4 bg-slate-950/60 backdrop-blur-md" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">Update Job Status</h2>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-500">Change the status of <span className="font-semibold text-slate-700">{job?.name}</span></p>

          <div className="space-y-2">
            {STATUS_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSelectedStatus(opt.value)}
                className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border-2 text-left transition ${selectedStatus === opt.value ? toneCls[opt.tone] : 'border-slate-200 bg-white hover:border-slate-300'}`}
              >
                <div className={`w-4 h-4 mt-0.5 rounded-full border-2 flex-shrink-0 ${selectedStatus === opt.value ? `border-current ${toneCls[opt.tone].split(' ').find(c => c.startsWith('bg-'))}` : 'border-slate-300'}`}>
                  {selectedStatus === opt.value && <div className={`w-2 h-2 rounded-full m-auto ${toneCls[opt.tone].split(' ').find(c => c.startsWith('bg-'))}`} />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{opt.label}</p>
                  <p className="text-xs opacity-70">{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>

          {needsReason && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <p className="text-xs font-semibold text-amber-800">Reason required</p>
              </div>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder={selectedStatus === 'cancelled' ? 'Why is this job being cancelled?' : 'Why is this job being put on hold?'}
                className="w-full px-3 py-2 text-sm border border-amber-200 rounded-lg focus:outline-none focus:border-amber-500 bg-white resize-none"
                autoFocus
              />
            </div>
          )}

          {isGateStatus && (
            <BillingReadinessGate
              checking={checking}
              readiness={readiness}
              statusLabel={STATUS_OPTIONS.find(o => o.value === selectedStatus)?.label || selectedStatus}
            />
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={saving || (needsReason && !reason.trim()) || hasBlockingGate}
              className="flex-1 px-4 py-2.5 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm font-medium flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Status
            </button>
            <button onClick={onClose} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition text-sm font-medium">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}