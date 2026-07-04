import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell } from 'recharts';
import { Wallet, TrendingUp, TrendingDown, Download, PiggyBank } from 'lucide-react';

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

  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: rotas = [] } = useQuery({ queryKey: ['all-rotas'], queryFn: () => base44.entities.RotaAssignment.list() });

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
    name: j.name,
    type: j.job_type,
    budget: j.budget_amount || 0,
    spend: costByJob[j.id] || 0,
    variance: (j.budget_amount || 0) - (costByJob[j.id] || 0)
  })).filter(r => r.budget > 0 || r.spend > 0);

  const totalBudget = rows.reduce((a, b) => a + b.budget, 0);
  const totalSpend = rows.reduce((a, b) => a + b.spend, 0);
  const totalVariance = totalBudget - totalSpend;
  const overBudget = rows.filter(r => r.variance < 0).length;

  const chartData = [...rows].sort((a, b) => b.budget - a.budget).slice(0, 6).map(r => ({
    name: r.name.length > 14 ? r.name.slice(0, 12) + '…' : r.name,
    Budget: Math.round(r.budget),
    Spend: Math.round(r.spend)
  }));

  const stats = [
    { label: 'Total Budget', value: fmtGBP(totalBudget), icon: Wallet, gradient: 'stat-gradient-emerald' },
    { label: 'Est. Labour Spend', value: fmtGBP(totalSpend), icon: TrendingUp, gradient: 'stat-gradient-blue' },
    { label: totalVariance >= 0 ? 'Under Budget' : 'Over Budget', value: fmtGBP(Math.abs(totalVariance)), icon: totalVariance >= 0 ? PiggyBank : TrendingDown, gradient: totalVariance >= 0 ? 'stat-gradient-amber' : 'stat-gradient-rose' },
    { label: 'Jobs Over Budget', value: overBudget, icon: TrendingDown, gradient: overBudget > 0 ? 'stat-gradient-rose' : 'stat-gradient-slate' }
  ];

  const handleExportCsv = () => {
    setExporting(true);
    try {
      const header = 'Job,Type,Budget (GBP),Est. Spend (GBP),Variance (GBP)';
      const lines = rows.map(r => `"${r.name.replace(/"/g, '""')}","${r.type}",${r.budget.toFixed(2)},${r.spend.toFixed(2)},${r.variance.toFixed(2)}`);
      const csv = [header, ...lines].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'job-cost-analytics.csv';
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
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-sm">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Cost Analytics</h2>
              <p className="text-xs text-slate-500">Budget vs estimated labour spend</p>
            </div>
          </div>
          <button onClick={handleExportCsv} disabled={exporting || rows.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-xs font-medium disabled:opacity-50">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="rounded-xl border border-slate-100 p-3 flex items-center gap-3">
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

        {chartData.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-slate-400 text-sm">
            No budget or assignment data yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} interval={0} angle={-12} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => '£' + v} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtGBP(v)} cursor={{ fill: 'rgba(16,185,129,0.06)' }} />
              <Bar dataKey="Budget" radius={[4, 4, 0, 0]} maxBarSize={28}>
                {chartData.map((d, i) => <Cell key={i} fill="#10b981" />)}
              </Bar>
              <Bar dataKey="Spend" radius={[4, 4, 0, 0]} maxBarSize={28}>
                {chartData.map((d, i) => <Cell key={i} fill={d.Spend > d.Budget ? '#f43f5e' : '#3b82f6'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </motion.div>
  );
}