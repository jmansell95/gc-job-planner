import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import {
  Loader2, Satellite, Link2, Check, AlertTriangle, FileBarChart,
} from 'lucide-react';

/**
 * FleetSyncButtons — prominent, always-visible sync control bar for the
 * Fleet page header. Replaces the old buried sync bar inside Fleet Insights.
 * Gradient background makes it impossible to miss.
 */
export default function FleetSyncButtons({ liveData, onShowReport, vehicles = [] }) {
  const queryClient = useQueryClient();
  const [geotabSyncing, setGeotabSyncing] = useState(false);
  const [holmanSyncing, setHolmanSyncing] = useState(false);
  const [result, setResult] = useState(null);

  const handleGeotabSync = async () => {
    setGeotabSyncing(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('syncGeotabFleet', { action: 'sync' });
      const d = res.data || res;
      setResult({ ok: !!d.ok, msg: d.message || d.error || 'Geotab sync complete' });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['geotab-live-locations-fleet'] });
    } catch (e) {
      setResult({ ok: false, msg: e.message || 'Geotab sync failed' });
    }
    setGeotabSyncing(false);
  };

  const handleHolmanSync = async () => {
    setHolmanSyncing(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('syncHolmanFleet', { action: 'sync' });
      const d = res.data || res;
      setResult({ ok: !!d.ok, msg: d.message || d.error || 'Holman sync complete' });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    } catch (e) {
      setResult({ ok: false, msg: e.message || 'Holman sync failed' });
    }
    setHolmanSyncing(false);
  };

  return (
    <div className="rounded-2xl border border-slate-200 shadow-sm mb-4 bg-white relative">
      <div className="px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-slate-600 text-xs font-semibold flex-1 min-w-0">
          <Satellite className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <span className="truncate">Sync fleet data from Geotab & Holman</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={handleGeotabSync} disabled={geotabSyncing}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-lg text-xs font-bold hover:bg-cyan-100 transition disabled:opacity-50">
            {geotabSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Satellite className="w-3.5 h-3.5" />} Sync Geotab
          </button>
          <button onClick={handleHolmanSync} disabled={holmanSyncing}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold hover:bg-blue-100 transition disabled:opacity-50">
            {holmanSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />} Sync Holman
          </button>
          {onShowReport && (
            <button onClick={onShowReport}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-200 transition">
              <FileBarChart className="w-3.5 h-3.5" /> Reports
            </button>
          )}
        </div>
      </div>

      {result && (
        <div className={`mx-3 mb-3 flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${result.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
          {result.ok ? <Check className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> : <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
          <span>{result.msg}</span>
        </div>
      )}
    </div>
  );
}