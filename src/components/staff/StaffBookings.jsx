import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Wrench, GraduationCap, Calendar, Clock, MapPin, Phone, FileText, CheckCircle2, XCircle, CalendarClock } from 'lucide-react';
import { format, isFuture, isToday, isPast } from 'date-fns';
import { Skeleton, EmptyState } from '@/components/StateViews';

export default function StaffBookings({ staffId, compact = false }) {
  const { data: maintenanceBookings = [], isLoading: mbLoading } = useQuery({
    queryKey: ['my-maintenance-bookings', staffId],
    queryFn: () => base44.entities.VehicleMaintenanceBooking.filter({ assigned_staff_id: staffId }, '-booking_date', 50),
    enabled: !!staffId
  });
  const { data: trainingBookings = [], isLoading: tbLoading } = useQuery({
    queryKey: ['my-training-bookings', staffId],
    queryFn: () => base44.entities.TrainingBooking.filter({ staff_id: staffId }, '-created_date', 50),
    enabled: !!staffId
  });
  const { data: courses = [] } = useQuery({ queryKey: ['training-courses'], queryFn: () => base44.entities.TrainingCourse.list('-start_date', 200) });
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => base44.entities.Vehicle.list() });

  const isLoading = mbLoading || tbLoading;

  const upcomingMaintenance = maintenanceBookings.filter(b => {
    if (['cancelled', 'completed'].includes(b.status)) return false;
    if (!b.booking_date) return true;
    const d = new Date(b.booking_date + 'T00:00:00');
    return isFuture(d) || isToday(d);
  });
  const pastMaintenance = maintenanceBookings.filter(b => {
    if (['cancelled', 'completed'].includes(b.status)) return true;
    if (!b.booking_date) return false;
    return isPast(new Date(b.booking_date + 'T00:00:00')) && !isToday(new Date(b.booking_date + 'T00:00:00'));
  });

  const upcomingTraining = trainingBookings.filter(b => {
    if (['passed', 'failed', 'rebooked'].includes(b.status)) return false;
    const course = courses.find(c => c.id === b.course_id);
    if (!course) return false;
    const d = new Date(course.start_date + 'T00:00:00');
    return isFuture(d) || isToday(d);
  });
  const pastTraining = trainingBookings.filter(b => {
    if (['passed', 'failed', 'rebooked'].includes(b.status)) return true;
    const course = courses.find(c => c.id === b.course_id);
    if (!course) return false;
    return isPast(new Date(course.start_date + 'T00:00:00')) && !isToday(new Date(course.start_date + 'T00:00:00'));
  });

  if (isLoading) {
    return <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>;
  }

  const hasUpcoming = upcomingMaintenance.length > 0 || upcomingTraining.length > 0;
  const hasPast = pastMaintenance.length > 0 || pastTraining.length > 0;

  const MaintenanceCard = ({ b }) => {
    const vehicle = vehicles.find(v => v.id === b.vehicle_id);
    const typeLabels = { mot: 'MOT', service: 'Service', windscreen: 'Windscreen Repair', repair: 'Repair', inspection: 'Inspection', other: 'Maintenance' };
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
            <Wrench className="w-5 h-5 text-amber-600" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-slate-900 text-sm">{typeLabels[b.booking_type] || 'Maintenance'}</p>
              {b.status === 'completed' && <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700">Done</span>}
              {b.status === 'cancelled' && <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-500">Cancelled</span>}
            </div>
            <p className="text-sm text-slate-600 mt-0.5">{vehicle ? `${vehicle.name} (${vehicle.registration_number})` : b.vehicle_name || 'Vehicle'}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-slate-500">
              {b.booking_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(new Date(b.booking_date + 'T00:00:00'), 'EEE dd MMM yyyy')}</span>}
              {b.booking_time && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{b.booking_time}</span>}
              {b.supplier_name && <span className="flex items-center gap-1"><Wrench className="w-3 h-3" />{b.supplier_name}</span>}
            </div>
            {b.location && <p className="text-xs text-slate-500 mt-1 flex items-center gap-1"><MapPin className="w-3 h-3" />{b.location}</p>}
            {b.supplier_phone && (
              <a href={`tel:${b.supplier_phone}`} className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium mt-1.5 hover:underline">
                <Phone className="w-3 h-3" />{b.supplier_phone}
              </a>
            )}
            {b.notes && <p className="text-xs text-slate-400 mt-1.5 italic">{b.notes}</p>}
          </div>
        </div>
      </div>
    );
  };

  const TrainingCard = ({ b }) => {
    const course = courses.find(c => c.id === b.course_id);
    if (!course) return null;
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
            <GraduationCap className="w-5 h-5 text-violet-600" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-slate-900 text-sm">{course.title}</p>
              {b.status === 'passed' && <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Passed</span>}
              {b.status === 'failed' && <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700 flex items-center gap-1"><XCircle className="w-3 h-3" />Failed</span>}
              {b.status === 'rebooked' && <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">Rebooked</span>}
              {(b.status === 'booked' || b.status === 'attended') && <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">Booked</span>}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-slate-500">
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(new Date(course.start_date + 'T00:00:00'), 'EEE dd MMM yyyy')}{course.end_date !== course.start_date ? ` – ${format(new Date(course.end_date + 'T00:00:00'), 'dd MMM')}` : ''}</span>
              {course.start_time && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{course.start_time}{course.end_time ? ` – ${course.end_time}` : ''}</span>}
            </div>
            {course.venue && <p className="text-xs text-slate-500 mt-1 flex items-center gap-1"><MapPin className="w-3 h-3" />{course.venue}{course.address ? `, ${course.address}` : ''}</p>}
            {course.provider && <p className="text-xs text-slate-400 mt-1">Provider: {course.provider}</p>}
            {b.status === 'passed' && b.certificate_url && (
              <a href={b.certificate_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium mt-1.5 hover:underline">
                <FileText className="w-3 h-3" />View Certificate
              </a>
            )}
            {b.status === 'failed' && b.failure_reason && <p className="text-xs text-red-500 mt-1">Reason: {b.failure_reason}</p>}
            {course.description && b.status === 'booked' && <p className="text-xs text-slate-400 mt-1.5 italic">{course.description}</p>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Upcoming */}
      {hasUpcoming && (
        <div>
          {!compact && <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">Upcoming Bookings</h3>}
          <div className="space-y-3">
            {upcomingMaintenance.map(b => <MaintenanceCard key={b.id} b={b} />)}
            {upcomingTraining.map(b => <TrainingCard key={b.id} b={b} />)}
          </div>
        </div>
      )}

      {/* Past */}
      {hasPast && !compact && (
        <div>
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-3">History</h3>
          <div className="space-y-3 opacity-75">
            {pastTraining.map(b => <TrainingCard key={b.id} b={b} />)}
            {pastMaintenance.map(b => <MaintenanceCard key={b.id} b={b} />)}
          </div>
        </div>
      )}

      {!hasUpcoming && !hasPast && (
        <div className="bg-white rounded-xl border border-slate-200">
          <EmptyState icon={CalendarClock} title="No bookings yet" message="Your manager will book vehicle maintenance and training courses for you here." />
        </div>
      )}
    </div>
  );
}