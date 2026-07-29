import React from 'react';
import { Lock, FileText } from 'lucide-react';

/**
 * Banner shown above cost-editing UIs when the job has issued invoices.
 * Warns the user that cost data is frozen and edits would desync the
 * invoice from the underlying records.
 */
export default function BillingLockBanner({ lockedInvoices }) {
  if (!lockedInvoices || lockedInvoices.length === 0) return null;

  const totalGross = lockedInvoices.reduce((s, i) => s + (Number(i.gross_total) || 0), 0);

  return (
    <div className="rounded-xl border-2 border-indigo-300 bg-indigo-50/60 px-4 py-3 mb-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
        <Lock className="w-5 h-5 text-indigo-600" />
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="text-sm font-bold text-indigo-900">Billing Locked — {lockedInvoices.length} invoice{lockedInvoices.length === 1 ? '' : 's'} issued</h4>
        <p className="text-xs text-indigo-700 mt-0.5">
          This job's cost data is frozen. {lockedInvoices.map((i) => i.invoice_number).join(', ')} ({totalGross > 0 ? '£' + totalGross.toLocaleString('en-GB', { minimumFractionDigits: 2 }) : ''} gross) — editing cost items or sub-contractor logs now would desync the invoice from its source data. Void the invoice first if changes are needed.
        </p>
      </div>
      <FileText className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-1" />
    </div>
  );
}