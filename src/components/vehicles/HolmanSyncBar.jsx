import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Loader2, Link2, Link2Off, AlertTriangle, Check } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function HolmanSyncBar() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);

  const handleSync = async () => {
    setSyncing(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('syncHolmanFleet', { action: 'sync' });
      const d = res.data || res;
      setResult({ ok: !!d.ok, msg: d.message || d.error || 'Sync complete', synced: d.synced || 0, unmatched: d.unmatched || 0, total: d.total || 0 });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    } catch (e) {
      setResult({ ok: false, msg: e.message || 'Sync failed' });
    }
    setSyncing(false);
  };

  const handleTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('syncHolmanFleet', { action: 'test' });
      const d = res.data || res;
      setResult({ ok: !!d.ok, msg: d.message || d.error || 'Unknown response' });
    } catch (e) {
      setResult({ ok: false, msg: e.message || 'Test failed' });
    }
    setTesting(false);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 flex-1 min-w-0">
        <Link2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
        <span className="truncate">Holman Fleet Sync</span>
        <span className="text-xs text-slate-400 font-normal hidden sm:inline">Auto-syncs MOT, service dates & mileage</span>
      </div>
      <button onClick={handleTest} disabled={testing}
        className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50">
        {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2Off className="w-3.5 h-3.5" />} Test
      </button>
      <button onClick={handleSync} disabled={syncing}
        className="flex items-center gap-1.5 px-3.5 py-2 bg-[#2E5A1A] text-white rounded-lg text-xs font-bold hover:bg-[#1c4a12] disabled:opacity-50 transition">
        {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Sync Now
      </button>
      {result && (
        <div className={`w-full flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${result.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
          {result.ok ? <Check className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> : <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
          <span>{result.msg}</span>
        </div>
      )}
    </div>
  );
}