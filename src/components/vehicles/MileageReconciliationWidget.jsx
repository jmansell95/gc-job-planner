import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Gauge, AlertTriangle, CheckCircle2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

export default function MileageReconciliationWidget() {
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['mileage-reconciliation'],
    queryFn: async () => {
      const res = await base44.functions.invoke('checkMileageDiscrepancies', {});
      return res?.data ?? res;
    },
  });

  const discrepancies = data?.discrepancies || [];
  const matched = data?.matched || [];
  const checked = data?.checked || 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${discrepancies.length > 0 ? 'bg-amber-50' : 'bg-emerald-50'}`}>
            <Gauge className={`w-4 h-4 ${discrepancies.length > 0 ? 'text-amber-600' : 'text-emerald-600'}`} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Mileage Reconciliation</h3>
            <p className="text-[11px] text-slate-400">Geotab vs Holman odometer cross-check</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {discrepancies.length > 0 ? (
            <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
              {discrepancies.length} discrepancy{discrepancies.length !== 1 ? 'ies' : ''}
            </span>
          ) : !isLoading && checked > 0 ? (
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
              All matched
            </span>
          ) : null}
          <button onClick={() => refetch()} disabled={isFetching}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="px-4 pb-4 text-center text-xs text-slate-400">Checking mileage data…</div>
      ) : checked === 0 ? (
        <div className="px-4 pb-4 text-center text-xs text-slate-400">
          No vehicles synced from both Geotab and Holman yet.
        </div>
      ) : (
        <div className="px-4 pb-3">
          {/* Summary strip */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-slate-50 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-slate-700 tabular-nums">{checked}</p>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Checked</p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-emerald-700 tabular-nums">{matched.length}</p>
              <p className="text-[10px] text-emerald-500 uppercase font-semibold">Matched</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-amber-700 tabular-nums">{discrepancies.length}</p>
              <p className="text-[10px] text-amber-500 uppercase font-semibold">Flagged</p>
            </div>
          </div>

          {/* Discrepancy list */}
          {discrepancies.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-amber-700 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Discrepancies (&gt;50 mi)
                </p>
                <button onClick={() => setExpanded(!expanded)}
                  className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-0.5">
                  {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {expanded ? 'Hide' : 'Show all'}
                </button>
              </div>
              <div className="space-y-1">
                {(expanded ? discrepancies : discrepancies.slice(0, 3)).map(d => (
                  <div key={d.vehicle_id} className="flex items-center gap-2 bg-amber-50/50 border border-amber-100 rounded-lg p-2">
                    <span className="font-mono text-xs font-bold text-slate-700 flex-shrink-0">{d.registration_number}</span>
                    <div className="flex-1 flex items-center gap-2 text-[11px]">
                      <span className="text-cyan-600">Geotab: <strong>{d.geotab_miles.toLocaleString()}</strong></span>
                      <span className="text-slate-300">vs</span>
                      <span className="text-blue-600">Holman: <strong>{d.holman_miles.toLocaleString()}</strong></span>
                    </div>
                    <span className="text-xs font-bold text-amber-700 flex-shrink-0">±{d.difference.toLocaleString()} mi</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {discrepancies.length === 0 && (
            <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 rounded-lg p-2.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>All {checked} dual-synced vehicles have matching mileage within ±50 miles.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}