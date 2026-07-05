import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, MapPin, Briefcase, Truck, FileText, ExternalLink, CalendarDays, Clock, CheckCircle2, PlayCircle, ClipboardCheck, Ruler, WifiOff, HardHat, Sparkles, ChevronRight } from 'lucide-react';
import { format, isFuture, isPast } from 'date-fns';
import PrintEmailSchedule from '@/components/PrintEmailSchedule';
import SitePhotoUpload from '@/components/SitePhotoUpload';
import QuickTaskLog from '@/components/QuickTaskLog';
import StaffTimesheets from '@/components/StaffTimesheets';
import ManagerTimesheetApprovals from '@/components/ManagerTimesheetApprovals';
import { formatJobType } from '@/utils/format';
import { useStaffAssistant } from '@/components/StaffAssistantChat';
import { motion } from 'framer-motion';
import { EmptyState, Skeleton, SkeletonText } from '@/components/StateViews';

const jobTypeBadgeColors = {
  groundworks: 'bg-green-100 text-green-700 ring-1 ring-green-200',
  cp_drilling: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200',
  rotary_drilling: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200',
  enabling_works: 'bg-purple-100 text-purple-700 ring-1 ring-purple-200',
  depot: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'
};

const jobTypeDot = {
  groundworks: 'bg-green-500',
  cp_drilling: 'bg-amber-500',
  rotary_drilling: 'bg-blue-500',
  enabling_works: 'bg-purple-500',
  depot: 'bg-slate-400'
};

const jobTypeAccent = {
  groundworks: { bar: 'bg-green-500', soft: 'bg-green-50', ring: 'ring-green-100', text: 'text-green-700' },
  cp_drilling: { bar: 'bg-amber-500', soft: 'bg-amber-50', ring: 'ring-amber-100', text: 'text-amber-700' },
  rotary_drilling: { bar: 'bg-blue-500', soft: 'bg-blue-50', ring: 'ring-blue-100', text: 'text-blue-700' },
  enabling_works: { bar: 'bg-purple-500', soft: 'bg-purple-50', ring: 'ring-purple-100', text: 'text-purple-700' },
  depot: { bar: 'bg-slate-400', soft: 'bg-slate-50', ring: 'ring-slate-100', text: 'text-slate-600' }
};

