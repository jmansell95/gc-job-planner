import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import {
  Loader2, Satellite, Link2, Zap, Clock, Check, AlertTriangle, FileBarChart,
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

  // Only count Geotab devices that match actual Vehicle records in our DB.
  // The Geotab database can contain devices not in our system, so filtering
  // by vehicle_id prevents inflated "tracked" counts.
  const vehicleIds = new Set(vehicles.map(v => v.id));
  const trackedVehicles = (liveData?.vehicles || []).filter(v => v.vehicle_id && vehicleIds.has(v.vehicle_id));
  const trackedCount = trackedVehicles.length;
  const movingCount = trackedVehicles.filter(v => v.ignition_on).length;
  const stoppedCount = trackedCount - movingCount;

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
    <div className="rounded-2xl overflow-hidden shadow-lg mb-4 mesh-bg relative">
      <div className="relative z-10 px-4 py-3 flex flex-wrap items-center gap-3">
        {/* Live status chips */}
        <div className="flex items-center gap-3 text-white">
          <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-lg px-2.5 py-1.5">
            <Satellite className="w-4 h-4" />
            <span className="text-sm font-bold tabular-nums">{trackedCount}</span>
            <span className="text-[10px] text-white/70 font-medium">tracked</span>
          </div>
          <div className="flex items-center gap-1.5 bg-emerald-500/30 backdrop-blur-sm rounded-lg px-2.5 py-1.5">
            <Zap className="w-3.5 h-3.5 text-emerald-200" />
            <span className="text-sm font-bold tabular-nums">{movingCount}</span>
            <span className="text-[10px] text-white/70 font-medium">moving</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 bg-white/10 backdrop-blur-sm rounded-lg px-2.5 py-1.5">
            <Clock className="w-3.5 h-3.5 text-white/60" />
            <span className="text-sm font-semibold tabular-nums">{stoppedCount}</span>
            <span className="text-[10px] text-white/60 font-medium">stopped</span>
          </div>
        </div>

        <div className="flex-1" />

        {/* Sync buttons — bold, in-your-face */}
        <button onClick={handleGeotabSync} disabled={geotabSyncing}
          className="flex items-center gap-1.5 px-4 py-2 bg-white text-cyan-700 rounded-lg text-xs font-bold hover:bg-cyan-50 transition disabled:opacity-50 shadow-md">
          {geotabSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Satellite className="w-3.5 h-3.5" />} Sync Geotab
        </button>
        <button onClick={handleHolmanSync} disabled={holmanSyncing}
          className="flex items-center gap-1.5 px-4 py-2 bg-white text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-50 transition disabled:opacity-50 shadow-md">
          {holmanSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />} Sync Holman
        </button>
        {onShowReport && (
          <button onClick={onShowReport}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white/15 backdrop-blur-sm text-white rounded-lg text-xs font-bold hover:bg-white/25 transition">
            <FileBarChart className="w-3.5 h-3.5" /> Reports
          </button>
        )}
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