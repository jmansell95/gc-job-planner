import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Calendar, MapPin, Briefcase, Truck } from 'lucide-react';
import { format, startOfWeek, isWithinInterval } from 'date-fns';
import PrintEmailSchedule from '@/components/PrintEmailSchedule';

export default function StaffDashboard() {
  const [staff, setStaff] = useState(null);
  const [loading, setLoading] = useState(true);

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
  }, []);

  const { data: assignments = [] } = useQuery({
    queryKey: ['staff-assignments', staff?.id],
    queryFn: async () => {
      if (!staff?.id) return [];
      const rotas = await base44.entities.RotaAssignment.filter({ staff_id: staff.id });
      return rotas.sort((a, b) => new Date(a.assigned_date) - new Date(b.assigned_date));
    },
    enabled: !!staff?.id
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs-for-assignments'],
    queryFn: async () => {
      return await base44.entities.Job.list();
    }
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => {
      return await base44.entities.Vehicle.list();
    }
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-green-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
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

  const jobTypeBadgeColors = {
    groundworks: 'bg-green-100 text-green-700',
    cp_drilling: 'bg-amber-100 text-amber-700',
    rotary_drilling: 'bg-blue-100 text-blue-700',
    enabling_works: 'bg-purple-100 text-purple-700',
    depot: 'bg-slate-100 text-slate-700'
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 md:py-6">
          <h1 className="text-2xl md:text-3xl font-bold text-green-600">My Schedule</h1>
          <p className="text-slate-600 text-sm md:text-base mt-1">Welcome, {staff.name}</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 md:py-8">
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

        {/* Print/Email Controls */}
        <div className="mb-8">
          <PrintEmailSchedule 
            weekStart={new Date()} 
            staffId={staff.id}
            staffName={staff.name}
          />
        </div>

        {/* Assignments List */}
        <div>
          <h2 className="text-lg md:text-xl font-bold text-slate-900 mb-4">This Week & Next Week</h2>
          
          {assignments.length === 0 ? (
            <div className="bg-white rounded-lg p-12 border border-green-200 text-center">
              <p className="text-slate-600">No assignments scheduled</p>
            </div>
          ) : (
            <div className="space-y-4">
              {assignments.map(assignment => {
                const job = jobs.find(j => j.id === assignment.job_id);
                const vehicle = vehicles.find(v => v.id === assignment.vehicle_id);
                
                if (!job) return null;

                return (
                  <div key={assignment.id} className={`rounded-lg p-4 md:p-6 border-l-4 border ${jobTypeColors[job.job_type] || 'bg-slate-50 border-slate-200'}`}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                      {/* Job Details */}
                      <div>
                        <div className="flex items-start justify-between mb-3 md:mb-4 gap-2">
                          <div className="min-w-0">
                            <h3 className="text-base md:text-lg font-bold text-slate-900 break-words">{job.name}</h3>
                            <span className={`inline-block px-2 py-1 rounded text-xs font-semibold mt-2 ${jobTypeBadgeColors[job.job_type]}`}>
                              {job.job_type.replace('_', ' ').toUpperCase()}
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
                          {job.client_id && (
                            <div className="flex items-start gap-2">
                              <Briefcase className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                              Client: {job.client_id}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Vehicle & Equipment */}
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

                        {job.equipment_needed && (
                          <div className="p-3 md:p-4 bg-white bg-opacity-50 rounded-lg border border-green-100">
                            <h4 className="font-semibold text-slate-900 mb-2">Equipment</h4>
                            <p className="text-slate-600 text-sm">{job.equipment_needed}</p>
                          </div>
                        )}

                        {job.notes && (
                          <div className="p-3 md:p-4 bg-white bg-opacity-50 rounded-lg border border-green-100">
                            <h4 className="font-semibold text-slate-900 mb-2">Notes</h4>
                            <p className="text-slate-600 text-sm">{job.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}