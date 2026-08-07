import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { CalendarClock, GraduationCap, AlertCircle, Clock, User, Loader2, ArrowRight } from 'lucide-react';
import WidgetShell from '@/components/dashboard/WidgetShell';

/**
 * TrainingGapSchedulerWidget — Smart-scheduling for training.
 * Identifies staff with expiring certifications and cross-references
 * their rota to find low-utilization windows where training can be
 * scheduled without disrupting billable work.
 */
export default function TrainingGapSchedulerWidget({ onNavigate }) {
  const { data: staff = [], isLoading: staffLoading } = useQuery({
    queryKey: ['training-gap-staff'],
    queryFn: () => base44.entities.Staff.filter({ is_active: true }),
  });
  const { data: courses = [] } = useQuery({
    queryKey: ['training-gap-courses'],
    queryFn: () => base44.entities.TrainingCourse.list('-created_date', 100),
  });
  const { data: rotas = [] } = useQuery({
    queryKey: ['training-gap-rotas'],
    queryFn: () => base44.entities.RotaAssignment.filter({ week_start: getWeekStart() }),
  });
  const { data: bookings = [] } = useQuery({
    queryKey: ['training-gap-bookings'],
    queryFn: () => base44.entities.TrainingBooking.filter({ status: 'scheduled' }),
  });

  const suggestions = useMemo(() => {
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Find staff with expiring or missing certs
    const staffWithGaps = staff.filter(s => {
      if (!s.certifications && !s.qualifications) return false;
      const certs = s.certifications || s.qualifications || [];
      return certs.some(c => {
        const expiry = c.expiry_date || c.expiry;
        if (!expiry) return false;
        return new Date(expiry) <= in30Days;
      });
    });

    // For each staff with gaps, find their low-utilization days this week
    const result = staffWithGaps.map(s => {
      const staffRotas = rotas.filter(r => r.staff_id === s.id);
      const assignedDates = new Set(staffRotas.map(r => r.assigned_date));
      const allDays = Array.from({ length: 5 }, (_, i) => {
        const d = new Date(getWeekStart());
        d.setDate(d.getDate() + i);
        return d.toISOString().slice(0, 10);
      });
      const freeDays = allDays.filter(d => !assignedDates.has(d));
      const hasBooking = bookings.some(b => b.staff_id === s.id);

      // Find relevant course
      const expiringCerts = (s.certifications || s.qualifications || []).filter(c => {
        const expiry = c.expiry_date || c.expiry;
        return expiry && new Date(expiry) <= in30Days;
      });
      const relevantCourse = courses.find(c =>
        expiringCerts.some(cert => c.name && c.name.toLowerCase().includes((cert.name || cert.type || '').toLowerCase().split(' ')[0]))
      );

      return {
        staff: s,
        freeDays: freeDays.length,
        freeDayLabels: freeDays.map(d => new Date(d).toLocaleDateString('en-GB', { weekday: 'short' })),
        expiringCount: expiringCerts.length,
        expiringNames: expiringCerts.map(c => c.name || c.type),
        courseId: relevantCourse?.id,
        courseName: relevantCourse?.name,
        alreadyBooked: hasBooking,
      };
    }).filter(s => s.freeDays > 0 && !s.alreadyBooked);

    return result;
  }, [staff, courses, rotas, bookings]);

  const isLoading = staffLoading;

  return (
    <WidgetShell icon={CalendarClock} title="Training Gap Scheduler" subtitle="Auto-schedule training during low-utilization windows">
      <div className="space-y-3">
        {/* Summary */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-slate-900">{suggestions.length} staff need training</p>
            <p className="text-xs text-slate-500">Certifications expiring within 30 days · free days identified for scheduling</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
        ) : suggestions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <AlertCircle className="w-8 h-8 text-emerald-300 mb-2" />
            <p className="text-sm text-slate-500">All certifications current — no training gaps</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {suggestions.slice(0, 10).map((s, i) => (
              <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-amber-200 bg-amber-50/30">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate">{s.staff.name}</p>
                  <p className="text-[11px] text-slate-500">
                    {s.expiringCount} cert{s.expiringCount > 1 ? 's' : ''} expiring: {s.expiringNames.join(', ').slice(0, 40)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-emerald-600">
                    <Clock className="w-3 h-3" />
                    <span className="text-[10px] font-bold">{s.freeDays} free</span>
                  </div>
                  {s.freeDayLabels.length > 0 && (
                    <span className="text-[10px] text-slate-400 hidden sm:inline">{s.freeDayLabels.join(', ')}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {suggestions.length > 0 && (
          <button onClick={() => onNavigate?.('settings')}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition">
            <GraduationCap className="w-3.5 h-3.5" /> Open Training Manager
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </WidgetShell>
  );
}

function getWeekStart() {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}