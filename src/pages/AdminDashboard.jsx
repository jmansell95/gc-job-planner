import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Users, Truck, Briefcase, Calendar, Settings } from 'lucide-react';
import AdminNav from '@/components/AdminNav';
import StaffManager from '@/components/StaffManager';
import VehicleManager from '@/components/VehicleManager';
import JobManager from '@/components/JobManager';
import TeamManager from '@/components/TeamManager';
import WeeklyRotaBuilder from '@/components/WeeklyRotaBuilder';

export default function AdminDashboard() {
  const [activeSection, setActiveSection] = useState('overview');

  const { data: staffCount } = useQuery({
    queryKey: ['staff-count'],
    queryFn: async () => {
      const result = await base44.entities.Staff.list();
      return result.length;
    }
  });

  const { data: vehicleCount } = useQuery({
    queryKey: ['vehicle-count'],
    queryFn: async () => {
      const result = await base44.entities.Vehicle.list();
      return result.length;
    }
  });

  const { data: jobCount } = useQuery({
    queryKey: ['job-count'],
    queryFn: async () => {
      const result = await base44.entities.Job.list();
      return result.length;
    }
  });

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
      <AdminNav activeSection={activeSection} setActiveSection={setActiveSection} />
      
      <main className="flex-1 overflow-auto pt-16 lg:pt-0">
        <div className="p-4 md:p-8 max-w-7xl mx-auto w-full">
          {activeSection === 'overview' && (
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-6 md:mb-8">Admin Dashboard</h1>
              
              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-8">
                <div className="bg-white rounded-lg p-4 md:p-6 border border-green-200 shadow-sm hover:shadow-md transition">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-slate-600 text-xs md:text-sm font-medium">Active Staff</p>
                      <p className="text-2xl md:text-4xl font-bold text-green-600 mt-1 md:mt-2">{staffCount || 0}</p>
                    </div>
                    <Users className="w-8 md:w-12 h-8 md:h-12 text-green-600 opacity-20 flex-shrink-0" />
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 md:p-6 border border-green-200 shadow-sm hover:shadow-md transition">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-slate-600 text-xs md:text-sm font-medium">Vehicles</p>
                      <p className="text-2xl md:text-4xl font-bold text-green-600 mt-1 md:mt-2">{vehicleCount || 0}</p>
                    </div>
                    <Truck className="w-8 md:w-12 h-8 md:h-12 text-green-600 opacity-20 flex-shrink-0" />
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 md:p-6 border border-green-200 shadow-sm hover:shadow-md transition">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-slate-600 text-xs md:text-sm font-medium">Active Jobs</p>
                      <p className="text-2xl md:text-4xl font-bold text-green-600 mt-1 md:mt-2">{jobCount || 0}</p>
                    </div>
                    <Briefcase className="w-8 md:w-12 h-8 md:h-12 text-green-600 opacity-20 flex-shrink-0" />
                  </div>
                </div>
              </div>

              {/* Quick Actions and Info */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                <div className="bg-white rounded-lg p-4 md:p-6 border border-green-200 shadow-sm">
                  <h3 className="text-base md:text-lg font-semibold text-slate-900 mb-4">Quick Actions</h3>
                  <div className="space-y-2 md:space-y-3">
                    <button onClick={() => setActiveSection('staff')} className="w-full px-4 py-2 md:py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm md:text-base font-medium active:scale-95">
                      Manage Staff
                    </button>
                    <button onClick={() => setActiveSection('vehicles')} className="w-full px-4 py-2 md:py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm md:text-base font-medium active:scale-95">
                      Manage Vehicles
                    </button>
                    <button onClick={() => setActiveSection('jobs')} className="w-full px-4 py-2 md:py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm md:text-base font-medium active:scale-95">
                      Manage Jobs
                    </button>
                    <button onClick={() => setActiveSection('rota')} className="w-full px-4 py-2 md:py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm md:text-base font-medium active:scale-95">
                      Build Weekly Rota
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 md:p-6 border border-green-200 shadow-sm">
                  <h3 className="text-base md:text-lg font-semibold text-slate-900 mb-4">System Info</h3>
                  <div className="space-y-3 text-sm md:text-base text-slate-600">
                    <p><span className="font-medium text-slate-900">Version:</span> 1.0</p>
                    <p><span className="font-medium text-slate-900">Last Updated:</span> Today</p>
                    <p><span className="font-medium text-slate-900">Status:</span> <span className="text-green-600 font-semibold">Operational</span></p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'staff' && <StaffManager />}
          {activeSection === 'vehicles' && <VehicleManager />}
          {activeSection === 'jobs' && <JobManager />}
          {activeSection === 'rota' && <WeeklyRotaBuilder />}
          {activeSection === 'teams' && <TeamManager />}
        </div>
      </main>
    </div>
  );
}