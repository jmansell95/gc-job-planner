import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell } from 'recharts';
import { Wallet, TrendingUp, TrendingDown, Download, PiggyBank } from 'lucide-react';
import WidgetShell from '@/components/dashboard/WidgetShell';
import { useJobFilter } from '@/components/dashboard/JobFilterContext';

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid rgba(226,232,240,0.8)',
  fontSize: 12,
  background: 'rgba(255,255,255,0.9)',
  backdropFilter: 'blur(8px)',
  boxShadow: '0 8px 24px -8px rgba(15,42,31,0.18)',
  padding: '8px 12px'
};

const fmtGBP = (n) => '£' + (Math.round((n || 0) * 100) / 100).toLocaleString('en-GB');

export default function JobCostAnalytics() {
  const [exporting, setExporting] = useState(false);
  const { selectedJobId } = useJobFilter();
  const isAll = selectedJobId === 'all';

  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: rotas = [] } = useQuery({ queryKey: ['all-rotas'], queryFn: () => base44.entities.RotaAssignment.list() });

  const { rows } = useMemo(() => {
    // Labour cost tracking removed — payroll handled outside this system.
    // Budget tracking remains for comparing against recorded equipment spend.
    const rows = jobs.map(j => ({
      id: j.id,
      name: j.name,
      type: j.job_type,
      status: j.status,
      budget: j.budget_amount || 0,
      spend: 0,
      variance: (j.budget_amount || 0)
    })).filter(r => r.budget > 0);
    return { rows };
  }, [jobs, staff, rotas]);

  const selectedRow = !isAll ? rows.find(r => r.id === selectedJobId) : null;

  const displayRows = isAll ? rows : (selectedRow ? [selectedRow] : []);
  const totalBudget = displayRows.reduce((a, b) => a + b.budget, 0);
  const totalSpend = displayRows.reduce((a, b) => a + b.spend, 0);
  const totalVariance = totalBudget - totalSpend;
  const overBudget = displayRows.filter(r => r.variance < 0).length;
  const pctUsed = totalBudget > 0 ? Math.round((totalSpend / totalBudget) * 100) : 0;

  const scopeLabel = isAll ? 'All Jobs' : (selectedRow?.name || 'Selected Job');

  const stats = [
    { label: 'Total Budget', value: fmtGBP(totalBudget), icon: Wallet, gradient: 'stat-gradient-emerald' },
    { label: 'Recorded Spend', value: fmtGBP(totalSpend), icon: TrendingUp, gradient: 'stat-gradient-blue' },
    { label: totalVariance >= 0 ? 'Under Budget' : 'Over Budget', value: fmtGBP(Math.abs(totalVariance)), icon: totalVariance >= 0 ? PiggyBank : TrendingDown, gradient: totalVariance >= 0 ? 'stat-gradient-amber' : 'stat-gradient-rose' },
    { label: isAll ? 'Jobs Over Budget' : 'Status', value: isAll ? overBudget : (selectedRow?.variance < 0 ? 'Over' : selectedRow?.variance === 0 ? 'On target' : 'Under'), icon: TrendingDown, gradient: (!isAll && selectedRow?.variance < 0) || (isAll && overBudget > 0) ? 'stat-gradient-rose' : 'stat-gradient-slate' }
  ];

  const chartData = [...displayRows].sort((a, b) => b.budget - a.budget).slice(0, 8).map(r => ({
    name: r.name,
    Budget: Math.round(r.budget),
    Spend: Math.round(r.spend)
  }));

  const handleExportCsv = () => {
    setExporting(true);
    try {
      const header = 'Job,Type,Budget (GBP),Recorded Spend (GBP),Variance (GBP)';
      const lines = displayRows.map(r => `"${r.name.replace(/"/g, '""')}","${r.type}",${r.budget.toFixed(2)},${r.spend.toFixed(2)},${r.variance.toFixed(2)}`);
      const csv = [header, ...lines].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `job-cost-analytics-${isAll ? 'all' : selectedJobId}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <WidgetShell icon={Wallet} title="Cost Analytics" subtitle="Budget vs recorded spend"
      action={<div className="flex items-center gap-2 flex-wrap justify-end">
        <button onClick={handleExportCsv} disabled={exporting || displayRows.length === 0}
          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-xs font-medium disabled:opacity-50 flex-shrink-0">
          <Download className="w-3.5 h-3.5" /> CSV
        </button>
      </div>}>
      {/* Scope badge */}
        <div className="mb-4">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Showing: {scopeLabel}
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label}               className="rounded-xl border border-slate-100 p-3 flex items-center gap-3 bg-slate-50">
                <div className={`w-10 h-10 rounded-lg ${s.gradient} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-base font-bold text-slate-900 truncate">{s.value}</p>
                  <p className="text-[11px] text-slate-500 font-medium truncate">{s.label}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Budget utilisation bar */}
        {totalBudget > 0 && (
          <div className="mb-5 rounded-xl border border-slate-100 p-4 bg-slate-50/60">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-700">Budget Used</p>
              <p className="text-xs font-bold text-slate-900">{pctUsed}%</p>
            </div>
            <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${pctUsed > 100 ? 'bg-rose-500' : pctUsed > 85 ? 'bg-amber-500' : 'bg-emerald-600'}`}
                style={{ width: `${Math.min(100, pctUsed)}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              {fmtGBP(totalSpend)} of {fmtGBP(totalBudget)} {pctUsed > 100 ? '· Over Budget' : `· ${fmtGBP(totalBudget - totalSpend)} Remaining`}
            </p>
          </div>
        )}

        {/* Chart */}
        <div>
          <p className="text-xs font-semibold text-slate-600 mb-3">
            {isAll ? 'Top Jobs By Budget' : 'Budget vs Spend'}
          </p>
          {chartData.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-slate-400 text-sm">
              No budget or assignment data {isAll ? 'yet' : 'for this Job'}.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(260, chartData.length * 48 + 40)}>
              <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => '£' + v} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#334155' }} axisLine={false} tickLine={false} width={140} interval={0} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtGBP(v)} cursor={{ fill: 'rgba(16,185,129,0.06)' }} />
                <Bar dataKey="Budget" radius={[0, 4, 4, 0]} maxBarSize={16}>
                  {chartData.map((d, i) => <Cell key={i} fill="#10b981" />)}
                </Bar>
                <Bar dataKey="Spend" radius={[0, 4, 4, 0]} maxBarSize={16}>
                  {chartData.map((d, i) => <Cell key={i} fill={d.Spend > d.Budget ? '#f43f5e' : '#3b82f6'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />Budget</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />On-track spend</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />Over-budget spend</span>
          </div>
        </div>
    </WidgetShell>
  );
}