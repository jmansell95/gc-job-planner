import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { HardHat, ArrowLeft, Sparkles, LayoutDashboard, ClipboardCheck, CalendarPlus, X, Clock, Wrench, ShieldCheck, Users } from 'lucide-react';
import { format } from 'date-fns';
import DailyDiary from '@/components/staff/DailyDiary';
import WorkHistory from '@/components/staff/WorkHistory';
import StaffBookings from '@/components/staff/StaffBookings';
import ProfileStats from '@/components/staff/ProfileStats';
import TrainingHistory from '@/components/staff/TrainingHistory';
import StaffDocuments from '@/components/staff/StaffDocuments';
import TeamMiniFeed from '@/components/staff/TeamMiniFeed';
import EmailNotificationToggle from '@/components/staff/EmailNotificationToggle';
import ManagerTimesheetApprovals from '@/components/ManagerTimesheetApprovals';
import { useStaffAssistant } from '@/components/StaffAssistantChat';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/use-toast';
import { EmptyState } from '@/components/StateViews';

const ABSENCE_REASONS = [
  { value: 'holiday', label: 'Holiday' },
  { value: 'sick', label: 'Sick Leave' },
  { value: 'personal', label: 'Personal' },
  { value: 'training', label: 'Training' },
  { value: 'other', label: 'Other' },
];

