import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar, ChevronLeft, ChevronRight, MapPin, Clock, CalendarDays,
  Truck, Wrench, GraduationCap, UserMinus, Hotel, Flag, CalendarOff, Users as UsersIcon, TrendingUp,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isToday, addMonths, parseISO } from 'date-fns';
import { getJobPrimaryType, getJobTypeColor } from '@/utils/jobTeams';
import StatCard from '@/components/dashboard/StatCard';

// Each scheduled/booked category gets a single colour + icon so the unified
// calendar reads at a glance and can be filtered by type.
const CATEGORY = {
  shift:       { label: 'Shifts',        icon: CalendarDays,  dot: 'bg-emerald-500', chip: 'bg-emerald-100 text-emerald-700',    bar: 'from-emerald-500 to-emerald-600' },
  delivery:    { label: 'Deliveries',    icon: Truck,         dot: 'bg-cyan-500',    chip: 'bg-cyan-100 text-cyan-700',          bar: 'from-cyan-500 to-cyan-600' },
  maintenance: { label: 'Maintenance',  icon: Wrench,        dot: 'bg-amber-500',   chip: 'bg-amber-100 text-amber-700',        bar: 'from-amber-500 to-amber-600' },
  training:    { label: 'Training',      icon: GraduationCap, dot: 'bg-violet-500',  chip: 'bg-violet-100 text-violet-700',       bar: 'from-violet-500 to-violet-600' },
  absence:     { label: 'Absences',      icon: UserMinus,     dot: 'bg-rose-500',    chip: 'bg-rose-100 text-rose-700',           bar: 'from-rose-500 to-rose-600' },
  hotel:       { label: 'Hotels',        icon: Hotel,         dot: 'bg-blue-500',    chip: 'bg-blue-100 text-blue-700',           bar: 'from-blue-500 to-blue-600' },
  milestone:   { label: 'Milestones',    icon: Flag,         dot: 'bg-indigo-500',  chip: 'bg-indigo-100 text-indigo-700',       bar: 'from-indigo-500 to-indigo-600' },
  holiday:     { label: 'Bank Holidays', icon: CalendarOff,  dot: 'bg-slate-500',   chip: 'bg-slate-200 text-slate-700',        bar: 'from-slate-500 to-slate-600' },
};
const CATEGORY_ORDER = Object.keys(CATEGORY);

