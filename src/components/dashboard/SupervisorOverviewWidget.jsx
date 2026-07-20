import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Shield, ArrowDownToLine, TestTube, Users, MapPin, Package, Ruler, Briefcase, Construction } from 'lucide-react';
import { Skeleton } from '@/components/StateViews';
import StatCard from '@/components/dashboard/StatCard';

const JOB_TYPE_LABELS = {
  groundworks: 'Groundworks', coring: 'Coring', trial_pit: 'Trial Pit',
  cp_drilling: 'CP Drilling', rotary_drilling: 'Rotary Drilling',
  enabling_works: 'Enabling Works', depot: 'Depot'
};

const JOB_TYPE_COLORS = {
  groundworks: 'bg-emerald-100 text-emerald-700',
  coring: 'bg-teal-100 text-teal-700',
  trial_pit: 'bg-lime-100 text-lime-700',
  cp_drilling: 'bg-amber-100 text-amber-700',
  rotary_drilling: 'bg-blue-100 text-blue-700',
  enabling_works: 'bg-purple-100 text-purple-700',
  depot: 'bg-slate-100 text-slate-600',
};

export default function SupervisorOverviewWidget({ profile }) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Always fetch — we need teams to resolve which crews this person supervises,
  // and the underlying data regardless of role. The queries are cheap.
  const { data: teams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: () => base44.entities.Team.list(),
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: () => base44.entities.Staff.list(),
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list(),
  });

  const { data: todayRotas = [] } = useQuery({
    queryKey: ['rotas-supervisor-today', todayStr],
    queryFn: () => base44.entities.RotaAssignment.filter({ assigned_date: todayStr }),
  });

  const { data: todayLogs = [] } = useQuery({
    queryKey: ['investigation-logs-supervisor-today', todayStr],
    queryFn: () => base44.entities.InvestigationLog.filter({ date: todayStr }),
  });

  // Resolve which teams this person supervises. Priority:
  // 1. Their team's managed_team_ids (explicit supervisor team link).
  // 2. Any team where supervisor_staff_id points at this staff member.
  // 3. Fallback: all non-supervisor field-ops teams (for admins/managers without
  //    an explicit link — gives them a live overview of field production).
  const myTeam = teams.find(t => t.id === profile?.team_id);
  const isSupervisor = myTeam?.is_supervisor_team === true;
  const isAdmin = profile?.system_role === 'admin' || profile?.system_role === 'manager';

  let managedTeams = [];
  if (isSupervisor && myTeam?.managed_team_ids?.length) {
    managedTeams = myTeam.managed_team_ids
      .map(id => teams.find(t => t.id === id))
      .filter(Boolean);
  }
  if (managedTeams.length === 0 && profile?.id) {
    const linked = teams.filter(t => t.supervisor_staff_id === profile.id);
    if (linked.length) managedTeams = linked;
  }
  if (managedTeams.length === 0 && (isSupervisor || isAdmin)) {
    managedTeams = teams.filter(t =>
      t.category === 'field_ops' && !t.is_supervisor_team && !t.parent_team_id
    );
  }

  // Deduplicate
  const managedIds = new Set(managedTeams.map(t => t.id));
  managedTeams = teams.filter(t => managedIds.has(t.id));

  const showWidget = managedTeams.length > 0;

  if (teamsLoading) return <Skeleton className="h-48 w-full rounded-xl" />;
  if (!showWidget) return null;

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
    const isDrilling = team.job_type === 'cp_drilling' || team.job_type === 'rotary_drilling' || team.job_type === 'coring';
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
  const totalCrew = teamData.reduce((s, t) => s + t.memberCount, 0);
  const activeJobCount = [...new Set(teamData.flatMap(t => t.activeJobs.map(j => j.id)))].length;

  const hasDrilling = teamData.some(t => t.isDrilling);

  const stats = hasDrilling
    ? [
        { label: 'On Site', value: totalOnSite, sub: `${totalCrew} crew assigned`, icon: Users, gradient: 'stat-gradient-blue' },
        { label: 'Metres Drilled', value: `${totalMeterage.toFixed(1)}m`, sub: 'today', icon: ArrowDownToLine, gradient: 'stat-gradient-emerald' },
        { label: 'Samples', value: totalSamples, sub: 'collected', icon: TestTube, gradient: 'stat-gradient-amber' },
        { label: 'Jobs Live', value: activeJobCount, sub: 'active', icon: Briefcase, gradient: 'stat-gradient-rose' },
      ]
    : [
        { label: 'On Site', value: totalOnSite, sub: `${totalCrew} crew assigned`, icon: Users, gradient: 'stat-gradient-blue' },
        { label: 'Log Entries', value: totalLogs, sub: 'today', icon: Package, gradient: 'stat-gradient-emerald' },
        { label: 'Jobs Live', value: activeJobCount, sub: 'active', icon: Briefcase, gradient: 'stat-gradient-amber' },
      ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 sm:px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 shadow-sm">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900 truncate">Supervisor Overview</h2>
            <p className="text-xs text-slate-400 truncate">
              {managedTeams.length} {managedTeams.length === 1 ? 'crew' : 'crews'} · live production today
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-5">
          {stats.map((stat, i) => (
            <StatCard key={i} icon={stat.icon} value={stat.value} label={stat.label} sub={stat.sub} gradient={stat.gradient} />
          ))}
        </div>

        {/* Per-team cards */}
        <div className="space-y-2.5">
          {teamData.map(({ team, isDrilling, memberCount, onSite, meterage, samples, totalDepth, logCount, activeJobs }) => (
            <div key={team.id} className="border border-slate-200 rounded-xl p-3.5 hover:border-emerald-200 hover:shadow-sm transition">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="font-semibold text-slate-900 text-sm truncate">{team.name}</p>
                  {team.job_type && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${JOB_TYPE_COLORS[team.job_type] || JOB_TYPE_COLORS.depot}`}>
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
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                        <Ruler className="w-3 h-3" /> {totalDepth.toFixed(1)}m depth
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
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium truncate max-w-full">
                    <Construction className="w-3 h-3 flex-shrink-0" /> {activeJobs.map(j => j.name).join(', ')}
                  </span>
                )}
                {onSite === 0 && meterage === 0 && logCount === 0 && activeJobs.length === 0 && (
                  <span className="text-xs text-slate-400">No activity today</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}