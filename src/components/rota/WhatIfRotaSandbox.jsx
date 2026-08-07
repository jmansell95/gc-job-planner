import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { FlaskConical, Users, Briefcase, PoundSterling, TrendingUp, AlertTriangle, Loader2, Check, X } from 'lucide-react';

/**
 * WhatIfRotaSandbox — a sandbox mode for the WeeklyRotaBuilder.
 * Planners can test assignment changes to see their impact on
 * "Predicted Profitability" before pushing changes to the live rota.
 *
 * Shows a side-by-side comparison: current rota vs proposed changes,
 * with calculated impact on crew utilization, job coverage, and cost.
 */
export default function WhatIfRotaSandbox({ weekStart, onClose }) {
  const [proposedChanges, setProposedChanges] = useState({});
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);

  const { data: rotas = [], isLoading: rotasLoading } = useQuery({
    queryKey: ['whatif-rotas', weekStart],
    queryFn: () => base44.entities.RotaAssignment.filter({ week_start: weekStart }),
  });
  const { data: staff = [] } = useQuery({
    queryKey: ['whatif-staff'],
    queryFn: () => base44.entities.Staff.filter({ is_active: true }),
  });
  const { data: jobs = [] } = useQuery({
    queryKey: ['whatif-jobs'],
    queryFn: () => base44.entities.Job.list('-updated_date', 100),
  });

  const weekDays = useMemo(() => {
    const start = new Date(weekStart);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d.toISOString().slice(0, 10);
    });
  }, [weekStart]);

  const currentMetrics = useMemo(() => {
    const jobAssignments = rotas.filter(r => r.assignment_type === 'job');
    const uniqueStaff = new Set(jobAssignments.map(r => r.staff_id));
    const uniqueJobs = new Set(jobAssignments.map(r => r.job_id));
    const estimatedCost = jobAssignments.length * 350; // rough day rate avg
    return {
      totalAssignments: rotas.length,
      jobAssignments: jobAssignments.length,
      crewDeployed: uniqueStaff.size,
      jobsCovered: uniqueJobs.size,
      estimatedCost,
    };
  }, [rotas]);

  const proposedMetrics = useMemo(() => {
    const changes = Object.values(proposedChanges);
    const addedAssignments = changes.filter(c => c.action === 'add').length;
    const removedAssignments = changes.filter(c => c.action === 'remove').length;
    const netChange = addedAssignments - removedAssignments;
    const newJobAssignments = currentMetrics.jobAssignments + netChange;
    const newCost = newJobAssignments * 350;

    return {
      ...currentMetrics,
      jobAssignments: newJobAssignments,
      estimatedCost: newCost,
      costDelta: newCost - currentMetrics.estimatedCost,
      assignmentDelta: netChange,
    };
  }, [proposedChanges, currentMetrics]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const prompt = `You are a resource planning analyst. Compare these two rota configurations and assess the impact:

CURRENT ROTA:
- ${currentMetrics.jobAssignments} job assignments
- ${currentMetrics.crewDeployed} crew members deployed
- ${currentMetrics.jobsCovered} jobs covered
- Estimated weekly cost: £${currentMetrics.estimatedCost}

PROPOSED CHANGES:
${Object.entries(proposedChanges).map(([key, c]) => `- ${c.action.toUpperCase()}: ${c.staffName} → ${c.jobName} on ${c.date}`).join('\n') || 'No changes proposed'}

Assess:
1. Impact on crew utilization (better/worse?)
2. Impact on job coverage (any gaps?)
3. Cost impact
4. Risk factors (overallocation, single-point-of-failure, etc.)
5. Overall recommendation

Return as JSON: { "utilization_impact": "string", "coverage_impact": "string", "cost_impact": "string", "risk_factors": ["string"], "recommendation": "approve|reject|modify", "reasoning": "string" }`;

      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            utilization_impact: { type: 'string' },
            coverage_impact: { type: 'string' },
            cost_impact: { type: 'string' },
            risk_factors: { type: 'array', items: { type: 'string' } },
            recommendation: { type: 'string' },
            reasoning: { type: 'string' },
          },
        },
      });
      setAnalysis(res);
    } catch (e) {
      setAnalysis({ error: e.message });
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleChange = (staffId, staffName, date, jobId, jobName) => {
    const key = `${staffId}-${date}`;
    const existing = proposedChanges[key];
    if (existing) {
      const updated = { ...proposedChanges };
      delete updated[key];
      setProposedChanges(updated);
    } else {
      setProposedChanges({
        ...proposedChanges,
        [key]: { action: 'add', staffId, staffName, date, jobId, jobName },
      });
    }
  };

  if (rotasLoading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-violet-50">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
          <FlaskConical className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-slate-900">What-If Sandbox</p>
          <p className="text-xs text-slate-500">Test rota changes before applying — see profitability and coverage impact</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        )}
      </div>

      {/* Metrics comparison */}
      <div className="grid grid-cols-2 gap-3">
        {/* Current */}
        <div className="insight-card rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Briefcase className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs font-bold text-slate-700">Current</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs"><span className="text-slate-500">Assignments</span><span className="font-bold tabular-nums">{currentMetrics.jobAssignments}</span></div>
            <div className="flex justify-between text-xs"><span className="text-slate-500">Crew deployed</span><span className="font-bold tabular-nums">{currentMetrics.crewDeployed}</span></div>
            <div className="flex justify-between text-xs"><span className="text-slate-500">Est. cost</span><span className="font-bold tabular-nums">£{currentMetrics.estimatedCost.toLocaleString()}</span></div>
          </div>
        </div>

        {/* Proposed */}
        <div className="insight-card rounded-xl p-3 border-violet-200">
          <div className="flex items-center gap-1.5 mb-2">
            <FlaskConical className="w-3.5 h-3.5 text-violet-500" />
            <span className="text-xs font-bold text-violet-700">Proposed</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Assignments</span>
              <span className="font-bold tabular-nums">{proposedMetrics.jobAssignments} {proposedMetrics.assignmentDelta !== 0 && <span className={proposedMetrics.assignmentDelta > 0 ? 'text-emerald-600' : 'text-rose-600'}>({proposedMetrics.assignmentDelta > 0 ? '+' : ''}{proposedMetrics.assignmentDelta})</span>}</span>
            </div>
            <div className="flex justify-between text-xs"><span className="text-slate-500">Crew deployed</span><span className="font-bold tabular-nums">{proposedMetrics.crewDeployed}</span></div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Est. cost</span>
              <span className="font-bold tabular-nums">£{proposedMetrics.estimatedCost.toLocaleString()} {proposedMetrics.costDelta !== 0 && <span className={proposedMetrics.costDelta > 0 ? 'text-rose-600' : 'text-emerald-600'}>({proposedMetrics.costDelta > 0 ? '+' : ''}£{proposedMetrics.costDelta.toLocaleString()})</span>}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Proposed changes list */}
      {Object.keys(proposedChanges).length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-700">Proposed Changes ({Object.keys(proposedChanges).length})</p>
          {Object.entries(proposedChanges).map(([key, c]) => (
            <div key={key} className="flex items-center gap-2 p-2 rounded-lg bg-violet-50 border border-violet-200">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-600">ADD</span>
              <span className="text-xs text-slate-700 flex-1">{c.staffName} → {c.jobName} on {new Date(c.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}</span>
              <button onClick={() => toggleChange(c.staffId, c.staffName, c.date, c.jobId, c.jobName)} className="p-1 rounded hover:bg-violet-100">
                <X className="w-3 h-3 text-violet-500" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Analyze button */}
      <button onClick={handleAnalyze} disabled={analyzing || Object.keys(proposedChanges).length === 0}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl command-gradient text-white text-sm font-semibold disabled:opacity-50 transition active:scale-95">
        {analyzing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing impact...</> : <><TrendingUp className="w-4 h-4" /> Analyze Impact</>}
      </button>

      {/* Analysis results */}
      {analysis && !analysis.error && (
        <div className="space-y-2 animate-slide-up">
          <div className={`p-3 rounded-xl border ${analysis.recommendation === 'approve' ? 'bg-emerald-50 border-emerald-200' : analysis.recommendation === 'reject' ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex items-center gap-2 mb-1">
              {analysis.recommendation === 'approve' ? <Check className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-amber-600" />}
              <span className="text-sm font-bold text-slate-900">Recommendation: {analysis.recommendation?.toUpperCase()}</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">{analysis.reasoning}</p>
          </div>
          {analysis.risk_factors && analysis.risk_factors.length > 0 && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
              <p className="text-xs font-bold text-rose-900 mb-1">Risk Factors</p>
              <ul className="space-y-0.5">
                {analysis.risk_factors.map((r, i) => <li key={i} className="text-xs text-rose-700">• {r}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}