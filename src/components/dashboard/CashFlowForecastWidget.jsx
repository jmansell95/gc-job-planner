import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { PoundSterling, TrendingUp, Clock, AlertCircle } from 'lucide-react';
import WidgetShell from '@/components/dashboard/WidgetShell';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';

/**
 * Phase 4 — Financials: Cash Flow Forecast widget.
 *
 * Projects cash inflow from outstanding invoices (by due date) and
 * retention release eligibility over the next 12 weeks. Gives finance
 * a forward-looking view of expected money in.
 */
export default function CashFlowForecastWidget() {
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['cashflow-invoices'],
    queryFn: () => base44.entities.Invoice.filter({ status: { $in: ['sent', 'overdue'] } }, 'due_date', 100),
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['cashflow-contracts'],
    queryFn: () => base44.entities.JobBillingContract.filter({ retention_status: { $in: ['holding', 'release_eligible'] } }, '-created_date', 50),
  });

  const forecast = useMemo(() => {
    const weeks = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const weekStart = new Date(now.getTime() + i * 7 * 86400000);
      const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);
      const label = weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

      let invoiceTotal = 0;
      for (const inv of invoices) {
        if (!inv.due_date || !inv.gross_total) continue;
        const due = new Date(inv.due_date);
        if (due >= weekStart && due < weekEnd) invoiceTotal += inv.gross_total;
      }

      let retentionTotal = 0;
      for (const c of contracts) {
        if (c.retention_status === 'release_eligible' && c.total_retention_held) {
          retentionTotal += c.total_retention_held;
        }
      }

      weeks.push({
        label,
        invoices: Math.round(invoiceTotal),
        retention: i === 0 ? Math.round(retentionTotal) : 0,
        total: Math.round(invoiceTotal + (i === 0 ? retentionTotal : 0)),
      });
    }
    return weeks;
  }, [invoices, contracts]);

  const totalOutstanding = invoices.reduce((sum, inv) => sum + (inv.gross_total || 0), 0);
  const totalRetention = contracts.reduce((sum, c) => sum + (c.total_retention_held || 0), 0);
  const overdueCount = invoices.filter(i => i.status === 'overdue').length;

  return (
    <WidgetShell icon={PoundSterling} title="Cash Flow Forecast" subtitle="12-week projected inflow from invoices & retention">
      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-slate-50 rounded-lg p-2.5 text-center">
          <p className="text-lg font-bold text-slate-700 tabular-nums">£{Math.round(totalOutstanding).toLocaleString()}</p>
          <p className="text-[10px] text-slate-400 uppercase font-medium">Outstanding</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-2.5 text-center">
          <p className="text-lg font-bold text-amber-600 tabular-nums">£{Math.round(totalRetention).toLocaleString()}</p>
          <p className="text-[10px] text-slate-400 uppercase font-medium">Retention Held</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-2.5 text-center">
          <p className="text-lg font-bold text-rose-600 tabular-nums">{overdueCount}</p>
          <p className="text-[10px] text-slate-400 uppercase font-medium">Overdue</p>
        </div>
      </div>

      {isLoading ? (
        <div className="h-48 animate-pulse bg-slate-100 rounded-lg" />
      ) : totalOutstanding === 0 && totalRetention === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <TrendingUp className="w-8 h-8 text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">No outstanding invoices</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={forecast} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} interval={1} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => `£${v / 1000}k`} />
            <Tooltip
              formatter={(v) => `£${v.toLocaleString()}`}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
            />
            <ReferenceLine y={0} stroke="#e2e8f0" />
            <Line type="monotone" dataKey="invoices" stroke="#2E5A1A" strokeWidth={2} dot={{ r: 3 }} name="Invoices" />
            <Line type="monotone" dataKey="retention" stroke="#d97706" strokeWidth={2} dot={{ r: 3 }} name="Retention" />
          </LineChart>
        </ResponsiveContainer>
      )}

      {overdueCount > 0 && (
        <div className="mt-3 flex items-start gap-2 bg-rose-50 rounded-lg px-3 py-2 text-xs text-rose-700">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <p>{overdueCount} overdue invoice(s) need chasing — see Outstanding Receivables widget.</p>
        </div>
      )}
    </WidgetShell>
  );
}