export default function StaffProfile() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { openChat } = useStaffAssistant();
  const queryClient = useQueryClient();
  const [staff, setStaff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showApprovals, setShowApprovals] = useState(false);
  const [showAbsenceForm, setShowAbsenceForm] = useState(false);
  const [absenceForm, setAbsenceForm] = useState({ start_date: format(new Date(), 'yyyy-MM-dd'), end_date: format(new Date(), 'yyyy-MM-dd'), reason: 'holiday', notes: '' });
  const [savingAbsence, setSavingAbsence] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await base44.functions.invoke('getMyStaffProfile');
        if (res.data?.id && !res.data.no_staff_profile) setStaff(res.data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const { data: allStaff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: mgrTimesheets = [] } = useQuery({ queryKey: ['all-timesheets-mgr'], queryFn: () => base44.entities.Timesheet.list('-created_date', 500) });
  const { data: absences = [] } = useQuery({
    queryKey: ['my-absences', staff?.id],
    queryFn: () => base44.entities.Absence.filter({ staff_id: staff.id }, '-start_date', 20),
    enabled: !!staff?.id
  });

  const reporters = staff ? allStaff.filter(s => s.manager_id === staff.id) : [];
  const pendingCount = mgrTimesheets.filter(t => reporters.some(r => r.id === t.staff_id) && t.status === 'submitted').length;
  const upcomingAbsences = absences.filter(a => new Date(a.end_date + 'T00:00:00') >= new Date() && a.status !== 'rejected');

  const handleSaveAbsence = async () => {
    if (!absenceForm.start_date || !absenceForm.end_date) return;
    setSavingAbsence(true);
    try {
      await base44.entities.Absence.create({ staff_id: staff.id, ...absenceForm, status: 'pending' });
      try { await base44.functions.invoke('notifyAbsenceRequest', { staff_id: staff.id, ...absenceForm }); } catch (_) {}
      queryClient.invalidateQueries({ queryKey: ['my-absences', staff.id] });
      toast({ title: 'Time off requested', description: 'Your manager will review this request.' });
      setShowAbsenceForm(false);
      setAbsenceForm({ start_date: format(new Date(), 'yyyy-MM-dd'), end_date: format(new Date(), 'yyyy-MM-dd'), reason: 'holiday', notes: '' });
    } catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
    setSavingAbsence(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="w-10 h-10 border-4 border-emerald-100 border-t-emerald-700 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 px-6">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <HardHat className="w-7 h-7 text-slate-400" />
          </div>
          <p className="text-slate-700 font-semibold">No crew profile found</p>
          <p className="text-slate-400 text-sm mt-1">Contact your supervisor to get set up.</p>
        </div>
      </div>
    );
  }

  const canAccessAdmin = staff.is_admin || (staff.team?.allowed_tool_access?.length > 0);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header with Quick Actions bar */}
      <div className="hero-gradient relative overflow-hidden">
        <div className="relative max-w-4xl mx-auto px-4 md:px-6 py-5 md:py-7">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => navigate('/staff-schedule')} type="button"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 ring-1 ring-white/20 text-white text-sm font-medium active:scale-95 transition touch-manipulation flex-shrink-0">
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Schedule</span>
              </button>
              <div className="min-w-0">
                <h1 className="text-xl md:text-2xl font-bold text-white truncate tracking-tight">My Profile</h1>
                <p className="text-emerald-100 text-sm truncate">{staff.name}{staff.team?.name ? ` · ${staff.team.name}` : ''}</p>
              </div>
            </div>
          </div>
          {/* Quick Actions bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            <button onClick={() => setShowAbsenceForm(true)} type="button"
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 ring-1 ring-white/20 text-white text-sm font-medium active:scale-95 transition touch-manipulation whitespace-nowrap flex-shrink-0">
              <CalendarPlus className="w-4 h-4" />
              <span>Time Off</span>
            </button>
            <EmailNotificationToggle initialEnabled={staff.email_notifications_enabled} compact />
            {reporters.length > 0 && (
              <button onClick={() => setShowApprovals(true)} type="button"
                className="relative flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 ring-1 ring-white/20 text-white text-sm font-medium active:scale-95 transition touch-manipulation whitespace-nowrap flex-shrink-0">
                <ClipboardCheck className="w-4 h-4" />
                <span>Approvals</span>
                {pendingCount > 0 && (
                  <span className="min-w-[20px] h-5 px-1.5 bg-amber-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center">{pendingCount}</span>
                )}
              </button>
            )}
            <button onClick={openChat} type="button"
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 ring-1 ring-white/20 text-white text-sm font-medium active:scale-95 transition touch-manipulation whitespace-nowrap flex-shrink-0">
              <Sparkles className="w-4 h-4" />
              <span>Assistant</span>
            </button>
            {canAccessAdmin && (
              <button onClick={() => navigate('/admin')} type="button"
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 ring-1 ring-white/20 text-white text-sm font-medium active:scale-95 transition touch-manipulation whitespace-nowrap flex-shrink-0">
                <LayoutDashboard className="w-4 h-4" />
                <span>Admin</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 md:px-6 pt-5 md:pt-8 space-y-5 md:space-y-6" style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}>
        {/* Quick Stats */}
        <ProfileStats staffId={staff.id} jobType={staff.team?.job_type} />

        {/* Daily Diary */}
        <DailyDiary staffId={staff.id} />

        {/* Work History */}
        <WorkHistory staffId={staff.id} />

        {/* My Bookings — maintenance & training */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-6 shadow-sm">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
              <Wrench className="w-4 h-4 text-amber-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">My Bookings</h2>
          </div>
          <StaffBookings staffId={staff.id} />
        </div>

        {/* Upcoming Time Off */}
        {upcomingAbsences.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-6 shadow-sm">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Upcoming Time Off</h2>
            </div>
            <div className="space-y-2">
              {upcomingAbsences.map(a => (
                <div key={a.id} className="flex items-center gap-2 text-sm">
                  <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="text-slate-700 font-medium capitalize">{a.reason}</span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-500">{format(new Date(a.start_date + 'T00:00:00'), 'dd MMM')} – {format(new Date(a.end_date + 'T00:00:00'), 'dd MMM')}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ml-auto ${
                    a.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                    a.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-slate-500'
                  }`}>{a.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* My Training — passed courses & certificates */}
        <TrainingHistory staffId={staff.id} staffName={staff.name} />

        {/* My Documents — CSCS card front/back, certificates */}
        <StaffDocuments staffId={staff.id} staffName={staff.name} />

        {/* Team Mini Feed */}
        {staff.team_id && (
          <TeamMiniFeed teamId={staff.team_id} currentStaffId={staff.id} />
        )}
      </div>

      {/* Approvals Sheet */}
      <Sheet open={showApprovals} onOpenChange={setShowApprovals}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-amber-600" />
              Timesheet Approvals
            </SheetTitle>
          </SheetHeader>
          <ManagerTimesheetApprovals staffId={staff.id} />
        </SheetContent>
      </Sheet>

      {/* Absence Request Modal */}
      {showAbsenceForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => !savingAbsence && setShowAbsenceForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-lg">Request Time Off</h3>
              <button onClick={() => setShowAbsenceForm(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">From</label>
                  <input type="date" value={absenceForm.start_date} onChange={e => setAbsenceForm({ ...absenceForm, start_date: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">To</label>
                  <input type="date" value={absenceForm.end_date} min={absenceForm.start_date} onChange={e => setAbsenceForm({ ...absenceForm, end_date: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Reason</label>
                <select value={absenceForm.reason} onChange={e => setAbsenceForm({ ...absenceForm, reason: e.target.value })}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 bg-white">
                  {ABSENCE_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Notes (optional)</label>
                <textarea value={absenceForm.notes} onChange={e => setAbsenceForm({ ...absenceForm, notes: e.target.value })} rows={2}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 resize-none" />
              </div>
              <button onClick={handleSaveAbsence} disabled={savingAbsence || !absenceForm.start_date || !absenceForm.end_date}
                className="w-full px-4 py-2.5 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-sm font-semibold disabled:opacity-50">
                {savingAbsence ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}