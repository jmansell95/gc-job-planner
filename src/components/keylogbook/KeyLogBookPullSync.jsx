import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { DownloadCloud, CheckCircle2, AlertCircle, Loader2, RefreshCw, Clock } from 'lucide-react';

/**
 * Pull Sync panel for KeyLogBook — fetches all historical data from the
 * KeyLogBook REST API (projects, boreholes, driller remarks) and keeps it
 * in sync on a 30-minute schedule. Complements the real-time webhook.
 */
export default function KeyLogBookPullSync({ config }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);

  const handlePull = async () => {
    setSyncing(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('syncKeyLogBook');
      const data = res.data || res;
      if (data.error) throw new Error(data.error);
      setResult({ ok: true, summary: data.summary, counts: data });
      toast({ title: 'KeyLogBook pull complete', description: data.summary });
    } catch (e) {
      setResult({ ok: false, error: e.message });
      toast({ title: 'Pull sync failed', description: e.message, variant: 'destructive' });
    } finally {
      setSyncing(false);
      queryClient.invalidateQueries({ queryKey: ['keylogbook-config'] });
    }
  };

  const lastStatus = config?.last_pull_sync_status || 'never';
  const statusConfig = {
    success: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Last pull: Success' },
    failed: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Last pull: Failed' },
    never: { icon: Clock, color: 'text-slate-400', bg: 'bg-slate-50', label: 'No pull sync yet' },
  };
  const StatusIcon = statusConfig[lastStatus].icon;
  const hasCredentials = !!config?.api_base_url && !!config?.api_key;

  return (
    <div className="space-y-3">
      {/* Status panel */}
      {config?.last_pull_sync_at && (
        <div className={`flex items-start gap-2.5 p-3.5 rounded-xl border ${statusConfig[lastStatus].bg} border-slate-100`}>
          <StatusIcon className={`w-4 h-4 ${statusConfig[lastStatus].color} flex-shrink-0 mt-0.5`} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">{statusConfig[lastStatus].label}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {new Date(config.last_pull_sync_at).toLocaleString('en-GB')}
            </p>
            {config.last_pull_sync_summary && (
              <p className="text-xs text-slate-600 mt-1">{config.last_pull_sync_summary}</p>
            )}
          </div>
        </div>
      )}

      {/* Pull button */}
      <button
        onClick={handlePull}
        disabled={syncing || !hasCredentials}
        className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-[#2E5A1A] text-white rounded-lg text-sm font-semibold hover:bg-[#1c4a12] disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {syncing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Pulling from KeyLogBook…
          </>
        ) : (
          <>
            <DownloadCloud className="w-4 h-4" />
            Pull All from KeyLogBook
          </>
        )}
      </button>

      {/* Missing credentials warning */}
      {!hasCredentials && (
        <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>Enter the KeyLogBook API base URL and API key in the "API details" section above, then save before pulling.</span>
        </div>
      )}

      {/* Result panel */}
      {result && (
        <div className={`flex items-start gap-3 p-4 rounded-xl border ${result.ok ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'} animate-slide-up`}>
          {result.ok ? <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />}
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-bold ${result.ok ? 'text-emerald-900' : 'text-red-900'}`}>
              {result.ok ? 'Pull sync complete' : 'Pull sync failed'}
            </p>
            <p className={`text-xs mt-1 ${result.ok ? 'text-emerald-700' : 'text-red-700'}`}>
              {result.ok ? result.summary : result.error}
            </p>
          </div>
        </div>
      )}

      {/* Help text */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <RefreshCw className="w-3.5 h-3.5 flex-shrink-0" />
        <span>
          Fetches all projects, boreholes, and driller remarks from the KeyLogBook API.
          Also runs automatically every 30 minutes. New data pushed via webhook appears instantly.
        </span>
      </div>
    </div>
  );
}