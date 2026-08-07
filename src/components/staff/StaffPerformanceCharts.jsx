import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, RadialBarChart, RadialBar, Legend,
} from 'recharts';
import { TrendingUp, Clock, Target, Award } from 'lucide-react';
import WidgetShell from '@/components/dashboard/WidgetShell';

// Staff performance graph dashboard — shows meterage drilled, on-time arrivals,
// briefing sign-offs, and qualification status as visual charts on the profile page.
export default function StaffPerformanceCharts({ staffId, staffName }) {
  // Fetch rota assignments for this staff member
  const { data: rotas = [] } = useQuery({
    queryKey: ['staff-rotas-perf', staffId],
    queryFn: () => base44.entities.RotaAssignment.filter({ staff_id: staffId }),
    enabled: !!staffId,
  });

  // Fetch timesheets
  const { data: timesheets = [] } = useQuery({
    queryKey: ['staff-timesheets-perf', staffId],
    queryFn: () => base44.entities.Timesheet.filter({ staff_id: staffId }),
    enabled: !!staffId,
  });

  const stats = useMemo(() => {
    const total = rotas.length;
    const started = rotas.filter(r => r.status === 'started' || r.status === 'completed').length;
    const completed = rotas.filter(r => r.status === 'completed').length;
    const briefed = rotas.filter(r => r.briefing_signed).length;
    const arrived = rotas.filter(r => r.arrived_on_site_at).length;
    const onTimeArrivals = rotas.filter(r => {
      if (!r.arrived_on_site_at || !r.start_time) return false;
      const arrived = new Date(r.arrived_on_site_at);
      const [h, m] = r.start_time.split(':').map(Number);
      const expected = new Date(arrived);
      expected.setHours(h, m, 0, 0);
      return arrived <= expected;
    }).length;

    // Meterage from timesheets
    const totalMeterage = timesheets.reduce((sum, t) => sum + (t.meterage || 0), 0);

    // Weekly meterage for chart (last 8 weeks)
    const weeklyMeterage = {};
    for (let i = 7; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i * 7);
      const weekKey = `W${Math.ceil((d.getDate() + d.getDay()) / 7)}`;
      const dateKey = d.toISOString().slice(0, 10);
      weeklyMeterage[dateKey] = { week: weekKey, meterage: 0, shifts: 0 };
    }
    for (const t of timesheets) {
      const d = (t.work_date || t.created_date || '').slice(0, 10);
      if (weeklyMeterage[d]) {
        weeklyMeterage[d].meterage += (t.meterage || 0);
        weeklyMeterage[d].shifts += 1;
      }
    }

    const arrivalRate = total > 0 ? Math.round((arrived / total) * 100) : 0;
    const onTimeRate = arrived > 0 ? Math.round((onTimeArrivals / arrived) * 100) : 0;
    const briefingRate = total > 0 ? Math.round((briefed / total) * 100) : 0;
    const completionRate = started > 0 ? Math.round((completed / started) * 100) : 0;

    return {
      total,
      arrived,
      onTimeRate,
      briefingRate,
      completionRate,
      totalMeterage,
      weeklyData: Object.values(weeklyMeterage),
    };
  }, [rotas, timesheets]);

  const radialData = [
    { name: 'On-Time', value: stats.onTimeRate, fill: '#10b981' },
    { name: 'Briefings', value: stats.briefingRate, fill: '#3b82f6' },
    { name: 'Completion', value: stats.completionRate, fill: '#8b5cf6' },
  ];

  return (
    <WidgetShell icon={TrendingUp} title="Performance Dashboard" subtitle={`${staffName || 'Staff'} — KPI overview`}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={Clock} label="Total Shifts" value={stats.total} color="emerald" />
          <StatCard icon={Target} label="On-Time Rate" value={`${stats.onTimeRate}%`} color="blue" />
          <StatCard icon={Award} label="Briefing Sign-offs" value={`${stats.briefingRate}%`} color="violet" />
          <StatCard icon={TrendingUp} label="Total Meterage" value={`${stats.totalMeterage}m`} color="amber" />
        </div>

        {/* Radial chart — compliance rates */}
        <div className="bg-slate-50/50 rounded-xl p-3">
          <p className="text-xs font-semibold text-slate-500 mb-2 text-center">Compliance Rates</p>
          <ResponsiveContainer width="100%" height={180}>
            <RadialBarChart innerRadius="30%" outerRadius="90%" data={radialData} startAngle={90} endAngle={-270}>
              <RadialBar background dataKey="value" cornerRadius={6} />
              <Legend iconType="circle" layout="horizontal" verticalAlign="bottom" wrapperStyle={{ fontSize: '11px' }} />
              <Tooltip />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Weekly meterage bar chart */}
      <div className="mt-4 bg-slate-50/50 rounded-xl p-3">
        <p className="text-xs font-semibold text-slate-500 mb-2">Weekly Meterage (last 8 weeks)</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={stats.weeklyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="week" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="meterage" fill="#10b981" radius={[4, 4, 0, 0]} name="Meterage (m)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </WidgetShell>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-blue-50 text-blue-700',
    violet: 'bg-violet-50 text-violet-700',
    amber: 'bg-amber-50 text-amber-700',
  };
  return (
    <div className={`${colors[color]} rounded-xl p-3 text-center`}>
      <Icon className="w-4 h-4 mx-auto mb-1 opacity-70" />
      <p className="text-xl font-bold tabular-nums">{value}</p>
      <p className="text-[10px] uppercase font-semibold opacity-70 mt-0.5">{label}</p>
    </div>
  );
}