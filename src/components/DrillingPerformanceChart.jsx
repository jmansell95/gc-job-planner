import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Ruler } from 'lucide-react';

export default function DrillingPerformanceChart({ rotas, staff }) {
  const drillingStaff = staff.filter(s => s.job_role === 'cp_driller' || s.job_role === 'rotary_driller');

  const data = drillingStaff.map(member => {
    const memberRotas = rotas.filter(r => r.staff_id === member.id);
    const totalMeterage = memberRotas.reduce((sum, r) => sum + (r.meterage || 0), 0);
    const completedShifts = memberRotas.filter(r => r.status === 'completed').length;
    return {
      name: member.name.split(' ')[0],
      meterage: totalMeterage,
      shifts: completedShifts
    };
  }).filter(d => d.meterage > 0 || d.shifts > 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <Ruler className="w-5 h-5 text-amber-600" />
        <h2 className="font-semibold text-slate-900">Drilling Performance</h2>
        <span className="ml-auto text-xs text-slate-400">Meterage by crew member (this week)</span>
      </div>
      {data.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
          No meterage data recorded yet
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#64748b" />
            <YAxis tick={{ fontSize: 12 }} stroke="#64748b" unit="m" />
            <Tooltip
              contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
              formatter={(value, name) => name === 'meterage' ? [`${value}m`, 'Meterage'] : [`${value} shifts`, 'Shifts']}
            />
            <Legend formatter={(value) => value === 'meterage' ? 'Meterage (m)' : 'Completed Shifts'} />
            <Bar dataKey="meterage" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            <Bar dataKey="shifts" fill="#0d9488" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}