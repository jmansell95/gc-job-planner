import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { BarChart3, TrendingUp, Users, Briefcase, Award, ArrowRight } from 'lucide-react';
import WidgetShell from './WidgetShell';

// Benchmark Comparisons — compares jobs by margin, crews by utilization,
// and periods by revenue. Helps managers spot top/bottom performers at a glance.

export default function BenchmarkComparisonsWidget({ onJobSelect }) {
  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs-benchmark'],
    queryFn: async () => {
      const res = await base44.entities.Job.list('-created_date', 100);
      return res.data || res || [];
    },
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['staff-benchmark'],
    queryFn: async () => {
      const res = await base44.entities.Staff.list('-created_date', 100);
      return res.data || res || [];
    },
  });

  const { data: rotas = [] } = useQuery({
    queryKey: ['rotas-benchmark'],
    queryFn: async () => {
      const res = await base44.entities.RotaAssignment.list('-created_date', 200);
      return res.data || res || [];
    },
  });

  const { data: timesheets = [] } = useQuery({
    queryKey: ['timesheets-benchmark'],
    queryFn: async () => {
      const res = await base44.entities.Timesheet.list('-created_date', 200);
      return res.data || res || [];
    },
  });

  const analysis = useMemo(() => {
    // Job margin comparison — top 5 by estimated margin %
    const jobMargins = jobs
      .filter(j => j.budget_amount && j.budget_amount > 0)
      .map(j => {
        const cost = j.actual_cost || 0;
        const margin = j.budget_amount > 0 ? ((j.budget_amount - cost) / j.budget_amount) * 100 : 0;
        return { name: j.name, id: j.id, margin: Math.round(margin), budget: j.budget_amount, cost };
      })
      .sort((a, b) => b.margin - a.margin);

    const topJobs = jobMargins.slice(0, 5);
    const bottomJobs = jobMargins.slice(-5).reverse();

    // Crew utilization — assignments per staff member (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentRotas = rotas.filter(r => r.assigned_date && r.assigned_date >= thirtyDaysAgo.toISOString().slice(0, 10));

    const crewUtil = staff.map(s => {
      const assignments = recentRotas.filter(r => r.staff_id === s.id).length;
      const jobAssignments = recentRotas.filter(r => r.staff_id === s.id && r.assignment_type === 'job').length;
      const util = recentRotas.length > 0 ? (jobAssignments / Math.max(assignments, 1)) * 100 : 0;
      return { name: s.name, id: s.id, assignments, jobAssignments, util: Math.round(util) };
    }).filter(c => c.assignments > 0).sort((a, b) => b.util - a.util);

    const topCrews = crewUtil.slice(0, 5);
    const bottomCrews = crewUtil.slice(-3).reverse();

    // Period comparison — this week vs last week timesheet hours
    const now = new Date();
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - now.getDay() + 1);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const thisWeekStr = thisWeekStart.toISOString().slice(0, 10);
    const lastWeekStr = lastWeekStart.toISOString().slice(0, 10);

    const thisWeekHours = timesheets
      .filter(t => t.week_start && t.week_start >= thisWeekStr)
      .reduce((sum, t) => sum + (t.total_hours || t.hours || 0), 0);
    const lastWeekHours = timesheets
      .filter(t => t.week_start && t.week_start >= lastWeekStr && t.week_start < thisWeekStr)
      .reduce((sum, t) => sum + (t.total_hours || t.hours || 0), 0);
    const weekChange = lastWeekHours > 0 ? Math.round(((thisWeekHours - lastWeekHours) / lastWeekHours) * 100) : 0;

    return { topJobs, bottomJobs, topCrews, bottomCrews, thisWeekHours, lastWeekHours, weekChange };
  }, [jobs, staff, rotas, timesheets]);

  const maxMargin = Math.max(...analysis.topJobs.map(j => Math.abs(j.margin)), 1);

  return (
    <WidgetShell
      icon={BarChart3}
      title="Benchmark Comparisons"
      subtitle="Top & bottom performers — jobs by margin, crews by utilization"
    >
      <div className="space-y-5">
        {/* Period comparison */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50 rounded-xl p-3.5">
            <p className="text-xs text-slate-500 font-medium">This Week Hours</p>
            <p className="text-xl font-bold text-slate-800 mt-0.5">{Math.round(analysis.thisWeekHours)}h</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3.5">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500 font-medium">vs Last Week</p>
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${analysis.weekChange >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>
                {analysis.weekChange >= 0 ? '+' : ''}{analysis.weekChange}%
              </span>
            </div>
            <p className="text-xl font-bold text-slate-800 mt-0.5">{Math.round(analysis.lastWeekHours)}h</p>
          </div>
        </div>

        {/* Job margin benchmarks */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Briefcase className="w-3.5 h-3.5 text-slate-400" />
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Job Margin — Top 5</p>
          </div>
          <div className="space-y-1.5">
            {analysis.topJobs.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">No jobs with budgets yet.</p>
            ) : analysis.topJobs.map((j, i) => (
              <button
                key={j.id}
                onClick={() => onJobSelect?.(j.id)}
                className="w-full flex items-center gap-2 group"
              >
                <span className="text-xs font-bold text-slate-400 w-4 text-right">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-700 truncate group-hover:text-emerald-700 transition">{j.name}</span>
                    <span className={`text-xs font-bold flex-shrink-0 ${j.margin >= 20 ? 'text-emerald-600' : j.margin >= 0 ? 'text-amber-600' : 'text-rose-600'}`}>
                      {j.margin}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${j.margin >= 20 ? 'stat-gradient-emerald' : j.margin >= 0 ? 'stat-gradient-amber' : 'stat-gradient-rose'}`}
                      style={{ width: `${Math.min(Math.abs(j.margin) / maxMargin * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Crew utilization benchmarks */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Crew Utilisation — Top 5 (30 days)</p>
          </div>
          <div className="space-y-1.5">
            {analysis.topCrews.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">No rota assignments in the last 30 days.</p>
            ) : analysis.topCrews.map((c, i) => (
              <div key={c.id} className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 w-4 text-right">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-700 truncate">{c.name}</span>
                    <span className="text-xs font-bold text-slate-600 flex-shrink-0">{c.util}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                    <div
                      className="h-full rounded-full stat-gradient-blue"
                      style={{ width: `${c.util}%` }}
                    />
                  </div>
                </div>
                {i === 0 && <Award className="w-4 h-4 text-amber-400 flex-shrink-0" />}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom performers callout */}
        {analysis.bottomJobs.length > 0 && analysis.bottomJobs[0].margin < 0 && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-rose-500" />
              <p className="text-xs font-semibold text-rose-700">Needs Attention — Negative Margin</p>
            </div>
            <p className="text-xs text-rose-600">
              {analysis.bottomJobs.filter(j => j.margin < 0).length} job(s) are running at a loss. Review costing and billing.
            </p>
          </div>
        )}
      </div>
    </WidgetShell>
  );
}