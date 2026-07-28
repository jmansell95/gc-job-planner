import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { PoundSterling, FileText, Clock, Loader2, TrendingUp } from 'lucide-react';
import WidgetShell from '@/components/dashboard/WidgetShell';
import { useAllJobsFinancials } from '@/hooks/useAllJobsFinancials';

const fmtGbp = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 });

// Unbilled Liability (Work-in-Progress) — aggregates earned revenue on active
// jobs that hasn't yet been invoiced. Uses the shared calculateJobFinancials
// engine so figures match the job detail Financials tab exactly.
export default function UnbilledLiabilityWidget() {
  const { data: allFin, isLoading: finLoading } = useAllJobsFinancials();
  const jobs = allFin?.jobs || [];
  const finMap = allFin?.finMap || {};

  const { data: invoices = [], isLoading: invLoading } = useQuery({
    queryKey: ['wip-invoices'],
    queryFn: () => base44.entities.Invoice.list()
  });

  const isLoading = finLoading || invLoading;

  // Only active / in-progress jobs carry unbilled WIP
  const activeJobIds = new Set(jobs.filter(j => (j.status || 'planning') === 'in_progress').map(j => j.id));
  const jobMap = {}; jobs.forEach(j => { jobMap[j.id] = j; });

  // Sum invoiced (non-void) net per job
  const invoicedByJob = {};
  invoices.forEach(inv => {
    if (inv.status === 'void') return;
    invoicedByJob[inv.job_id] = (invoicedByJob[inv.job_id] || 0) + (Number(inv.net_total) || 0);
  });

  // Earned revenue per active job — from the calculateJobFinancials engine
  // (sell-side total: meterage + SOR + day rates + hire + sub-con sell), NOT
  // the buy-side cost.
  const earnedByJob = {};
  jobs.forEach(j => {
    if (!activeJobIds.has(j.id)) return;
    const fin = finMap[j.id];
    earnedByJob[j.id] = fin?.summary?.total_revenue_net || 0;
  });

  const jobRows = Object.keys(earnedByJob).map(jobId => {
    const earned = earnedByJob[jobId];
    const invoiced = invoicedByJob[jobId] || 0;
    const unbilled = Math.max(0, earned - invoiced);
    return { jobId, name: jobMap[jobId]?.name || 'Unknown', earned, invoiced, unbilled };
  }).filter(r => r.unbilled > 0).sort((a, b) => b.unbilled - a.unbilled);

  const totalUnbilled = jobRows.reduce((s, r) => s + r.unbilled, 0);
  const totalEarned = jobRows.reduce((s, r) => s + r.earned, 0);
  const totalInvoiced = jobRows.reduce((s, r) => s + r.invoiced, 0);
  const realizationPct = totalEarned > 0 ? Math.round((totalInvoiced / totalEarned) * 100) : 100;

  return (
    <WidgetShell icon={PoundSterling} title="Unbilled Work-in-Progress" subtitle="Earned revenue not yet invoiced on active jobs">
      {isLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : (
        <div className="space-y-3">
          {/* Headline figures */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-slate-50 rounded-lg p-2.5 text-center">
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Earned</p>
              <p className="text-sm font-bold text-slate-700 tabular-nums mt-0.5">{fmtGbp(totalEarned)}</p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-2.5 text-center">
              <p className="text-[10px] text-emerald-600 font-medium uppercase tracking-wide">Invoiced</p>
              <p className="text-sm font-bold text-emerald-700 tabular-nums mt-0.5">{fmtGbp(totalInvoiced)}</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-2.5 text-center">
              <p className="text-[10px] text-amber-600 font-medium uppercase tracking-wide">Unbilled</p>
              <p className="text-sm font-bold text-amber-700 tabular-nums mt-0.5">{fmtGbp(totalUnbilled)}</p>
            </div>
          </div>

          {/* Realisation bar */}
          <div className="flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all" style={{ width: `${realizationPct}%` }} />
            </div>
            <span className="text-xs font-semibold text-slate-600 tabular-nums">{realizationPct}%</span>
          </div>

          {/* Per-job unbilled breakdown */}
          {jobRows.length === 0 ? (
            <div className="text-center py-4 text-slate-400 text-sm border border-dashed border-slate-200 rounded-lg">
              All earned revenue is invoiced. No unbilled WIP.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {jobRows.slice(0, 8).map(r => (
                <div key={r.jobId} className="flex items-center justify-between gap-2 bg-white border border-slate-100 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="text-xs font-medium text-slate-700 truncate">{r.name}</span>
                  </div>
                  <span className="text-xs font-bold text-amber-700 tabular-nums flex-shrink-0">{fmtGbp(r.unbilled)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </WidgetShell>
  );
}