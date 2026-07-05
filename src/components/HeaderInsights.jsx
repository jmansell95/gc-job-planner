import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Lightbulb, RefreshCw, ChevronDown, AlertCircle, TrendingUp } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, startOfWeek } from 'date-fns';

const fmtGBP = (n) => '£' + (Math.round((n || 0) * 100) / 100).toLocaleString('en-GB');

export default function HeaderInsights() {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);

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

      // Labour cost calc (same logic as JobCostAnalytics)
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

      const prompt = `You are an operations assistant for a UK groundworks & drilling company. Based on this week's data, give 3-5 concise, actionable steps the operations manager should take THIS WEEK to improve operations. Focus on concrete actions: reassigning staff, approving timesheets, scheduling maintenance, reviewing over-budget jobs, filling rota gaps. Be specific and reference actual job/staff names from the data. Data: ${context} Return JSON with "summary" (one punchy sentence, under 20 words) and "steps" (array of action items, each under 18 words, starting with a verb).`;

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

  // Auto-generate when data is ready
  useEffect(() => {
    if (staff.length > 0 && jobs.length > 0 && !insights && !loading && !error) {
      generate();
    }
  }, [staff, jobs, generate]); // eslint-disable-line

  const hasInsights = insights && (insights.steps?.length || insights.summary);
  const stepCount = insights?.steps?.length || 0;

  return (
    <div className="sticky top-14 lg:top-0 z-30 -mx-4 md:-mx-8 mb-4">
      <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 shadow-lg shadow-emerald-900/20">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <button
            onClick={() => hasInsights && setExpanded(!expanded)}
            className="w-full flex items-center gap-3 py-2.5 text-left"
          >
            {/* Pulsing icon */}
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 rounded-lg bg-white/30 animate-ping" style={{ animationDuration: '2.5s' }} />
              <div className="relative w-8 h-8 rounded-lg bg-white/20 ring-1 ring-white/30 backdrop-blur-sm flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="h-3 w-24 bg-white/30 rounded animate-pulse" />
                  <span className="text-xs text-emerald-100">Analysing this week's data…</span>
                </div>
              ) : error ? (
                <div className="flex items-center gap-2 text-white">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm">Couldn't load insights — tap to retry</span>
                </div>
              ) : hasInsights ? (
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-emerald-100 uppercase tracking-wider flex-shrink-0">Weekly Insights</span>
                    {stepCount > 0 && (
                      <span className="text-[10px] bg-white/20 text-white px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">{stepCount} actions</span>
                    )}
                  </div>
                  <p className="text-sm text-white font-medium truncate">{insights.summary}</p>
                </div>
              ) : (
                <div className="text-sm text-emerald-100">Loading weekly insights…</div>
              )}
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <span
                role="button"
                tabIndex={-1}
                onClick={(e) => { e.stopPropagation(); generate(); }}
                className="w-8 h-8 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </span>
              {hasInsights && (
                <ChevronDown className={`w-5 h-5 text-white/80 transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`} />
              )}
            </div>
          </button>
        </div>

        {/* Expanded panel */}
        <AnimatePresence>
          {expanded && hasInsights && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="overflow-hidden border-t border-white/15 bg-emerald-800/40 backdrop-blur-sm"
            >
              <div className="max-w-7xl mx-auto px-4 md:px-8 py-3">
                <div className="space-y-2">
                  {(insights.steps || []).map((step, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className="flex items-start gap-2.5 text-sm text-white"
                    >
                      <div className="w-5 h-5 rounded-full bg-emerald-400/30 ring-1 ring-emerald-300/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-[10px] font-bold text-emerald-100">{i + 1}</span>
                      </div>
                      <span className="leading-relaxed">{step}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}