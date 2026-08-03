import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Users, Phone, Mail, Trophy, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton, EmptyState } from '@/components/StateViews';
import ProfileAvatar from '@/components/ui/ProfileAvatar';
import StaffProgressModal from '@/components/staff/StaffProgressModal';

function getWeekStart(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return format(d, 'yyyy-MM-dd');
}

export default function TeamMiniFeed({ teamId, currentStaffId }) {
  const [selectedMember, setSelectedMember] = useState(null);
  const weekStart = getWeekStart();

  const { data: allStaff = [], isLoading: staffLoading } = useQuery({
    queryKey: ['staff'],
    queryFn: () => base44.entities.Staff.list()
  });
  const teamMembers = allStaff.filter(s => s.team_id === teamId && s.is_active !== false);

  const { data: crewScores = [] } = useQuery({
    queryKey: ['incentive-scores', teamId, weekStart],
    queryFn: () => base44.entities.IncentiveScore.filter({ team_id: teamId, week_start: weekStart }, '-total_points', 50),
    enabled: !!teamId,
  });

  const scoreMap = new Map(crewScores.map(s => [s.staff_id, s]));
  const topScorer = crewScores.length > 0 ? crewScores[0] : null;

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-6 shadow-sm">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <Users className="w-4 h-4 text-emerald-700" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">My Crew</h2>
          {topScorer && (
            <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
              <Trophy className="w-3 h-3" />
              {topScorer.staff_name?.split(' ')[0]} leading
            </span>
          )}
        </div>

        {staffLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
          </div>
        ) : teamMembers.length === 0 ? (
          <EmptyState icon={Users} title="No crew members" message="You're not part of a crew yet." />
        ) : (
          <div className="space-y-2">
            {teamMembers.map(m => {
              const score = scoreMap.get(m.id);
              const isTop = topScorer && topScorer.staff_id === m.id && (score?.total_points || 0) > 0;
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedMember({ staffId: m.id, staffName: m.name })}
                  className="w-full flex items-center gap-3 bg-slate-50 hover:bg-slate-100 rounded-xl px-3 py-2.5 transition group text-left"
                >
                  <div className="relative flex-shrink-0">
                    <ProfileAvatar name={m.name} avatarUrl={m.avatar_url} size={36} />
                    {isTop && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center ring-2 ring-white">
                        <Trophy className="w-2.5 h-2.5 text-white" />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {m.name}
                      {m.id === currentStaffId && <span className="text-xs text-emerald-600 ml-1.5">(you)</span>}
                    </p>
                    <div className="flex items-center gap-2">
                      {score ? (
                        <span className="text-xs text-slate-500 tabular-nums">
                          {score.total_points || 0} pts · {(score.total_metres || 0).toFixed(0)}m
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">No score yet</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition flex-shrink-0" />
                </button>
              );
            })}
            <p className="text-xs text-slate-400 text-center pt-2">
              Tap a crew member to view their weekly progress & badges
            </p>
          </div>
        )}
      </div>

      {selectedMember && (
        <StaffProgressModal
          staffId={selectedMember.staffId}
          staffName={selectedMember.staffName}
          teamId={teamId}
          weekStart={weekStart}
          onClose={() => setSelectedMember(null)}
        />
      )}
    </>
  );
}