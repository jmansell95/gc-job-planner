import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { GraduationCap, CheckCircle2, XCircle, Clock, FileText, ExternalLink, Calendar, Award } from 'lucide-react';
import { Skeleton, EmptyState } from '@/components/StateViews';

const BOOKING_STATUS = {
  booked: { label: 'Booked', color: 'bg-blue-100 text-blue-700', icon: Clock },
  attended: { label: 'Attended', color: 'bg-violet-100 text-violet-700', icon: Clock },
  passed: { label: 'Passed', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-700', icon: XCircle },
  rebooked: { label: 'Rebooked', color: 'bg-amber-100 text-amber-700', icon: Clock },
};

export default function TrainingHistory({ staffId, staffName }) {
  const [expanded, setExpanded] = useState(true);

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['staff-training-history', staffId],
    queryFn: () => base44.entities.TrainingBooking.list('-created_date', 200),
    enabled: !!staffId
  });

  const { data: courses = [] } = useQuery({
    queryKey: ['courses-for-history'],
    queryFn: () => base44.entities.TrainingCourse.list('-start_date', 200)
  });

  const myBookings = bookings.filter(b => b.staff_id === staffId);
  const courseMap = {};
  courses.forEach(c => { courseMap[c.id] = c; });

  const passed = myBookings.filter(b => b.status === 'passed');
  const upcoming = myBookings.filter(b => b.status === 'booked' || b.status === 'attended');
  const failed = myBookings.filter(b => b.status === 'failed');

  if (isLoading) {
    return <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>;
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
            <GraduationCap className="w-4 h-4 text-violet-700" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">My Training</h2>
            <p className="text-xs text-slate-500">
              {passed.length} completed{upcoming.length > 0 && ` · ${upcoming.length} upcoming`}{failed.length > 0 && ` · ${failed.length} failed`}
            </p>
          </div>
        </div>
        {myBookings.length > 3 && (
          <button onClick={() => setExpanded(!expanded)} className="text-xs font-medium text-violet-700 hover:text-violet-900">
            {expanded ? 'Show less' : 'Show all'}
          </button>
        )}
      </div>

      {myBookings.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No training records" message="Your training bookings and certificates will appear here once your manager books you onto a course." />
      ) : (
        <div className="space-y-2.5">
          {(expanded ? myBookings : myBookings.slice(0, 3)).map(b => {
            const course = b.course_id ? courseMap[b.course_id] : null;
            const st = BOOKING_STATUS[b.status] || BOOKING_STATUS.booked;
            const StatusIcon = st.icon;
            return (
              <div key={b.id} className={`rounded-xl p-3 border ${b.status === 'passed' ? 'border-emerald-100 bg-emerald-50/30' : b.status === 'failed' ? 'border-red-100 bg-red-50/30' : 'border-slate-200 bg-slate-50/30'}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${b.status === 'passed' ? 'bg-emerald-100' : b.status === 'failed' ? 'bg-red-100' : 'bg-violet-100'}`}>
                    <StatusIcon className={`w-4 h-4 ${b.status === 'passed' ? 'text-emerald-600' : b.status === 'failed' ? 'text-red-500' : 'text-violet-600'}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-900 truncate">{course?.title || b.certificate_title || 'Training Course'}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                      {course?.start_date && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(course.start_date + 'T00:00:00'), 'dd MMM yyyy')}
                        </span>
                      )}
                      {course?.provider && <span>{course.provider}</span>}
                      {course?.venue && <span className="inline-flex items-center gap-1"><FileText className="w-3 h-3" />{course.venue}</span>}
                    </div>
                    {/* Certificate link for passed courses */}
                    {b.status === 'passed' && b.certificate_url && (
                      <a href={b.certificate_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium mt-1.5 hover:underline">
                        <Award className="w-3.5 h-3.5" /> View Certificate
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {b.status === 'passed' && b.expiry_date && (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500 mt-1 ml-2">
                        <Clock className="w-3 h-3" /> Expires {b.expiry_date}
                      </span>
                    )}
                    {b.status === 'failed' && b.failure_reason && (
                      <p className="text-xs text-red-500 mt-1">Reason: {b.failure_reason}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}