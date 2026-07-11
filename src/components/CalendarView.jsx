import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Calendar, ChevronLeft, ChevronRight, MapPin, Users as UsersIcon, Clock } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isToday, addMonths, parseISO } from 'date-fns';
import PageHeader from '@/components/PageHeader';
import { getJobPrimaryType, getJobTypeColor, getJobTypeLabel } from '@/utils/jobTeams';

const jobTypeColors = {
  groundworks: { dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  cp_drilling: { dot: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  rotary_drilling: { dot: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  enabling_works: { dot: 'bg-purple-500', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  depot: { dot: 'bg-slate-500', bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' },
};

const statusBadge = {
  assigned: 'bg-slate-100 text-slate-600',
  started: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
};

const OvertimeBadge = ({ assignment }) => {
  if (!assignment.is_overtime) return null;
  const mult = assignment.rate_multiplier != null && assignment.rate_multiplier !== ''
    ? Number(assignment.rate_multiplier)
    : null;
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold flex-shrink-0 whitespace-nowrap">
      OT{mult ? ` ${mult}x` : ''}
    </span>
  );
};

export default function CalendarView() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data: assignments = [] } = useQuery({ queryKey: ['calendar-assignments'], queryFn: () => base44.entities.RotaAssignment.list() });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: teams = [] } = useQuery({ queryKey: ['teams'], queryFn: () => base44.entities.Team.list() });
  const { data: jobTypes = [] } = useQuery({ queryKey: ['job-types'], queryFn: () => base44.entities.JobType.list('-order') });

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const getAssignmentsForDate = (dateStr) => {
    const _seen = {};
    return assignments.filter(a => a.assigned_date === dateStr).filter(a => {
      const k = `${a.staff_id}|${a.job_id}`;
      if (_seen[k]) return false;
      _seen[k] = true;
      return true;
    });
  };
  const selectedAssignments = getAssignmentsForDate(selectedDate);
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div>
      <PageHeader title="Calendar" icon={Calendar} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">{format(currentMonth, 'MMMM yyyy')}</h2>
              <div className="flex gap-2">
                <button onClick={() => setCurrentMonth(addMonths(currentMonth, -1))} className="p-2 rounded-lg hover:bg-slate-100 transition">
                  <ChevronLeft className="w-5 h-5 text-slate-600" />
                </button>
                <button onClick={() => { setCurrentMonth(new Date()); setSelectedDate(format(new Date(), 'yyyy-MM-dd')); }} className="px-3 py-1.5 text-sm rounded-lg hover:bg-slate-100 transition text-slate-600 font-medium">
                  Today
                </button>
                <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 rounded-lg hover:bg-slate-100 transition">
                  <ChevronRight className="w-5 h-5 text-slate-600" />
                </button>
              </div>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekdays.map(day => (
                <div key={day} className="text-center text-xs font-semibold text-slate-400 py-1">{day}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {days.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const dayAssignments = getAssignmentsForDate(dateStr);
                const inMonth = isSameMonth(day, currentMonth);
                const isSelected = selectedDate === dateStr;
                const today = isToday(day);

                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`min-h-[60px] md:min-h-[80px] p-1.5 rounded-lg border text-left transition ${
                      isSelected ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500' :
                      today ? 'border-emerald-300' :
                      'border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                    } ${!inMonth ? 'opacity-40' : ''}`}
                  >
                    <div className={`text-xs font-medium mb-1 ${today ? 'text-emerald-700 font-bold' : 'text-slate-700'}`}>
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-0.5">
                      {dayAssignments.slice(0, 3).map(a => {
                        const job = jobs.find(j => j.id === a.job_id);
                        const colors = getJobTypeColor(getJobPrimaryType(job, teams), jobTypes);
                        return (
                          <div key={a.id} className={`text-[10px] px-1.5 py-0.5 rounded ${colors.bg} ${colors.text} truncate font-medium flex items-center gap-1`}>
                            {a.is_overtime && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0"></span>}
                            <span className="truncate">{job?.name?.substring(0, 12) || '—'}</span>
                          </div>
                        );
                      })}
                      {dayAssignments.length > 3 && (
                        <div className="text-[10px] text-slate-400 px-1">+{dayAssignments.length - 3} more</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-slate-100">
              {jobTypes.map(jt => {
                const colors = getJobTypeColor(jt.key, jobTypes);
                return (
                  <div key={jt.id} className="flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${colors.dot}`}></span>
                    <span className="text-xs text-slate-500">{jt.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Selected day details */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-6 lg:sticky lg:top-4">
            <h3 className="font-bold text-slate-900 mb-1">{format(parseISO(selectedDate), 'EEEE, MMM d')}</h3>
            <p className="text-xs text-slate-500 mb-4">{selectedAssignments.length} assignment{selectedAssignments.length !== 1 ? 's' : ''}</p>

            {selectedAssignments.length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center">No assignments this day</p>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {selectedAssignments.map(a => {
                  const job = jobs.find(j => j.id === a.job_id);
                  const member = staff.find(s => s.id === a.staff_id);
                  const colors = getJobTypeColor(job?.job_type, jobTypes);
                  return (
                    <div key={a.id} className={`rounded-lg p-3 border ${colors.border} ${colors.bg}`}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-slate-900 truncate">{job?.name || 'Unknown job'}</p>
                          {job?.location && (
                            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 flex-shrink-0" /> {job.location}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {a.is_overtime && <OvertimeBadge assignment={a} />}
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize ${statusBadge[a.status] || statusBadge.assigned}`}>
                            {a.status}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <UsersIcon className="w-3 h-3" />
                        <span>{member?.name || 'Unassigned'}</span>
                        {(a.start_time || a.end_time) && (
                          <>
                            <span className="text-slate-300">·</span>
                            <Clock className="w-3 h-3" />
                            <span>{a.start_time}–{a.end_time}</span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}