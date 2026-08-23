import React from 'react';
import { Weight, Box, AlertTriangle } from 'lucide-react';

/**
 * Dual weight + volume progress bar with safe/near/over colour coding.
 * Green = safe, amber = within 90%, red = over capacity.
 * Reused by the load planner and scanner sign-out basket.
 */
export default function WeightProgressBar({ loadedWeightKg, maxWeightKg, loadedVolumeM3, maxVolumeM3, compact = false }) {
  const weightPct = maxWeightKg ? Math.min((loadedWeightKg / maxWeightKg) * 100, 100) : 0;
  const volumePct = maxVolumeM3 ? Math.min((loadedVolumeM3 / maxVolumeM3) * 100, 100) : 0;
  const overWeight = maxWeightKg && loadedWeightKg > maxWeightKg;
  const nearWeight = maxWeightKg && !overWeight && weightPct >= 90;
  const overVolume = maxVolumeM3 && loadedVolumeM3 > maxVolumeM3;
  const nearVolume = maxVolumeM3 && !overVolume && volumePct >= 90;

  const barColor = (over, near) => over ? 'bg-rose-500' : near ? 'bg-amber-500' : 'bg-emerald-500';
  const labelColor = (over, near) => over ? 'text-rose-600 font-bold' : near ? 'text-amber-600 font-bold' : 'text-slate-600';

  if (!maxWeightKg && !maxVolumeM3) return null;

  return (
    <div className={`space-y-1.5 ${compact ? '' : 'mt-2'}`}>
      {maxWeightKg > 0 && (
        <div>
          <div className="flex items-center justify-between text-[10px] mb-0.5">
            <span className="text-slate-500 font-medium inline-flex items-center gap-1">
              <Weight className="w-2.5 h-2.5" /> Weight capacity
            </span>
            <span className={labelColor(overWeight, nearWeight)}>
              {Math.round(loadedWeightKg)} / {Math.round(maxWeightKg)} kg
            </span>
          </div>
          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${barColor(overWeight, nearWeight)}`} style={{ width: `${weightPct}%` }} />
          </div>
        </div>
      )}
      {maxVolumeM3 > 0 && (
        <div>
          <div className="flex items-center justify-between text-[10px] mb-0.5">
            <span className="text-slate-500 font-medium inline-flex items-center gap-1">
              <Box className="w-2.5 h-2.5" /> Volume capacity
            </span>
            <span className={labelColor(overVolume, nearVolume)}>
              {loadedVolumeM3.toFixed(1)} / {maxVolumeM3.toFixed(1)} m³
            </span>
          </div>
          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${barColor(overVolume, nearVolume)}`} style={{ width: `${volumePct}%` }} />
          </div>
        </div>
      )}
      {(overWeight || overVolume) && (
        <div className="flex items-center gap-1.5 text-[10px] text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1">
          <AlertTriangle className="w-3 h-3 flex-shrink-0" /> Vehicle capacity exceeded — consider a larger vehicle or split the load.
        </div>
      )}
    </div>
  );
}