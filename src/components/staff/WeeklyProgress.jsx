import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { Ruler, TrendingUp, Award } from 'lucide-react';

// Weekly progress counter — motivates crews by showing their contribution
// this week (metres drilled, units completed). Shown on the mobile dashboard.
export default function WeeklyProgress({ staffId }) {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd');

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['subcon-weekly-progress', staffId],
    queryFn: async () => {
      if (!staffId) return [];
      const all = await base44.entities.InvestigationLog.filter({ staff_id: staffId });
      return all.filter(l => {
        const d = l.date || '';
        return d >= weekStartStr && d <= weekEndStr;
      });
    },
    enabled: !!staffId,
  });

  const metersDrilled = logs
    .filter(l => (l.units_label || '').toLowerCase().includes('metre'))
    .reduce((sum, l) => sum + (l.units_completed || 0), 0);

  const unitsCompleted = logs
    .filter(l => !(l.units_label || '').toLowerCase().includes('metre') && l.units_completed)
    .reduce((sum, l) => sum + (l.units_completed || 0), 0);

  const logsCount = logs.length;

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-2.5">
        {[0,1,2].map(i => <div key={i} className="bg-white rounded-xl border border-slate-200 h-20 animate-pulse" />)}
      </div>
    );
  }

  const stats = [
    { icon: Ruler, value: metersDrilled > 0 ? metersDrilled.toFixed(1) : '0', label: 'Metres', color: 'blue' },
    { icon: TrendingUp, value: unitsCompleted, label: 'Units', color: 'amber' },
    { icon: Award, value: logsCount, label: 'Logs', color: 'emerald' },
  ];

  const colorMap = {
    blue: 'from-blue-500 to-blue-600',
    amber: 'from-amber-500 to-amber-600',
    emerald: 'from-emerald-500 to-emerald-600',
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-2 px-1">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
          This Week · {format(weekStart, 'dd')}–{format(weekEnd, 'dd MMM')}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-3 text-center shadow-sm">
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${colorMap[s.color]} flex items-center justify-center mx-auto mb-1.5 shadow-sm`}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              <p className="text-xl font-bold text-slate-900 tabular-nums">{s.value}</p>
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">{s.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}