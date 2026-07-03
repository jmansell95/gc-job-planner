import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Users, Truck, Briefcase, Calendar, Grid3x3, MapPin, ChevronRight, Clock, HardHat, Building2, Activity } from 'lucide-react';
import AdminNav from '@/components/AdminNav';
import PageHeader from '@/components/PageHeader';
import JobManager from '@/components/JobManager';
import TeamManager from '@/components/TeamManager';
import WeeklyRotaBuilder from '@/components/WeeklyRotaBuilder';
import SettingsPage from '@/components/SettingsPage';
import JobDetail from '@/components/JobDetail';
import { JobStatusChart, WeeklyAssignmentsChart, StaffUtilizationChart } from '@/components/DashboardCharts';
import VehicleMaintenanceAlerts from '@/components/VehicleMaintenanceAlerts';
import DrillingPerformanceChart from '@/components/DrillingPerformanceChart';
import { format, startOfWeek, addDays } from 'date-fns';

const jobTypeBadge = {
  groundworks: 'bg-green-100 text-green-700',
  cp_drilling: 'bg-amber-100 text-amber-700',
  rotary_drilling: 'bg-blue-100 text-blue-700',
  enabling_works: 'bg-purple-100 text-purple-700',
  depot: 'bg-slate-100 text-slate-600',
};

