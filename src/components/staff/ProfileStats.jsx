import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, startOfWeek, startOfMonth, isWithinInterval } from 'date-fns';
import { Clock, Calendar, ClipboardCheck, Ruler } from 'lucide-react';

const fmtH = (mins) => {
  const h = (Number(mins) || 0) / 60;
  return h.toFixed(1) + 'h';
};

export default function ProfileStats({ staffId, jobType }) {
  const { data: summaries = [] } = useQuery({
    queryKey: ['profile-stats', staffId],
    queryFn: () => base44.entities.Timesheet.filter({ staff_id: staffId, is_summary: true }, '-date', 200),
    enabled: !!staffId
  });

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);

  const validSummaries = summaries.filter(s => s.status !== 'rejected' && s.status !== 'deleted');

  const weekMins = validSummaries
    .filter(s => { try { return isWithinInterval(new Date(s.date + 'T00:00:00'), { start: weekStart, end: now }); } catch { return false; } })
    .reduce((sum, s) => sum + (Number(s.task_duration_minutes) || 0), 0);

  const monthMins = validSummaries
    .filter(s => { try { return isWithinInterval(new Date(s.date + 'T00:00:00'), { start: monthStart, end: now }); } catch { return false; } })
    .reduce((sum, s) => sum + (Number(s.task_duration_minutes) || 0), 0);

  const pendingCount = summaries.filter(s => s.status === 'submitted').length;
  const totalMeterage = validSummaries.reduce((sum, s) => sum + (Number(s.meterage) || 0), 0);
  const isDrillingCrew = jobType === 'cp_drilling' || jobType === 'rotary_drilling';

  const stats = [
    { label: 'This Week', value: fmtH(weekMins), icon: Clock, gradient: 'stat-gradient-emerald' },
    { label: 'This Month', value: fmtH(monthMins), icon: Calendar, gradient: 'stat-gradient-blue' },
    { label: 'Pending Approval', value: pendingCount, icon: ClipboardCheck, gradient: 'stat-gradient-amber' },
    ...(isDrillingCrew ? [{ label: 'Total Meterage', value: totalMeterage > 0 ? totalMeterage + 'm' : '—', icon: Ruler, gradient: 'stat-gradient-slate' }] : []),
  ];

  return (
    <div className={`grid grid-cols-2 gap-3 ${isDrillingCrew ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
      {stats.map(stat => (
        <div key={stat.label} className={`${stat.gradient} rounded-2xl p-4 text-white shadow-sm`}>
          <div className="flex items-center gap-2 mb-1.5">
            <stat.icon className="w-4 h-4 text-white/80" />
            <p className="text-xs font-medium text-white/80 uppercase tracking-wide">{stat.label}</p>
          </div>
          <p className="text-2xl font-bold">{stat.value}</p>
        </div>
      ))}
    </div>
  );
}