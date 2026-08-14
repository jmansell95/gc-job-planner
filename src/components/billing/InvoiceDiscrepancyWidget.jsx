import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, CheckCircle2, ArrowRightLeft, RefreshCw, PoundSterling } from 'lucide-react';

export default function InvoiceDiscrepancyWidget() {
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['invoice-discrepancies'],
    queryFn: async () => {
      const res = await base44.functions.invoke('checkInvoiceDiscrepancies', { tolerance_pct: 2 });
      return res?.data ?? res;
    },
  });

  const discrepancies = data?.discrepancies || [];
  const matchedCount = data?.matched_count || 0;
  const totalVariance = data?.total_variance || 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${discrepancies.length > 0 ? 'bg-orange-50' : 'bg-emerald-50'}`}>
            <ArrowRightLeft className={`w-4 h-4 ${discrepancies.length > 0 ? 'text-orange-600' : 'text-emerald-600'}`} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Invoice Discrepancy Check</h3>
            <p className="text-[11px] text-slate-400">PO vs supplier invoice three-way match</p>
          </div>
        </div>
        <button onClick={() => refetch()} disabled={isFetching}
          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {isLoading ? (
        <div className="px-4 pb-4 text-center text-xs text-slate-400">Checking invoice matches…</div>
      ) : discrepancies.length === 0 ? (
        <div className="px-4 pb-4 flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 rounded-lg p-2.5 mx-4 mb-4">
          <CheckCircle2 className="w-4 h-4" />
          <span>All {matchedCount} invoice(s) match PO totals within 2% tolerance.</span>
        </div>
      ) : (
        <div className="px-4 pb-4">
          {/* Summary strip */}
          <div className="flex items-center gap-3 mb-3 text-xs flex-wrap gap-y-2">
            <span className="flex items-center gap-1.5 text-orange-700 font-bold">
              <AlertTriangle className="w-3.5 h-3.5" />
              {discrepancies.length} discrepancy{discrepancies.length !== 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1.5 text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {matchedCount} matched
            </span>
            <span className="flex items-center gap-1.5 text-slate-500 sm:ml-auto">
              <PoundSterling className="w-3.5 h-3.5" />
              Net variance: <strong className={totalVariance >= 0 ? 'text-orange-600' : 'text-emerald-600'}>
                £{Math.abs(totalVariance).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
              </strong>
            </span>
          </div>

          {/* Discrepancy list */}
          <div className="space-y-1.5">
            {discrepancies.slice(0, 6).map(d => (
              <div key={d.po_id} className="flex items-center gap-2 bg-orange-50/50 border border-orange-100 rounded-lg p-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-bold text-slate-700">{d.po_number}</span>
                    <span className="text-[10px] text-slate-400 truncate">{d.supplier_name}</span>
                  </div>
                  {d.job_name && <p className="text-[10px] text-slate-400 truncate">{d.job_name}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] text-slate-400">PO £{d.po_total.toLocaleString('en-GB', { minimumFractionDigits: 0 })}</p>
                  <p className="text-[10px] text-slate-600">Inv £{d.invoice_amount.toLocaleString('en-GB', { minimumFractionDigits: 0 })}</p>
                </div>
                <div className={`text-right flex-shrink-0 w-16 ${d.variance > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>
                  <p className="text-[11px] font-bold">
                    {d.variance > 0 ? '+' : ''}£{Math.abs(d.variance).toLocaleString('en-GB', { minimumFractionDigits: 0 })}
                  </p>
                  <p className="text-[9px] text-slate-400">{d.variance_pct}%</p>
                </div>
              </div>
            ))}
            {discrepancies.length > 6 && (
              <p className="text-[10px] text-slate-400 text-center pt-1">+{discrepancies.length - 6} more discrepancies</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}