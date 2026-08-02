import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Activity } from 'lucide-react';
import { format, subDays, isWithinInterval, parseISO } from 'date-fns';

/**
 * RigUtilizationSparkline — compact 7-day utilization indicator for a rig
 * card. Fetches the rig's asset assignments and shows which of the last 7
 * days the rig was on a job (green bar) vs idle (grey bar). Gives at-a-glance
 * utilization trend without opening the detail drawer.
 */
export default function RigUtilizationSparkline({ rigId }) {
  const { data: assignments = [] } = useQuery({
    queryKey: ['rig-util-7d', rigId],
    queryFn: () => base44.entities.JobAssetAssignment.filter({ asset_id: rigId }),
    enabled: !!rigId,
    staleTime: 5 * 60 * 1000,
  });

  const days = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const date = subDays(today, 6 - i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayDate = parseISO(dateStr);

      // A rig is utilized on a day if any assignment covers that day:
      // assigned_date <= day <= (returned_date or today)
      const utilized = assignments.some((a) => {
        if (!a.assigned_date) return false;
        const start = parseISO(a.assigned_date);
        const end = a.returned_date ? parseISO(a.returned_date) : today;
        try {
          return isWithinInterval(dayDate, { start, end });
        } catch {
          return false;
        }
      });

      return { date: dateStr, label: format(date, 'EEE').slice(0, 1), utilized };
    });
  }, [assignments]);

  const utilizedCount = days.filter((d) => d.utilized).length;
  const pct = Math.round((utilizedCount / 7) * 100);

  return (
    <div className="mt-2.5">
      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
        <span className="inline-flex items-center gap-0.5"><Activity className="w-2.5 h-2.5" /> 7-day util</span>
        <span className={`font-semibold ${pct >= 70 ? 'text-emerald-600' : pct >= 40 ? 'text-amber-600' : 'text-slate-500'}`}>{pct}%</span>
      </div>
      <div className="flex items-end gap-1 h-6">
        {days.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
            <div
              className={`w-full rounded-sm transition-all ${d.utilized ? 'bg-gradient-to-t from-[#2E5A1A] to-[#5A8C1E]' : 'bg-slate-200'}`}
              style={{ height: d.utilized ? '100%' : '30%' }}
              title={`${format(parseISO(d.date), 'EEE dd MMM')}: ${d.utilized ? 'On job' : 'Idle'}`}
            />
            <span className="text-[8px] text-slate-400 font-medium">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}