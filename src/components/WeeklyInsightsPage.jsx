import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, RefreshCw, AlertCircle, Lightbulb, Printer, CheckSquare } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, startOfWeek } from 'date-fns';
import PageHeader from '@/components/PageHeader';

const fmtGBP = (n) => '£' + (Math.round((n || 0) * 100) / 100).toLocaleString('en-GB');

export default function WeeklyInsightsPage() {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const weekStart = startOfWeek(new Date());
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');

  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => base44.entities.Vehicle.list() });
  const { data: timesheets = [] } = useQuery({ queryKey: ['timesheets-all'], queryFn: () => base44.entities.Timesheet.list() });
  const { data: rotas = [] } = useQuery({
    queryKey: ['rotas-this-week', weekStartStr],
    queryFn: async () => (await base44.entities.RotaAssignment.list()).filter(r => r.week_start === weekStartStr)
  });

  const generate = useCallback(async () => {
    if (!staff.length && !jobs.length) return;
    setLoading(true);
    setError(null);
    try {
      const activeJobs = jobs.filter(j => (j.status || 'planning') === 'in_progress');
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const todays = rotas.filter(r => r.assigned_date === todayStr);

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

      const jobsOverBudget = activeJobs.filter(j => j.budget_amount && costByJob[j.id] > j.budget_amount);
      const unassignedActive = activeJobs.filter(j => !rotas.some(r => r.job_id === j.id));
      const underutilised = staff.filter(s => s.is_active !== false && rotas.filter(r => r.staff_id === s.id).length < 2);
      const pendingTimesheets = timesheets.filter(t => t.status === 'submitted').length;

      const today = new Date();
      const exp = (d) => { if (!d) return null; return Math.ceil((new Date(d + 'T00:00:00') - today) / 86400000); };
      const vehicleAlerts = vehicles.filter(v => {
        const m = exp(v.mot_expiry), s = exp(v.service_due_date);
        return (m !== null && m <= 30) || (s !== null && s <= 30);
      });

      const context = [
        `Week starting ${weekStartStr}.`,
        `${activeJobs.length} active jobs of ${jobs.length} total.`,
        `Today: ${todays.length} assignments covering ${new Set(todays.map(r => r.staff_id)).size} staff.`,
        `Jobs with no rota assignments this week: ${unassignedActive.length} (${unassignedActive.map(j => j.name).join(', ') || 'none'}).`,
        `Staff underutilised (<2 shifts): ${underutilised.length} (${underutilised.map(s => s.name).join(', ') || 'none'}).`,
        `Jobs over budget: ${jobsOverBudget.length} (${jobsOverBudget.map(j => `${j.name} spend ${fmtGBP(costByJob[j.id])} vs budget ${fmtGBP(j.budget_amount)}`).join('; ') || 'none'}).`,
        `Pending unapproved timesheets: ${pendingTimesheets}.`,
        `Vehicles with maintenance/MOT due within 30 days: ${vehicleAlerts.length} (${vehicleAlerts.map(v => v.name).join(', ') || 'none'}).`,
      ].join(' ');

      const prompt = `You are an operations assistant for a UK groundworks & drilling company. Based on this week's data, give 4-6 concise, actionable steps the operations manager should take THIS WEEK to improve operations. Focus on concrete actions: reassigning staff, approving timesheets, scheduling maintenance, reviewing over-budget jobs, filling rota gaps. Be specific and reference actual job/staff names from the data. Data: ${context} Return JSON with "summary" (one punchy sentence, under 20 words) and "steps" (array of action items, each under 18 words, starting with a verb).`;

      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            steps: { type: 'array', items: { type: 'string' } }
          }
        }
      });
      setInsights(res);
    } catch (e) {
      setError(e.message || 'Failed to generate insights');
    }
    setLoading(false);
  }, [staff, jobs, vehicles, timesheets, rotas, weekStartStr]);

  useEffect(() => {
    if (staff.length > 0 && jobs.length > 0 && !insights && !loading && !error) {
      generate();
    }
  }, [staff, jobs, generate]); // eslint-disable-line

  const hasInsights = insights && (insights.steps?.length || insights.summary);

  const buildPrintHtml = () => {
    const steps = (insights?.steps || []).map((s, i) =>
      `<li><span class="num">${i + 1}</span><span>${s.replace(/</g, '&lt;')}</span></li>`
    ).join('');
    const summary = insights?.summary ? `<p class="summary">${insights.summary.replace(/</g, '&lt;')}</p>` : '';
    return `<!DOCTYPE html><html><head><title>Weekly Insights — ${format(weekStart, 'dd MMM yyyy')}</title>
<style>
  body{font-family:Arial,sans-serif;margin:24px;color:#111;max-width:700px}
  h1{font-size:22px;margin:0 0 4px}
  .sub{color:#666;font-size:12px;margin-bottom:16px}
  .summary{background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:12px 14px;font-size:14px;font-weight:600;color:#065f46;margin-bottom:18px}
  ol{list-style:none;padding:0;margin:0;counter-reset:step}
  li{display:flex;gap:10px;padding:10px 0;border-bottom:1px solid #e2e8f0;font-size:13px;line-height:1.5}
  .num{flex-shrink:0;width:22px;height:22px;border-radius:50%;background:#047857;color:#fff;font-size:11px;font-weight:bold;display:flex;align-items:center;justify-content:center}
  .foot{margin-top:20px;padding-top:12px;border-top:1px solid #e2e8f0;color:#999;font-size:10px}
  @media print{body{margin:10mm}}
</style></head><body>
<h1>Weekly Insights</h1>
<p class="sub">Week of ${format(weekStart, 'dd MMMM yyyy')} · GC Job Planner</p>
${summary}
<ol>${steps}</ol>
<div class="foot">Generated ${format(new Date(), 'dd MMM yyyy HH:mm')}</div>
</body></html>`;
  };

  const handlePrint = () => {
    if (!hasInsights) return;
    const html = buildPrintHtml();
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <PageHeader title="Weekly Insights" icon={Sparkles} />
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            disabled={!hasInsights}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition text-sm font-medium disabled:opacity-50"
          >
            <Printer className="w-4 h-4" /> Print Actions
          </button>
          <button
            onClick={generate}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Generating...' : 'Regenerate'}
          </button>
        </div>
      </div>

      <p className="text-sm text-slate-500 mb-6">AI-generated action plan based on this week's jobs, rotas, timesheets, budgets and vehicle maintenance. Week of <span className="font-medium text-slate-700">{format(weekStart, 'dd MMMM yyyy')}</span>.</p>

      {/* Summary Banner */}
      {loading && !insights && (
        <div className="card-modern rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-emerald-700 animate-spin" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">Analysing this week's data…</p>
              <p className="text-xs text-slate-500">Reviewing jobs, staff, budgets and maintenance</p>
            </div>
          </div>
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-4 bg-slate-200/70 rounded animate-pulse" style={{ width: `${85 - i * 12}%` }} />
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl p-6 bg-red-50 border border-red-200 flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
          <div>
            <p className="font-semibold text-red-900">Couldn't generate insights</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {hasInsights && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          {/* Summary */}
          {insights.summary && (
            <div className="card-modern rounded-2xl p-5 mb-6 bg-emerald-50/60 border-emerald-100">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Lightbulb className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">This Week's Summary</p>
                  <p className="text-base font-semibold text-slate-900 leading-relaxed">{insights.summary}</p>
                </div>
              </div>
            </div>
          )}

          {/* Action Steps */}
          <div className="card-modern rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100/70 flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-emerald-700" />
              <h2 className="font-semibold text-slate-900">Action Items for This Week</h2>
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold ml-auto">
                {(insights.steps || []).length} steps
              </span>
            </div>
            <div className="divide-y divide-slate-100/70">
              {(insights.steps || []).map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="flex items-start gap-3 px-5 py-4 hover:bg-emerald-50/30 transition"
                >
                  <div className="w-7 h-7 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed pt-1">{step}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}