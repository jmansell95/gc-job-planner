import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Activity, BarChart3, Users } from 'lucide-react';

const STATUS_COLORS = { planning: '#64748b', in_progress: '#059669', completed: '#0d9488', on_hold: '#d97706' };
const STATUS_LABELS = { planning: 'Planning', in_progress: 'In Progress', completed: 'Completed', on_hold: 'On Hold' };

export function JobStatusChart({ jobs }) {
  const statuses = ['planning', 'in_progress', 'completed', 'on_hold'];
  const data = statuses
    .map(s => ({ name: STATUS_LABELS[s], key: s, value: jobs.filter(j => (j.status || 'planning') === s).length }))
    .filter(d => d.value > 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-5 h-5 text-emerald-700" />
        <h2 className="font-semibold text-slate-900">Job Status</h2>
      </div>
      {data.length === 0 ? (
        <div className="h-[180px] flex items-center justify-center text-slate-400 text-sm">No jobs yet</div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <ResponsiveContainer width="100%" height={180} className="!w-[140px] sm:!w-[160px] flex-shrink-0">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={42} outerRadius={70} paddingAngle={2}>
                {data.map((d) => <Cell key={d.key} fill={STATUS_COLORS[d.key]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 w-full">
            {data.map(d => (
              <div key={d.key} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: STATUS_COLORS[d.key] }}></span>
                  <span className="text-sm text-slate-600">{d.name}</span>
                </div>
                <span className="text-sm font-bold text-slate-900">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function WeeklyAssignmentsChart({ days, rotas }) {
  const data = days.map(dayStr => {
    const d = new Date(dayStr + 'T00:00:00');
    const dayLabel = d.toLocaleDateString('en-GB', { weekday: 'short' });
    const count = rotas.filter(r => r.assigned_date === dayStr).length;
    return { day: dayLabel, assignments: count };
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-5 h-5 text-emerald-700" />
        <h2 className="font-semibold text-slate-900">This Week's Assignments</h2>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: '#f0fdf4' }} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
          <Bar dataKey="assignments" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StaffUtilizationChart({ staff, rotas, weekDays }) {
  const data = staff.map(member => {
    const count = rotas.filter(r => r.staff_id === member.id && weekDays.includes(r.assigned_date)).length;
    return { name: member.name.split(' ')[0], fullName: member.name, assigned: count, total: weekDays.length };
  }).sort((a, b) => b.assigned - a.assigned);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-5 h-5 text-emerald-700" />
        <h2 className="font-semibold text-slate-900">Staff Utilization</h2>
      </div>
      {data.length === 0 ? (
        <div className="h-[180px] flex items-center justify-center text-slate-400 text-sm">No staff yet</div>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(180, data.length * 32)}>
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 15, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} width={70} />
            <Tooltip cursor={{ fill: '#f0fdf4' }} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={(value, name, props) => [`${value} / ${props.payload.total} days`, props.payload.fullName]} />
            <Bar dataKey="assigned" fill="#059669" radius={[0, 4, 4, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}