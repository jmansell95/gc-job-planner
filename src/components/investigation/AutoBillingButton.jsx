import React, { useState } from 'react';
import { Brain, Loader2, CheckCircle2, AlertCircle, PoundSterling } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

/**
 * AutoBillingButton — calls the autoCreateBillingFromRemarks backend
 * function to detect billable events from a driller diary / investigation
 * log's remarks using LLM, and auto-creates JobCostItem billing entries.
 */
export default function AutoBillingButton({ logId }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const { toast } = useToast();

  const handleAnalyze = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('autoCreateBillingFromRemarks', { log_id: logId });
      if (res.data?.error) {
        setResult({ error: res.data.error });
      } else {
        setResult(res.data);
        toast({
          title: 'Billing Detection Complete',
          description: res.data?.message || 'Billable events detected.',
        });
      }
    } catch (e) {
      setResult({ error: e.message });
    } finally {
      setLoading(false);
    }
  };

  if (result && !result.error) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-medium border border-emerald-200">
        <CheckCircle2 className="w-3 h-3" />
        {result.created > 0 ? `${result.created} billing item(s) created` : 'No billable events found'}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={handleAnalyze}
        disabled={loading || !logId}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-50 text-violet-700 text-[11px] font-medium border border-violet-200 hover:bg-violet-100 transition disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
        {loading ? 'Detecting...' : 'Auto-Detect Billing'}
      </button>
      {result?.error && (
        <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-rose-600">
          <AlertCircle className="w-3 h-3" /> {result.error}
        </span>
      )}
    </div>
  );
}