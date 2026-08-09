import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { PoundSterling, TrendingDown, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/StateViews';

const BUCKETS = [
  { label: '0–30 days', min: 0, max: 30, color: 'bg-emerald-500', text: 'text-emerald-600' },
  { label: '31–60 days', min: 31, max: 60, color: 'bg-blue-500', text: 'text-blue-600' },
  { label: '61–90 days', min: 61, max: 90, color: 'bg-amber-500', text: 'text-amber-600' },
  { label: '90+ days', min: 91, max: Infinity, color: 'bg-rose-500', text: 'text-rose-600' },
];

const gbp = (n) => n != null ? '£' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '£0';
const daysSince = (dateStr) => {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
};

/**
 * Aged debtors dashboard — groups all unpaid (sent + overdue) invoices into
 * aging buckets (0-30, 31-60, 61-90, 90+ days) with total outstanding per
 * bucket and per client. Highlights overdue risk for cash flow management.
 */
export default function AgedDebtorsDashboard() {
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices-outstanding'],
    queryFn: () => base44.entities.Invoice.filter({ status: { $in: ['sent', 'overdue'] } }, '-issue_date', 500),
  });

  const { bucketTotals, byClient, totalOutstanding, overdueCount } = useMemo(() => {
    const buckets = BUCKETS.map(() => 0);
    const clientMap = {};
    let total = 0;
    let overdue = 0;

    invoices.forEach(inv => {
      const days = daysSince(inv.issue_date);
      const gross = inv.gross_total || 0;
      if (!gross) return;

      total += gross;
      if (inv.status === 'overdue' || days > 30) overdue++;

      const bucketIdx = BUCKETS.findIndex(b => days >= b.min && days <= b.max);
      if (bucketIdx >= 0) buckets[bucketIdx] += gross;

      const clientId = inv.client_id || 'unknown';
      if (!clientMap[clientId]) {
        clientMap[clientId] = { name: inv.client_name || 'Unknown', total: 0, count: 0, oldest: Infinity };
      }
      clientMap[clientId].total += gross;
      clientMap[clientId].count++;
      clientMap[clientId].oldest = Math.min(clientMap[clientId].oldest, days);
    });

    const clients = Object.entries(clientMap)
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    return { bucketTotals: buckets, byClient: clients, totalOutstanding: total, overdueCount: overdue };
  }, [invoices]);

  if (isLoading) return <Skeleton className="h-72 rounded-xl" />;

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <PoundSterling className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-500 font-medium">Total Outstanding</span>
          </div>
          <p className="text-xl font-bold text-slate-900 tabular-nums">{gbp(totalOutstanding)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="w-4 h-4 text-rose-400" />
            <span className="text-xs text-slate-500 font-medium">Overdue Invoices</span>
          </div>
          <p className="text-xl font-bold text-rose-600 tabular-nums">{overdueCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 col-span-2">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-slate-500 font-medium">90+ Days at Risk</span>
          </div>
          <p className="text-xl font-bold text-rose-600 tabular-nums">{gbp(bucketTotals[3])}</p>
        </div>
      </div>

      {/* Aging buckets bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-900 mb-3">Aging Buckets</h3>
        <div className="space-y-2.5">
          {BUCKETS.map((b, i) => {
            const pct = totalOutstanding > 0 ? (bucketTotals[i] / totalOutstanding) * 100 : 0;
            return (
              <div key={b.label}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-slate-600">{b.label}</span>
                  <span className={`font-bold tabular-nums ${b.text}`}>{gbp(bucketTotals[i])}</span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className={`h-full ${b.color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top clients by outstanding */}
      {byClient.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Top Clients by Outstanding</h3>
          </div>
          <div className="divide-y divide-slate-50">
            {byClient.map(c => (
              <div key={c.id} className="px-5 py-3 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{c.name}</p>
                  <p className="text-xs text-slate-500">{c.count} invoice{c.count !== 1 ? 's' : ''} · oldest {c.oldest}d</p>
                </div>
                <p className="text-sm font-bold text-slate-900 tabular-nums flex-shrink-0">{gbp(c.total)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}