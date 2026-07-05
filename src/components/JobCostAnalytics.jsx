import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell } from 'recharts';
import { Wallet, TrendingUp, TrendingDown, Download, PiggyBank, Filter } from 'lucide-react';

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
  const [selectedJobId, setSelectedJobId] = useState('all');

  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: rotas = [] } = useQuery({ queryKey: ['all-rotas'], queryFn: () => base44.entities.RotaAssignment.list() });

  const { costByJob, rows } = useMemo(() => {
    const costByJob = {};
    rotas.forEach(r => {
      const member = staff.find(s => s.id === r.staff_id);
      if (!member) return;
      const isDriller = member.job_role === 'cp_driller' || member.job_role === 'rotary_driller';
      let cost = 0;
      if (isDriller && r.meterage && member.meterage_rate) cost = r.meterage * member.meterage_rate;
      else if (member.day_rate) cost = member.day_rate;
      costByJob[r.job_id] = (costByJob[r.job_id] || 0) + cost;
    });
    const rows = jobs.map(j => ({
      id: j.id,
      name: j.name,
      type: j.job_type,
      status: j.status,
      budget: j.budget_amount || 0,
      spend: costByJob[j.id] || 0,
      variance: (j.budget_amount || 0) - (costByJob[j.id] || 0)
    })).filter(r => r.budget > 0 || r.spend > 0);
    return { costByJob, rows };
  }, [jobs, staff, rotas]);

  const isAll = selectedJobId === 'all';
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
    { label: 'Est. Labour Spend', value: fmtGBP(totalSpend), icon: TrendingUp, gradient: 'stat-gradient-blue' },
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
      const header = 'Job,Type,Budget (GBP),Est. Spend (GBP),Variance (GBP)';
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
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mb-6">
      <div className="card-modern rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-sm">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Cost Analytics</h2>
              <p className="text-xs text-slate-500">Budget vs estimated labour spend</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={selectedJobId}
                onChange={e => setSelectedJobId(e.target.value)}
                className="pl-8 pr-7 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 bg-white focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 appearance-none cursor-pointer max-w-[180px] truncate"
              >
                <option value="all">All Jobs</option>
                {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
              </select>
            </div>
            <button onClick={handleExportCsv} disabled={exporting || displayRows.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-xs font-medium disabled:opacity-50 flex-shrink-0">
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          </div>
        </div>

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
              <div key={s.label} className="rounded-xl border border-slate-100 p-3 flex items-center gap-3 bg-white">
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
              {fmtGBP(totalSpend)} of {fmtGBP(totalBudget)} {pctUsed > 100 ? '· over budget' : `· ${fmtGBP(totalBudget - totalSpend)} remaining`}
            </p>
          </div>
        )}

        {/* Chart */}
        <div>
          <p className="text-xs font-semibold text-slate-600 mb-3">
            {isAll ? 'Top jobs by budget' : 'Budget vs spend'}
          </p>
          {chartData.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-slate-400 text-sm">
              No budget or assignment data {isAll ? 'yet' : 'for this job'}.
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
          <div className="flex items-center gap-4 mt-3 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />Budget</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />On-track spend</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />Over-budget spend</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}