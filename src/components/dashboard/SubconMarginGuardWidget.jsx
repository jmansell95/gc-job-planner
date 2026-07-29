import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Loader2, HardHat, ArrowRight } from 'lucide-react';
import WidgetShell from '@/components/dashboard/WidgetShell';

const fmtGbp = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const LOW_MARGIN_PCT = 5;

// Subcontractor Margin Guard — surfaces subcontractor logs with zero, negative,
// or low (<5%) margins so finance can review before invoicing. Pairs with the
// checkSubconMargin backend automation that auto-recalculates and audit-logs
// at-risk entries on creation.
export default function SubconMarginGuardWidget() {
  const { data: subconLogs = [], isLoading } = useQuery({
    queryKey: ['subcon-margin-guard'],
    queryFn: () => base44.entities.SubcontractorLog.filter({ status: { $ne: 'synced' } }, '-date', 200)
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list()
  });
  const jobMap = {}; jobs.forEach(j => { jobMap[j.id] = j; });

  const atRisk = subconLogs
    .filter(l => {
      const marginNet = Number(l.margin_net) || 0;
      const marginPct = Number(l.margin_pct) || 0;
      const markup = Number(l.markup_percentage) || 0;
      return marginNet <= 0 || marginPct < LOW_MARGIN_PCT || markup === 0;
    })
    .map(l => ({
      id: l.id,
      subconName: l.subcontractor_name || 'Unknown',
      jobName: jobMap[l.job_id]?.name || '—',
      jobId: l.job_id,
      purchaseNet: Number(l.purchase_cost_net) || 0,
      clientChargeNet: Number(l.client_charge_net) || 0,
      marginNet: Number(l.margin_net) || 0,
      marginPct: Number(l.margin_pct) || 0,
      markup: Number(l.markup_percentage) || 0,
      status: l.status,
      date: l.date,
    }))
    .sort((a, b) => a.marginNet - b.marginNet);

  const totalAtRiskCost = atRisk.reduce((s, r) => s + r.purchaseNet, 0);
  const totalLostMargin = atRisk.filter(r => r.marginNet < 0).reduce((s, r) => s + Math.abs(r.marginNet), 0);

  return (
    <WidgetShell icon={AlertTriangle} title="Subcontractor Margin Guard" subtitle="Zero, negative or low-margin sub-con logs awaiting review">
      {isLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : atRisk.length === 0 ? (
        <div className="text-center py-6 text-emerald-600 text-sm border border-dashed border-emerald-200 rounded-lg bg-emerald-50/50">
          <AlertTriangle className="w-5 h-5 mx-auto mb-1.5 text-emerald-500" />
          All subcontractor logs have healthy margins (≥ {LOW_MARGIN_PCT}%).
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-red-50 rounded-lg p-2.5 text-center">
              <p className="text-[10px] text-red-600 font-medium uppercase tracking-wide">At-Risk Logs</p>
              <p className="text-sm font-bold text-red-700 tabular-nums mt-0.5">{atRisk.length}</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-2.5 text-center">
              <p className="text-[10px] text-amber-600 font-medium uppercase tracking-wide">Buy-Side Cost</p>
              <p className="text-sm font-bold text-amber-700 tabular-nums mt-0.5">{fmtGbp(totalAtRiskCost)}</p>
            </div>
          </div>

          {totalLostMargin > 0 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-xs text-red-700 font-medium">
                Negative margin exposure: <span className="font-bold tabular-nums">{fmtGbp(totalLostMargin)}</span> — these logs bill the client less than the subcontractor cost.
              </p>
            </div>
          )}

          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {atRisk.slice(0, 12).map(r => (
              <div key={r.id} className="bg-white border border-slate-100 rounded-lg px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <HardHat className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="text-xs font-semibold text-slate-800 truncate">{r.subconName}</span>
                  </div>
                  <span className={`text-xs font-bold tabular-nums flex-shrink-0 ${r.marginNet < 0 ? 'text-red-600' : 'text-amber-600'}`}>
                    {r.marginPct.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <span className="text-[11px] text-slate-400 truncate">{r.jobName}</span>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-shrink-0">
                    <span className="tabular-nums">Buy {fmtGbp(r.purchaseNet)}</span>
                    <ArrowRight className="w-2.5 h-2.5 text-slate-300" />
                    <span className="tabular-nums font-medium text-slate-700">Sell {fmtGbp(r.clientChargeNet)}</span>
                  </div>
                </div>
                {r.markup === 0 && (
                  <p className="text-[10px] text-red-500 font-medium mt-1">⚠ Zero markup — billed at cost</p>
                )}
              </div>
            ))}
            {atRisk.length > 12 && (
              <p className="text-center text-[11px] text-slate-400 py-1">+{atRisk.length - 12} more</p>
            )}
          </div>
        </div>
      )}
    </WidgetShell>
  );
}