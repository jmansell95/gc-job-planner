import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, CalendarDays, CalendarClock, Clock, HardHat, CheckCircle2, UserCircle, ShieldCheck, AlertTriangle, Truck, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, isFuture, isPast } from 'date-fns';
import { motion } from 'framer-motion';
import { EmptyState, Skeleton, SkeletonText } from '@/components/StateViews';
import AssignmentCard from '@/components/staff/AssignmentCard';
import EndOfDayCard from '@/components/staff/EndOfDayCard';
import { useToast } from '@/components/ui/use-toast';
import { syncAllOfflineData, getOfflineDeliveryCount } from '@/utils/offlineSync';
import { isWithinSiteHours, isBeforeSiteOpen, SITE_OPEN_TIME, SITE_CLOSE_TIME, SITE_EARLY_ACCESS_TIME } from '@/utils/siteHours';
import { complianceDaysUntil } from '@/utils/complianceDate';
import OutsideSiteHours from '@/components/staff/OutsideSiteHours';
import { useAuth } from '@/lib/AuthContext';

import ShiftWizard from '@/components/staff/ShiftWizard';
import EarlyLeaveModal from '@/components/staff/EarlyLeaveModal';
import ScheduleSplash from '@/components/staff/ScheduleSplash';
import NextJobPrompt from '@/components/staff/NextJobPrompt';
import AdHocVisitModal from '@/components/staff/AdHocVisitModal';
import TodayPrepStrip from '@/components/staff/TodayPrepStrip';
import SyncHUD from '@/components/staff/SyncHUD';
import StaffTabBar from '@/components/staff/StaffTabBar';
import StaffHeader from '@/components/staff/StaffHeader';
import StaffAlerts from '@/components/staff/StaffAlerts';
import ActiveJobCard from '@/components/staff/ActiveJobCard';
import IncentiveQuickLook from '@/components/staff/IncentiveQuickLook';
import DrillingWeatherWidget from '@/components/DrillingWeatherWidget';
import Breadcrumbs from '@/components/Breadcrumbs';

