import React from 'react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Users, Truck, Briefcase, Grid3x3, ClipboardCheck, Plus, Calendar, ArrowRight } from 'lucide-react';
import { format, startOfWeek, addDays } from 'date-fns';
import { JobStatusChart, StaffUtilizationChart, JobTypeBreakdownChart } from '@/components/DashboardCharts';
import VehicleMaintenanceAlerts from '@/components/VehicleMaintenanceAlerts';
import JobCostAnalytics from '@/components/JobCostAnalytics';
import DashboardInsights from '@/components/DashboardInsights';
import FieldCrewsToday from '@/components/FieldCrewsToday';
import NeedsAttentionPanel from '@/components/NeedsAttentionPanel';
import DeliveryStats from '@/components/DeliveryStats';


const cardVariants = {
  hidden: { opacity: 0, y: 14 },
  show: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.35 } })
};

export default function DashboardOverview({ onNavigate, onSelectJob }) {
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => base44.entities.Vehicle.list() });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: timesheets = [] } = useQuery({ queryKey: ['timesheets'], queryFn: () => base44.entities.Timesheet.list('-created_date', 100) });

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const weekDays = Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), 'yyyy-MM-dd'));

  const { data: thisWeekRotas = [] } = useQuery({
    queryKey: ['rotas-this-week', weekStartStr],
    queryFn: () => base44.entities.RotaAssignment.filter({ week_start: weekStartStr })
  });

  const activeJobs = jobs.filter(j => (j.status || 'planning') === 'in_progress');
  const onHoldJobs = jobs.filter(j => j.status === 'on_hold');
  const todaysRotas = thisWeekRotas.filter(r => r.assigned_date === todayStr);
  const staffToday = [...new Set(todaysRotas.map(r => r.staff_id))].length;
  const pendingTs = timesheets.filter(t => t.status === 'submitted').length;
  const activeStaff = staff.filter(s => s.is_active !== false).length;

  const stats = [
    { label: 'Active Jobs', value: activeJobs.length, sub: onHoldJobs.length ? `${onHoldJobs.length} on hold` : `${jobs.length} total`, icon: Briefcase, gradient: 'stat-gradient-emerald', nav: 'jobs' },
    { label: 'Working Today', value: staffToday, sub: `${activeStaff} active staff`, icon: Users, gradient: 'stat-gradient-blue', nav: 'rota' },
    { label: 'Pending Approval', value: pendingTs, sub: 'timesheets', icon: ClipboardCheck, gradient: pendingTs > 0 ? 'stat-gradient-amber' : 'stat-gradient-slate', nav: 'timesheets' },
    { label: 'Vehicles', value: vehicles.length, sub: 'in fleet', icon: Truck, gradient: 'stat-gradient-amber', nav: 'settings' },
  ];

  return (
    <div>
      {/* Hero header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 rounded-xl flex-shrink-0">
              <Grid3x3 className="w-7 h-7 text-emerald-700" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Dashboard</h1>
              <p className="text-slate-500 text-sm mt-0.5">{thisWeekRotas.length} shifts this week · Week of {format(weekStart, 'dd MMM yyyy')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => onNavigate('jobs')} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition text-sm font-medium">
              <Plus className="w-4 h-4 text-emerald-700" /> Add Job
            </button>
            <button onClick={() => onNavigate('rota')} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-sm font-medium">
              <Calendar className="w-4 h-4" /> Build Rota
            </button>
          </div>
        </div>
      </motion.div>

      {/* Delivery & Collection stats */}
      <DeliveryStats onNavigate={onNavigate} />

      {/* Needs Attention */}
      <NeedsAttentionPanel onNavigate={onNavigate} />

      {/* KPI Stats — clickable */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.button key={stat.label} custom={i} initial="hidden" animate="show" variants={cardVariants}
              onClick={() => onNavigate(stat.nav)}
              className="card-modern rounded-2xl p-4 sm:p-5 flex items-center gap-3 sm:gap-4 text-left group">
              <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl ${stat.gradient} flex items-center justify-center flex-shrink-0 shadow-md`}>
                <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">{stat.value}</p>
                <p className="text-xs text-slate-500 font-medium">{stat.label}</p>
                <p className="text-[11px] text-slate-400 truncate">{stat.sub}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition ml-auto flex-shrink-0" />
            </motion.button>
          );
        })}
      </div>

      {/* Field Crews + AI Insights side by side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <FieldCrewsToday todaysRotas={todaysRotas} staff={staff} jobs={jobs} vehicles={vehicles} onSelectJob={onSelectJob} onNavigate={onNavigate} />

        {/* AI Weekly Insights (inline, no longer a separate orphan) */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.35 }}>
          <DashboardInsights />
        </motion.div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <JobStatusChart jobs={jobs} />
        <JobTypeBreakdownChart jobs={jobs} />
        <div className="lg:col-span-2">
          <StaffUtilizationChart staff={staff} rotas={thisWeekRotas} weekDays={weekDays} />
        </div>
      </div>

      {/* Cost Analytics */}
      <div className="mb-6">
        <JobCostAnalytics />
      </div>

      {/* Vehicle Maintenance Alerts */}
      <div className="mb-6">
        <VehicleMaintenanceAlerts vehicles={vehicles} />
      </div>
    </div>
  );
}