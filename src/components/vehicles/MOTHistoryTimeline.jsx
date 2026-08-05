import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ShieldCheck, ShieldX, ShieldAlert, Calendar, Gauge, Loader2, History } from 'lucide-react';

const RESULT_META = {
  pass: { label: 'PASS', Icon: ShieldCheck, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  fail: { label: 'FAIL', Icon: ShieldX, cls: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
  advisory: { label: 'ADVISORY', Icon: ShieldAlert, cls: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  prs: { label: 'PRS', Icon: ShieldAlert, cls: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  unknown: { label: 'UNKNOWN', Icon: ShieldAlert, cls: 'bg-slate-50 text-slate-500 border-slate-200', dot: 'bg-slate-400' },
};

const SOURCE_LABEL = {
  dvla_lookup: 'DVLA Lookup',
  manual: 'Manual Entry',
  holman_sync: 'Holman Sync',
};

/**
 * MOTHistoryTimeline — shows the MOT test history for a vehicle as a
 * vertical timeline with pass/fail badges, test dates, and expiry dates.
 */
export default function MOTHistoryTimeline({ vehicleId }) {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['vehicle-mot-history', vehicleId],
    queryFn: () => base44.entities.VehicleMOTHistory.filter({ vehicle_id: vehicleId }, '-test_date', 50),
    enabled: !!vehicleId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-4 bg-slate-50 rounded-lg">
        <History className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
        <p className="text-xs text-slate-400">No MOT history recorded yet.</p>
        <p className="text-[10px] text-slate-400 mt-0.5">Run a DVLA spec sync to capture MOT data automatically.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-slate-200" />

      <div className="space-y-3">
        {history.map((record, i) => {
          const meta = RESULT_META[record.result] || RESULT_META.unknown;
          const Icon = meta.Icon;
          const isFirst = i === 0;
          return (
            <div key={record.id} className="relative flex items-start gap-3">
              {/* Dot */}
              <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${meta.cls} border-2 ${isFirst ? 'ring-2 ring-offset-1 ring-emerald-200' : ''}`}>
                <Icon className="w-3 h-3" />
              </div>

              {/* Content */}
              <div className={`flex-1 rounded-lg p-2.5 border ${isFirst ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50/50 border-slate-100'}`}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${meta.cls} border`}>
                    {meta.label}
                  </span>
                  {isFirst && (
                    <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                      CURRENT
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <Calendar className="w-3 h-3" />
                  <span>{new Date(record.test_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
                {record.expiry_date && (
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Expires: {new Date(record.expiry_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                )}
                {record.odometer != null && (
                  <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                    <Gauge className="w-2.5 h-2.5" /> {Number(record.odometer).toLocaleString()} mi
                  </p>
                )}
                {record.advisory_notes && (
                  <p className="text-[10px] text-amber-700 bg-amber-50 rounded px-1.5 py-1 mt-1">{record.advisory_notes}</p>
                )}
                <p className="text-[9px] text-slate-300 mt-1">{SOURCE_LABEL[record.source] || record.source}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}