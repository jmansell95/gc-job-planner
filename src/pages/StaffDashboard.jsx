import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, CalendarDays, Clock, Briefcase, WifiOff, HardHat, Sparkles, MessageCircle, History, ChevronDown, ClipboardCheck } from 'lucide-react';
import { format, isFuture, isPast } from 'date-fns';
import DailyTaskLog from '@/components/DailyTaskLog';
import StaffTimesheets from '@/components/StaffTimesheets';
import ManagerTimesheetApprovals from '@/components/ManagerTimesheetApprovals';
import { useStaffAssistant } from '@/components/StaffAssistantChat';
import { motion } from 'framer-motion';
import { EmptyState, Skeleton, SkeletonText } from '@/components/StateViews';
import AssignmentCard from '@/components/staff/AssignmentCard';
import JobBriefingModal from '@/components/staff/JobBriefingModal';
import EndOfDayCard from '@/components/staff/EndOfDayCard';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

const listContainer = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };

function SectionHeader({ icon: Icon, title, count, tone = 'dark' }) {
  const textTone = tone === 'muted' ? 'text-slate-400' : 'text-slate-900';
  return (
    <div className="flex items-center gap-2.5 mb-3 md:mb-4">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tone === 'muted' ? 'bg-slate-100' : 'bg-emerald-50'}`}>
        <Icon className={`w-4 h-4 ${tone === 'muted' ? 'text-slate-400' : 'text-emerald-700'}`} />
      </div>
      <h2 className={`text-lg md:text-xl font-bold ${textTone}`}>{title}</h2>
      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${tone === 'muted' ? 'bg-slate-100 text-slate-400' : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'}`}>{count}</span>
    </div>
  );
}

