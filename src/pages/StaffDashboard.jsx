import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, MapPin, Briefcase, Truck, FileText, ExternalLink, CalendarDays, Clock, CheckCircle2, PlayCircle, ClipboardCheck, Ruler, WifiOff, HardHat, Sparkles } from 'lucide-react';
import { format, isFuture, isPast } from 'date-fns';
import PrintEmailSchedule from '@/components/PrintEmailSchedule';
import SitePhotoUpload from '@/components/SitePhotoUpload';
import TimesheetEntry from '@/components/TimesheetEntry';
import StaffTimesheets from '@/components/StaffTimesheets';
import { formatJobType } from '@/utils/format';
import { useStaffAssistant } from '@/components/StaffAssistantChat';
import { motion } from 'framer-motion';
import { EmptyState, Skeleton, SkeletonText } from '@/components/StateViews';

const jobTypeBadgeColors = {
  groundworks: 'bg-green-100 text-green-700',
  cp_drilling: 'bg-amber-100 text-amber-700',
  rotary_drilling: 'bg-blue-100 text-blue-700',
  enabling_works: 'bg-purple-100 text-purple-700',
  depot: 'bg-slate-100 text-slate-700'
};

const statusConfig = {
  assigned: { label: 'Assigned', icon: Clock, badge: 'bg-slate-100 text-slate-600' },
  started: { label: 'In Progress', icon: PlayCircle, badge: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completed', icon: CheckCircle2, badge: 'bg-emerald-100 text-emerald-700' }
};

const listContainer = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const listItem = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

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
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="w-8 h-8 border-4 border-emerald-100 border-t-emerald-700 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-center">
          <p className="text-slate-600">No staff profile found</p>
        </div>
      </div>
    );
  }

  const jobTypeColors = {
    groundworks: 'bg-green-50 border-green-200',
    cp_drilling: 'bg-amber-50 border-amber-200',
    rotary_drilling: 'bg-blue-50 border-blue-200',
    enabling_works: 'bg-purple-50 border-purple-200',
    depot: 'bg-slate-50 border-slate-200'
  };

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
    const isDriller = staff.job_role === 'cp_driller' || staff.job_role === 'rotary_driller';
    if (!job) return null;
    return (
      <motion.div key={assignment.id} variants={listItem} className={`rounded-lg p-4 md:p-6 border-l-4 border ${jobTypeColors[job.job_type] || 'bg-slate-50 border-slate-200'}`}>
        {/* Status + Check-in Bar */}
        <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-200/60">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${status.badge}`}>
            <StatusIcon className="w-3.5 h-3.5" />
            {status.label}
            {assignment.status === 'started' && assignment.started_at && (
              <span className="text-[10px] opacity-70 ml-1">since {format(new Date(assignment.started_at), 'HH:mm')}</span>
            )}
          </span>
          <div className="flex gap-2">
            {(assignment.status || 'assigned') === 'assigned' && (
              <button onClick={() => handleStartJob(assignment.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-xs font-medium">
                <PlayCircle className="w-3.5 h-3.5" /> Start Job
              </button>
            )}
            {assignment.status === 'started' && (
              <div className="flex items-center gap-2">
                {isDriller && (
                  <input type="number" min="0" step="0.1" placeholder="Meterage (m)"
                    value={meterageInputs[assignment.id] || ''}
                    onChange={(e) => setMeterageInputs(prev => ({ ...prev, [assignment.id]: e.target.value }))}
                    className="w-28 px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-emerald-600" />
                )}
                <button onClick={() => handleCompleteJob(assignment.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-xs font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Complete Job
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div>
            <div className="flex items-start justify-between mb-3 md:mb-4 gap-2">
              <div className="min-w-0">
                <h3 className="text-base md:text-lg font-bold text-slate-900 break-words">{job.name}</h3>
                <span className={`inline-block px-2 py-1 rounded text-xs font-semibold mt-2 ${jobTypeBadgeColors[job.job_type]}`}>
                  {formatJobType(job.job_type)}
                </span>
              </div>
            </div>
            <div className="space-y-2 text-xs md:text-sm text-slate-600">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                {job.location}
              </div>
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                <span className="break-words">{format(new Date(assignment.assigned_date), 'EEEE, MMM d, yyyy')}</span>
              </div>
              {client && (
                <div className="flex items-start gap-2">
                  <Briefcase className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Client: <span className="font-medium text-slate-700">{client.name}</span></span>
                </div>
              )}
            </div>
          </div>
          <div className="space-y-3 md:space-y-4">
            {vehicle && (
              <div className="p-3 md:p-4 bg-white bg-opacity-50 rounded-lg border border-green-100">
                <div className="flex items-center gap-2 mb-2">
                  <Truck className="w-5 h-5 text-green-600" />
                  <h4 className="font-semibold text-slate-900">Assigned Vehicle</h4>
                </div>
                <p className="text-slate-900 font-mono font-bold text-lg">{vehicle.registration_number}</p>
                <p className="text-slate-600 text-sm">{vehicle.name}</p>
              </div>
            )}
            {job.requisition_list_url && (
              <div className="p-3 md:p-4 bg-white bg-opacity-50 rounded-lg border border-green-100">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-5 h-5 text-green-600" />
                  <h4 className="font-semibold text-slate-900">Requisition List</h4>
                </div>
                <a href={job.requisition_list_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-emerald-700 hover:text-emerald-900 font-medium">
                  <ExternalLink className="w-3.5 h-3.5" /> {job.requisition_list_name || 'View document'}
                </a>
              </div>
            )}
            {job.notes && (
              <div className="p-3 md:p-4 bg-white bg-opacity-50 rounded-lg border border-green-100">
                <h4 className="font-semibold text-slate-900 mb-2">Notes</h4>
                <p className="text-slate-600 text-sm whitespace-pre-wrap">{job.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Meterage Record */}
        {assignment.meterage != null && assignment.meterage > 0 && (
          <div className="flex items-center gap-2 text-sm text-slate-600 mb-3">
            <Ruler className="w-4 h-4 text-amber-600" />
            <span>Meterage recorded: <span className="font-semibold text-slate-900">{assignment.meterage}m</span></span>
          </div>
        )}

        {/* Briefing Sign-off */}
        <div className="mt-4 pt-4 border-t border-slate-200/60">
          {assignment.briefing_signed ? (
            <div className="flex items-center gap-2 text-sm text-emerald-700">
              <ClipboardCheck className="w-4 h-4" />
              <span className="font-medium">Briefing signed off</span>
              {assignment.briefing_signed_at && (
                <span className="text-xs text-slate-400">
                  · {format(new Date(assignment.briefing_signed_at), 'dd MMM yyyy HH:mm')}
                </span>
              )}
            </div>
          ) : (
            <button onClick={() => handleBriefingSign(assignment.id)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition text-sm font-medium w-full sm:w-auto">
              <ClipboardCheck className="w-4 h-4" />
              Sign Off Job Briefing
            </button>
          )}
        </div>

        {/* Site Photo Upload */}
        {job && (
          <div className="mt-4 pt-4 border-t border-slate-200/60">
            <SitePhotoUpload jobId={job.id} staffName={staff.name} />
          </div>
        )}

        {/* Timesheet Entry */}
        {job && assignment.status === 'completed' && (
          <div className="mt-4 pt-4 border-t border-slate-200/60">
            <TimesheetEntry assignment={assignment} jobId={job.id} staffId={staff.id} />
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-emerald-900 border-b border-emerald-800">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 md:py-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 md:w-12 md:h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-sm ring-1 ring-white/20 flex-shrink-0">
              <HardHat className="w-6 h-6 md:w-7 md:h-7 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold text-white truncate">My Schedule</h1>
              <p className="text-emerald-200 text-sm md:text-base mt-0.5 truncate">Welcome, {staff.name}</p>
            </div>
          </div>
          <button onClick={openChat} type="button"
            className="flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 ring-1 ring-white/20 text-white text-sm font-medium active:scale-95 transition cursor-pointer touch-manipulation select-none flex-shrink-0">
            <Sparkles className="w-5 h-5" />
            <span className="hidden sm:inline">Ask Assistant</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 md:py-8">
        {!isOnline && (
          <div className="mb-6 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
            <WifiOff className="w-4 h-4 flex-shrink-0" />
            You're offline. Showing cached schedule. Changes will sync when you reconnect.
          </div>
        )}
        {/* Staff Info Card */}
        <div className="bg-white rounded-lg p-4 md:p-6 border border-green-200 shadow-sm mb-6 md:mb-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
            <div className="col-span-1">
              <p className="text-xs font-medium text-slate-500 uppercase">Role</p>
              <p className="text-sm md:text-lg font-semibold text-slate-900 mt-1 capitalize">{staff.job_role.replace('_', ' ')}</p>
            </div>
            <div className="col-span-1">
              <p className="text-xs font-medium text-slate-500 uppercase">Type</p>
              <p className="text-sm md:text-lg font-semibold text-slate-900 mt-1 capitalize">{staff.worker_type.replace('_', ' ')}</p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="text-xs font-medium text-slate-500 uppercase">Email</p>
              <p className="text-sm font-semibold text-slate-900 mt-1 truncate">{staff.email}</p>
            </div>
            <div className="col-span-1">
              <p className="text-xs font-medium text-slate-500 uppercase">Jobs</p>
              <p className="text-sm md:text-lg font-semibold text-slate-900 mt-1">{assignments.length}</p>
            </div>
          </div>
        </div>

        {/* Today's Assignment Highlight */}
        {todaysAssignments.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-5 h-5 text-emerald-700" />
              <h2 className="text-lg md:text-xl font-bold text-slate-900">Today</h2>
              <span className="text-xs bg-emerald-700 text-white px-2 py-0.5 rounded-full font-medium">{todaysAssignments.length}</span>
            </div>
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
              <div key={i} className="bg-white rounded-lg border border-slate-200 p-5">
                <Skeleton className="h-4 w-1/3 mb-3" />
                <SkeletonText lines={3} />
              </div>
            ))}
          </div>
        ) : assignments.length === 0 ? (
          <EmptyState icon={CalendarDays} title="No assignments scheduled" message="Check back later — your supervisor will assign you to upcoming jobs." />
        ) : (
          <div className="space-y-8">
            {upcomingAssignments.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-5 h-5 text-emerald-700" />
                  <h2 className="text-lg md:text-xl font-bold text-slate-900">Upcoming</h2>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{upcomingAssignments.length}</span>
                </div>
                <motion.div variants={listContainer} initial="hidden" animate="show" className="space-y-4">
                  {upcomingAssignments.map(renderAssignment)}
                </motion.div>
              </div>
            )}
            {pastAssignments.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-5 h-5 text-slate-400" />
                  <h2 className="text-lg md:text-xl font-bold text-slate-500">Past Assignments</h2>
                  <span className="text-xs bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full font-medium">{pastAssignments.length}</span>
                </div>
                <motion.div variants={listContainer} initial="hidden" animate="show" className="space-y-4 opacity-70">
                  {pastAssignments.map(renderAssignment)}
                </motion.div>
              </div>
            )}
          </div>
        )}

        {/* My Timesheets */}
        <div className="mt-8">
          <StaffTimesheets staffId={staff.id} staffName={staff.name} />
        </div>
      </div>
    </div>
  );
}