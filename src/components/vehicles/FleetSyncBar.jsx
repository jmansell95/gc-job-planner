import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import {
  RefreshCw, Loader2, Satellite, Link2, Link2Off, FileBarChart,
  Check, AlertTriangle, Zap, Clock,
} from 'lucide-react';

/**
 * FleetSyncBar — unified sync control bar for the Fleet tab.
 * Combines Geotab (live telemetry) and Holman (compliance) sync buttons,
 * plus a refresh button and access to Geotab reports.
 */
export default function FleetSyncBar({ liveData, onShowReport }) {
  const queryClient = useQueryClient();
  const [geotabSyncing, setGeotabSyncing] = useState(false);
  const [holmanSyncing, setHolmanSyncing] = useState(false);
  const [holmanTesting, setHolmanTesting] = useState(false);
  const [result, setResult] = useState(null);

  const trackedCount = liveData?.vehicles?.length || 0;
  const movingCount = liveData?.vehicles?.filter(v => v.ignition_on).length || 0;

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

  const handleHolmanTest = async () => {
    setHolmanTesting(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('syncHolmanFleet', { action: 'test' });
      const d = res.data || res;
      setResult({ ok: !!d.ok, msg: d.message || d.error || 'Test complete' });
    } catch (e) {
      setResult({ ok: false, msg: e.message || 'Test failed' });
    }
    setHolmanTesting(false);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Live status strip */}
      <div className="px-4 py-2.5 bg-gradient-to-r from-cyan-50 to-blue-50 border-b border-slate-100 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Satellite className="w-4 h-4 text-cyan-600" />
          <span className="text-xs font-bold text-slate-700">{trackedCount} tracked</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-emerald-600" />
          <span className="text-xs font-semibold text-emerald-700">{movingCount} moving</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-500">{trackedCount - movingCount} stopped</span>
        </div>
      </div>

      {/* Sync buttons */}
      <div className="p-3 flex flex-wrap items-center gap-2">
        <button onClick={handleGeotabSync} disabled={geotabSyncing}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-cyan-600 text-white rounded-lg text-xs font-bold hover:bg-cyan-700 disabled:opacity-50 transition">
          {geotabSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Satellite className="w-3.5 h-3.5" />} Sync Geotab
        </button>
        <button onClick={handleHolmanSync} disabled={holmanSyncing}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-50 transition">
          {holmanSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />} Sync Holman
        </button>
        <button onClick={handleHolmanTest} disabled={holmanTesting}
          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50">
          {holmanTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2Off className="w-3.5 h-3.5" />} Test Holman
        </button>
        <div className="flex-1" />
        <button onClick={onShowReport}
          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition">
          <FileBarChart className="w-3.5 h-3.5" /> Reports
        </button>
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