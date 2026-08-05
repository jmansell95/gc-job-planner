import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Waves, AlertTriangle, RefreshCw, MapPin, Droplets } from 'lucide-react';

const RISK_CONFIG = {
  none: { label: 'No Flood Risk', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', Icon: Waves },
  low: { label: 'Low Risk', color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', Icon: Waves },
  moderate: { label: 'Flood Alert', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', Icon: AlertTriangle },
  high: { label: 'Flood Warning', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', Icon: AlertTriangle },
  severe: { label: 'Severe Flood', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', Icon: AlertTriangle },
};

export default function FloodRiskWidget({ lat, lng, locationName }) {
  const [checking, setChecking] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['flood-risk', lat, lng],
    queryFn: async () => {
      const res = await base44.functions.invoke('checkFloodRisk', { lat, lng, radius_km: 5 });
      return res?.data ?? res;
    },
    enabled: lat != null && lng != null,
  });

  if (lat == null || lng == null) {
    return (
      <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3">
        <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <p className="text-xs text-slate-500">Set site coordinates to check flood risk.</p>
      </div>
    );
  }

  const level = data?.flood_risk_level || 'none';
  const config = RISK_CONFIG[level] || RISK_CONFIG.none;
  const warnings = data?.warnings || [];
  const RiskIcon = config.Icon;

  return (
    <div className={`rounded-xl border-2 ${config.border} ${config.bg} overflow-hidden`}>
      <div className="px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-lg ${config.bg} border ${config.border} flex items-center justify-center`}>
            <RiskIcon className={`w-5 h-5 ${config.color}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-800">Flood Risk</h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${config.bg} ${config.color} border ${config.border}`}>
                {config.label}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              {locationName ? `${locationName} · ` : ''}EA flood warnings within 5km
            </p>
          </div>
        </div>
        <button onClick={() => refetch()} disabled={isLoading}
          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white/50 rounded-lg transition disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {isLoading ? (
        <div className="px-4 pb-3 text-xs text-slate-400">Checking Environment Agency flood warnings…</div>
      ) : warnings.length === 0 ? (
        <div className="px-4 pb-3 flex items-center gap-2 text-xs text-emerald-600">
          <Waves className="w-3.5 h-3.5" />
          <span>No active flood warnings near this site.</span>
        </div>
      ) : (
        <div className="px-4 pb-3 space-y-1.5">
          <p className="text-[11px] font-semibold text-slate-500">
            {warnings.length} active warning{warnings.length !== 1 ? 's' : ''} nearby:
          </p>
          {warnings.slice(0, 3).map((w, i) => (
            <div key={i} className="flex items-start gap-2 bg-white/60 rounded-lg p-2 border border-slate-100">
              <Droplets className="w-3 h-3 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-slate-700 truncate">{w.description}</p>
                <p className="text-[10px] text-slate-400">
                  {w.severity} · {w.distance_km}km away
                </p>
              </div>
            </div>
          ))}
          {warnings.length > 3 && (
            <p className="text-[10px] text-slate-400 text-center">+{warnings.length - 3} more warnings</p>
          )}
        </div>
      )}
    </div>
  );
}