// Expand a date range (inclusive) into individual yyyy-MM-dd strings, clamped to
// the visible calendar window so multi-day absences/hotels/training only emit
// the dates actually shown on screen.
function expandRange(startStr, endStr, rangeStart, rangeEnd) {
  if (!startStr) return [];
  const stop = (endStr || startStr) > rangeEnd ? rangeEnd : (endStr || startStr);
  const cur0 = startStr < rangeStart ? rangeStart : startStr;
  const out = [];
  let cur = cur0;
  while (cur <= stop) {
    out.push(cur);
    const d = new Date(cur + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    cur = format(d, 'yyyy-MM-dd');
  }
  return out;
}

export default function CalendarView() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [activeCats, setActiveCats] = useState(() => Object.fromEntries(CATEGORY_ORDER.map(k => [k, true])));

  const { data: assignments = [] } = useQuery({ queryKey: ['calendar-assignments'], queryFn: () => base44.entities.RotaAssignment.list() });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: teams = [] } = useQuery({ queryKey: ['teams'], queryFn: () => base44.entities.Team.list() });
  const { data: jobTypes = [] } = useQuery({ queryKey: ['job-types'], queryFn: () => base44.entities.JobType.list('-order') });
  const { data: deliveries = [] } = useQuery({ queryKey: ['calendar-deliveries'], queryFn: () => base44.entities.DeliveryLog.list() });
  const { data: maintenance = [] } = useQuery({ queryKey: ['calendar-maintenance'], queryFn: () => base44.entities.VehicleMaintenanceBooking.list() });
  const { data: trainingCourses = [] } = useQuery({ queryKey: ['calendar-training-courses'], queryFn: () => base44.entities.TrainingCourse.list() });
  const { data: absences = [] } = useQuery({ queryKey: ['calendar-absences'], queryFn: () => base44.entities.Absence.list() });
  const { data: hotels = [] } = useQuery({ queryKey: ['calendar-hotels'], queryFn: () => base44.entities.HotelBooking.list() });
  const { data: milestones = [] } = useQuery({ queryKey: ['calendar-milestones'], queryFn: () => base44.entities.JobMilestone.list() });
  const { data: holidays = [] } = useQuery({ queryKey: ['calendar-holidays'], queryFn: () => base44.entities.BankHoliday.list() });

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const rangeStart = days.length ? format(days[0], 'yyyy-MM-dd') : '';
  const rangeEnd = days.length ? format(days[days.length - 1], 'yyyy-MM-dd') : '';

  // Build a single normalised event list from every scheduled/booked source.
  const events = useMemo(() => {
    if (!rangeStart) return [];
    const list = [];
    const jobName = id => jobs.find(j => j.id === id)?.name;
    const staffName = id => staff.find(s => s.id === id)?.name;

    assignments.forEach(a => {
      if (!a.assigned_date) return;
      list.push({ id: `shift-${a.id}`, date: a.assigned_date, category: 'shift', label: jobName(a.job_id) || 'Shift', sub: staffName(a.staff_id), job_id: a.job_id, raw: a });
    });
    deliveries.forEach(d => {
      if (!d.scheduled_date) return;
      list.push({ id: `del-${d.id}`, date: d.scheduled_date, category: 'delivery', label: d.items || 'Delivery', sub: d.job_name || jobName(d.job_id) });
    });
    maintenance.forEach(m => {
      if (!m.booking_date) return;
      list.push({ id: `maint-${m.id}`, date: m.booking_date, category: 'maintenance', label: m.vehicle_name || 'Vehicle Maintenance', sub: m.booking_type });
    });
    trainingCourses.forEach(c => {
      if (!c.start_date) return;
      expandRange(c.start_date, c.end_date, rangeStart, rangeEnd).forEach(dt => {
        list.push({ id: `train-${c.id}-${dt}`, date: dt, category: 'training', label: c.title, sub: c.provider });
      });
    });
    absences.forEach(a => {
      if (!a.start_date) return;
      expandRange(a.start_date, a.end_date, rangeStart, rangeEnd).forEach(dt => {
        list.push({ id: `abs-${a.id}-${dt}`, date: dt, category: 'absence', label: staffName(a.staff_id) || 'Absence', sub: a.reason });
      });
    });
    hotels.forEach(h => {
      if (!h.check_in_date) return;
      expandRange(h.check_in_date, h.check_out_date, rangeStart, rangeEnd).forEach(dt => {
        list.push({ id: `hotel-${h.id}-${dt}`, date: dt, category: 'hotel', label: h.hotel_name, sub: h.job_name || jobName(h.job_id) });
      });
    });
    milestones.forEach(m => {
      if (!m.target_date || m.completed) return;
      list.push({ id: `ms-${m.id}`, date: m.target_date, category: 'milestone', label: m.name, sub: jobName(m.job_id) });
    });
    holidays.forEach(h => {
      if (!h.holiday_date) return;
      list.push({ id: `hol-${h.id}`, date: h.holiday_date, category: 'holiday', label: h.name, sub: 'Bank Holiday' });
    });
    return list;
  }, [assignments, deliveries, maintenance, trainingCourses, absences, hotels, milestones, holidays, jobs, staff, rangeStart, rangeEnd]);

  const eventsForDate = (dateStr) => events.filter(e => e.date === dateStr && activeCats[e.category]);
  const selectedEvents = eventsForDate(selectedDate);
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Month-level stats (only counts events in the current month, all categories)
  const monthStr = format(currentMonth, 'yyyy-MM');
  const monthEvents = events.filter(e => e.date && e.date.startsWith(monthStr) && activeCats[e.category]);
  const monthShifts = monthEvents.filter(e => e.category === 'shift').length;
  const monthCrew = [...new Set(monthEvents.filter(e => e.category === 'shift').map(e => e.raw?.staff_id).filter(Boolean))].length;
  const monthJobs = [...new Set(monthEvents.filter(e => e.category === 'shift').map(e => e.job_id).filter(Boolean))].length;
  const monthOvertime = monthEvents.filter(e => e.category === 'shift' && e.raw?.is_overtime).length;

  const toggleCat = (k) => setActiveCats(prev => ({ ...prev, [k]: !prev[k] }));
  const allOn = CATEGORY_ORDER.every(k => activeCats[k]);
  const toggleAll = () => setActiveCats(Object.fromEntries(CATEGORY_ORDER.map(k => [k, !allOn])));

  return (
    <div>
      {/* Hero header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm mb-5 overflow-hidden">
        <div className="relative px-5 md:px-7 py-5 md:py-6">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#2E5A1A] to-[#8DC63F]" />
          <div className="flex items-center justify-between gap-3 flex-wrap pl-2">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 md:w-12 md:h-12 rounded-2xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0 shadow-sm">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">{format(currentMonth, 'MMMM yyyy')}</h1>
                <p className="text-slate-500 text-xs md:text-sm mt-0.5">Everything scheduled & booked — at a glance</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl p-1">
              <button onClick={() => setCurrentMonth(addMonths(currentMonth, -1))} className="p-1.5 rounded-lg hover:bg-white transition text-slate-600">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => { setCurrentMonth(new Date()); setSelectedDate(format(new Date(), 'yyyy-MM-dd')); }}
                className="px-2.5 py-1.5 text-xs rounded-lg hover:bg-white transition text-slate-700 font-semibold">
                Today
              </button>
              <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1.5 rounded-lg hover:bg-white transition text-slate-600">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Month stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3 mt-4 pl-2">
            <StatCard icon={Calendar} value={monthEvents.length} label="Events" gradient="stat-gradient-emerald" />
            <StatCard icon={CalendarDays} value={monthShifts} label="Shifts" gradient="stat-gradient-blue" />
            <StatCard icon={UsersIcon} value={monthCrew} label="Crew" gradient="stat-gradient-violet" />
            <StatCard icon={TrendingUp} value={monthOvertime} label="Overtime" gradient="stat-gradient-amber" />
          </div>
        </div>
      </div>

      {/* Category filter chips */}
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        <button onClick={toggleAll} type="button"
          className={`px-2.5 py-1.5 rounded-full text-xs font-semibold border transition ${allOn ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
          {allOn ? 'Clear all' : 'Show all'}
        </button>
        {CATEGORY_ORDER.map(k => {
          const c = CATEGORY[k];
          const Icon = c.icon;
          const on = activeCats[k];
          const count = events.filter(e => e.category === k && e.date.startsWith(monthStr)).length;
          return (
            <button key={k} onClick={() => toggleCat(k)} type="button"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border transition ${on ? `${c.chip} border-transparent` : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}>
              <Icon className="w-3.5 h-3.5" />
              {c.label}
              {count > 0 && <span className={`ml-0.5 text-[10px] font-bold ${on ? '' : 'text-slate-400'}`}>{count}</span>}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-5">
            <div className="grid grid-cols-7 gap-1.5 mb-2">
              {weekdays.map(day => (
                <div key={day} className="text-center text-[11px] font-bold text-slate-400 uppercase tracking-wide py-1">{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {days.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const dayEvents = eventsForDate(dateStr);
                const inMonth = isSameMonth(day, currentMonth);
                const isSelected = selectedDate === dateStr;
                const today = isToday(day);
                const dayCats = [...new Set(dayEvents.map(e => e.category))];

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
                      {dayEvents.length > 0 && (
                        <span className="text-[9px] font-semibold text-slate-400 bg-slate-100 px-1 py-0.5 rounded-full">{dayEvents.length}</span>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 3).map(e => {
                        const c = CATEGORY[e.category];
                        return (
                          <div key={e.id} className={`text-[10px] px-1.5 py-0.5 rounded-md ${c.chip} truncate font-medium flex items-center gap-1`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${c.dot} flex-shrink-0`} />
                            <span className="truncate">{e.label?.substring(0, 14) || '—'}</span>
                          </div>
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <div className="text-[10px] text-slate-400 px-1 font-medium">+{dayEvents.length - 3} more</div>
                      )}
                    </div>
                    {dayCats.length > 0 && dayEvents.length <= 3 && (
                      <div className="absolute bottom-1 left-1.5 flex gap-0.5">
                        {dayCats.slice(0, 5).map((cat, i) => (
                          <span key={i} className={`w-1.5 h-1.5 rounded-full ${CATEGORY[cat].dot}`} />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 pt-4 border-t border-slate-100">
              {CATEGORY_ORDER.map(k => (
                <div key={k} className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${CATEGORY[k].dot}`} />
                  <span className="text-xs text-slate-500 font-medium">{CATEGORY[k].label}</span>
                </div>
              ))}
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
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">{selectedEvents.length} item{selectedEvents.length !== 1 ? 's' : ''}</span>
              <span className="text-xs text-slate-400">{[...new Set(selectedEvents.map(e => e.category))].length} categories</span>
            </div>

            {selectedEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                  <Calendar className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-sm font-semibold text-slate-700">Nothing scheduled this day</p>
                <p className="text-xs text-slate-400 mt-1">Pick another date or enable more categories.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
                {CATEGORY_ORDER.map(cat => {
                  const items = selectedEvents.filter(e => e.category === cat);
                  if (items.length === 0) return null;
                  const c = CATEGORY[cat];
                  const Icon = c.icon;
                  return (
                    <div key={cat}>
                      <div className="flex items-center gap-1.5 mb-1.5 px-0.5">
                        <Icon className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{c.label}</span>
                        <span className="text-[10px] text-slate-300 font-semibold">{items.length}</span>
                      </div>
                      <div className="space-y-1.5">
                        {items.map(e => {
                          const job = e.job_id ? jobs.find(j => j.id === e.job_id) : null;
                          const colors = job ? getJobTypeColor(getJobPrimaryType(job, teams), jobTypes) : null;
                          return (
                            <div key={e.id} className="rounded-xl border border-slate-100 overflow-hidden bg-slate-50/50">
                              <div className={`h-1.5 bg-gradient-to-r ${c.bar}`} />
                              <div className="p-2.5">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="font-semibold text-sm text-slate-900 truncate">{e.label}</p>
                                    {e.sub && <p className="text-xs text-slate-500 truncate mt-0.5">{e.sub}</p>}
                                  </div>
                                  {e.category === 'shift' && e.raw?.is_overtime && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold flex-shrink-0 whitespace-nowrap">OT</span>
                                  )}
                                </div>
                                {e.category === 'shift' && job?.location && (
                                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                    <MapPin className="w-3 h-3 flex-shrink-0" /> <span className="truncate">{job.location}</span>
                                  </p>
                                )}
                                {e.category === 'shift' && (e.raw?.start_time || e.raw?.end_time) && (
                                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                    <Clock className="w-3 h-3 flex-shrink-0" /> {e.raw.start_time}–{e.raw.end_time}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
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