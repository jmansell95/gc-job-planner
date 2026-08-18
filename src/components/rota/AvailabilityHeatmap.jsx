import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Calendar, Coffee, Stethoscope, Users, Warehouse, Loader2 } from 'lucide-react';
import { format, startOfWeek, addDays, isSameDay, parseISO } from 'date-fns';
import { useDivision } from '@/contexts/DivisionContext';

// Availability Heatmap — overlays absence, training, and yard/depot
// status as colored background highlights on the rota grid so
// managers see availability conflicts instantly before assigning.

const TYPE_CONFIG = {
  annual_leave: { color: 'bg-blue-200/60', border: 'border-blue-300', icon: Coffee, label: 'AL' },
  sick: { color: 'bg-rose-200/60', border: 'border-rose-300', icon: Stethoscope, label: 'Sick' },
  training: { color: 'bg-amber-200/60', border: 'border-amber-300', icon: Users, label: 'Train' },
  yard_depot: { color: 'bg-slate-200/60', border: 'border-slate-300', icon: Warehouse, label: 'Yard' },
};

export default function AvailabilityHeatmap({ weekStart: propWeekStart }) {
  const [weekStart, setWeekStart] = useState(propWeekStart || format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const { activeDivisionId } = useDivision();

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['heatmap-staff'],
    queryFn: async () => { const r = await base44.entities.Staff.filter({ is_active: true }, 'full_name', 100); return r.data || r || []; },
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['heatmap-assignments', weekStart, activeDivisionId || 'overview'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getDivisionScopedData', { entity: 'RotaAssignment', division_id: activeDivisionId, filter: { week_start: weekStart }, sort: 'assigned_date', limit: 500 });
      return res.data?.data || [];
    },
  });

  const { data: absences = [] } = useQuery({
    queryKey: ['heatmap-absences'],
    queryFn: async () => { const r = await base44.entities.Absence.filter({ status: 'approved' }, 'start_date', 200); return r.data || r || []; },
  });

  const days = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const date = addDays(new Date(weekStart), i);
      return { date, dateStr: format(date, 'yyyy-MM-dd'), label: format(date, 'EEE dd') };
    });
  }, [weekStart]);

  const getDayStatus = (staffId, date) => {
    const dayAssignments = assignments.filter(a => a.staff_id === staffId && a.assigned_date === date);
    const nonJob = dayAssignments.find(a => a.assignment_type !== 'job');
    if (nonJob) return { type: nonJob.assignment_type, label: nonJob.non_job_label || TYPE_CONFIG[nonJob.assignment_type]?.label || '' };

    // Check approved absences
    const absence = absences.find(a => a.staff_id === staffId && {
      start: parseISO(a.start_date), end: parseISO(a.end_date || a.start_date),
    } && date >= parseISO(a.start_date) && date <= parseISO(a.end_date || a.start_date));
    if (absence) return { type: absence.absence_type || 'annual_leave', label: absence.absence_type === 'sick' ? 'Sick' : 'AL' };

    const hasJob = dayAssignments.some(a => a.assignment_type === 'job');
    if (hasJob) return { type: 'job', label: 'Job' };
    return null;
  };

  const isWeekend = (date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  return (
    <div className="insight-card rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#2E5A1A]" />
          <h3 className="font-bold text-slate-800">Availability Heatmap</h3>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setWeekStart(format(addDays(new Date(weekStart), -7), 'yyyy-MM-dd'))}
            className="px-2 py-1 text-xs rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600">← Prev</button>
          <button onClick={() => setWeekStart(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'))}
            className="px-3 py-1 text-xs rounded-lg bg-emerald-100 text-emerald-700 font-medium">Today</button>
          <button onClick={() => setWeekStart(format(addDays(new Date(weekStart), 7), 'yyyy-MM-dd'))}
            className="px-2 py-1 text-xs rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600">Next →</button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mb-3">
        <LegendItem color="bg-emerald-200/60" label="On Job" />
        <LegendItem color="bg-blue-200/60" label="Annual Leave" />
        <LegendItem color="bg-rose-200/60" label="Sick" />
        <LegendItem color="bg-amber-200/60" label="Training" />
        <LegendItem color="bg-slate-200/60" label="Yard/Depot" />
        <LegendItem color="bg-white border border-slate-200" label="Available" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 text-[#2E5A1A] animate-spin" /></div>
      ) : (
        <div className="overflow-x-auto">
          <div className="grid gap-1" style={{ gridTemplateColumns: `140px repeat(7, minmax(80px, 1fr))` }}>
            <div></div>
            {days.map(d => (
              <div key={d.dateStr} className={`text-center text-xs font-semibold py-1.5 rounded-lg ${isWeekend(d.date) ? 'bg-slate-100 text-slate-400' : 'bg-slate-50 text-slate-600'}`}>
                {d.label}
              </div>
            ))}
            {staff.slice(0, 20).map(s => (
              <React.Fragment key={s.id}>
                <div className="flex items-center px-2 py-1">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-green-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {(s.full_name || s.name || '?').charAt(0)}
                  </div>
                  <span className="ml-2 text-xs font-medium text-slate-700 truncate">{s.full_name || s.name}</span>
                </div>
                {days.map(d => {
                  const status = getDayStatus(s.id, d.dateStr);
                  const isAvail = !status;
                  const cfg = status ? TYPE_CONFIG[status.type] : null;
                  return (
                    <div key={d.dateStr} className={`min-h-[36px] rounded-lg border flex items-center justify-center text-xs font-medium transition ${
                      isWeekend(d.date) ? 'opacity-50' : ''
                    } ${
                      status?.type === 'job' ? 'bg-emerald-200/60 border-emerald-300 text-emerald-700' :
                      cfg ? `${cfg.color} ${cfg.border} text-slate-600` :
                      'bg-white border-slate-100 text-slate-300'
                    }`}>
                      {status?.type === 'job' ? 'Job' :
                       status?.label || (isAvail ? '—' : '')}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LegendItem({ color, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-4 h-4 rounded ${color}`} />
      <span className="text-xs text-slate-600">{label}</span>
    </div>
  );
}