export default function StaffDashboard() {
  const navigate = useNavigate();
  const [staff, setStaff] = useState(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const isPlatformAdmin = user?.role === 'admin';
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [shiftWizard, setShiftWizard] = useState(null);
  const [earlyLeaveAssignment, setEarlyLeaveAssignment] = useState(null);
  const [splashDismissed, setSplashDismissed] = useState(false);
  const [showScheduleSummary, setShowScheduleSummary] = useState(false);
  const [showNextJobPrompt, setShowNextJobPrompt] = useState(false);
  const [showAdHocVisit, setShowAdHocVisit] = useState(false);
  const [activeTab, setActiveTab] = useState('today');
  const [showComplianceAlert, setShowComplianceAlert] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    async function loadStaff() {
      try {
        const res = await base44.functions.invoke('getMyStaffProfile');
        const profile = res.data;
        if (profile && (profile.id || profile.is_admin)) {
          setStaff(profile);
        } else if (isPlatformAdmin) {
          // Super admin with no linked crew profile — preview the schedule
          // instead of hitting the "No crew profile found" dead-end.
          // Include delivery_dashboard_enabled so the Truck icon shows.
          setStaff({ id: null, name: user?.full_name || user?.email, email: user?.email, is_admin: true, system_role: 'admin', team: null, no_staff_profile: true, delivery_dashboard_enabled: true });
        }
      } catch (error) {
        console.error('Error loading staff:', error);
        if (isPlatformAdmin) {
          setStaff({ id: null, name: user?.full_name || user?.email, email: user?.email, is_admin: true, system_role: 'admin', team: null, no_staff_profile: true, delivery_dashboard_enabled: true });
        }
      } finally {
        setLoading(false);
      }
    }
    loadStaff();
    const handleOnline = () => {
      setIsOnline(true);
      syncAllOfflineData().then(result => {
        if (result.total > 0) {
          queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
          queryClient.invalidateQueries({ queryKey: ['all-rota-assignments'] });
          const parts = [];
          if (result.briefings > 0) parts.push(`${result.briefings} briefing${result.briefings !== 1 ? 's' : ''}`);
          if (result.deliveries > 0) parts.push(`${result.deliveries} deliver${result.deliveries !== 1 ? 'ies' : 'y'}`);
          toast({ title: 'Offline data synced', description: `${parts.join(' and ')} uploaded.` });
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
  const { data: bizConfig } = useQuery({ queryKey: ['business-config'], queryFn: async () => { const list = await base44.entities.BusinessConfig.filter({ key: 'global' }); return list[0] || null; } });
  const { data: myCompliance = [] } = useQuery({ queryKey: ['staff-compliance', staff?.id], queryFn: () => base44.entities.ComplianceItem.filter({ category: 'staff' }), enabled: !!staff?.id });
  const { data: jobAssets = [] } = useQuery({ queryKey: ['job-asset-assignments-staff'], queryFn: () => base44.entities.JobAssetAssignment.list('-created_date', 500) });
  const { data: siteAssetsStaff = [] } = useQuery({ queryKey: ['site-assets-staff'], queryFn: () => base44.entities.SiteAsset.list('-created_date', 500) });
  const { data: equipmentCompliance = [] } = useQuery({ queryKey: ['equipment-compliance'], queryFn: () => base44.entities.ComplianceItem.filter({ category: 'equipment' }) });
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

  // Opens the Shift Wizard — the single full-screen flow that guides staff
  // through arrival → briefing → tasks → end of shift, one step at a time.
  const handleOpenShiftWizard = (assignmentId, opts = {}) => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const hasMoreJobs = assignments.some(a => a.assigned_date === todayStr && (a.status || 'assigned') !== 'completed' && a.id !== assignmentId);
    setShiftWizard({ assignmentId, isLastJob: !hasMoreJobs, forceStep: opts.forceStep || null });
  };

  // Confirms arrival: creates a travel_to draft timesheet entry and marks the
  // assignment as arrived. The wizard handles the transition to briefing/working.
  const handleArrivedConfirm = async ({ assignmentId, departHome, arriveSite, gpsPrefilled }) => {
    const assignment = assignments.find(a => a.id === assignmentId);
    if (!assignment) return;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const arrivedAt = new Date().toISOString();
    try {
      if (departHome && arriveSite) {
        const [dh, dm] = departHome.split(':').map(Number);
        const [ah, am] = arriveSite.split(':').map(Number);
        const travelMins = (ah * 60 + am) - (dh * 60 + dm);
        if (travelMins > 0) {
          // If times were pre-filled from GPS but the user changed them,
          // flag the entry for manager review
          const overrideNote = gpsPrefilled ? 'Manually adjusted from GPS time — manager review required' : '';
          await base44.entities.Timesheet.create({
            staff_id: staff.id,
            date: todayStr,
            job_id: assignment.job_id || '',
            task_description: 'Travel to site',
            task_type: 'travel_to',
            start_time: departHome,
            end_time: arriveSite,
            task_duration_minutes: travelMins,
            total_hours: Math.round((travelMins / 60) * 100) / 100,
            status: 'draft',
            travel_depart_home: departHome,
            travel_arrive_site: arriveSite,
            notes: overrideNote
          });
        }
      }
      await base44.entities.RotaAssignment.update(assignment.id, { arrived_on_site_at: arrivedAt });
      queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
    } catch (error) {
      console.error('Error confirming arrival:', error);
      toast({ title: 'Error', description: 'Could not confirm arrival. Please try again.', variant: 'destructive' });
    }
  };

  // Opens the leave-site modal — the single way to leave site. A reason is
  // required before the staff member can confirm they've left.
  const handleLeaveSite = (assignmentId) => {
    const assignment = assignments.find(a => a.id === assignmentId);
    if (!assignment) return;
    setEarlyLeaveAssignment(assignment);
  };

  // Confirms leaving site: records the reason on the assignment and marks the
  // staff member as having left. The job stays open ('started') for up to 5
  // hours so they can enter their travel-home time and submit their timesheet.
  const handleEarlyLeaveConfirm = async ({ reason, note }) => {
    const assignment = earlyLeaveAssignment;
    if (!assignment) return;
    setEarlyLeaveAssignment(null);
    try {
      await base44.entities.RotaAssignment.update(assignment.id, {
        early_leave_reason: reason,
        early_leave_note: note,
        left_site_at: new Date().toISOString()
      });
      queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
      toast({ title: 'Left site recorded', description: `Enter your travel home & submit your timesheet within ${Number(bizConfig?.post_leave_site_window_hours) || 5} hours.` });
    } catch (error) {
      console.error('Error recording leave site:', error);
      toast({ title: 'Error', description: 'Could not record leave site. Please try again.', variant: 'destructive' });
    }
  };

  // Opens the Shift Wizard at the end-of-shift step — guides staff through
  // reviewing their day, logging meterage, progress notes, and travel home.
  const handleStartEndOfShift = (assignmentId) => {
    handleOpenShiftWizard(assignmentId, { forceStep: 'end_of_shift' });
  };

  // Final submission after the wizard — creates travel_from, submits the
  // consolidated timesheet, marks the assignment completed, and checks for
  // remaining jobs today.
  const handleEndOfShiftSubmit = async (data) => {
    const { assignmentId, isLastJob } = shiftWizard;
    setShiftWizard(null);
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    try {
      // Create travel_from entry so it's included in the timesheet merge
      if (isLastJob && data.travelHome?.departSite && data.travelHome?.arriveHome) {
        const [dh, dm] = data.travelHome.departSite.split(':').map(Number);
        const [ah, am] = data.travelHome.arriveHome.split(':').map(Number);
        const travelMins = (ah * 60 + am) - (dh * 60 + dm);
        if (travelMins > 0) {
          const assignment = assignments.find(a => a.id === assignmentId);
          await base44.entities.Timesheet.create({
            staff_id: staff.id,
            date: todayStr,
            job_id: assignment?.job_id || '',
            task_description: 'Travel from site',
            task_type: 'travel_from',
            start_time: data.travelHome.departSite,
            end_time: data.travelHome.arriveHome,
            task_duration_minutes: travelMins,
            total_hours: Math.round((travelMins / 60) * 100) / 100,
            status: 'draft'
          });
        }
      }
      let submitResult = null;
      try {
        submitResult = await base44.functions.invoke('submitDailyTimesheet', { staff_id: staff.id, date: todayStr });
      } catch (e) {
        console.error('Timesheet submit error:', e);
        const msg = e?.message || '';
        if (msg.includes('under 9 hours') || msg.includes('UNDER_9H_NO_EARLY_LEAVE')) {
          toast({ title: 'Cannot submit timesheet', description: 'Your on-site work is under 9 hours and no early-leave reason was recorded. Use the Leave Site Early button to record why you left early, or add the missing tasks.', variant: 'destructive' });
          queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
          return;
        }
      }
      const updateData = {
        status: 'completed',
        completed_at: new Date().toISOString()
      };
      if (data.progressNotes) updateData.progress_notes = data.progressNotes;
      if (data.meterage !== undefined && data.meterage !== '' && !isNaN(data.meterage)) {
        updateData.meterage = Number(data.meterage);
      }
      // Process asset returns if the crew scanned gear during decommissioning
      if (data.assetReturn && (data.assetReturn.scannedAssetIds?.length > 0 || data.assetReturn.scannedManifestIds?.length > 0)) {
        try {
          const assignment = assignments.find(a => a.id === assignmentId);
          const job = jobs.find(j => j.id === assignment?.job_id);
          await base44.functions.invoke('processAssetReturn', {
            job_id: assignment?.job_id || '',
            staff_id: staff.id,
            staff_name: staff.name || '',
            job_name: job?.name || '',
            scanned_asset_ids: data.assetReturn.scannedAssetIds || [],
            scanned_manifest_ids: data.assetReturn.scannedManifestIds || [],
            notes: data.assetReturn.notes || '',
          });
          queryClient.invalidateQueries({ queryKey: ['job-asset-assignments'] });
          queryClient.invalidateQueries({ queryKey: ['site-assets-for-return'] });
          toast({ title: 'Gear return logged', description: `${data.assetReturn.scannedAssetIds.length + data.assetReturn.scannedManifestIds.length} scan(s) sent to yard & Asset Panda.` });
        } catch (assetErr) {
          console.error('Asset return error:', assetErr);
          toast({ title: 'Gear return failed', description: 'Your timesheet was submitted but the asset return could not be processed. Please tell the yard manager.', variant: 'destructive' });
        }
      }
      await base44.entities.RotaAssignment.update(assignmentId, updateData);
      queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['staff-timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['all-timesheets-mgr'] });
      // After completion, check if there are more jobs today
      const remaining = assignments.filter(a => a.assigned_date === todayStr && (a.status || 'assigned') !== 'completed' && a.id !== assignmentId);
      if (remaining.length > 0) {
        setShowNextJobPrompt(true);
      } else {
        toast({ title: 'Shift completed', description: 'Your timesheet has been submitted for approval.' });
      }
    } catch (error) {
      console.error('Error completing shift:', error);
      toast({ title: 'Error', description: 'Could not complete shift. Please try again.', variant: 'destructive' });
    }
  };

  // Log an ad-hoc / nearby site visit (unplanned work at a different site)
  const handleAdHocVisit = async ({ jobId, customSite, description, durationMinutes }) => {
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const visitJob = jobs.find(j => j.id === jobId);
      await base44.entities.Timesheet.create({
        staff_id: staff.id,
        date: todayStr,
        job_id: jobId || '',
        task_description: description || (customSite ? `Nearby visit: ${customSite}` : 'Nearby site visit'),
        task_type: 'on_site',
        task_duration_minutes: Number(durationMinutes) || 0,
        total_hours: Math.round(((Number(durationMinutes) || 0) / 60) * 100) / 100,
        status: 'draft',
        notes: customSite ? `Site: ${customSite}` : ''
      });
      try {
        await base44.functions.invoke('submitDailyTimesheet', { staff_id: staff.id, date: todayStr });
      } catch (e) { console.error('Timesheet submit error:', e); }
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['staff-timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['all-timesheets-mgr'] });
      toast({ title: 'Visit logged', description: `${durationMinutes} min recorded${visitJob ? ` at ${visitJob.name}` : customSite ? ` at ${customSite}` : ''}.` });
      setShowAdHocVisit(false);
      // After ad-hoc visit, check if there are more scheduled jobs today
      const remaining = assignments.filter(a => a.assigned_date === todayStr && (a.status || 'assigned') !== 'completed');
      if (remaining.length > 0) {
        setShowNextJobPrompt(true);
      }
    } catch (error) {
      console.error('Error logging ad-hoc visit:', error);
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
    // Opens the Shift Wizard — it determines the correct step automatically
    // (arrive → briefing → working → end of shift) based on assignment state.
    handleOpenShiftWizard(assignmentId);
  };

  const handleBriefingComplete = ({ offline } = {}) => {
    queryClient.invalidateQueries({ queryKey: ['staff-assignments'] });
    queryClient.invalidateQueries({ queryKey: ['all-rota-assignments'] });
    queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
    if (offline) {
      toast({ title: 'Briefing saved offline', description: 'Your signature will sync when you reconnect.' });
    } else {
      toast({ title: 'Briefing signed', description: "You're briefed and ready to work." });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen page-bg-vibrant">
        <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
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
          <p className="text-slate-400 text-sm mt-1">Contact your manager to get set up.</p>
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

  if (!isWithinSiteHours() && !isBeforeSiteOpen() && !staff?.is_admin && !isPlatformAdmin) {
    return <OutsideSiteHours openTime={SITE_OPEN_TIME} closeTime={SITE_CLOSE_TIME} />;
  }
  const canPerformActions = isWithinSiteHours() || staff?.is_admin || isPlatformAdmin;

  // Staff only see assignments from the latest published (non-superseded) rota week.
  // When a new draft is created, old weeks are superseded and staff see nothing until
  // the new rota is published/sent to them.
  // Admins bypass this — they see all assignments regardless of publish status so
  // they can review the schedule even while a draft is being prepared.
  const visibleWeekStarts = rotaWeeks.filter(w => w.status === 'published' && !w.superseded).map(w => w.week_start);
  const hasAnyRotaWeeks = rotaWeeks.length > 0;
  const cancelledJobIds = new Set(jobs.filter(j => j.status === 'cancelled').map(j => j.id));
  const onHoldJobIds = new Set(jobs.filter(j => j.status === 'on_hold').map(j => j.id));
  const isAdminUser = staff?.is_admin || isPlatformAdmin;
  const visibleAssignments = (isAdminUser ? assignments : (hasAnyRotaWeeks ? assignments.filter(a => visibleWeekStarts.includes(a.week_start)) : assignments))
    .filter(a => !cancelledJobIds.has(a.job_id));
  const scheduleLocked = !isAdminUser && hasAnyRotaWeeks && visibleWeekStarts.length === 0;

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
    onOpenShiftWizard: (id, opts) => handleOpenShiftWizard(id, opts),
    onLeaveSite: handleLeaveSite,
    canPerformActions,
    tasksSubmitted: mgrTimesheets.some(t => t.job_id === assignment.job_id && t.date === todayStr && (t.status === 'submitted' || t.status === 'approved')),
    arrivedOnSite: !!assignment.arrived_on_site_at,
    needsBriefing: !assignment.briefing_signed && !visibleAssignments.some(a => a.job_id === assignment.job_id && a.briefing_signed && a.id !== assignment.id),
    crewSignedCount,
    crewTotal,
    allCrewSigned: crewTotal > 0 && crewSignedCount === crewTotal,
    previousProgress: visibleAssignments
      .filter(a => a.job_id === assignment.job_id && a.progress_notes && a.assigned_date < assignment.assigned_date)
      .sort((a, b) => new Date(b.assigned_date) - new Date(a.assigned_date))
      .map(a => ({ date: a.assigned_date, notes: a.progress_notes, staffName: allStaff.find(s => s.id === a.staff_id)?.name || staff.name })),
    hotelBooking: myHotelBookings.find(h => h.job_id === assignment.job_id) || null,
    onAdHocVisit: () => setShowAdHocVisit(true),
    jobAssets: jobAssets.filter(a => a.job_id === assignment.job_id),
    assetMap: Object.fromEntries((siteAssetsStaff || []).map(a => [a.id, a])),
    complianceItems: equipmentCompliance
    };
    };

  return (
    <div className="page-bg-vibrant min-h-screen pb-20">
      <StaffHeader staff={staff} onShowSchedule={() => setShowScheduleSummary(true)} />
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        <Breadcrumbs />
      </div>

      {/* Today Tab — zero-scroll, action-first */}
      {activeTab === 'today' && (
        <div className="max-w-6xl mx-auto px-4 md:px-6 pt-3 md:pt-4 space-y-3">
          <SyncHUD />

          {/* Consolidated alert — single line */}
          <StaffAlerts isOnline={isOnline} staff={staff} />

          {/* Compliance alert — collapsed by default, expand to view */}
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
            const summaryLabel = expired.length > 0 ? `${expired.length} compliance item${expired.length > 1 ? 's' : ''} expired` : expiring.length > 0 ? `${expiring.length} item${expiring.length > 1 ? 's' : ''} expiring soon` : 'CSCS card not on file';
            return (
              <div className={`rounded-2xl border overflow-hidden ${isUrgent ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                <button onClick={() => setShowComplianceAlert(v => !v)} type="button"
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition ${isUrgent ? 'text-red-900' : 'text-amber-900'}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isUrgent ? 'bg-red-100' : 'bg-amber-100'}`}>
                    <AlertTriangle className={`w-5 h-5 ${isUrgent ? 'text-red-500' : 'text-amber-500'}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{summaryLabel}</p>
                    <p className="text-xs opacity-80 mt-0.5">{showComplianceAlert ? 'Tap to collapse' : 'Tap to expand details'}</p>
                  </div>
                  <ShieldCheck className={`w-5 h-5 flex-shrink-0 ${isUrgent ? 'text-red-400' : 'text-amber-400'}`} />
                </button>
                {showComplianceAlert && (
                  <button onClick={() => navigate('/staff-profile')} type="button"
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold border-t transition ${isUrgent ? 'text-red-700 bg-red-100/50 hover:bg-red-100 border-red-200' : 'text-amber-700 bg-amber-100/50 hover:bg-amber-100 border-amber-200'}`}>
                    View in profile
                  </button>
                )}
              </div>
            );
          })()}

          {/* Incentive Quick-Look — mini score card */}
          {staff?.id && !staff?.is_admin && (
            <IncentiveQuickLook staffId={staff.id} teamId={staff.team_id} />
          )}

          {/* Today's assignments — active job hero + compact secondary cards */}
          {assignmentsLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="insight-card rounded-2xl p-5">
                  <Skeleton className="h-1.5 w-full mb-4 rounded-full" />
                  <Skeleton className="h-4 w-1/3 mb-3" />
                  <SkeletonText lines={3} />
                </div>
              ))}
            </div>
          ) : scheduleLocked ? (
            <div className="insight-card rounded-2xl">
              <EmptyState icon={CalendarClock} title="New schedule on the way" message="Your manager is preparing your new rota. You'll get it by email once it's ready." />
            </div>
          ) : visibleAssignments.length === 0 ? (
            <div className="insight-card rounded-2xl">
              <EmptyState icon={CalendarDays} title="No shifts scheduled" message="Check back later — your manager will assign you to upcoming jobs." />
            </div>
          ) : todaysSorted.length === 0 ? (
            <div className="insight-card rounded-2xl">
              <EmptyState icon={CalendarDays} title="No jobs today" message="Check the Upcoming tab for your next shifts." />
            </div>
          ) : todaysAllDone ? (
            <EndOfDayCard />
          ) : (
            <div className="space-y-3">
              {/* Prep strip */}
              <TodayPrepStrip
                todaysSorted={todaysSorted}
                jobs={jobs}
                myCompliance={myCompliance}
                myHotelBookings={myHotelBookings}
                staffId={staff.id}
              />
              {/* Active / next job — hero card with big action button */}
              {nextTodayAssignment && (
                <div>
                  {!activeStarted && todaysSorted.length > 1 && (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-bold uppercase tracking-wide">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Up Next
                      </span>
                    </div>
                  )}
                  <ActiveJobCard {...cardProps(nextTodayAssignment)} />
                  {(() => {
                    const activeJob = jobs.find(j => j.id === nextTodayAssignment?.job_id);
                    if (!activeJob?.site_lat || !activeJob?.site_lng) return null;
                    return (
                      <DrillingWeatherWidget
                        lat={activeJob.site_lat}
                        lng={activeJob.site_lng}
                        locationName={activeJob.location}
                        compact={false}
                      />
                    );
                  })()}
                </div>
              )}
              {/* Other jobs today — compact cards */}
              {todaysSorted.filter(a => a.id !== nextTodayAssignment?.id).map(a => (
                <AssignmentCard key={a.id} {...cardProps(a)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upcoming Tab */}
      {activeTab === 'upcoming' && (
        <div className="max-w-6xl mx-auto px-4 md:px-6 pt-3 md:pt-4 space-y-3">
          {assignmentsLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="insight-card rounded-2xl p-5">
                  <Skeleton className="h-1.5 w-full mb-4 rounded-full" />
                  <Skeleton className="h-4 w-1/3 mb-3" />
                  <SkeletonText lines={3} />
                </div>
              ))}
            </div>
          ) : upcomingDates.length > 0 ? (
            <div className="space-y-4">
              {upcomingDates.slice(0, 20).map(date => {
                const dayAssignments = upcomingGrouped[date].sort((a, b) => (a.start_time || '23:59').localeCompare(b.start_time || '23:59'));
                const d = new Date(date + 'T00:00:00');
                return (
                  <div key={date}>
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wide shadow-sm">
                        {format(d, 'EEEE')}
                      </span>
                      <span className="text-xs text-slate-400">{format(d, 'dd MMM yyyy')}</span>
                      <span className="text-xs text-slate-300">·</span>
                      <span className="text-xs text-slate-400 font-medium">{dayAssignments.length} {dayAssignments.length === 1 ? 'job' : 'jobs'}</span>
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
          ) : (
            <div className="insight-card rounded-2xl">
              <EmptyState icon={CalendarDays} title="No upcoming jobs" message="Check back later — your manager will assign you to upcoming jobs." />
            </div>
          )}
        </div>
      )}

      {/* More Tab — bookings + quick links */}
      {activeTab === 'more' && (
        <div className="max-w-6xl mx-auto px-4 md:px-6 pt-3 md:pt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3.5">
            {staff.delivery_dashboard_enabled && (
              <button onClick={() => navigate('/deliveries')} type="button"
                className="stat-gradient-blue rounded-2xl flex flex-col items-center gap-3 p-5 hover:scale-[1.03] active:scale-95 transition touch-manipulation glow-blue">
                <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Truck className="w-7 h-7 text-white" />
                </div>
                <span className="text-base font-bold text-white">Deliveries</span>
              </button>
            )}
            <button onClick={() => navigate('/staff-profile')} type="button"
              className="stat-gradient-violet rounded-2xl flex flex-col items-center gap-3 p-5 hover:scale-[1.03] active:scale-95 transition touch-manipulation">
                <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <UserCircle className="w-7 h-7 text-white" />
                </div>
                <span className="text-base font-bold text-white">Profile</span>
              </button>
            <button onClick={() => setShowScheduleSummary(true)} type="button"
              className="stat-gradient-emerald rounded-2xl flex flex-col items-center gap-3 p-5 hover:scale-[1.03] active:scale-95 transition touch-manipulation glow-emerald">
                <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <CalendarDays className="w-7 h-7 text-white" />
                </div>
                <span className="text-base font-bold text-white">Schedule</span>
              </button>
            <button onClick={() => navigate('/help')} type="button"
              className="stat-gradient-amber rounded-2xl flex flex-col items-center gap-3 p-5 hover:scale-[1.03] active:scale-95 transition touch-manipulation glow-amber">
                <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <HelpCircle className="w-7 h-7 text-white" />
                </div>
                <span className="text-base font-bold text-white">Help Guides</span>
              </button>
          </div>

        </div>
      )}

      {/* Bottom Tab Bar */}
      <StaffTabBar activeTab={activeTab} onChange={setActiveTab} counts={{ today: todaysSorted.length, upcoming: upcomingAssignments.length }} />

      {/* Unified Shift Wizard — full-screen step-by-step flow:
          arrive → briefing → tasks → finish day */}
      {shiftWizard && (
        <ShiftWizard
          open={!!shiftWizard}
          assignment={assignments.find(a => a.id === shiftWizard.assignmentId)}
          job={jobs.find(j => j.id === assignments.find(a => a.id === shiftWizard.assignmentId)?.job_id)}
          client={clients.find(c => c.id === jobs.find(j => j.id === assignments.find(a => a.id === shiftWizard.assignmentId)?.job_id)?.client_id)}
          staff={staff}
          staffId={staff.id}
          crewAssignments={allAssignments.filter(a => a.job_id === assignments.find(a2 => a2.id === shiftWizard.assignmentId)?.job_id && a.assigned_date === assignments.find(a2 => a2.id === shiftWizard.assignmentId)?.assigned_date)}
          visibleAssignments={visibleAssignments}
          isDriller={['cp_drilling', 'rotary_drilling'].includes(jobs.find(j => j.id === assignments.find(a => a.id === shiftWizard.assignmentId)?.job_id)?.job_type)}
          isLastJob={shiftWizard.isLastJob}
          forceStep={shiftWizard.forceStep}
          onArrivedConfirm={handleArrivedConfirm}
          onBriefingComplete={handleBriefingComplete}
          onStartJob={handleStartJob}
          onEndOfShiftSubmit={handleEndOfShiftSubmit}
          onClose={() => setShiftWizard(null)}
        />
      )}

      {/* Early leave modal — leave site before end of shift with a reason */}
      {earlyLeaveAssignment && (
        <EarlyLeaveModal
          open={!!earlyLeaveAssignment}
          jobName={jobs.find(j => j.id === earlyLeaveAssignment.job_id)?.name}
          onConfirm={handleEarlyLeaveConfirm}
          onClose={() => setEarlyLeaveAssignment(null)}
        />
      )}

      {/* Next Job prompt — shown after completing a job when more jobs remain today */}
      <NextJobPrompt
        open={showNextJobPrompt}
        onClose={() => setShowNextJobPrompt(false)}
        remainingJobs={todaysSorted.filter(a => (a.status || 'assigned') !== 'completed')}
        jobs={jobs}
        onCheckIn={(assignmentId) => { setShowNextJobPrompt(false); handleStartAttempt(assignmentId); }}
        onAdHocVisit={() => { setShowNextJobPrompt(false); setShowAdHocVisit(true); }}
      />

      {/* Ad-hoc / nearby site visit modal */}
      <AdHocVisitModal
        open={showAdHocVisit}
        onClose={() => setShowAdHocVisit(false)}
        onSubmit={handleAdHocVisit}
        jobs={jobs}
      />

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