import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { PoundSterling, Clock, AlertTriangle, FileText, TrendingUp, Receipt } from 'lucide-react';
import { Skeleton } from '@/components/StateViews';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 });

/**
 * Financial Overview — top-of-page summary card for the Financial Control section.
 * Shows outstanding, overdue, draft, and paid-totals at a glance.
 */
export default function FinancialOverviewWidget({ onSelectTab }) {
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices-overview'],
    queryFn: () => base44.entities.Invoice.list('-issue_date', 200),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    );
  }

  const outstanding = invoices.filter(i => i.status === 'sent' || i.status === 'overdue');
  const overdue = invoices.filter(i => i.status === 'overdue');
  const drafts = invoices.filter(i => i.status === 'draft');
  const paid = invoices.filter(i => i.status === 'paid');

  const outstandingTotal = outstanding.reduce((s, i) => s + (i.gross_total || 0), 0);
  const overdueTotal = overdue.reduce((s, i) => s + (i.gross_total || 0), 0);
  const draftTotal = drafts.reduce((s, i) => s + (i.net_total || 0), 0);
  const paidTotal = paid.reduce((s, i) => s + (i.net_total || 0), 0);

  const cards = [
    { label: 'Outstanding', value: fmt(outstandingTotal), sub: `${outstanding.length} invoice${outstanding.length !== 1 ? 's' : ''}`, icon: PoundSterling, gradient: 'stat-gradient-amber', tab: 'aged-debtors' },
    { label: 'Overdue', value: fmt(overdueTotal), sub: `${overdue.length} need chasing`, icon: AlertTriangle, gradient: 'stat-gradient-rose', tab: 'aged-debtors' },
    { label: 'Draft', value: fmt(draftTotal), sub: `${drafts.length} awaiting send`, icon: FileText, gradient: 'stat-gradient-slate', tab: 'invoicing' },
    { label: 'Paid', value: fmt(paidTotal), sub: `${paid.length} settled`, icon: TrendingUp, gradient: 'stat-gradient-emerald', tab: null },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c, i) => {
        const Icon = c.icon;
        const Wrapper = c.tab && onSelectTab ? 'button' : 'div';
        return (
          <Wrapper
            key={i}
            onClick={() => c.tab && onSelectTab?.(c.tab)}
            className={`rounded-xl p-3.5 text-white text-left ${c.gradient} ${c.tab && onSelectTab ? 'hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer' : ''}`}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <Icon className="w-4 h-4 text-white/70" />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-white/80">{c.label}</span>
            </div>
            <p className="text-2xl font-bold tabular-nums">{c.value}</p>
            <p className="text-[11px] text-white/70 mt-0.5">{c.sub}</p>
          </Wrapper>
        );
      })}
    </div>
  );
}