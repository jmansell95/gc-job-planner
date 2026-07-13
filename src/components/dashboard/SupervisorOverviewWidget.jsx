import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Shield, ArrowDownToLine, TestTube, Users, MapPin, Package, Ruler, Briefcase } from 'lucide-react';
import { Skeleton } from '@/components/StateViews';

const JOB_TYPE_LABELS = {
  groundworks: 'Groundworks', cp_drilling: 'CP Drilling', rotary_drilling: 'Rotary Drilling',
  enabling_works: 'Enabling Works', depot: 'Depot'
};

const JOB_TYPE_COLORS = {
  groundworks: 'bg-emerald-100 text-emerald-700',
  cp_drilling: 'bg-amber-100 text-amber-700',
  rotary_drilling: 'bg-blue-100 text-blue-700',
  enabling_works: 'bg-purple-100 text-purple-700',
  depot: 'bg-slate-100 text-slate-600',
};

export default function SupervisorOverviewWidget({ profile }) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const { data: teams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: () => base44.entities.Team.list(),
  });

  const myTeam = teams.find(t => t.id === profile?.team_id);
  const isSupervisor = myTeam?.is_supervisor_team === true;

  const managedTeamIds = (myTeam?.managed_team_ids || []);
  let managedTeams = managedTeamIds.map(id => teams.find(t => t.id === id)).filter(Boolean);
  if (managedTeams.length === 0) {
    managedTeams = teams.filter(t => t.category === 'field_ops' && !t.is_supervisor_team);
  }

  const { data: staff = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: () => base44.entities.Staff.list(),
    enabled: isSupervisor,
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list(),
    enabled: isSupervisor,
  });

  const { data: todayRotas = [] } = useQuery({
    queryKey: ['rotas-supervisor-today', todayStr],
    queryFn: () => base44.entities.RotaAssignment.filter({ assigned_date: todayStr }),
    enabled: isSupervisor,
  });

  const { data: todayLogs = [] } = useQuery({
    queryKey: ['investigation-logs-supervisor-today', todayStr],
    queryFn: () => base44.entities.InvestigationLog.filter({ date: todayStr }),
    enabled: isSupervisor,
  });

  if (teamsLoading) return <Skeleton className="h-48 w-full rounded-xl" />;

  // Build per-team production data
  const teamData = managedTeams.map(team => {
    const teamStaffIds = staff.filter(s => s.team_id === team.id).map(s => s.id);
    const teamRotas = todayRotas.filter(r => teamStaffIds.includes(r.staff_id));
    const teamJobIds = [...new Set(teamRotas.map(r => r.job_id))];
    const teamLogs = todayLogs.filter(l => teamJobIds.includes(l.job_id));
    const onSite = teamRotas.filter(r => r.status === 'started' || r.status === 'completed').length;
    const meterage = teamRotas.reduce((sum, r) => sum + (r.meterage || 0), 0);
    const samples = teamLogs.filter(l => l.sample_type && l.sample_type !== 'none').length;
    const totalDepth = teamLogs.reduce((sum, l) => {
      if (l.depth_from != null && l.depth_to != null) return sum + (l.depth_to - l.depth_from);
      return sum;
    }, 0);
    const isDrilling = team.job_type === 'cp_drilling' || team.job_type === 'rotary_drilling';
    return {
      team, isDrilling, memberCount: teamStaffIds.length, onSite,
      meterage, samples, totalDepth, logCount: teamLogs.length,
      activeJobs: teamJobIds.map(jid => jobs.find(j => j.id === jid)).filter(Boolean),
    };
  });

  // Summary totals
  const totalOnSite = teamData.reduce((s, t) => s + t.onSite, 0);
  const totalMeterage = teamData.reduce((s, t) => s + t.meterage, 0);
  const totalSamples = teamData.reduce((s, t) => s + t.samples, 0);
  const totalLogs = teamData.reduce((s, t) => s + t.logCount, 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 sm:px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 truncate">Supervisor Overview</h2>
            <p className="text-xs text-slate-400 truncate">{managedTeams.length} {managedTeams.length === 1 ? 'crew' : 'crews'} · {isSupervisor ? 'under your supervision' : 'across all teams'}</p>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {/* Summary row */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-5">
          {(() => {
            const stats = teamData.some(t => t.isDrilling)
              ? [
                  { label: 'On Site', value: totalOnSite, sub: `${teamData.reduce((s, t) => s + t.memberCount, 0)} crew`, icon: Users, gradient: 'stat-gradient-blue' },
                  { label: 'Metres Drilled', value: `${totalMeterage.toFixed(1)}m`, sub: 'today', icon: Ruler, gradient: 'stat-gradient-emerald' },
                  { label: 'Samples', value: totalSamples, sub: 'collected', icon: TestTube, gradient: 'stat-gradient-amber' },
                  { label: 'Jobs Live', value: [...new Set(teamData.flatMap(t => t.activeJobs.map(j => j.id)))].length, sub: 'active', icon: Briefcase, gradient: 'stat-gradient-rose' },
                ]
              : [
                  { label: 'On Site', value: totalOnSite, sub: `${teamData.reduce((s, t) => s + t.memberCount, 0)} crew`, icon: Users, gradient: 'stat-gradient-blue' },
                  { label: 'Log Entries', value: totalLogs, sub: 'today', icon: Package, gradient: 'stat-gradient-emerald' },
                  { label: 'Jobs Live', value: [...new Set(teamData.flatMap(t => t.activeJobs.map(j => j.id)))].length, sub: 'active', icon: Briefcase, gradient: 'stat-gradient-amber' },
                ];
            return stats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div key={i} className="bg-slate-50 border border-slate-100 rounded-xl p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
                  <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl ${stat.gradient} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">{stat.value}</p>
                    <p className="text-xs text-slate-500 font-medium">{stat.label}</p>
                    <p className="text-[11px] text-slate-400 truncate">{stat.sub}</p>
                  </div>
                </div>
              );
            });
          })()}
        </div>

        {/* Per-team cards */}
        {teamData.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm">
            <Users className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            No team activity to display
          </div>
        ) : (
        <div className="space-y-3">
          {teamData.map(({ team, isDrilling, memberCount, onSite, meterage, samples, totalDepth, logCount, activeJobs }) => (
            <div key={team.id} className="border border-slate-200 rounded-xl p-3.5">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="font-semibold text-slate-900 text-sm truncate">{team.name}</p>
                  {team.job_type && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${JOB_TYPE_COLORS[team.job_type] || JOB_TYPE_COLORS.depot}`}>
                      {JOB_TYPE_LABELS[team.job_type] || team.job_type}
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-500 flex-shrink-0">
                  <span className="font-bold text-slate-700">{onSite}</span>/{memberCount} on site
                </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                {isDrilling ? (
                  <>
                    {meterage > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                        <ArrowDownToLine className="w-3 h-3" /> {meterage.toFixed(1)}m drilled
                      </span>
                    )}
                    {samples > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-medium">
                        <TestTube className="w-3 h-3" /> {samples} sample{samples !== 1 ? 's' : ''}
                      </span>
                    )}
                    {totalDepth > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 font-medium">
                        <Ruler className="w-3 h-3" /> {totalDepth.toFixed(1)}m total depth
                      </span>
                    )}
                  </>
                ) : (
                  logCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">
                      <Package className="w-3 h-3" /> {logCount} log entr{logCount !== 1 ? 'ies' : 'y'}
                    </span>
                  )
                )}
                {activeJobs.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 font-medium truncate">
                    <Briefcase className="w-3 h-3" /> {activeJobs.map(j => j.name).join(', ')}
                  </span>
                )}
                {onSite === 0 && meterage === 0 && logCount === 0 && activeJobs.length === 0 && (
                  <span className="text-xs text-slate-400">No activity today</span>
                )}
              </div>
            </div>
          ))}
        </div>
        )}
      </div>
    </div>
  );
}