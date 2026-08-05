import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { BarChart3, GitCompare, Users, Briefcase, Calendar, Loader2 } from 'lucide-react';
import WidgetShell from '@/components/dashboard/WidgetShell';
import { format, startOfWeek, subWeeks, isWithinInterval, parseISO } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line,
} from 'recharts';

/**
 * Benchmark Comparisons — compare job vs job, crew vs crew, and period vs period
 * for performance insights. Shows revenue, cost, margin, and productivity metrics
 * side-by-side with visual charts.
 */
export default function BenchmarkComparisonsWidget() {
  const [mode, setMode] = useState('jobs'); // 'jobs' | 'crews' | 'periods'

  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ['benchmark-jobs'],
    queryFn: () => base44.entities.Job.filter({ status: { $in: ['in_progress', 'completed', 'decommissioning'] } }, '-start_date', 30),
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['benchmark-staff'],
    queryFn: () => base44.entities.Staff.filter({ is_active: true }, '-created_date', 50),
  });

  const { data: rotas = [] } = useQuery({
    queryKey: ['benchmark-rotas'],
    queryFn: () => base44.entities.RotaAssignment.filter({}, '-assigned_date', 200),
  });

  const { data: timesheets = [] } = useQuery({
    queryKey: ['benchmark-timesheets'],
    queryFn: () => base44.entities.Timesheet.filter({ status: 'approved' }, '-created_date', 200),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['benchmark-teams'],
    queryFn: () => base44.entities.Team.list(),
  });

  // Job comparison data
  const jobData = useMemo(() => {
    return jobs.slice(0, 8).map(j => ({
      name: j.name?.length > 15 ? j.name.substring(0, 15) + '…' : j.name,
      Budget: Math.round(j.budget_amount || 0),
      Actual: Math.round(j.actual_cost || 0),
      Margin: Math.round((j.budget_amount || 0) - (j.actual_cost || 0)),
    }));
  }, [jobs]);

  // Crew comparison data — group rotas by team
  const crewData = useMemo(() => {
    if (!teams.length) return [];
    return teams.slice(0, 8).map(team => {
      const teamStaff = staff.filter(s => s.team_id === team.id);
      const teamRotas = rotas.filter(r => teamStaff.some(s => s.id === r.staff_id));
      const teamTimesheets = timesheets.filter(t => teamStaff.some(s => s.id === t.staff_id));
      const totalHours = teamTimesheets.reduce((sum, t) => sum + (t.total_hours || 0), 0);
      const daysWorked = teamRotas.filter(r => r.assignment_type === 'job').length;
      return {
        name: team.name?.length > 12 ? team.name.substring(0, 12) + '…' : team.name,
        Hours: Math.round(totalHours),
        Days: daysWorked,
        Crew: teamStaff.length,
      };
    }).filter(d => d.Days > 0 || d.Hours > 0);
  }, [teams, staff, rotas, timesheets]);

  // Period comparison — last 4 weeks
  const periodData = useMemo(() => {
    const now = new Date();
    const weeks = [];
    for (let w = 3; w >= 0; w--) {
      const weekStart = startOfWeek(subWeeks(now, w), { weekStartsOn: 1 });
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const weekRotas = rotas.filter(r => {
        if (!r.assigned_date) return false;
        const d = parseISO(r.assigned_date);
        return isWithinInterval(d, { start: weekStart, end: weekEnd });
      });
      const weekTs = timesheets.filter(t => {
        if (!t.week_start) return false;
        const d = parseISO(t.week_start);
        return isWithinInterval(d, { start: weekStart, end: weekEnd });
      });
      weeks.push({
        name: format(weekStart, 'dd MMM'),
        Shifts: weekRotas.filter(r => r.assignment_type === 'job').length,
        Hours: Math.round(weekTs.reduce((s, t) => s + (t.total_hours || 0), 0)),
      });
    }
    return weeks;
  }, [rotas, timesheets]);

  const modes = [
    { id: 'jobs', label: 'Jobs', icon: Briefcase, data: jobData, keys: ['Budget', 'Actual', 'Margin'], subtitle: 'Budget vs actual cost by job' },
    { id: 'crews', label: 'Crews', icon: Users, data: crewData, keys: ['Hours', 'Days'], subtitle: 'Hours and days worked by crew' },
    { id: 'periods', label: 'Periods', icon: Calendar, data: periodData, keys: ['Shifts', 'Hours'], subtitle: 'Week-over-week trend' },
  ];

  const activeMode = modes.find(m => m.id === mode);
  const isLoading = jobsLoading;

  return (
    <WidgetShell
      icon={GitCompare}
      title="Benchmark Comparisons"
      subtitle="Job vs job · crew vs crew · period vs period"
    >
      {/* Mode tabs */}
      <div className="flex gap-1.5 mb-4 bg-slate-100 rounded-lg p-1">
        {modes.map(m => {
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                mode === m.id ? 'bg-white text-[#2E5A1A] shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {m.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-[#2E5A1A] animate-spin" />
        </div>
      ) : !activeMode.data || activeMode.data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <BarChart3 className="w-8 h-8 text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">No data for {activeMode.label.toLowerCase()} comparison</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">{activeMode.subtitle}</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={activeMode.data} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                cursor={{ fill: 'rgba(46,90,26,0.05)' }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {activeMode.keys.map((key, i) => {
                const colors = ['#2E5A1A', '#8DC63F', '#f59e0b'];
                return (
                  <Bar key={key} dataKey={key} fill={colors[i % colors.length]} radius={[4, 4, 0, 0]} maxBarSize={40} />
                );
              })}
            </BarChart>
          </ResponsiveContainer>

          {/* Period trend line for periods mode */}
          {mode === 'periods' && periodData.length > 1 && (
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={periodData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Line type="monotone" dataKey="Hours" stroke="#2E5A1A" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </WidgetShell>
  );
}