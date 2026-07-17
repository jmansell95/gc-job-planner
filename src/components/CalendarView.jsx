import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Calendar, ChevronLeft, ChevronRight, MapPin, Users as UsersIcon, Clock, Briefcase, CalendarDays, TrendingUp } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isToday, addMonths, parseISO } from 'date-fns';
import { getJobPrimaryType, getJobTypeColor, getJobTypeLabel } from '@/utils/jobTeams';

const jobTypeColors = {
  groundworks: { dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', grad: 'from-emerald-500 to-emerald-600' },
  cp_drilling: { dot: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', grad: 'from-amber-500 to-amber-600' },
  rotary_drilling: { dot: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', grad: 'from-blue-500 to-blue-600' },
  enabling_works: { dot: 'bg-purple-500', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', grad: 'from-purple-500 to-purple-600' },
  depot: { dot: 'bg-slate-500', bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', grad: 'from-slate-500 to-slate-600' },
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
    const seen = {};
    return assignments.filter(a => a.assigned_date === dateStr).filter(a => {
      const k = `${a.staff_id}|${a.job_id}`;
      if (seen[k]) return false;
      seen[k] = true;
      return true;
    });
  };
  const selectedAssignments = getAssignmentsForDate(selectedDate);
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Month-level stats
  const monthStr = format(currentMonth, 'yyyy-MM');
  const monthAssignments = assignments.filter(a => a.assigned_date && a.assigned_date.startsWith(monthStr));
  const monthShifts = monthAssignments.length;
  const monthCrew = [...new Set(monthAssignments.map(a => a.staff_id))].length;
  const monthJobs = [...new Set(monthAssignments.map(a => a.job_id))].length;
  const monthOvertime = monthAssignments.filter(a => a.is_overtime).length;

  return (
    <div>
      {/* Hero header */}
      <div className="hero-gradient relative overflow-hidden rounded-2xl mb-6">
        <div className="relative px-5 md:px-7 py-5 md:py-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 md:w-12 md:h-12 rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">{format(currentMonth, 'MMMM yyyy')}</h1>
                <p className="text-emerald-100 text-xs md:text-sm mt-0.5">Site schedule at a glance</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-white/15 ring-1 ring-white/25 rounded-xl p-1 backdrop-blur-sm">
              <button onClick={() => setCurrentMonth(addMonths(currentMonth, -1))} className="p-1.5 rounded-lg hover:bg-white/20 transition text-white">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => { setCurrentMonth(new Date()); setSelectedDate(format(new Date(), 'yyyy-MM-dd')); }}
                className="px-2.5 py-1.5 text-xs rounded-lg hover:bg-white/20 transition text-white font-semibold">
                Today
              </button>
              <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1.5 rounded-lg hover:bg-white/20 transition text-white">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Month stat chips */}
          <div className="grid grid-cols-4 gap-2 md:gap-3 mt-4">
            {[
              { label: 'Shifts', value: monthShifts, icon: CalendarDays },
              { label: 'Crew', value: monthCrew, icon: UsersIcon },
              { label: 'Jobs', value: monthJobs, icon: Briefcase },
              { label: 'Overtime', value: monthOvertime, icon: TrendingUp },
            ].map(s => (
              <div key={s.label} className="bg-white/12 ring-1 ring-white/20 rounded-xl px-2.5 md:px-3 py-2 backdrop-blur-sm">
                <div className="flex items-center gap-1.5">
                  <s.icon className="w-3.5 h-3.5 text-emerald-100" />
                  <span className="text-[10px] md:text-[11px] font-medium text-emerald-100 uppercase tracking-wide">{s.label}</span>
                </div>
                <p className="text-lg md:text-xl font-bold text-white mt-0.5 leading-none">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-5">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1.5 mb-2">
              {weekdays.map(day => (
                <div key={day} className="text-center text-[11px] font-bold text-slate-400 uppercase tracking-wide py-1">{day}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1.5">
              {days.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const dayAssignments = getAssignmentsForDate(dateStr);
                const inMonth = isSameMonth(day, currentMonth);
                const isSelected = selectedDate === dateStr;
                const today = isToday(day);
                const dayJobTypes = [...new Set(dayAssignments.map(a => getJobPrimaryType(jobs.find(j => j.id === a.job_id), teams)))];

                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`min-h-[64px] md:min-h-[84px] p-1.5 rounded-xl border text-left transition relative overflow-hidden ${
                      isSelected ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/30 shadow-sm' :
                      today ? 'border-emerald-300 bg-emerald-50/30' :
                      'border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                    } ${!inMonth ? 'opacity-40' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-bold ${today ? 'text-white bg-emerald-600 w-5 h-5 rounded-full flex items-center justify-center' : 'text-slate-700'}`}>
                        {format(day, 'd')}
                      </span>
                      {dayAssignments.length > 0 && (
                        <span className="text-[9px] font-semibold text-slate-400 bg-slate-100 px-1 py-0.5 rounded-full">{dayAssignments.length}</span>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      {dayAssignments.slice(0, 3).map(a => {
                        const job = jobs.find(j => j.id === a.job_id);
                        const colors = getJobTypeColor(getJobPrimaryType(job, teams), jobTypes);
                        return (
                          <div key={a.id} className={`text-[10px] px-1.5 py-0.5 rounded-md ${colors.bg} ${colors.text} truncate font-medium flex items-center gap-1`}>
                            {a.is_overtime && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0"></span>}
                            <span className="truncate">{job?.name?.substring(0, 14) || '—'}</span>
                          </div>
                        );
                      })}
                      {dayAssignments.length > 3 && (
                        <div className="text-[10px] text-slate-400 px-1 font-medium">+{dayAssignments.length - 3} more</div>
                      )}
                    </div>
                    {/* job-type dots row */}
                    {dayJobTypes.length > 0 && dayAssignments.length <= 3 && (
                      <div className="absolute bottom-1 left-1.5 flex gap-0.5">
                        {dayJobTypes.slice(0, 4).map((t, i) => (
                          <span key={i} className={`w-1.5 h-1.5 rounded-full ${(jobTypeColors[t] || jobTypeColors.depot).dot}`} />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 pt-4 border-t border-slate-100">
              {jobTypes.map(jt => {
                const colors = getJobTypeColor(jt.key, jobTypes);
                return (
                  <div key={jt.id} className="flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${colors.dot}`}></span>
                    <span className="text-xs text-slate-500 font-medium">{jt.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Selected day details */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 lg:sticky lg:top-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <CalendarDays className="w-4 h-4 text-emerald-700" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 leading-tight">{format(parseISO(selectedDate), 'EEEE')}</h3>
                <p className="text-xs text-slate-500">{format(parseISO(selectedDate), 'd MMMM yyyy')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-4 mt-2">
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">{selectedAssignments.length} shift{selectedAssignments.length !== 1 ? 's' : ''}</span>
              <span className="text-xs text-slate-400">{[...new Set(selectedAssignments.map(a => a.staff_id))].length} crew</span>
            </div>

            {selectedAssignments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                  <Calendar className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-sm font-semibold text-slate-700">No shifts this day</p>
                <p className="text-xs text-slate-400 mt-1">Pick another date to see the schedule.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
                {selectedAssignments.map(a => {
                  const job = jobs.find(j => j.id === a.job_id);
                  const member = staff.find(s => s.id === a.staff_id);
                  const primary = getJobPrimaryType(job, teams);
                  const colors = getJobTypeColor(primary, jobTypes);
                  const jc = jobTypeColors[primary] || jobTypeColors.depot;
                  return (
                    <div key={a.id} className={`rounded-xl border ${colors.border} overflow-hidden`}>
                      <div className={`h-1.5 bg-gradient-to-r ${jc.grad}`} />
                      <div className={`p-3 ${colors.bg}`}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-slate-900 truncate">{job?.name || 'Unknown job'}</p>
                            {job?.location && (
                              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3 flex-shrink-0" /> <span className="truncate">{job.location}</span>
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
                        <div className="flex items-center gap-2 text-xs text-slate-600 bg-white/50 rounded-lg px-2 py-1.5">
                          <div className="flex items-center gap-1">
                            <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                              <span className="text-[9px] font-bold text-emerald-700">{member?.name?.charAt(0) || '?'}</span>
                            </div>
                            <span className="font-medium truncate">{member?.name || 'Unassigned'}</span>
                          </div>
                          {(a.start_time || a.end_time) && (
                            <span className="flex items-center gap-0.5 ml-auto text-slate-500">
                              <Clock className="w-3 h-3" />{a.start_time}–{a.end_time}
                            </span>
                          )}
                        </div>
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