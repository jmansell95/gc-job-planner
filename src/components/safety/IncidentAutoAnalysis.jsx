import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Brain, Loader2, Sparkles, CheckCircle2, AlertCircle, Lightbulb } from 'lucide-react';

/**
 * IncidentAutoAnalysis — uses InvokeLLM to analyze an incident/near-miss
 * and auto-suggest corrective actions based on similar historical incidents
 * and standard RAMS protocols. Embedded in the IncidentReporter component.
 */
export default function IncidentAutoAnalysis({ incident, onApplySuggestions }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const prompt = `You are a health and safety analyst for a UK geotechnical drilling and groundworks company. Analyze this incident and suggest corrective actions.

Incident Type: ${incident?.type || 'Unknown'}
Severity: ${incident?.severity || 'Unknown'}
Description: ${incident?.description || 'No description provided'}
Immediate Action Taken: ${incident?.immediate_action || 'None recorded'}
Job: ${incident?.job_name || 'Unknown'}
Location: ${incident?.location || 'Unknown'}

Based on UK HSE guidelines, RIDDOR requirements, and standard RAMS protocols for drilling/groundworks, provide:

1. Root cause analysis (most likely contributing factors)
2. Recommended corrective actions (specific, actionable)
3. Whether this is RIDDOR-reportable and why
4. Similar incident patterns to watch for

Return as JSON:
{
  "root_cause": "Analysis of likely root causes",
  "corrective_actions": [
    { "action": "Specific corrective action", "priority": "high|medium|low", "owner": "Suggested responsible role" }
  ],
  "riddor_reportable": boolean,
  "riddor_reason": "Why it is or isn't RIDDOR-reportable",
  "prevention_notes": "Patterns to watch for to prevent recurrence"
}`;

      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            root_cause: { type: 'string' },
            corrective_actions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  action: { type: 'string' },
                  priority: { type: 'string' },
                  owner: { type: 'string' },
                },
              },
            },
            riddor_reportable: { type: 'boolean' },
            riddor_reason: { type: 'string' },
            prevention_notes: { type: 'string' },
          },
        },
      });

      setAnalysis(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApply = () => {
    if (analysis && onApplySuggestions) {
      onApplySuggestions({
        root_cause: analysis.root_cause,
        corrective_actions: analysis.corrective_actions || [],
        riddor_reportable: analysis.riddor_reportable,
        riddor_reason: analysis.riddor_reason,
      });
    }
  };

  return (
    <div className="space-y-3">
      {/* Analyze button */}
      {!analysis && (
        <button onClick={handleAnalyze} disabled={analyzing || !incident?.description}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl command-gradient text-white text-sm font-semibold disabled:opacity-50 transition active:scale-95">
          {analyzing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing incident...</> : <><Brain className="w-4 h-4" /> Auto-Analyze with AI</>}
        </button>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 text-rose-700 text-xs">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Analysis results */}
      {analysis && (
        <div className="space-y-3 animate-slide-up">
          {/* Root cause */}
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
            <div className="flex items-center gap-2 mb-1.5">
              <Lightbulb className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold text-blue-900">Root Cause Analysis</span>
            </div>
            <p className="text-xs text-blue-800 leading-relaxed">{analysis.root_cause}</p>
          </div>

          {/* RIDDOR flag */}
          {analysis.riddor_reportable && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span className="text-xs font-bold text-rose-900">RIDDOR-Reportable</span>
              </div>
              <p className="text-xs text-rose-700 mt-1">{analysis.riddor_reason}</p>
            </div>
          )}

          {/* Corrective actions */}
          {analysis.corrective_actions && analysis.corrective_actions.length > 0 && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-emerald-900">Suggested Corrective Actions</span>
              </div>
              <div className="space-y-1.5">
                {analysis.corrective_actions.map((action, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${action.priority === 'high' ? 'bg-rose-100 text-rose-600' : action.priority === 'medium' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                      {action.priority?.toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-emerald-800">{action.action}</p>
                      {action.owner && <p className="text-[11px] text-emerald-500 mt-0.5">Suggested owner: {action.owner}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Prevention notes */}
          {analysis.prevention_notes && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs font-bold text-slate-700">Prevention Notes</span>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">{analysis.prevention_notes}</p>
            </div>
          )}

          {/* Apply button */}
          <button onClick={handleApply}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition active:scale-95">
            <Sparkles className="w-4 h-4" /> Apply Suggestions to Incident
          </button>
        </div>
      )}
    </div>
  );
}