export default function StaffDashboard() {
  const [staff, setStaff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [meterageInputs, setMeterageInputs] = useState({});
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showApprovals, setShowApprovals] = useState(false);
  const [showTimesheets, setShowTimesheets] = useState(false);
  const [briefingAssignment, setBriefingAssignment] = useState(null);
  const { openChat } = useStaffAssistant();
  const queryClient = useQueryClient();

  useEffect(() => {
    async function loadStaff() {
      try {
        const res = await base44.functions.invoke('getMyStaffProfile');
        const profile = res.data;
        if (profile && profile.id && !profile.no_staff_profile) {
          setStaff(profile);
        }
      } catch (error) {
        console.error('Error loading staff:', error);
      } finally {
        setLoading(false);
      }
    }
    loadStaff();
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ['staff-assignments', staff?.id],
    queryFn: async () => {
      if (!staff?.id) return [];
      try {
        const rotas = await base44.entities.RotaAssignment.filter({ staff_id: staff.id });
        const sorted = rotas.sort((a, b) => new Date(a.assigned_date) - new Date(b.assigned_date));
        localStorage.setItem('cached_assignments_' + staff.id, JSON.stringify(sorted));
        return sorted;
      } catch (err) {
        const cached = localStorage.getItem('cached_assignments_' + staff.id);
        if (cached) return JSON.parse(cached);
        throw err;
      }
    },
    enabled: !!staff?.id
  });

  const { data: jobs = [] } = useQuery({ queryKey: ['jobs-for-assignments'], queryFn: () => base44.entities.Job.list() });
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => base44.entities.Vehicle.list() });
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list() });
  const { data: allStaff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: mgrTimesheets = [] } = useQuery({ queryKey: ['all-timesheets-mgr'], queryFn: () => base44.entities.Timesheet.list('-created_date', 500) });

  const handleStartJob = async (assignmentId) => {
    try {
      await base44.entities.RotaAssignment.update(assignmentId, {
        status: 'started',
        started_at: new Date().toISOString()
      });
      queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
    } catch (error) {
      console.error('Error starting job:', error);
    }
  };

  const handleCompleteJob = async (assignmentId, extraData = {}) => {
    try {
      const updateData = {
        status: 'completed',
        completed_at: new Date().toISOString(),
        ...extraData
      };
      if (meterageInputs[assignmentId] !== undefined && meterageInputs[assignmentId] !== '') {
        updateData.meterage = parseFloat(meterageInputs[assignmentId]) || 0;
      }
      await base44.entities.RotaAssignment.update(assignmentId, updateData);
      setMeterageInputs(prev => { const next = { ...prev }; delete next[assignmentId]; return next; });
      queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
    } catch (error) {
      console.error('Error completing job:', error);
    }
  };

  const handleBriefingSign = async (assignmentId) => {
    try {
      await base44.entities.RotaAssignment.update(assignmentId, {
        briefing_signed: true,
        briefing_signed_at: new Date().toISOString()
      });
      queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
    } catch (error) {
      console.error('Error signing briefing:', error);
    }
  };

  const handleStartAttempt = (assignmentId) => {
    const assignment = assignments.find(a => a.id === assignmentId);
    if (!assignment) return;
    const hasPriorBriefing = assignments.some(a => a.job_id === assignment.job_id && a.briefing_signed && a.id !== assignment.id);
    if (assignment.briefing_signed || hasPriorBriefing) {
      handleStartJob(assignmentId);
    } else {
      setBriefingAssignment(assignment);
    }
  };

  const handleBriefingComplete = () => {
    setBriefingAssignment(null);
    queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
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
          <p className="text-slate-700 font-semibold">No staff profile found</p>
          <p className="text-slate-400 text-sm mt-1">Contact your supervisor to get set up.</p>
        </div>
      </div>
    );
  }

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todaysAssignments = assignments.filter(a => a.assigned_date === todayStr);
  const upcomingAssignments = assignments.filter(a => isFuture(new Date(a.assigned_date + 'T00:00:00')) && a.assigned_date !== todayStr);
  const pastAssignments = assignments.filter(a => isPast(new Date(a.assigned_date + 'T00:00:00')) && a.assigned_date !== todayStr)
    .sort((a, b) => new Date(b.assigned_date) - new Date(a.assigned_date));

  const nextTodayAssignment = todaysAssignments.find(a => (a.status || 'assigned') !== 'completed');
  const todaysAllDone = todaysAssignments.length > 0 && !nextTodayAssignment;
  const heroAssignment = nextTodayAssignment || upcomingAssignments[0];
  const isHeroStarted = heroAssignment?.status === 'started' && heroAssignment?.assigned_date === todayStr;

  const reporters = allStaff.filter(s => s.manager_id === staff.id);
  const pendingCount = mgrTimesheets.filter(t => reporters.some(r => r.id === t.staff_id) && t.status === 'submitted').length;

  const cardProps = (assignment) => ({
    assignment,
    job: jobs.find(j => j.id === assignment.job_id),
    vehicle: vehicles.find(v => v.id === assignment.vehicle_id),
    client: clients.find(c => c.id === jobs.find(j => j.id === assignment.job_id)?.client_id),
    staff,
    onStart: handleStartAttempt,
    onComplete: handleCompleteJob,
    onSign: handleBriefingSign,
    meterage: meterageInputs[assignment.id],
    onMeterageChange: (id, val) => setMeterageInputs(prev => ({ ...prev, [id]: val })),
    tasksSubmitted: mgrTimesheets.some(t => t.job_id === assignment.job_id && t.date === todayStr && (t.status === 'submitted' || t.status === 'approved')),
    needsBriefing: !assignment.briefing_signed && !assignments.some(a => a.job_id === assignment.job_id && a.briefing_signed && a.id !== assignment.id),
    previousProgress: assignments
      .filter(a => a.job_id === assignment.job_id && a.progress_notes && a.assigned_date < assignment.assigned_date)
      .sort((a, b) => new Date(b.assigned_date) - new Date(a.assigned_date))
      .map(a => ({ date: a.assigned_date, notes: a.progress_notes, staffName: allStaff.find(s => s.id === a.staff_id)?.name || staff.name }))
  });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="hero-gradient relative overflow-hidden">
        <div className="relative max-w-6xl mx-auto px-4 md:px-6 py-5 md:py-7">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg ring-1 ring-white/25 flex-shrink-0">
                <HardHat className="w-6 h-6 md:w-7 md:h-7 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl md:text-3xl font-bold text-white truncate tracking-tight">My Schedule</h1>
                <p className="text-emerald-100 text-sm md:text-base mt-0.5 truncate">Welcome back, {staff.name.split(' ')[0]}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {reporters.length > 0 && (
                <button onClick={() => setShowApprovals(true)} type="button"
                  className="relative flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 ring-1 ring-white/20 text-white text-sm font-medium active:scale-95 transition touch-manipulation">
                  <ClipboardCheck className="w-5 h-5" />
                  <span className="hidden sm:inline">Approvals</span>
                  {pendingCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1.5 bg-amber-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center ring-2 ring-emerald-800">{pendingCount}</span>
                  )}
                </button>
              )}
              <button onClick={() => setShowTimesheets(true)} type="button"
                className="flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 ring-1 ring-white/20 text-white text-sm font-medium active:scale-95 transition touch-manipulation">
                <Clock className="w-5 h-5" />
                <span className="hidden sm:inline">My Timesheets</span>
              </button>
              <button onClick={openChat} type="button"
                className="flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 ring-1 ring-white/20 text-white text-sm font-medium active:scale-95 transition touch-manipulation">
                <Sparkles className="w-5 h-5" />
                <span className="hidden sm:inline">Ask Assistant</span>
              </button>
            </div>
          </div>

          {/* Quick stats strip */}
          <div className="grid grid-cols-3 gap-2 md:gap-3">
            {[
              { label: 'Today', value: todaysAssignments.length, icon: Clock },
              { label: 'Upcoming', value: upcomingAssignments.length, icon: Calendar },
              { label: 'Total', value: assignments.length, icon: Briefcase }
            ].map((stat) => (
              <div key={stat.label} className="bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2.5 ring-1 ring-white/15">
                <div className="flex items-center gap-1.5">
                  <stat.icon className="w-3.5 h-3.5 text-emerald-200" />
                  <p className="text-[10px] md:text-xs font-medium text-emerald-100 uppercase tracking-wide">{stat.label}</p>
                </div>
                <p className="text-xl md:text-2xl font-bold text-white mt-0.5">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-5 md:py-8">
        {/* WhatsApp reminder */}
        <div className="mb-5 flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-sm text-emerald-900">
          <MessageCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <p className="font-medium">Check WhatsApp groups for updates at the start of each working day.</p>
        </div>

        {!isOnline && (
          <div className="mb-5 flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            <WifiOff className="w-4 h-4 flex-shrink-0" />
            You're offline. Showing cached schedule — changes will sync when you reconnect.
          </div>
        )}

        {/* Assignments List */}
        {assignmentsLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5">
                <Skeleton className="h-1.5 w-full mb-4 rounded-full" />
                <Skeleton className="h-4 w-1/3 mb-3" />
                <SkeletonText lines={3} />
              </div>
            ))}
          </div>
        ) : assignments.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200">
            <EmptyState icon={CalendarDays} title="No assignments scheduled" message="Check back later — your supervisor will assign you to upcoming jobs." />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Current/next job — one at a time */}
            {heroAssignment ? (
              <>
                <AssignmentCard {...cardProps(heroAssignment)} defaultExpanded />
                {isHeroStarted && <DailyTaskLog staffId={staff.id} />}
              </>
            ) : todaysAllDone ? (
              <EndOfDayCard />
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200">
                <EmptyState icon={CalendarDays} title="No jobs scheduled" message="You have no assignments for today. Check back later or contact your supervisor." />
              </div>
            )}
          </div>
        )}

      </div>

      {/* Timesheet Approvals pop-out */}
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

      {/* Briefing modal */}
      {briefingAssignment && (
        <JobBriefingModal
          assignment={briefingAssignment}
          job={jobs.find(j => j.id === briefingAssignment.job_id)}
          client={clients.find(c => c.id === jobs.find(j => j.id === briefingAssignment.job_id)?.client_id)}
          onStart={handleBriefingComplete}
          onClose={() => setBriefingAssignment(null)}
        />
      )}

      {/* My Timesheets pop-out */}
      <Sheet open={showTimesheets} onOpenChange={setShowTimesheets}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-700" />
              My Timesheets
            </SheetTitle>
          </SheetHeader>
          <StaffTimesheets staffId={staff.id} staffName={staff.name} />
        </SheetContent>
      </Sheet>
    </div>
  );
}