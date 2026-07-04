import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Activity, BarChart3, Users, Layers } from 'lucide-react';
import { motion } from 'framer-motion';

const STATUS_COLORS = { planning: '#64748b', in_progress: '#059669', completed: '#0d9488', on_hold: '#d97706' };
const STATUS_LABELS = { planning: 'Planning', in_progress: 'In Progress', completed: 'Completed', on_hold: 'On Hold' };

const JOB_TYPE_LABELS = { groundworks: 'Groundworks', cp_drilling: 'CP Drilling', rotary_drilling: 'Rotary Drilling', enabling_works: 'Enabling Works', depot: 'Depot' };
const JOB_TYPE_COLORS = { groundworks: '#16a34a', cp_drilling: '#f59e0b', rotary_drilling: '#3b82f6', enabling_works: '#a855f7', depot: '#64748b' };

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid rgba(226,232,240,0.8)',
  fontSize: 12,
  background: 'rgba(255,255,255,0.85)',
  backdropFilter: 'blur(8px)',
  boxShadow: '0 8px 24px -8px rgba(15,42,31,0.18)',
  padding: '8px 12px'
};

const cardCls = "card-modern rounded-2xl p-5";

export function JobStatusChart({ jobs }) {
  const statuses = ['planning', 'in_progress', 'completed', 'on_hold'];
  const data = statuses
    .map(s => ({ name: STATUS_LABELS[s], key: s, value: jobs.filter(j => (j.status || 'planning') === s).length }))
    .filter(d => d.value > 0);
  const total = data.reduce((a, b) => a + b.value, 0);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className={cardCls}>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center"><Activity className="w-4 h-4 text-emerald-700" /></div>
        <h2 className="font-semibold text-slate-900">Job Status</h2>
      </div>
      {data.length === 0 ? (
        <div className="h-[180px] flex items-center justify-center text-slate-400 text-sm">No jobs yet</div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative">
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={3} stroke="none">
                  {data.map(d => <Cell key={d.key} fill={STATUS_COLORS[d.key]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-slate-900">{total}</span>
              <span className="text-[10px] text-slate-400 uppercase tracking-wide">Jobs</span>
            </div>
          </div>
          <div className="space-y-2 w-full">
            {data.map(d => (
              <div key={d.key} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS[d.key] }}></span>
                  <span className="text-sm text-slate-600">{d.name}</span>
                </div>
                <span className="text-sm font-bold text-slate-900">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

export function WeeklyAssignmentsChart({ days, rotas }) {
  const data = days.map(dayStr => {
    const d = new Date(dayStr + 'T00:00:00');
    return { day: d.toLocaleDateString('en-GB', { weekday: 'short' }), assignments: rotas.filter(r => r.assigned_date === dayStr).length };
  });

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className={cardCls}>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center"><BarChart3 className="w-4 h-4 text-emerald-700" /></div>
        <h2 className="font-semibold text-slate-900">This Week's Assignments</h2>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#047857" />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: 'rgba(16,185,129,0.08)' }} contentStyle={tooltipStyle} />
          <Bar dataKey="assignments" fill="url(#barGrad)" radius={[6, 6, 0, 0]} maxBarSize={42} />
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

export function StaffUtilizationChart({ staff, rotas, weekDays }) {
  const data = staff.map(member => {
    const count = rotas.filter(r => r.staff_id === member.id && weekDays.includes(r.assigned_date)).length;
    return { name: member.name.split(' ')[0], fullName: member.name, assigned: count, total: weekDays.length };
  }).sort((a, b) => b.assigned - a.assigned);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className={cardCls}>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center"><Users className="w-4 h-4 text-emerald-700" /></div>
        <h2 className="font-semibold text-slate-900">Staff Utilisation</h2>
      </div>
      {data.length === 0 ? (
        <div className="h-[180px] flex items-center justify-center text-slate-400 text-sm">No staff yet</div>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(180, data.length * 32)}>
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 15, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="barGradH" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#047857" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} width={70} />
            <Tooltip cursor={{ fill: 'rgba(16,185,129,0.08)' }} contentStyle={tooltipStyle} formatter={(value, name, props) => [`${value} / ${props.payload.total} days`, props.payload.fullName]} />
            <Bar dataKey="assigned" fill="url(#barGradH)" radius={[0, 6, 6, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </motion.div>
  );
}

export function JobTypeBreakdownChart({ jobs }) {
  const types = ['groundworks', 'cp_drilling', 'rotary_drilling', 'enabling_works', 'depot'];
  const data = types
    .map(t => ({ name: JOB_TYPE_LABELS[t], key: t, value: jobs.filter(j => j.job_type === t).length }))
    .filter(d => d.value > 0);
  const total = data.reduce((a, b) => a + b.value, 0);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className={cardCls}>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center"><Layers className="w-4 h-4 text-emerald-700" /></div>
        <h2 className="font-semibold text-slate-900">Job Type Breakdown</h2>
      </div>
      {data.length === 0 ? (
        <div className="h-[180px] flex items-center justify-center text-slate-400 text-sm">No jobs yet</div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative">
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={3} stroke="none">
                  {data.map(d => <Cell key={d.key} fill={JOB_TYPE_COLORS[d.key]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-slate-900">{total}</span>
              <span className="text-[10px] text-slate-400 uppercase tracking-wide">Jobs</span>
            </div>
          </div>
          <div className="space-y-2 w-full">
            {data.map(d => (
              <div key={d.key} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: JOB_TYPE_COLORS[d.key] }}></span>
                  <span className="text-sm text-slate-600">{d.name}</span>
                </div>
                <span className="text-sm font-bold text-slate-900">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}