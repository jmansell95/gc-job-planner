import React from 'react';
import { Lock, FileText, Archive, CheckCircle2, Unlock, ShieldAlert } from 'lucide-react';

/**
 * Banner shown above cost-editing UIs when the job's billing is frozen.
 * Two lock reasons:
 *   - 'invoices' / 'both': one or more invoices have been issued
 *   - 'status': the job is decommissioning or completed
 *
 * Admins can "temp open" the lock to make late billing adjustments without
 * voiding the invoice. The toggle is passed down from the parent so the
 * override state is shared with the editing UIs that consume useBillingLock.
 */
export default function BillingLockBanner({ lockedInvoices, lockReason, job, tempOpen, onTempOpen }) {
  const hasInvoices = lockReason === 'invoices' || lockReason === 'both';
  const isStatusLock = lockReason === 'status' || lockReason === 'both';

  if (!hasInvoices && !isStatusLock) return null;

  // Temp-open active — show the "open" confirmation banner instead of the lock.
  if (tempOpen) {
    return (
      <div className="rounded-xl border-2 border-emerald-400 bg-emerald-50/70 px-4 py-3 mb-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <Unlock className="w-5 h-5 text-emerald-700" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-bold text-emerald-900">Billing Temporarily Opened</h4>
          <p className="text-xs text-emerald-800 mt-0.5">
            You can now edit cost items, subcontractor logs and timesheets. The lock will reinstate when you leave this page — re-lock now if you're done.
          </p>
        </div>
        {onTempOpen && (
          <button
            onClick={() => onTempOpen(false)}
            className="px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-white border border-emerald-300 rounded-lg hover:bg-emerald-100 transition flex-shrink-0"
          >
            Re-lock
          </button>
        )}
      </div>
    );
  }

  // Status-only lock (no invoices yet)
  if (isStatusLock && !hasInvoices) {
    const isCompleted = job?.status === 'completed';
    const Icon = isCompleted ? CheckCircle2 : Archive;
    return (
      <div className="rounded-xl border-2 border-orange-300 bg-orange-50/60 px-4 py-3 mb-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-orange-600" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-bold text-orange-900">
            {isCompleted ? 'Billing Locked — Job Completed' : 'Billing Locked — Decommissioning'}
          </h4>
          <p className="text-xs text-orange-700 mt-0.5">
            {isCompleted
              ? "This job is completed. New cost items, subcontractor logs, and timesheets can't be added. Reactivate the job if late costs need recording."
              : "This job is being decommissioned — new billable items are frozen while equipment is collected. Finish or cancel the decommissioning to unlock."}
          </p>
        </div>
        {onTempOpen && (
          <button
            onClick={() => onTempOpen(true)}
            className="px-3 py-1.5 text-xs font-semibold text-orange-800 bg-white border border-orange-300 rounded-lg hover:bg-orange-100 transition flex items-center gap-1.5 flex-shrink-0"
          >
            <Unlock className="w-3.5 h-3.5" /> Temp open
          </button>
        )}
        <Lock className="w-4 h-4 text-orange-400 flex-shrink-0 mt-1" />
      </div>
    );
  }

  // Invoice-based lock (with optional status lock too)
  const totalGross = lockedInvoices.reduce((s, i) => s + (Number(i.gross_total) || 0), 0);

  return (
    <div className="rounded-xl border-2 border-indigo-300 bg-indigo-50/60 px-4 py-3 mb-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
        <Lock className="w-5 h-5 text-indigo-600" />
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="text-sm font-bold text-indigo-900">Billing Locked — {lockedInvoices.length} invoice{lockedInvoices.length === 1 ? '' : 's'} issued{isStatusLock ? ' · job finalised' : ''}</h4>
        <p className="text-xs text-indigo-700 mt-0.5">
          This job's cost data is frozen. {lockedInvoices.map((i) => i.invoice_number).join(', ')} ({totalGross > 0 ? '£' + totalGross.toLocaleString('en-GB', { minimumFractionDigits: 2 }) : ''} gross) — editing cost items or subcontractor logs now would desync the invoice from its source data. Void the invoice first if changes are needed.
        </p>
        {onTempOpen && (
          <button
            onClick={() => { if (confirm('Temporarily open billing for this job?\n\nYou will be able to edit cost items without voiding the invoice. The lock reinstates when you leave this page.')) onTempOpen(true); }}
            className="mt-2 px-3 py-1.5 text-xs font-semibold text-indigo-800 bg-white border border-indigo-300 rounded-lg hover:bg-indigo-100 transition inline-flex items-center gap-1.5"
          >
            <ShieldAlert className="w-3.5 h-3.5" /> Temp open for late adjustments
          </button>
        )}
      </div>
      <FileText className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-1" />
    </div>
  );
}