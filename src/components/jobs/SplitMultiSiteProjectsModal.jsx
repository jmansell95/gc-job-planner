import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { GitBranch, Loader2, AlertTriangle, CheckCircle2, X, ArrowRight } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

/**
 * SplitMultiSiteProjectsModal — admin migration tool that splits existing
 * multi-site jobs into standalone projects. Shows a dry-run split plan first,
 * then executes on confirmation.
 */
export default function SplitMultiSiteProjectsModal({ open, onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [plan, setPlan] = useState(null);
  const [result, setResult] = useState(null);

  React.useEffect(() => {
    if (!open) { setPlan(null); setResult(null); setLoading(false); setExecuting(false); return; }
    setLoading(true);
    base44.functions.invoke('splitMultiSiteJobs', { dry_run: true })
      .then((res) => setPlan(res.data || res))
      .catch((e) => toast({ title: 'Could not load split plan', description: e?.message, variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const execute = async () => {
    setExecuting(true);
    try {
      const res = await base44.functions.invoke('splitMultiSiteJobs', { dry_run: false });
      setResult(res.data || res);
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast({ title: 'Migration complete', description: 'Multi-site jobs split into standalone projects.' });
    } catch (e) {
      toast({ title: 'Migration failed', description: e?.message, variant: 'destructive' });
    }
    setExecuting(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden rounded-t-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-violet-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center">
              <GitBranch className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Split Multi-Site Projects</h2>
              <p className="text-xs text-slate-400">One-off migration — each site becomes its own standalone project</p>
            </div>
          </div>
          <button onClick={onClose} type="button" className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
            </div>
          )}

          {!loading && plan && !result && (
            <>
              <div className={`rounded-xl border p-3 ${plan.multi_site_count > 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                <div className="flex items-center gap-2">
                  {plan.multi_site_count > 0
                    ? <AlertTriangle className="w-4 h-4 text-amber-600" />
                    : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                  <p className="text-sm font-semibold text-slate-800">
                    {plan.multi_site_count > 0
                      ? `${plan.multi_site_count} project${plan.multi_site_count !== 1 ? 's' : ''} have multiple sites`
                      : 'No multi-site projects found — nothing to split.'}
                  </p>
                </div>
              </div>

              {plan.split_plan && plan.split_plan.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Split Plan</p>
                  {plan.split_plan.map((item) => (
                    <div key={item.job_id} className="bg-slate-50 rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-sm font-bold text-slate-800 truncate flex-1">{item.job_name}</span>
                        <span className="text-xs font-mono text-slate-500">{item.job_reference || '—'}</span>
                        <span className="px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full text-[10px] font-bold">
                          {item.additional_sites} new project{item.additional_sites !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {item.sites.map((s, i) => (
                          <span key={i} className="inline-flex items-center gap-1 text-[11px] text-slate-500 bg-white border border-slate-200 rounded-full px-2 py-0.5">
                            <ArrowRight className="w-2.5 h-2.5 text-violet-400" /> {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mt-3">
                    <p className="text-[11px] text-blue-700">
                      Each additional site becomes a new standalone project with a <strong>PRJ-</strong> reference,
                      copying the client, dates and billing settings. AFPs, BOQ lines and rota assignments stay
                      on the original project — the new projects start with empty billing.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {!loading && result && (
            <div className="space-y-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <div>
                  <p className="text-sm font-bold text-emerald-800">Migration complete</p>
                  <p className="text-xs text-emerald-700">
                    {result.jobs_processed} project{result.jobs_processed !== 1 ? 's' : ''} processed ·
                    {' '}{result.total_sites_split} site{result.total_sites_split !== 1 ? 's' : ''} split into new projects.
                  </p>
                </div>
              </div>
              {result.results && result.results.map((r) => (
                <div key={r.job_id} className="bg-slate-50 rounded-xl border border-slate-200 p-3">
                  <p className="text-sm font-semibold text-slate-800 mb-1.5">{r.job_name}</p>
                  {r.splits.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                      <ArrowRight className="w-3 h-3 text-violet-400" />
                      <span>{s.site_name}</span>
                      {s.new_reference && <span className="font-mono text-violet-700 font-bold">{s.new_reference}</span>}
                      {s.error && <span className="text-rose-600">· error: {s.error}</span>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-5 py-4 border-t border-slate-100 bg-white">
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-slate-500 hover:text-slate-700 text-sm font-medium transition">
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && plan && plan.multi_site_count > 0 && (
            <button
              type="button"
              onClick={execute}
              disabled={executing}
              className="flex-1 px-4 py-2.5 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {executing ? <><Loader2 className="w-4 h-4 animate-spin" /> Splitting…</> : <><GitBranch className="w-4 h-4" /> Split {plan.multi_site_count} Project{plan.multi_site_count !== 1 ? 's' : ''}</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}