export default function AdminDashboard() {
  const [activeSection, setActiveSection] = useState('overview');
  const [selectedJob, setSelectedJob] = useState(null);

  const { data: staff = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: () => base44.entities.Staff.list()
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list()
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list()
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list()
  });

  const weekStart = startOfWeek(new Date());
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekDays = Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), 'yyyy-MM-dd'));

  const { data: thisWeekRotas = [] } = useQuery({
    queryKey: ['rotas-this-week', weekStartStr],
    queryFn: async () => {
      const all = await base44.entities.RotaAssignment.list();
      return all.filter(r => r.week_start === weekStartStr);
    }
  });

  // Unique staff on rota this week
  const staffOnRota = [...new Set(thisWeekRotas.map(r => r.staff_id))].length;
  const activeJobs = jobs.filter(j => (j.status || 'planning') === 'in_progress');
  const todaysRotas = thisWeekRotas.filter(r => r.assigned_date === format(new Date(), 'yyyy-MM-dd'));

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50/80">
      <AdminNav activeSection={activeSection} setActiveSection={setActiveSection} />
      
      <main className="flex-1 overflow-auto pt-16 lg:pt-0">
        <div className="p-4 md:p-8 max-w-7xl mx-auto w-full">
          {activeSection === 'overview' && (
            <div>
              {/* Header */}
              <div className="mb-8">
                <div className="flex items-center gap-3 md:gap-4 mb-1">
                  <div className="p-2 md:p-3 bg-emerald-700 rounded-lg flex-shrink-0">
                    <Grid3x3 className="w-6 md:w-8 h-6 md:h-8 text-white" />
                  </div>
                  <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Dashboard</h1>
                </div>
                <p className="text-slate-500 text-sm mt-1 ml-14 md:ml-16">Week of {format(weekStart, 'dd MMM yyyy')}</p>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'Total Staff', value: staff.length, icon: Users, color: 'text-emerald-700', bg: 'bg-emerald-50' },
                  { label: 'Active Jobs', value: activeJobs.length, icon: Activity, color: 'text-teal-700', bg: 'bg-teal-50' },
                  { label: 'Vehicles', value: vehicles.length, icon: Truck, color: 'text-amber-700', bg: 'bg-amber-50' },
                  { label: 'Staff On Rota', value: staffOnRota, icon: Calendar, color: 'text-purple-700', bg: 'bg-purple-50' },
                ].map(stat => {
                  const Icon = stat.icon;
                  return (
                    <div key={stat.label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
                      <div className={`w-11 h-11 rounded-xl ${stat.bg} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-5 h-5 ${stat.color}`} />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                        <p className="text-xs text-slate-500 font-medium">{stat.label}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <JobStatusChart jobs={jobs} />
                <WeeklyAssignmentsChart days={weekDays} rotas={thisWeekRotas} />
              </div>

              {/* Utilization + Maintenance Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <StaffUtilizationChart staff={staff} rotas={thisWeekRotas} weekDays={weekDays} />
                <VehicleMaintenanceAlerts vehicles={vehicles} />
              </div>

              {/* Drilling Performance */}
              <div className="mb-6">
                <DrillingPerformanceChart rotas={thisWeekRotas} staff={staff} />
              </div>

              {/* Active Jobs + Today's Field Crew */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="w-5 h-5 text-emerald-700" />
                      <h2 className="font-semibold text-slate-900">Active Jobs</h2>
                    </div>
                    <button onClick={() => setActiveSection('jobs')} className="text-xs text-emerald-700 hover:text-emerald-900 font-medium flex items-center gap-1">
                      View all <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {activeJobs.length === 0 ? (
                    <div className="px-5 py-8 text-center text-slate-400 text-sm">No active jobs</div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {activeJobs.slice(0, 5).map(job => (
                        <button key={job.id} onClick={() => { setSelectedJob(job); setActiveSection('job-detail'); }}
                          className="w-full px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50 transition text-left">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-slate-900 text-sm truncate">{job.name}</p>
                            <div className="flex items-center gap-1.5 text-slate-400 text-xs mt-0.5">
                              <MapPin className="w-3 h-3" /><span className="truncate">{job.location}</span>
                            </div>
                          </div>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${jobTypeBadge[job.job_type] || 'bg-slate-100 text-slate-600'}`}>
                            {job.job_type.replace(/_/g, ' ')}
                          </span>
                          <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-emerald-700" />
                      <h2 className="font-semibold text-slate-900">Today's Field Crew</h2>
                    </div>
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">{todaysRotas.length}</span>
                  </div>
                  {todaysRotas.length === 0 ? (
                    <div className="px-5 py-8 text-center text-slate-400 text-sm">No assignments today</div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {todaysRotas.slice(0, 6).map(r => {
                        const member = staff.find(s => s.id === r.staff_id);
                        const job = jobs.find(j => j.id === r.job_id);
                        const vehicle = vehicles.find(v => v.id === r.vehicle_id);
                        return (
                          <div key={r.id} className="px-5 py-3 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                              <span className="text-emerald-700 font-bold text-xs">{member?.name?.charAt(0) || '?'}</span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-slate-900 truncate">{member?.name || 'Unknown'}</p>
                              <p className="text-xs text-slate-400 truncate">{job?.name || '—'}{vehicle ? ` · ${vehicle.registration_number}` : ''}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Jobs */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-5 h-5 text-emerald-700" />
                      <h2 className="font-semibold text-slate-900">Jobs</h2>
                    </div>
                    <button onClick={() => setActiveSection('jobs')} className="text-xs text-emerald-700 hover:text-emerald-900 font-medium flex items-center gap-1">
                      View all <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {jobs.length === 0 ? (
                    <div className="px-5 py-8 text-center text-slate-400 text-sm">No jobs yet</div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {jobs.slice(0, 6).map(job => (
                        <button
                          key={job.id}
                          onClick={() => { setSelectedJob(job); setActiveSection('job-detail'); }}
                          className="w-full px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50 transition text-left"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-slate-900 text-sm truncate">{job.name}</p>
                            <div className="flex items-center gap-1.5 text-slate-400 text-xs mt-0.5">
                              <MapPin className="w-3 h-3" /><span className="truncate">{job.location}</span>
                            </div>
                          </div>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${jobTypeBadge[job.job_type] || 'bg-slate-100 text-slate-600'}`}>
                            {job.job_type.replace(/_/g, ' ')}
                          </span>
                          <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* This Week's Rota Summary */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-emerald-700" />
                      <h2 className="font-semibold text-slate-900">This Week's Rota</h2>
                    </div>
                    <button onClick={() => setActiveSection('rota')} className="text-xs text-emerald-700 hover:text-emerald-900 font-medium flex items-center gap-1">
                      Manage <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {thisWeekRotas.length === 0 ? (
                    <div className="px-5 py-8 text-center text-slate-400 text-sm">No assignments this week</div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {weekDays.filter(d => thisWeekRotas.some(r => r.assigned_date === d)).map(dayStr => {
                        const dayRotas = thisWeekRotas.filter(r => r.assigned_date === dayStr);
                        const d = new Date(dayStr + 'T00:00:00');
                        return (
                          <div key={dayStr} className="px-5 py-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-semibold text-slate-700">{format(d, 'EEEE dd MMM')}</span>
                              <span className="text-xs text-slate-400">{dayRotas.length} assigned</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {dayRotas.slice(0, 4).map(r => {
                                const s = staff.find(x => x.id === r.staff_id);
                                return s ? (
                                  <span key={r.id} className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">{s.name}</span>
                                ) : null;
                              })}
                              {dayRotas.length > 4 && (
                                <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">+{dayRotas.length - 4} more</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Staff Overview */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-emerald-700" />
                      <h2 className="font-semibold text-slate-900">Staff</h2>
                    </div>
                    <button onClick={() => setActiveSection('settings')} className="text-xs text-emerald-700 hover:text-emerald-900 font-medium flex items-center gap-1">
                      Manage <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {staff.length === 0 ? (
                    <div className="px-5 py-8 text-center text-slate-400 text-sm">No staff yet</div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {staff.slice(0, 6).map(member => (
                        <div key={member.id} className="px-5 py-3 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-emerald-700 font-bold text-xs">{member.name.charAt(0)}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-900 truncate">{member.name}</p>
                            <p className="text-xs text-slate-400 capitalize">{member.job_role?.replace(/_/g, ' ')}</p>
                          </div>
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full capitalize flex-shrink-0">
                            {member.worker_type?.replace(/_/g, ' ')}
                          </span>
                        </div>
                      ))}
                      {staff.length > 6 && (
                        <div className="px-5 py-3 text-xs text-slate-400 text-center">+{staff.length - 6} more staff</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Vehicles */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Truck className="w-5 h-5 text-emerald-700" />
                      <h2 className="font-semibold text-slate-900">Vehicles</h2>
                    </div>
                    <button onClick={() => setActiveSection('settings')} className="text-xs text-emerald-700 hover:text-emerald-900 font-medium flex items-center gap-1">
                      Manage <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {vehicles.length === 0 ? (
                    <div className="px-5 py-8 text-center text-slate-400 text-sm">No vehicles yet</div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {vehicles.slice(0, 6).map(v => (
                        <div key={v.id} className="px-5 py-3 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                            <Truck className="w-4 h-4 text-amber-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-mono font-bold text-slate-900">{v.registration_number}</p>
                            <p className="text-xs text-slate-400 truncate">{v.name}</p>
                          </div>
                        </div>
                      ))}
                      {vehicles.length > 6 && (
                        <div className="px-5 py-3 text-xs text-slate-400 text-center">+{vehicles.length - 6} more</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeSection === 'job-detail' && selectedJob && (
            <JobDetail job={selectedJob} onBack={() => setActiveSection('overview')} />
          )}
          {activeSection === 'jobs' && <JobManager />}
          {activeSection === 'rota' && <WeeklyRotaBuilder />}
          {activeSection === 'teams' && <TeamManager />}
          {activeSection === 'settings' && <SettingsPage />}
        </div>
      </main>
    </div>
  );
}