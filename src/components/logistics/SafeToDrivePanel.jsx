import React from 'react';
import { Weight, ShieldCheck, ShieldAlert, ShieldX, HelpCircle, Truck } from 'lucide-react';
import { getPayloadStatus } from '@/utils/loadWeight';

const STATUS_META = {
  safe: { Icon: ShieldCheck, bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', label: 'Safe to Drive', barBg: 'bg-emerald-500' },
  near: { Icon: ShieldAlert, bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', label: 'Near Limit', barBg: 'bg-amber-500' },
  over: { Icon: ShieldX, bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', label: 'Overloaded', barBg: 'bg-rose-500' },
  unknown: { Icon: HelpCircle, bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-500', label: 'No Payload Limit', barBg: 'bg-slate-400' },
};

/**
 * Safe-to-drive payload panel — shows the assigned vehicle's max payload,
 * total loaded weight for the day's runs, a status badge, and axle load
 * guidance. Placed at the top of each driver's run in the DriverDayPlan
 * so it's the first thing the driver sees before setting off.
 */
export default function SafeToDrivePanel({ vehicle, totalLoadedKg, axleGuidanceNote, stopsCount }) {
  const maxWeight = vehicle?.max_weight_kg || null;
  const status = getPayloadStatus(totalLoadedKg, maxWeight);
  const meta = STATUS_META[status.status];

  return (
    <div className={`rounded-xl border ${meta.border} ${meta.bg} p-3 mb-3`}>
      <div className="flex items-center gap-2.5 mb-2">
        <div className={`w-9 h-9 rounded-lg ${meta.bg} border ${meta.border} flex items-center justify-center flex-shrink-0`}>
          <meta.Icon className={`w-5 h-5 ${meta.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-bold ${meta.text}`}>{meta.label}</p>
            {vehicle?.registration_number && (
              <span className="text-[11px] font-mono font-semibold text-slate-500 truncate">{vehicle.registration_number}</span>
            )}
          </div>
          <p className="text-[11px] text-slate-500">
            {stopsCount} stop{stopsCount !== 1 ? 's' : ''} · {Math.round(totalLoadedKg)} kg loaded
            {maxWeight ? ` / ${Math.round(maxWeight)} kg limit` : ''}
          </p>
        </div>
      </div>

      {maxWeight > 0 && (
        <div className="h-2 bg-white/60 rounded-full overflow-hidden mb-2">
          <div className={`h-full rounded-full ${meta.barBg} transition-all`} style={{ width: `${status.pct}%` }} />
        </div>
      )}

      {axleGuidanceNote && totalLoadedKg > 0 && (
        <div className="bg-white/60 rounded-lg p-2 mt-1">
          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-0.5 flex items-center gap-1">
            <Truck className="w-3 h-3" /> Axle Load Guidance
          </p>
          <p className="text-[11px] text-slate-600 leading-snug">{axleGuidanceNote}</p>
        </div>
      )}

      {status.status === 'over' && (
        <div className="flex items-center gap-1.5 mt-2 text-[11px] font-bold text-rose-700 bg-rose-100 rounded-lg px-2 py-1.5">
          <ShieldX className="w-3.5 h-3.5" /> Overloaded — remove items or use a larger vehicle before driving.
        </div>
      )}
    </div>
  );
}