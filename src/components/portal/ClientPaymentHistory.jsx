import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, Clock, AlertCircle, Download, PoundSterling } from 'lucide-react';
import { Skeleton } from '@/components/StateViews';

const gbp = (n) => n != null ? '£' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '£0.00';

const STATUS_CONFIG = {
  paid: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Paid' },
  sent: { icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Awaiting Payment' },
  overdue: { icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50', label: 'Overdue' },
  draft: { icon: Clock, color: 'text-slate-500', bg: 'bg-slate-50', label: 'Draft' },
  void: { icon: AlertCircle, color: 'text-slate-400', bg: 'bg-slate-50', label: 'Void' },
};

/**
 * Client-facing payment history — shows all invoices for the client's jobs
 * with status, amounts, and download links. Lets clients see their full
 * payment history and outstanding balance at a glance.
 */
export default function ClientPaymentHistory({ clientId }) {
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['client-invoices', clientId],
    queryFn: () => base44.entities.Invoice.filter({ client_id: clientId }, '-issue_date', 200),
    enabled: !!clientId,
  });

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />;

  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.gross_total || 0), 0);
  const totalOutstanding = invoices.filter(i => ['sent', 'overdue'].includes(i.status)).reduce((s, i) => s + (i.gross_total || 0), 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <PoundSterling className="w-4 h-4 text-emerald-500" />
            <span className="text-xs text-emerald-700 font-medium">Total Paid</span>
          </div>
          <p className="text-xl font-bold text-emerald-700 tabular-nums">{gbp(totalPaid)}</p>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-amber-500" />
            <span className="text-xs text-amber-700 font-medium">Outstanding</span>
          </div>
          <p className="text-xl font-bold text-amber-700 tabular-nums">{gbp(totalOutstanding)}</p>
        </div>
      </div>

      {/* Invoice list */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">Invoice History</h3>
        </div>
        {invoices.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-400">
            <PoundSterling className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            No invoices yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {invoices.map(inv => {
              const s = STATUS_CONFIG[inv.status] || STATUS_CONFIG.draft;
              const Icon = s.icon;
              return (
                <div key={inv.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{inv.invoice_number}</span>
                      <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${s.bg} ${s.color} font-medium`}>
                        <Icon className="w-2.5 h-2.5" />
                        {s.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {inv.job_name || 'Job'} · {inv.issue_date ? new Date(inv.issue_date).toLocaleDateString('en-GB') : '—'}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-slate-900 tabular-nums">{gbp(inv.gross_total)}</p>
                    {inv.status === 'paid' && inv.paid_at && (
                      <p className="text-[10px] text-emerald-500">Paid {new Date(inv.paid_at).toLocaleDateString('en-GB')}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}