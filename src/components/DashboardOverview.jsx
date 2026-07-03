import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Users, Truck, Briefcase, Calendar, Grid3x3, MapPin, ChevronRight, Clock, AlertTriangle } from 'lucide-react';
import { format, startOfWeek, addDays } from 'date-fns';
import { JobStatusChart, StaffUtilizationChart } from '@/components/DashboardCharts';
import VehicleMaintenanceAlerts from '@/components/VehicleMaintenanceAlerts';
import { formatJobType } from '@/utils/format';

const jobTypeBadge = {
  groundworks: 'bg-green-100 text-green-700',
  cp_drilling: 'bg-amber-100 text-amber-700',
  rotary_drilling: 'bg-blue-100 text-blue-700',
  enabling_works: 'bg-purple-100 text-purple-700',
  depot: 'bg-slate-100 text-slate-600',
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
    queryFn: async () => {
      const all = await base44.entities.RotaAssignment.list();
      return all.filter(r => r.week_start === weekStartStr);
    }
  });

  const activeJobs = jobs.filter(j => (j.status || 'planning') === 'in_progress');
  const todaysRotas = thisWeekRotas.filter(r => r.assigned_date === todayStr);
  const staffToday = [...new Set(todaysRotas.map(r => r.staff_id))].length;

  // Maintenance alerts count
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

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="p-2 md:p-3 bg-emerald-700 rounded-lg flex-shrink-0">
            <Grid3x3 className="w-6 md:w-8 h-6 md:h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-slate-500 text-sm mt-0.5">Week of {format(weekStart, 'dd MMM yyyy')}</p>
          </div>
        </div>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Active Jobs', value: activeJobs.length, icon: Briefcase, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          { label: 'Working Today', value: staffToday, icon: Users, color: 'text-blue-700', bg: 'bg-blue-50' },
          { label: 'Vehicles', value: vehicles.length, icon: Truck, color: 'text-amber-700', bg: 'bg-amber-50' },
          { label: 'Maint. Alerts', value: maintenanceAlerts, icon: AlertTriangle, color: maintenanceAlerts > 0 ? 'text-red-600' : 'text-slate-400', bg: maintenanceAlerts > 0 ? 'bg-red-50' : 'bg-slate-50' },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-center gap-4 hover:shadow-md transition">
              <div className={`w-12 h-12 rounded-xl ${stat.bg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                <p className="text-xs text-slate-500 font-medium">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Today's Field Crew */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
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
          <div className="px-5 py-8 text-center text-slate-400 text-sm">No assignments today</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {todaysRotas.map(r => {
              const member = staff.find(s => s.id === r.staff_id);
              const job = jobs.find(j => j.id === r.job_id);
              const vehicle = vehicles.find(v => v.id === r.vehicle_id);
              return (
                <button key={r.id} onClick={() => job && onSelectJob(job)}
                  className="w-full px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition text-left">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center flex-shrink-0">
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
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${jobTypeBadge[job?.job_type] || 'bg-slate-100 text-slate-600'}`}>
                      {formatJobType(job?.job_type) || '—'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <JobStatusChart jobs={jobs} />
        <StaffUtilizationChart staff={staff} rotas={thisWeekRotas} weekDays={weekDays} />
      </div>

      {/* Vehicle Maintenance Alerts */}
      <div className="mb-6">
        <VehicleMaintenanceAlerts vehicles={vehicles} />
      </div>

    </div>
  );
}