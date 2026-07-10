import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, CalendarDays, CalendarClock, Clock, Briefcase, WifiOff, HardHat, MessageCircle, History, CheckCircle2, UserCircle, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, isFuture, isPast } from 'date-fns';
import DailyTaskLog from '@/components/DailyTaskLog';
import { motion } from 'framer-motion';
import { EmptyState, Skeleton, SkeletonText } from '@/components/StateViews';
import AssignmentCard from '@/components/staff/AssignmentCard';
import JobBriefingModal from '@/components/staff/JobBriefingModal';
import EndOfDayCard from '@/components/staff/EndOfDayCard';
import { useToast } from '@/components/ui/use-toast';
import { syncPendingBriefings } from '@/utils/briefingSync';
import { isWithinSiteHours, isBeforeSiteOpen, SITE_OPEN_TIME, SITE_CLOSE_TIME, SITE_EARLY_ACCESS_TIME } from '@/utils/siteHours';
import { complianceDaysUntil } from '@/utils/complianceDate';
import OutsideSiteHours from '@/components/staff/OutsideSiteHours';
import TravelFromSiteModal from '@/components/staff/TravelFromSiteModal';
import ScheduleSplash from '@/components/staff/ScheduleSplash';

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
  const navigate = useNavigate();
  const [staff, setStaff] = useState(null);
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [meterageInputs, setMeterageInputs] = useState({});
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [briefingAssignment, setBriefingAssignment] = useState(null);
  const [travelFromAssignment, setTravelFromAssignment] = useState(null);
  const [splashDismissed, setSplashDismissed] = useState(false);
  const [showScheduleSummary, setShowScheduleSummary] = useState(false);
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
    const handleOnline = () => {
      setIsOnline(true);
      syncPendingBriefings().then(count => {
        if (count > 0) {
          queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
          queryClient.invalidateQueries({ queryKey: ['all-rota-assignments'] });
          toast({ title: 'Briefing signatures synced', description: `${count} offline signature${count === 1 ? '' : 's'} uploaded.` });
        }
      }).catch(err => console.error('Sync error:', err));
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Real-time sync: reflect assignment changes (including deletions) immediately
  useEffect(() => {
    if (!staff?.id) return;
    const unsub1 = base44.entities.RotaAssignment.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
    });
    const unsub2 = base44.entities.RotaWeek.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['rota-weeks'] });
    });
    return () => { if (unsub1) unsub1(); if (unsub2) unsub2(); };
  }, [staff?.id, queryClient]);

  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ['staff-assignments', staff?.id],
    queryFn: async () => {
      if (!staff?.id) return [];
      try {
        const rawRotas = await base44.entities.RotaAssignment.filter({ staff_id: staff.id });
        // Deduplicate: one assignment per job per date
        const _seen = {};
        const rotas = rawRotas.filter(a => {
          const k = `${a.job_id}|${a.assigned_date}`;
          if (_seen[k]) return false;
          _seen[k] = true;
          return true;
        });
        const sorted = rotas.sort((a, b) => new Date(a.assigned_date) - new Date(b.assigned_date));
        localStorage.setItem('cached_assignments_' + staff.id, JSON.stringify(sorted));
        return sorted;
      } catch (err) {
        // Only fall back to cached data when genuinely offline — otherwise stale
        // cache causes deleted assignments to reappear on transient API errors
        if (!navigator.onLine) {
          const cached = localStorage.getItem('cached_assignments_' + staff.id);
          if (cached) return JSON.parse(cached);
        }
        throw err;
      }
    },
    enabled: !!staff?.id
  });

  const { data: jobs = [] } = useQuery({ queryKey: ['jobs-for-assignments'], queryFn: () => base44.entities.Job.list() });
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => base44.entities.Vehicle.list() });
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list() });
  const { data: allStaff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: teams = [] } = useQuery({ queryKey: ['teams'], queryFn: () => base44.entities.Team.list() });
  const { data: allAssignments = [] } = useQuery({ queryKey: ['all-rota-assignments'], queryFn: () => base44.entities.RotaAssignment.list('-created_date', 500) });
  const { data: mgrTimesheets = [] } = useQuery({ queryKey: ['all-timesheets-mgr'], queryFn: () => base44.entities.Timesheet.list('-created_date', 500) });
  const { data: rotaWeeks = [] } = useQuery({ queryKey: ['rota-weeks'], queryFn: () => base44.entities.RotaWeek.list() });
  const { data: myCompliance = [] } = useQuery({ queryKey: ['staff-compliance', staff?.id], queryFn: () => base44.entities.ComplianceItem.filter({ category: 'staff' }), enabled: !!staff?.id });
  const { data: myHotelBookings = [] } = useQuery({ queryKey: ['my-hotel-bookings', staff?.id], queryFn: () => base44.entities.HotelBooking.list('-created_date', 500).then(list => list.filter(b => (b.assigned_staff_ids || []).includes(staff.id) || b.staff_id === staff.id)), enabled: !!staff?.id });

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

  // Opens the travel-from-site modal before final completion
  const handleCompleteJob = (assignmentId, extraData = {}) => {
    setTravelFromAssignment({ assignmentId, extraData });
  };

  // Actual completion after travel-from-site is captured (or skipped)
  const handleCompleteJobWithTravel = async (travelData) => {
    if (!travelFromAssignment) return;
    const { assignmentId, extraData } = travelFromAssignment;
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      // Create travel_from entry first so it's included in the timesheet merge
      if (travelData.departSite && travelData.arriveHome) {
        const [dh, dm] = travelData.departSite.split(':').map(Number);
        const [ah, am] = travelData.arriveHome.split(':').map(Number);
        const travelMins = (ah * 60 + am) - (dh * 60 + dm);
        if (travelMins > 0) {
          const assignment = assignments.find(a => a.id === assignmentId);
          await base44.entities.Timesheet.create({
            staff_id: staff.id,
            date: todayStr,
            job_id: assignment?.job_id || '',
            task_description: 'Travel from site',
            task_type: 'travel_from',
            start_time: travelData.departSite,
            end_time: travelData.arriveHome,
            task_duration_minutes: travelMins,
            total_hours: Math.round((travelMins / 60) * 100) / 100,
            status: 'draft'
          });
        }
      }
      try {
        await base44.functions.invoke('submitDailyTimesheet', { staff_id: staff.id, date: todayStr });
      } catch (e) { console.error('Timesheet submit error:', e); }
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
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['staff-timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['all-timesheets-mgr'] });
      toast({ title: 'Shift completed', description: 'Your timesheet has been submitted for approval.' });
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

  const handleConfirmShift = async (assignmentId) => {
    try {
      await base44.entities.RotaAssignment.update(assignmentId, { shift_status: 'confirmed' });
      queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
    } catch (error) {
      console.error('Error confirming shift:', error);
    }
  };

  const handleDeclineShift = async (assignmentId) => {
    try {
      await base44.entities.RotaAssignment.update(assignmentId, { shift_status: 'declined' });
      queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
    } catch (error) {
      console.error('Error declining shift:', error);
    }
  };

  const handleAcknowledgeSchedule = async (weekStart) => {
    try {
      const res = await base44.functions.invoke('acknowledgeSchedule', { week_start: weekStart });
      const ackAt = res?.data?.acknowledged_at || new Date().toISOString();
      setStaff(prev => prev ? { ...prev, last_acknowledged_week: weekStart, schedule_acknowledged_at: ackAt } : prev);
    } catch (error) {
      console.error('Error acknowledging schedule:', error);
    } finally {
      setSplashDismissed(true);
    }
  };

  const handleStartAttempt = (assignmentId) => {
    const assignment = assignments.find(a => a.id === assignmentId);
    if (!assignment) return;
    const hasPriorBriefing = assignments.some(a => a.job_id === assignment.job_id && a.briefing_signed && a.id !== assignment.id);
    const thisSigned = assignment.briefing_signed || hasPriorBriefing;
    if (!thisSigned) {
      setBriefingAssignment(assignment);
      return;
    }
    const crew = allAssignments.filter(a => a.job_id === assignment.job_id && a.assigned_date === assignment.assigned_date);
    const allSigned = crew.length > 0 && crew.every(a => a.briefing_signed);
    if (!allSigned) {
      const signedCount = crew.filter(a => a.briefing_signed).length;
      toast({ title: 'Waiting for crew briefings', description: `${signedCount} of ${crew.length} crew members have signed off. Everyone must complete the briefing before the shift can start.` });
      return;
    }
    handleStartJob(assignmentId);
  };

  const handleBriefingComplete = ({ offline } = {}) => {
    const justSigned = briefingAssignment;
    setBriefingAssignment(null);
    queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
    queryClient.invalidateQueries({ queryKey: ['all-rota-assignments'] });
    queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
    if (offline) {
      toast({ title: 'Briefing saved offline', description: 'Your signature will sync when you reconnect.' });
      return;
    }
    if (justSigned) {
      const crew = allAssignments.filter(a => a.job_id === justSigned.job_id && a.assigned_date === justSigned.assigned_date);
      const signedCount = crew.filter(a => a.briefing_signed || a.id === justSigned.id).length;
      const allSigned = crew.length > 0 && signedCount === crew.length;
      if (allSigned) {
        handleStartJob(justSigned.id);
        toast({ title: 'All crew briefed — shift started', description: 'Everyone has signed off on the site briefing.' });
      } else {
        toast({ title: 'Briefing signed', description: `${signedCount} of ${crew.length} crew members signed off — waiting for the rest.` });
      }
    }
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

  // Schedule splash — staff must acknowledge their weekly rota before proceeding.
  // Shown before the site-hours check so they can review the schedule any time.
  const publishedWeekStarts = rotaWeeks.filter(w => w.status === 'published' && !w.superseded).map(w => w.week_start);
  const latestPublishedWeek = publishedWeekStarts.length > 0 ? [...publishedWeekStarts].sort().reverse()[0] : null;
  const needsSplash = !splashDismissed && staff && latestPublishedWeek && latestPublishedWeek !== (staff.last_acknowledged_week || null);

  if (needsSplash) {
    const splashAssignments = assignments.filter(a => publishedWeekStarts.includes(a.week_start));
    return (
      <ScheduleSplash
        assignments={splashAssignments}
        jobs={jobs}
        vehicles={vehicles}
        clients={clients}
        teams={teams}
        staff={staff}
        weekStart={latestPublishedWeek}
        loading={assignmentsLoading}
        onAcknowledge={() => handleAcknowledgeSchedule(latestPublishedWeek)}
      />
    );
  }

  if (!isWithinSiteHours() && !isBeforeSiteOpen() && !staff?.is_admin) {
    return <OutsideSiteHours openTime={SITE_OPEN_TIME} closeTime={SITE_CLOSE_TIME} />;
  }
  const canPerformActions = isWithinSiteHours() || staff?.is_admin;

  // Staff only see assignments from the latest published (non-superseded) rota week.
  // When a new draft is created, old weeks are superseded and staff see nothing until
  // the new rota is published/sent to them.
  const visibleWeekStarts = rotaWeeks.filter(w => w.status === 'published' && !w.superseded).map(w => w.week_start);
  const hasAnyRotaWeeks = rotaWeeks.length > 0;
  const cancelledJobIds = new Set(jobs.filter(j => j.status === 'cancelled').map(j => j.id));
  const onHoldJobIds = new Set(jobs.filter(j => j.status === 'on_hold').map(j => j.id));
  const visibleAssignments = (hasAnyRotaWeeks ? assignments.filter(a => visibleWeekStarts.includes(a.week_start)) : assignments)
    .filter(a => !cancelledJobIds.has(a.job_id));
  const scheduleLocked = hasAnyRotaWeeks && visibleWeekStarts.length === 0;

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todaysAssignments = visibleAssignments.filter(a => a.assigned_date === todayStr);
  const todaysSorted = [...todaysAssignments].sort((a, b) => (a.start_time || '23:59').localeCompare(b.start_time || '23:59'));
  const upcomingAssignments = visibleAssignments.filter(a => isFuture(new Date(a.assigned_date + 'T00:00:00')) && a.assigned_date !== todayStr);
  const upcomingGrouped = {};
  upcomingAssignments.forEach(a => {
    if (!upcomingGrouped[a.assigned_date]) upcomingGrouped[a.assigned_date] = [];
    upcomingGrouped[a.assigned_date].push(a);
  });
  const upcomingDates = Object.keys(upcomingGrouped).sort();

  const nextTodayAssignment = todaysSorted.find(a => (a.status || 'assigned') !== 'completed');
  const todaysAllDone = todaysSorted.length > 0 && !nextTodayAssignment;
  const activeStarted = nextTodayAssignment?.status === 'started';

  const reporters = allStaff.filter(s => s.manager_id === staff.id);
  const pendingCount = mgrTimesheets.filter(t => reporters.some(r => r.id === t.staff_id) && t.status === 'submitted').length;

  const cardProps = (assignment) => {
    const crew = allAssignments.filter(a => a.job_id === assignment.job_id && a.assigned_date === assignment.assigned_date);
    const crewSignedCount = crew.filter(a => a.briefing_signed).length;
    const crewTotal = crew.length;
    return {
    assignment,
    job: jobs.find(j => j.id === assignment.job_id),
    vehicle: vehicles.find(v => v.id === assignment.vehicle_id),
    client: clients.find(c => c.id === jobs.find(j => j.id === assignment.job_id)?.client_id),
    staff,
    onStart: handleStartAttempt,
    onComplete: handleCompleteJob,
    onSign: handleBriefingSign,
    onConfirmShift: handleConfirmShift,
    onDeclineShift: handleDeclineShift,
    canPerformActions,
    meterage: meterageInputs[assignment.id],
    onMeterageChange: (id, val) => setMeterageInputs(prev => ({ ...prev, [id]: val })),
    tasksSubmitted: mgrTimesheets.some(t => t.job_id === assignment.job_id && t.date === todayStr && (t.status === 'submitted' || t.status === 'approved')),
    needsBriefing: !assignment.briefing_signed && !visibleAssignments.some(a => a.job_id === assignment.job_id && a.briefing_signed && a.id !== assignment.id),
    crewSignedCount,
    crewTotal,
    allCrewSigned: crewTotal > 0 && crewSignedCount === crewTotal,
    previousProgress: visibleAssignments
      .filter(a => a.job_id === assignment.job_id && a.progress_notes && a.assigned_date < assignment.assigned_date)
      .sort((a, b) => new Date(b.assigned_date) - new Date(a.assigned_date))
      .map(a => ({ date: a.assigned_date, notes: a.progress_notes, staffName: allStaff.find(s => s.id === a.staff_id)?.name || staff.name })),
    hotelBooking: myHotelBookings.find(h => h.job_id === assignment.job_id) || null
  };
  };

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
                <p className="text-emerald-200/80 text-xs md:text-sm mt-0.5 truncate">{format(new Date(), 'EEEE, do MMMM yyyy')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => setShowScheduleSummary(true)} type="button"
                className="flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 ring-1 ring-white/20 text-white text-sm font-medium active:scale-95 transition touch-manipulation">
                <CalendarDays className="w-5 h-5" />
                <span className="hidden sm:inline">My Schedule</span>
              </button>
              <button onClick={() => navigate('/staff-profile')} type="button"
                className="flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 ring-1 ring-white/20 text-white text-sm font-medium active:scale-95 transition touch-manipulation">
                <UserCircle className="w-5 h-5" />
                <span className="hidden sm:inline">My Profile</span>
              </button>
            </div>
          </div>

          {/* Quick stats strip */}
          <div className="grid grid-cols-3 gap-2 md:gap-3">
            {[
              { label: 'Today', value: todaysAssignments.length, icon: Clock },
              { label: 'Upcoming', value: upcomingAssignments.length, icon: Calendar },
              { label: 'Total', value: visibleAssignments.length, icon: Briefcase }
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
        {/* Info banners — consolidated stack */}
        <div className="space-y-2 mb-5">
          {/* Early access — most important, shown first */}
          {!canPerformActions && isBeforeSiteOpen() && (
            <div className="flex items-center gap-2.5 bg-blue-50/80 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-900">
              <Clock className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <p className="font-medium">Early access — work actions unlock at {SITE_OPEN_TIME}.</p>
            </div>
          )}

          {/* WhatsApp reminder */}
          <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm text-slate-600">
            <MessageCircle className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <p className="font-medium">Check WhatsApp groups for updates at the start of each working day.</p>
          </div>
        </div>

        {/* Compliance status alert */}
        {(() => {
          const myItems = myCompliance.filter(i => i.reference_id === staff?.id || i.reference_name === staff?.name);
          const expired = myItems.filter(i => {
            if (!i.expiry_date || i.status_override !== 'auto') return false;
            const days = complianceDaysUntil(i.expiry_date);
            return days !== null && days < 0;
          });
          const expiring = myItems.filter(i => {
            if (!i.expiry_date || i.status_override !== 'auto') return false;
            const days = complianceDaysUntil(i.expiry_date);
            return days !== null && days >= 0 && days <= 30;
          });
          const hasCSCS = myItems.some(i => i.qualification_type === 'cscs_card' || /cscs/i.test(i.title));
          if (expired.length === 0 && expiring.length === 0 && hasCSCS) return null;
          const isUrgent = expired.length > 0 || !hasCSCS;
          return (
            <button onClick={() => navigate('/staff-profile')} type="button"
              className={`mb-5 w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm text-left transition shadow-sm ${isUrgent ? 'bg-red-50 border border-red-100 text-red-900' : 'bg-amber-50 border border-amber-100 text-amber-900'}`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isUrgent ? 'bg-red-100' : 'bg-amber-100'}`}>
                <AlertTriangle className={`w-5 h-5 ${isUrgent ? 'text-red-500' : 'text-amber-500'}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold">{expired.length > 0 ? `${expired.length} compliance item${expired.length > 1 ? 's' : ''} expired` : expiring.length > 0 ? `${expiring.length} item${expiring.length > 1 ? 's' : ''} expiring soon` : 'CSCS card not on file'}</p>
                <p className="text-xs opacity-80 mt-0.5">{expired.length > 0 ? 'Tap to view details in your profile.' : expiring.length > 0 ? 'Tap to check your compliance wallet.' : 'Field staff need a valid CSCS card. Tap to view your profile.'}</p>
              </div>
              <ShieldCheck className={`w-5 h-5 flex-shrink-0 ${isUrgent ? 'text-red-400' : 'text-amber-400'}`} />
            </button>
          );
        })()}

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
        ) : scheduleLocked ? (
          <div className="bg-white rounded-2xl border border-slate-200">
            <EmptyState icon={CalendarClock} title="New schedule on the way" message="Your manager is preparing your new rota. You'll receive it by email once it's ready." />
          </div>
        ) : visibleAssignments.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200">
            <EmptyState icon={CalendarDays} title="No assignments scheduled" message="Check back later — your supervisor will assign you to upcoming jobs." />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Today's Timeline — all jobs for today in order */}
            {todaysSorted.length > 0 && (
              <div>
                <SectionHeader icon={Clock} title="Today" count={todaysSorted.length} />
                {todaysAllDone ? (
                  <EndOfDayCard />
                ) : (
                  <div className="space-y-3">
                    {todaysSorted.map(a => {
                      const isActive = a.id === nextTodayAssignment?.id;
                      const isStarted = a.status === 'started';
                      const isCompleted = a.status === 'completed';
                      return (
                        <div key={a.id}>
                          {isActive && isStarted && (
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-1 h-5 bg-emerald-600 rounded-full" />
                              <p className="text-sm font-bold text-slate-700 uppercase tracking-wide">In Progress</p>
                            </div>
                          )}
                          {isActive && !isStarted && !isCompleted && todaysSorted.length > 1 && (
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-1 h-5 bg-amber-500 rounded-full" />
                              <p className="text-sm font-bold text-slate-600 uppercase tracking-wide">Up Next</p>
                            </div>
                          )}
                          {isCompleted && (
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-1 h-5 bg-slate-300 rounded-full" />
                              <p className="text-sm font-bold text-slate-400 uppercase tracking-wide">Completed</p>
                            </div>
                          )}
                          <AssignmentCard {...cardProps(a)} defaultExpanded={isActive} />
                          {isActive && isStarted && <div className="mt-3"><DailyTaskLog staffId={staff.id} /></div>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* No jobs today but upcoming exists */}
            {todaysSorted.length === 0 && upcomingDates.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200">
                <EmptyState icon={CalendarDays} title="No jobs today" message="Check your upcoming assignments below." />
              </div>
            )}

            {/* Upcoming Assignments grouped by date */}
            {upcomingDates.length > 0 && (
              <div>
                <SectionHeader icon={Calendar} title="Upcoming" count={upcomingAssignments.length} tone="muted" />
                <div className="space-y-4">
                  {upcomingDates.slice(0, 10).map(date => {
                    const dayAssignments = upcomingGrouped[date].sort((a, b) => (a.start_time || '23:59').localeCompare(b.start_time || '23:59'));
                    const d = new Date(date + 'T00:00:00');
                    return (
                      <div key={date}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{format(d, 'EEEE')}</span>
                          <span className="text-xs text-slate-400">{format(d, 'dd MMM yyyy')}</span>
                          <span className="text-xs text-slate-300">·</span>
                          <span className="text-xs text-slate-400">{dayAssignments.length} {dayAssignments.length === 1 ? 'job' : 'jobs'}</span>
                        </div>
                        <div className="space-y-3">
                          {dayAssignments.map(a => (
                            <AssignmentCard key={a.id} {...cardProps(a)} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Nothing at all */}
            {todaysSorted.length === 0 && upcomingDates.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-200">
                <EmptyState icon={CalendarDays} title="No assignments scheduled" message="Check back later — your supervisor will assign you to upcoming jobs." />
              </div>
            )}
          </div>
        )}

      </div>

      {/* Briefing modal */}
      {briefingAssignment && (
        <JobBriefingModal
          assignment={briefingAssignment}
          job={jobs.find(j => j.id === briefingAssignment.job_id)}
          client={clients.find(c => c.id === jobs.find(j => j.id === briefingAssignment.job_id)?.client_id)}
          staff={staff}
          crewAssignments={allAssignments.filter(a => a.job_id === briefingAssignment.job_id && a.assigned_date === briefingAssignment.assigned_date)}
          onSigned={handleBriefingComplete}
          onClose={() => setBriefingAssignment(null)}
        />
      )}

      {/* Travel-from-site modal — final step before shift completion */}
      {travelFromAssignment && (
        <TravelFromSiteModal
          open={!!travelFromAssignment}
          jobName={jobs.find(j => j.id === assignments.find(a => a.id === travelFromAssignment.assignmentId)?.job_id)?.name}
          onConfirm={handleCompleteJobWithTravel}
          onClose={() => setTravelFromAssignment(null)}
        />
      )}

      {/* Schedule summary overlay — reviewable any time */}
      {showScheduleSummary && (
        <ScheduleSplash
          assignments={visibleAssignments}
          jobs={jobs}
          vehicles={vehicles}
          clients={clients}
          teams={teams}
          staff={staff}
          weekStart={latestPublishedWeek || (visibleAssignments[0]?.week_start) || format(new Date(), 'yyyy-MM-dd')}
          loading={assignmentsLoading}
          reviewMode
          acknowledgedAt={staff.schedule_acknowledged_at}
          onClose={() => setShowScheduleSummary(false)}
        />
      )}
    </div>
  );
}