const statusConfig = {
  assigned: { label: 'Assigned', icon: Clock, badge: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200' },
  started: { label: 'In Progress', icon: PlayCircle, badge: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' },
  completed: { label: 'Completed', icon: CheckCircle2, badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' }
};

const listContainer = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const listItem = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } } };

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
  const { openChat } = useStaffAssistant();
  const queryClient = useQueryClient();

  useEffect(() => {
    async function loadStaff() {
      try {
        const user = await base44.auth.me();
        const staffList = await base44.entities.Staff.filter({ email: user.email });
        if (staffList.length > 0) {
          setStaff(staffList[0]);
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

  const handleCompleteJob = async (assignmentId) => {
    try {
      const updateData = {
        status: 'completed',
        completed_at: new Date().toISOString()
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
  const pastAssignments = assignments.filter(a => isPast(new Date(a.assigned_date + 'T00:00:00')) && a.assigned_date !== todayStr);

  const renderAssignment = (assignment) => {
    const job = jobs.find(j => j.id === assignment.job_id);
    const vehicle = vehicles.find(v => v.id === assignment.vehicle_id);
    const client = clients.find(c => c.id === job?.client_id);
    const status = statusConfig[assignment.status || 'assigned'] || statusConfig.assigned;
    const StatusIcon = status.icon;
    const isDriller = job?.job_type === 'cp_drilling' || job?.job_type === 'rotary_drilling';
    const accent = jobTypeAccent[job?.job_type] || jobTypeAccent.depot;
    if (!job) return null;

    return (
      <motion.div key={assignment.id} variants={listItem}
        className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
        {/* Top accent bar */}
        <div className={`h-1.5 ${accent.bar}`} />

        <div className="p-4 md:p-6">
          {/* Status + Check-in Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 pb-4 border-b border-slate-100">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold self-start ${status.badge}`}>
              <StatusIcon className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{status.label}</span>
              {assignment.status === 'started' && assignment.started_at && (
                <span className="text-[10px] opacity-70 ml-1 whitespace-nowrap">since {format(new Date(assignment.started_at), 'HH:mm')}</span>
              )}
            </span>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              {(assignment.status || 'assigned') === 'assigned' && (
                <button onClick={() => handleStartJob(assignment.id)}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 active:scale-95 transition text-sm font-semibold touch-manipulation">
                  <PlayCircle className="w-4 h-4" /> Start Job
                </button>
              )}
              {assignment.status === 'started' && (
                <div className="flex items-center gap-2 flex-wrap">
                  {isDriller && (
                    <input type="number" min="0" step="0.1" placeholder="Meterage (m)"
                      value={meterageInputs[assignment.id] || ''}
                      onChange={(e) => setMeterageInputs(prev => ({ ...prev, [assignment.id]: e.target.value }))}
                      className="w-32 px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
                  )}
                  <button onClick={() => handleCompleteJob(assignment.id)}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 active:scale-95 transition text-sm font-semibold touch-manipulation">
                    <CheckCircle2 className="w-4 h-4" /> Complete
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Job Title */}
          <div className="flex items-start gap-3 mb-4">
            <span className={`w-3 h-3 rounded-full flex-shrink-0 mt-1.5 ${jobTypeDot[job.job_type] || 'bg-slate-400'}`} />
            <div className="min-w-0 flex-1">
              <h3 className="text-lg md:text-xl font-bold text-slate-900 leading-tight break-words">{job.name}</h3>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-semibold ${jobTypeBadgeColors[job.job_type]}`}>
                  {formatJobType(job.job_type)}
                </span>
                {assignment.meterage != null && assignment.meterage > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 ring-1 ring-amber-100">
                    <Ruler className="w-3 h-3" /> {assignment.meterage}m
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Job Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5 text-sm text-slate-600">
                <MapPin className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span className="break-words">{job.location}</span>
              </div>
              <div className="flex items-start gap-2.5 text-sm text-slate-600">
                <Calendar className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span className="break-words">{format(new Date(assignment.assigned_date), 'EEEE, MMM d, yyyy')}</span>
              </div>
              {client && (
                <div className="flex items-start gap-2.5 text-sm text-slate-600">
                  <Briefcase className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span>Client: <span className="font-medium text-slate-700">{client.name}</span></span>
                </div>
              )}
              {vehicle && (
                <div className="flex items-start gap-2.5 text-sm text-slate-600 md:hidden">
                  <Truck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span className="font-mono font-bold text-slate-900">{vehicle.registration_number}</span>
                  <span className="text-slate-400">·</span>
                  <span>{vehicle.name}</span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {vehicle && (
                <div className="hidden md:block p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Truck className="w-4 h-4 text-emerald-600" />
                    <h4 className="font-semibold text-slate-900 text-sm">Assigned Vehicle</h4>
                  </div>
                  <p className="text-slate-900 font-mono font-bold text-lg">{vehicle.registration_number}</p>
                  <p className="text-slate-500 text-xs">{vehicle.name}</p>
                </div>
              )}
              {job.requisition_list_url && (
                <a href={job.requisition_list_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-between gap-2 p-3.5 bg-emerald-50 rounded-xl border border-emerald-100 hover:bg-emerald-100 transition group">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold text-emerald-900 text-sm">Requisition List</p>
                      <p className="text-emerald-700 text-xs truncate">{job.requisition_list_name || 'View document'}</p>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-emerald-600 flex-shrink-0 group-hover:translate-x-0.5 transition" />
                </a>
              )}
              {job.notes && (
                <div className="p-3.5 bg-amber-50/50 rounded-xl border border-amber-100">
                  <h4 className="font-semibold text-slate-900 text-sm mb-1.5">Notes</h4>
                  <p className="text-slate-600 text-sm whitespace-pre-wrap leading-relaxed">{job.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Briefing Sign-off */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            {assignment.briefing_signed ? (
              <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50/50 rounded-lg px-3 py-2">
                <ClipboardCheck className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium">Briefing signed off</span>
                {assignment.briefing_signed_at && (
                  <span className="text-xs text-slate-400 ml-auto">
                    {format(new Date(assignment.briefing_signed_at), 'dd MMM HH:mm')}
                  </span>
                )}
              </div>
            ) : (
              <button onClick={() => handleBriefingSign(assignment.id)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 text-white rounded-xl hover:bg-slate-900 active:scale-95 transition text-sm font-medium w-full sm:w-auto touch-manipulation">
                <ClipboardCheck className="w-4 h-4" />
                Sign Off Job Briefing
              </button>
            )}
          </div>

          {/* Site Photo Upload */}
          {job && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <SitePhotoUpload jobId={job.id} staffName={staff.name} />
            </div>
          )}

          {/* Quick Task Log */}
          {job && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <QuickTaskLog jobId={job.id} jobType={job.job_type} staffId={staff.id} date={assignment.assigned_date} />
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="hero-gradient relative overflow-hidden">
        <div className="absolute -top-12 -right-8 w-48 h-48 rounded-full bg-emerald-300/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-10 w-44 h-44 rounded-full bg-teal-300/10 blur-3xl pointer-events-none" />
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
            <button onClick={openChat} type="button"
              className="flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 ring-1 ring-white/20 text-white text-sm font-medium active:scale-95 transition touch-manipulation flex-shrink-0">
              <Sparkles className="w-5 h-5" />
              <span className="hidden sm:inline">Ask Assistant</span>
            </button>
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
        {!isOnline && (
          <div className="mb-5 flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            <WifiOff className="w-4 h-4 flex-shrink-0" />
            You're offline. Showing cached schedule — changes will sync when you reconnect.
          </div>
        )}

        {/* Manager: Timesheet Approvals */}
        <ManagerTimesheetApprovals staffId={staff.id} />

        {/* Today's Assignment Highlight */}
        {todaysAssignments.length > 0 && (
          <div className="mb-8">
            <SectionHeader icon={Clock} title="Today" count={todaysAssignments.length} />
            <motion.div variants={listContainer} initial="hidden" animate="show" className="space-y-4">
              {todaysAssignments.map(renderAssignment)}
            </motion.div>
          </div>
        )}

        {/* Print/Email Controls */}
        <div className="mb-8">
          <PrintEmailSchedule
            weekStart={new Date()}
            staffId={staff.id}
            staffName={staff.name}
          />
        </div>

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
          <div className="space-y-8">
            {upcomingAssignments.length > 0 && (
              <div>
                <SectionHeader icon={Calendar} title="Upcoming" count={upcomingAssignments.length} />
                <motion.div variants={listContainer} initial="hidden" animate="show" className="space-y-4">
                  {upcomingAssignments.map(renderAssignment)}
                </motion.div>
              </div>
            )}
            {pastAssignments.length > 0 && (
              <div>
                <SectionHeader icon={Clock} title="Past Assignments" count={pastAssignments.length} tone="muted" />
                <motion.div variants={listContainer} initial="hidden" animate="show" className="space-y-4 opacity-70">
                  {pastAssignments.map(renderAssignment)}
                </motion.div>
              </div>
            )}
          </div>
        )}

        {/* My Timesheets */}
        <div className="mt-10">
          <StaffTimesheets staffId={staff.id} staffName={staff.name} />
        </div>
      </div>
    </div>
  );
}