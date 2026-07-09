import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Users, Phone, Mail, Briefcase } from 'lucide-react';
import { Skeleton, EmptyState } from '@/components/StateViews';

function getWeekStart(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return format(d, 'yyyy-MM-dd');
}

export default function TeamMiniFeed({ teamId, currentStaffId }) {
  const weekStart = getWeekStart();

  const { data: allStaff = [], isLoading: staffLoading } = useQuery({
    queryKey: ['staff'],
    queryFn: () => base44.entities.Staff.list()
  });
  const { data: assignments = [] } = useQuery({
    queryKey: ['team-assignments', teamId, weekStart],
    queryFn: () => base44.entities.RotaAssignment.filter({ week_start: weekStart }),
    enabled: !!teamId
  });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });

  const teamMembers = allStaff.filter(s => s.team_id === teamId && s.is_active !== false);
  const teamMemberIds = new Set(teamMembers.map(m => m.id));
  const weekAssignments = assignments.filter(a => teamMemberIds.has(a.staff_id));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-6 shadow-sm">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
          <Users className="w-4 h-4 text-emerald-700" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">My Crew</h2>
      </div>

      {staffLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
        </div>
      ) : teamMembers.length === 0 ? (
        <EmptyState icon={Users} title="No crew members" message="You're not part of a crew yet." />
      ) : (
        <div className="space-y-4">
          {/* Team contacts */}
          <div className="space-y-2">
            {teamMembers.map(m => (
              <div key={m.id} className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2.5">
                <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-emerald-700">{m.name?.charAt(0) || '?'}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {m.name}
                    {m.id === currentStaffId && <span className="text-xs text-emerald-600 ml-1.5">(you)</span>}
                  </p>
                  {m.email && <p className="text-xs text-slate-400 truncate">{m.email}</p>}
                </div>
                {m.email && (
                  <a href={`mailto:${m.email}`} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition flex-shrink-0">
                    <Mail className="w-4 h-4" />
                  </a>
                )}
              </div>
            ))}
          </div>

          {/* This week's roster */}
          {weekAssignments.length > 0 && (
            <div className="border-t border-slate-100 pt-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">This Week's Roster</p>
              <div className="space-y-1.5">
                {weekAssignments
                  .sort((a, b) => new Date(a.assigned_date) - new Date(b.assigned_date))
                  .map(a => {
                    const member = teamMembers.find(m => m.id === a.staff_id);
                    const job = jobs.find(j => j.id === a.job_id);
                    if (!member || !job) return null;
                    return (
                      <div key={a.id} className="flex items-center gap-2 text-xs">
                        <Briefcase className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="font-medium text-slate-600 min-w-0 truncate">{member.name.split(' ')[0]}</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-slate-500 min-w-0 truncate flex-1">{job.name}</span>
                        <span className="text-slate-400 flex-shrink-0">{format(new Date(a.assigned_date + 'T00:00:00'), 'EEE')}</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}