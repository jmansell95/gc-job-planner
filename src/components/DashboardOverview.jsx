import React from 'react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Users, Truck, Briefcase, Grid3x3, MapPin, ChevronRight, Clock, AlertTriangle } from 'lucide-react';
import { format, startOfWeek, addDays } from 'date-fns';
import { JobStatusChart, StaffUtilizationChart, JobTypeBreakdownChart } from '@/components/DashboardCharts';
import VehicleMaintenanceAlerts from '@/components/VehicleMaintenanceAlerts';
import DashboardInsights from '@/components/DashboardInsights';
import { formatJobType } from '@/utils/format';

const jobTypeBadge = {
  groundworks: 'bg-green-100 text-green-700 ring-1 ring-green-200',
  cp_drilling: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200',
  rotary_drilling: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200',
  enabling_works: 'bg-purple-100 text-purple-700 ring-1 ring-purple-200',
  depot: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
};

const jobTypeDot = {
  groundworks: 'bg-green-500',
  cp_drilling: 'bg-amber-500',
  rotary_drilling: 'bg-blue-500',
  enabling_works: 'bg-purple-500',
  depot: 'bg-slate-400',
};

const cardVariants = {
  hidden: { opacity: 0, y: 14 },
  show: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.35 } })
};

export default function DashboardOverview({ onNavigate, onSelectJob }) {
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => base44.entities.Vehicle.list() });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });

  const weekStart = startOfWeek(new Date());
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const weekDays = Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), 'yyyy-MM-dd'));

  const { data: thisWeekRotas = [] } = useQuery({
    queryKey: ['rotas-this-week', weekStartStr],
    queryFn: () => base44.entities.RotaAssignment.filter({ week_start: weekStartStr })
  });

  const activeJobs = jobs.filter(j => (j.status || 'planning') === 'in_progress');
  const todaysRotas = thisWeekRotas.filter(r => r.assigned_date === todayStr);
  const staffToday = [...new Set(todaysRotas.map(r => r.staff_id))].length;

  const today = new Date();
  const inDays = (dateStr) => {
    if (!dateStr) return null;
    return Math.ceil((new Date(dateStr + 'T00:00:00') - today) / (1000 * 60 * 60 * 24));
  };
  const maintenanceAlerts = vehicles.filter(v => {
    const motDays = inDays(v.mot_expiry);
    const svcDays = inDays(v.service_due_date);
    return (motDays !== null && motDays <= 30) || (svcDays !== null && svcDays <= 30);
  }).length;

  const stats = [
    { label: 'Active Jobs', value: activeJobs.length, icon: Briefcase, gradient: 'stat-gradient-emerald' },
    { label: 'Working Today', value: staffToday, icon: Users, gradient: 'stat-gradient-blue' },
    { label: 'Vehicles', value: vehicles.length, icon: Truck, gradient: 'stat-gradient-amber' },
    { label: 'Maint. Alerts', value: maintenanceAlerts, icon: AlertTriangle, gradient: maintenanceAlerts > 0 ? 'stat-gradient-rose' : 'stat-gradient-slate' },
  ];

  return (
    <div>
      {/* Gradient Hero */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mb-6">
        <div className="hero-gradient rounded-2xl p-5 md:p-6 text-white shadow-lg shadow-emerald-900/20 overflow-hidden relative">
          <div className="absolute -top-12 -right-8 w-44 h-44 rounded-full bg-emerald-300/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-10 w-40 h-40 rounded-full bg-teal-300/10 blur-3xl pointer-events-none" />
          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/15 rounded-xl ring-1 ring-white/20 backdrop-blur-sm flex-shrink-0">
                <Grid3x3 className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
                <p className="text-emerald-100 text-sm mt-0.5">Week of {format(weekStart, 'dd MMM yyyy')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 ring-1 ring-white/15 text-xs font-medium backdrop-blur-sm">
                <Briefcase className="w-3.5 h-3.5" /> {activeJobs.length} Active
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 ring-1 ring-white/15 text-xs font-medium backdrop-blur-sm">
                <Users className="w-3.5 h-3.5" /> {staffToday} Today
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 ring-1 ring-white/15 text-xs font-medium backdrop-blur-sm">
                <Truck className="w-3.5 h-3.5" /> {vehicles.length} Vehicles
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div key={stat.label} custom={i} initial="hidden" animate="show" variants={cardVariants}
              className="card-modern rounded-2xl p-5 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl ${stat.gradient} flex items-center justify-center flex-shrink-0 shadow-md`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                <p className="text-xs text-slate-500 font-medium">{stat.label}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Today's Field Crew */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.35 }}
        className="card-modern rounded-2xl overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-slate-100/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-700" />
            <h2 className="font-semibold text-slate-900">Today's Field Crew</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">{todaysRotas.length} assignments</span>
            <button onClick={() => onNavigate('calendar')} className="text-xs text-emerald-700 hover:text-emerald-900 font-medium flex items-center gap-1">
              Calendar <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        {todaysRotas.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2">
              <Users className="w-5 h-5 text-slate-300" />
            </div>
            <p className="text-slate-400 text-sm">No assignments scheduled today</p>
            <button onClick={() => onNavigate('rota')} className="mt-2 text-xs text-emerald-700 hover:text-emerald-900 font-medium">Build this week's rota →</button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100/70">
            {todaysRotas.map(r => {
              const member = staff.find(s => s.id === r.staff_id);
              const job = jobs.find(j => j.id === r.job_id);
              const vehicle = vehicles.find(v => v.id === r.vehicle_id);
              return (
                <button key={r.id} onClick={() => job && onSelectJob(job)}
                  className="w-full px-5 py-3 flex items-center gap-3 hover:bg-emerald-50/40 transition text-left">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <span className="text-white font-bold text-sm">{member?.name?.charAt(0) || '?'}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">{member?.name || 'Unknown'}</p>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 truncate">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{job?.name || '—'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {vehicle && <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{vehicle.registration_number}</span>}
                    {job?.job_type && <span className={`w-2 h-2 rounded-full ${jobTypeDot[job.job_type]}`} />}
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${jobTypeBadge[job?.job_type] || 'bg-slate-100 text-slate-600'}`}>
                      {formatJobType(job?.job_type) || '—'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <JobStatusChart jobs={jobs} />
        <JobTypeBreakdownChart jobs={jobs} />
        <div className="lg:col-span-2">
          <StaffUtilizationChart staff={staff} rotas={thisWeekRotas} weekDays={weekDays} />
        </div>
      </div>

      {/* AI Insights */}
      <div className="mb-6">
        <DashboardInsights />
      </div>

      {/* Vehicle Maintenance Alerts */}
      <div className="mb-6">
        <VehicleMaintenanceAlerts vehicles={vehicles} />
      </div>
    </div>
  );
}