import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ShieldCheck, ShieldAlert, ShieldX, GraduationCap, ArrowRight, Users } from 'lucide-react';
import { format } from 'date-fns';
import { complianceDaysUntil } from '@/utils/complianceDate';
import WidgetShell from '@/components/dashboard/WidgetShell';

export default function ComplianceOverviewWidget({ onNavigate }) {
  const { data: complianceItems = [] } = useQuery({
    queryKey: ['compliance-overview'],
    queryFn: () => base44.entities.ComplianceItem.list('-created_date', 300)
  });
  const { data: trainingBookings = [] } = useQuery({
    queryKey: ['training-overview'],
    queryFn: () => base44.entities.TrainingBooking.filter({ status: 'booked' })
  });
  const { data: courses = [] } = useQuery({
    queryKey: ['courses-overview'],
    queryFn: () => base44.entities.TrainingCourse.list('-start_date', 50)
  });
  const { data: staff = [] } = useQuery({
    queryKey: ['staff-overview'],
    queryFn: () => base44.entities.Staff.filter({ is_active: true })
  });

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Staff compliance breakdown
  const staffItems = complianceItems.filter(c => c.category === 'staff' && c.status_override !== 'not_required');
  const expired = staffItems.filter(c => {
    if (c.status_override === 'missing') return true;
    if (!c.expiry_date) return false;
    const days = complianceDaysUntil(c.expiry_date);
    return days !== null && days < 0;
  }).length;
  const expiring = staffItems.filter(c => {
    if (!c.expiry_date || c.status_override !== 'auto') return false;
    const days = complianceDaysUntil(c.expiry_date);
    return days !== null && days >= 0 && days <= 30;
  }).length;
  const missing = staffItems.filter(c => c.status_override === 'missing').length;
  const valid = staffItems.filter(c => {
    if (c.status_override === 'missing') return false;
    if (!c.expiry_date) return false;
    const days = complianceDaysUntil(c.expiry_date);
    return days !== null && days > 30;
  }).length;

  // Upcoming training
  const upcomingTraining = trainingBookings.filter(b => {
    const course = courses.find(c => c.id === b.course_id);
    if (!course) return false;
    return course.start_date >= todayStr;
  }).length;

  // Staff without any compliance items on file
  const staffWithItems = new Set(staffItems.map(c => c.reference_id).filter(Boolean));
  const staffWithoutCompliance = staff.filter(s => s.is_active !== false && !staffWithItems.has(s.id)).length;

  const summaryCards = [
    { label: 'Expired', value: expired, icon: ShieldX, tone: 'rose', sub: `${missing} missing` },
    { label: 'Expiring Soon', value: expiring, icon: ShieldAlert, tone: 'amber', sub: 'within 30 days' },
    { label: 'Valid', value: valid, icon: ShieldCheck, tone: 'emerald', sub: 'up to date' },
    { label: 'No Records', value: staffWithoutCompliance, icon: Users, tone: 'slate', sub: 'crew without items' },
  ];

  const toneMap = {
    rose: { bg: 'bg-rose-50', iconBg: 'bg-rose-100', iconText: 'text-rose-600', text: 'text-rose-700' },
    amber: { bg: 'bg-amber-50', iconBg: 'bg-amber-100', iconText: 'text-amber-600', text: 'text-amber-700' },
    emerald: { bg: 'bg-emerald-50', iconBg: 'bg-emerald-100', iconText: 'text-emerald-600', text: 'text-emerald-700' },
    slate: { bg: 'bg-slate-50', iconBg: 'bg-slate-100', iconText: 'text-slate-500', text: 'text-slate-600' },
  };

  const hasIssues = expired > 0 || expiring > 0 || missing > 0;

  return (
    <WidgetShell icon={ShieldCheck} title="Staff Training Compliance" subtitle="Staff training & upcoming courses at a glance"
      action={<button onClick={() => onNavigate('compliance')} type="button"
        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 rounded-lg transition">
        View All <ArrowRight className="w-3.5 h-3.5" />
      </button>}>
      {/* Staff compliance summary cards */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {summaryCards.map(card => {
          const Icon = card.icon;
          const t = toneMap[card.tone];
          return (
            <div key={card.label} className={`${t.bg} rounded-xl p-3.5 border border-white/60`}>
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-7 h-7 rounded-lg ${t.iconBg} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${t.iconText}`} />
                </div>
                <span className="text-2xl font-bold text-slate-900">{card.value}</span>
              </div>
              <p className="text-xs font-semibold text-slate-700">{card.label}</p>
              <p className="text-[11px] text-slate-400">{card.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Training row */}
      <div className="grid grid-cols-1 gap-3">
        <button onClick={() => onNavigate('compliance')} type="button"
          className="flex items-center gap-3 bg-white rounded-xl p-3.5 border border-slate-200 hover:border-emerald-200 hover:shadow-sm transition text-left">
          <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
            <GraduationCap className="w-4.5 h-4.5 text-violet-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">Upcoming Training</p>
            <p className="text-xs text-slate-400">
              {upcomingTraining > 0 ? `${upcomingTraining} booking${upcomingTraining !== 1 ? 's' : ''} scheduled` : 'No upcoming courses'}
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
        </button>
      </div>

      {/* Alert banner if issues exist */}
      {hasIssues && (
        <div className="mt-4 flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm bg-amber-50 border border-amber-200 text-amber-900">
          <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span className="font-medium">
            {expired > 0 && `${expired} expired item${expired !== 1 ? 's' : ''}`}
            {expired > 0 && expiring > 0 && ' · '}
            {expiring > 0 && `${expiring} expiring soon`}
            {' — tap to review'}
          </span>
        </div>
      )}
    </WidgetShell>
  );
}