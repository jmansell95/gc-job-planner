import React, { useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import SignaturePad from '@/components/staff/SignaturePad';
import { submitSignature } from '@/utils/signatureFlow';

/**
 * Official weekly sign-off modal — the final "official" tier signature that
 * locks the week for payroll. Captures a drawn manager signature and persists
 * a Signature record at tier 'weekly_official'.
 */
export default function WeeklySignOffModal({ open, onClose, staffMember, weekStart, weeklyRecord, currentUser }) {
  const [dataUrl, setDataUrl] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleConfirm = async () => {
    if (!dataUrl) { setError('Please draw your signature first'); return; }
    setSubmitting(true);
    setError('');
    try {
      const payloadSnapshot = weeklyRecord ? {
        weekly_total_minutes: weeklyRecord.weekly_total_minutes,
        weekly_standard_minutes: weeklyRecord.weekly_standard_minutes,
        weekly_overtime_minutes: weeklyRecord.weekly_overtime_minutes,
        weekly_meterage: weeklyRecord.weekly_meterage,
      } : {};
      await submitSignature({
        dataUrl,
        tier: 'weekly_official',
        signerType: 'manager',
        context: {
          staff_id: staffMember?.id,
          staff_name: staffMember?.name,
          manager_id: currentUser?.id,
          manager_name: currentUser?.full_name,
          week_start: weekStart,
          notes: 'Official weekly sign-off for payroll',
          payload_snapshot: payloadSnapshot,
        },
      });
      setDataUrl(null);
      onClose(true);
    } catch (e) {
      setError(e.message || 'Failed to record signature');
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-slate-950/60 backdrop-blur-md p-4" onClick={() => !submitting && onClose(false)}>
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Official weekly sign-off</h3>
              <p className="text-xs text-slate-500">{staffMember?.name} · Week of {weekStart}</p>
            </div>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-600">
            By signing below you confirm the timesheet for this week is accurate and complete. This locks the week for payroll and your signature will appear on the official PDF.
          </p>
          <SignaturePad onChange={setDataUrl} />
          {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
          <div className="flex items-center gap-2 pt-2">
            <button onClick={() => onClose(false)} disabled={submitting}
              className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              Cancel
            </button>
            <button onClick={handleConfirm} disabled={submitting || !dataUrl}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-700 text-white rounded-lg text-sm font-semibold hover:bg-emerald-800 disabled:opacity-50">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Sign off
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}