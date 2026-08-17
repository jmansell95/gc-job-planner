import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Sparkles, Loader2, X, GraduationCap, AlertTriangle, Calendar,
  Users, CheckCircle2, Zap,
} from 'lucide-react';
import { format, isFuture } from 'date-fns';
import { complianceDaysUntil } from '@/utils/complianceDate';
import { useToast } from '@/components/ui/use-toast';

/**
 * AutoBookerModal — scans the training matrix for compliance gaps and
 * expiring qualifications, then suggests the best upcoming courses to
 * fix them. Managers can review the auto-generated plan and confirm
 * bookings in bulk.
 *
 * Props:
 *   staff       — all staff entities
 *   teams       — all team entities
 *   compliance  — all staff compliance items
 *   bookings    — all training bookings
 *   courses     — all training courses
 *   categories  — active TrainingRequirement categories
 *   onClose     — close handler
 */
export default function AutoBookerModal({ staff, teams, compliance, bookings, courses, categories, onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [confirmedPlan, setConfirmedPlan] = useState({}); // { `${staffId}:${courseId}`: true }

  // Build the gap analysis
  const gaps = useMemo(() => {
    const results = [];
    const activeStaff = staff.filter(s => s.is_active !== false);

    for (const m of activeStaff) {
      const team = teams.find(t => t.id === m.team_id);
      const required = team?.required_qualifications || [];

      for (const cat of categories) {
        if (!required.includes(cat.qualification_type)) continue;

        const items = compliance.filter(c =>
          (c.reference_id === m.id || c.reference_name === m.name) &&
          c.qualification_type === cat.qualification_type
        );

        let status = 'gap';
        for (const item of items) {
          if (item.status_override === 'not_required') { status = 'valid'; break; }
          if (item.status_override === 'missing') continue;
          const days = complianceDaysUntil(item.expiry_date);
          if (days === null) { status = 'valid'; break; }
          if (days < 0) continue;
          if (days <= 30) { status = 'expiring'; }
          else { status = 'valid'; break; }
        }

        if (status === 'gap' || status === 'expiring') {
          // Find a matching upcoming course
          const matchingCourses = courses
            .filter(c => c.category === cat.qualification_type && c.status !== 'cancelled' && c.status !== 'completed')
            .filter(c => isFuture(new Date(c.start_date + 'T00:00:00')) || c.start_date === format(new Date(), 'yyyy-MM-dd'))
            .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

          const alreadyBooked = bookings.some(b =>
            b.staff_id === m.id && b.status === 'booked' &&
            matchingCourses.some(c => c.id === b.course_id)
          );

          const suggestedCourse = matchingCourses[0] || null;

          results.push({
            staff: m,
            category: cat,
            status,
            suggestedCourse,
            alreadyBooked,
            alternativeCourses: matchingCourses.slice(1, 3),
          });
        }
      }
    }
    return results;
  }, [staff, teams, compliance, bookings, courses, categories]);

  const bookableGaps = gaps.filter(g => g.suggestedCourse && !g.alreadyBooked);
  const unbookableGaps = gaps.filter(g => !g.suggestedCourse && !g.alreadyBooked);
  const alreadyBookedGaps = gaps.filter(g => g.alreadyBooked);

  const toggleConfirm = (key) => {
    setConfirmedPlan(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const confirmAll = () => {
    const plan = {};
    bookableGaps.forEach(g => {
      const key = `${g.staff.id}:${g.suggestedCourse.id}`;
      plan[key] = true;
    });
    setConfirmedPlan(plan);
  };

  const handleBook = async () => {
    const keys = Object.keys(confirmedPlan).filter(k => confirmedPlan[k]);
    if (keys.length === 0) { toast({ title: 'Select at least one booking to confirm', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const newBookings = keys.map(k => {
        const [staffId, courseId] = k.split(':');
        const s = staff.find(x => x.id === staffId);
        return {
          course_id: courseId,
          staff_id: staffId,
          staff_name: s?.name || '',
          status: 'booked',
        };
      });
      const created = await base44.entities.TrainingBooking.bulkCreate(newBookings);
      const createdArray = Array.isArray(created) ? created : [created];
      for (const b of createdArray) {
        try { await base44.functions.invoke('notifyTrainingBooking', { booking_id: b.id }); } catch (_) {}
      }
      queryClient.invalidateQueries({ queryKey: ['training-bookings'] });
      toast({ title: `${newBookings.length} auto-bookings created`, description: 'Crew members have been notified by email.' });
      onClose();
    } catch (err) {
      toast({ title: 'Could not book', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const confirmedCount = Object.values(confirmedPlan).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-slate-950/60 backdrop-blur-md p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-5 max-h-[calc(100dvh-2rem)] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Auto-Booker</h3>
              <p className="text-xs text-slate-500">AI-suggested course bookings for compliance gaps</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition"><X className="w-5 h-5" /></button>
        </div>

        {/* Summary tiles */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-center">
            <p className="text-2xl font-extrabold text-red-600 tabular-nums">{gaps.filter(g => g.status === 'gap').length}</p>
            <p className="text-[10px] font-bold text-red-500 uppercase">Missing</p>
          </div>
          <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-center">
            <p className="text-2xl font-extrabold text-amber-600 tabular-nums">{gaps.filter(g => g.status === 'expiring').length}</p>
            <p className="text-[10px] font-bold text-amber-500 uppercase">Expiring</p>
          </div>
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-center">
            <p className="text-2xl font-extrabold text-emerald-600 tabular-nums">{bookableGaps.length}</p>
            <p className="text-[10px] font-bold text-emerald-500 uppercase">Bookable</p>
          </div>
        </div>

        {gaps.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">No compliance gaps detected</p>
            <p className="text-xs text-slate-400 mt-0.5">All crew are fully qualified and no certs are expiring soon.</p>
          </div>
        ) : (
          <>
            {/* Action bar */}
            {bookableGaps.length > 0 && (
              <div className="flex items-center gap-2 mb-3">
                <button onClick={confirmAll}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-100 text-violet-700 rounded-lg text-xs font-bold hover:bg-violet-200 transition">
                  <Zap className="w-3.5 h-3.5" /> Select All ({bookableGaps.length})
                </button>
                <span className="text-xs text-slate-400">{confirmedCount} selected for booking</span>
              </div>
            )}

            {/* Bookable gaps */}
            {bookableGaps.length > 0 && (
              <div className="space-y-2 mb-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Suggested Bookings</p>
                {bookableGaps.map((g, i) => {
                  const key = `${g.staff.id}:${g.suggestedCourse.id}`;
                  const confirmed = confirmedPlan[key];
                  return (
                    <div key={i} className={'flex items-center gap-3 p-3 rounded-xl border transition ' + (confirmed ? 'border-violet-300 bg-violet-50' : 'border-slate-200 bg-white hover:bg-slate-50')}>
                      <button onClick={() => toggleConfirm(key)}
                        className={'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition ' + (confirmed ? 'bg-violet-600 border-violet-600' : 'border-slate-300 bg-white hover:border-slate-400')}>
                        {confirmed && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                      </button>
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2E5A1A] to-[#8DC63F] flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-bold text-[10px]">{g.staff.name.charAt(0)}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-800 truncate">{g.staff.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={'text-[9px] font-bold px-1.5 py-0.5 rounded ' + (g.status === 'gap' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600')}>
                            {g.status === 'gap' ? 'Missing' : 'Expiring'}
                          </span>
                          <span className="text-[10px] text-slate-400">{g.category.label}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[10px] font-semibold text-slate-700 truncate max-w-[120px]">{g.suggestedCourse.title}</p>
                        <p className="text-[9px] text-slate-400">{format(new Date(g.suggestedCourse.start_date + 'T00:00'), 'dd MMM')}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Already booked */}
            {alreadyBookedGaps.length > 0 && (
              <div className="space-y-1.5 mb-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Already Booked ({alreadyBookedGaps.length})</p>
                {alreadyBookedGaps.slice(0, 5).map((g, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 border border-blue-100">
                    <Calendar className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                    <p className="text-[10px] text-slate-600 truncate">{g.staff.name} — {g.category.label} (course booked)</p>
                  </div>
                ))}
              </div>
            )}

            {/* Unbookable gaps — no matching courses */}
            {unbookableGaps.length > 0 && (
              <div className="space-y-1.5 mb-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">No Courses Available ({unbookableGaps.length})</p>
                {unbookableGaps.slice(0, 5).map((g, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-dashed border-slate-200">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    <p className="text-[10px] text-slate-500 truncate">{g.staff.name} — {g.category.label} (no upcoming course)</p>
                  </div>
                ))}
              </div>
            )}

            {/* Footer */}
            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button onClick={onClose} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-200 transition">Cancel</button>
              <button onClick={handleBook} disabled={saving || confirmedCount === 0}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl text-sm font-semibold hover:brightness-110 disabled:opacity-50 transition">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                {saving ? 'Booking…' : `Confirm ${confirmedCount} Booking${confirmedCount === 1 ? '' : 's'}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}