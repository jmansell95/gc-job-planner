import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Brain, AlertOctagon, AlertTriangle, ShieldCheck, Gauge, CalendarClock, Wrench, TrendingUp, Loader2 } from 'lucide-react';
import { differenceInDays } from 'date-fns';

const RISK_CONFIG = {
  critical: { label: 'Critical', cls: 'bg-rose-100 text-rose-700 border-rose-200', dot: 'bg-rose-500', Icon: AlertOctagon },
  high: { label: 'High', cls: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500', Icon: AlertTriangle },
  moderate: { label: 'Moderate', cls: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-500', Icon: TrendingUp },
  low: { label: 'Low', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', Icon: ShieldCheck },
};

function daysLabel(days) {
  if (days == null) return '—';
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Today';
  return `in ${days}d`;
}

export default function PredictiveMaintenanceWidget({ onSelectVehicle }) {
  const { data, isLoading } = useQuery({
    queryKey: ['predictive-maintenance'],
    queryFn: async () => {
      const res = await base44.functions.invoke('predictMaintenance', {});
      return res?.data ?? res;
    },
    refetchInterval: 300000,
  });

  const vehicles = useMemo(() => (data?.vehicles || []).slice(0, 8), [data]);
  const summary = data?.summary;

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="w-4 h-4 text-violet-600" />
          <h3 className="text-sm font-bold text-slate-800">Predictive Maintenance</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-violet-600 animate-spin" />
        </div>
      </div>
    );
  }

  if (!summary || summary.total === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="w-4 h-4 text-violet-600" />
          <h3 className="text-sm font-bold text-slate-800">Predictive Maintenance</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <Brain className="w-8 h-8 text-slate-300 mb-2" />
          <p className="text-xs text-slate-400">No predictive data yet. Sync fleet mileage to generate forecasts.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-violet-50 to-white border-b border-slate-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-800 truncate">Predictive Maintenance</h3>
            <p className="text-[10px] text-slate-400 truncate">AI-ranked service & MOT forecasts</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {summary.critical > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">{summary.critical} critical</span>
          )}
          {summary.high > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{summary.high} high</span>
          )}
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-4 gap-px bg-slate-100">
        <div className="bg-white px-2 py-2 text-center">
          <p className="text-base font-bold text-slate-700 tabular-nums">{summary.total}</p>
          <p className="text-[9px] text-slate-400 uppercase font-medium">Tracked</p>
        </div>
        <div className="bg-white px-2 py-2 text-center">
          <p className="text-base font-bold text-rose-600 tabular-nums">{summary.mot_expired}</p>
          <p className="text-[9px] text-slate-400 uppercase font-medium">MOT Exp</p>
        </div>
        <div className="bg-white px-2 py-2 text-center">
          <p className="text-base font-bold text-amber-600 tabular-nums">{summary.mot_due_30d}</p>
          <p className="text-[9px] text-slate-400 uppercase font-medium">MOT 30d</p>
        </div>
        <div className="bg-white px-2 py-2 text-center">
          <p className="text-base font-bold text-blue-600 tabular-nums">{summary.service_overdue}</p>
          <p className="text-[9px] text-slate-400 uppercase font-medium">Svc Over</p>
        </div>
      </div>

      {/* Vehicle list */}
      <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
        {vehicles.map(v => {
          const cfg = RISK_CONFIG[v.risk_level] || RISK_CONFIG.low;
          const RiskIcon = cfg.Icon;
          return (
            <button
              key={v.vehicle_id}
              onClick={() => onSelectVehicle?.({ id: v.vehicle_id, registration_number: v.registration_number, name: v.vehicle_name })}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition text-left"
            >
              {/* Risk indicator */}
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border ${cfg.cls}`}>
                <RiskIcon className="w-4 h-4" />
              </div>

              {/* Vehicle info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate font-mono">{v.registration_number || 'No Reg'}</p>
                <p className="text-[11px] text-slate-400 truncate">
                  {[v.make, v.model].filter(Boolean).join(' ') || v.vehicle_name || 'Vehicle'}
                  {v.current_mileage > 0 && ` · ${v.current_mileage.toLocaleString()} mi`}
                </p>
                {/* Risk factors */}
                {v.risk_factors.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {v.risk_factors.slice(0, 2).map((f, i) => (
                      <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">{f}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Predicted dates */}
              <div className="flex-shrink-0 text-right space-y-0.5">
                {v.mot_days_remaining != null && (
                  <div className="flex items-center gap-1 justify-end">
                    <CalendarClock className={`w-3 h-3 ${v.mot_days_remaining < 0 ? 'text-rose-500' : v.mot_days_remaining <= 30 ? 'text-amber-500' : 'text-slate-400'}`} />
                    <span className={`text-[11px] font-semibold tabular-nums ${v.mot_days_remaining < 0 ? 'text-rose-600' : v.mot_days_remaining <= 30 ? 'text-amber-600' : 'text-slate-500'}`}>
                      {daysLabel(v.mot_days_remaining)}
                    </span>
                  </div>
                )}
                {v.service_days_remaining != null && (
                  <div className="flex items-center gap-1 justify-end">
                    <Wrench className={`w-3 h-3 ${v.service_days_remaining < 0 ? 'text-rose-500' : v.service_days_remaining <= 14 ? 'text-amber-500' : 'text-slate-400'}`} />
                    <span className={`text-[11px] font-semibold tabular-nums ${v.service_days_remaining < 0 ? 'text-rose-600' : v.service_days_remaining <= 14 ? 'text-amber-600' : 'text-slate-500'}`}>
                      {daysLabel(v.service_days_remaining)}
                    </span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {summary.total > 8 && (
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-center">
          <p className="text-[10px] text-slate-400">Showing top 8 of {summary.total} vehicles by risk</p>
        </div>
      )}
    </div>
  );
}