import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Trophy, Crown, Medal } from 'lucide-react';
import { format } from 'date-fns';
import ProfileAvatar from '@/components/ui/ProfileAvatar';
import { Skeleton } from '@/components/StateViews';

export default function CrewLeaderboard({ teamId, currentStaffId, weekStart, onSelectMember }) {
  const { data: scores = [], isLoading } = useQuery({
    queryKey: ['incentive-scores', teamId, weekStart],
    queryFn: () => base44.entities.IncentiveScore.filter({ team_id: teamId, week_start: weekStart }, '-total_points', 50),
    enabled: !!teamId && !!weekStart,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
      </div>
    );
  }

  if (!scores.length) {
    return (
      <div className="text-center py-6 text-sm text-slate-400">
        No scores yet this week. Be the first to log work and claim the top spot!
      </div>
    );
  }

  const sorted = [...scores].sort((a, b) => (b.total_points || 0) - (a.total_points || 0));

  const rankIcon = (rank) => {
    if (rank === 1) return <Crown className="w-4 h-4 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-4 h-4 text-slate-400" />;
    if (rank === 3) return <Medal className="w-4 h-4 text-amber-600" />;
    return <span className="text-xs font-bold text-slate-400 tabular-nums">{rank}</span>;
  };

  const rankBg = (rank) => {
    if (rank === 1) return 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200';
    if (rank === 2) return 'bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200';
    if (rank === 3) return 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200';
    return 'bg-white border-slate-200';
  };

  return (
    <div className="space-y-2">
      {sorted.map((s, i) => {
        const rank = s.rank_in_crew || i + 1;
        const isMe = s.staff_id === currentStaffId;
        return (
          <button
            key={s.id}
            onClick={() => onSelectMember && onSelectMember(s.staff_id, s.staff_name)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition hover:shadow-md ${rankBg(rank)} ${isMe ? 'ring-2 ring-emerald-500' : ''}`}
          >
            <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
              {rankIcon(rank)}
            </div>
            <ProfileAvatar name={s.staff_name} size={36} className="flex-shrink-0" />
            <div className="min-w-0 flex-1 text-left">
              <p className="text-sm font-semibold text-slate-900 truncate">
                {s.staff_name}
                {isMe && <span className="text-xs text-emerald-600 ml-1.5">(you)</span>}
              </p>
              <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                <span className="tabular-nums">{(s.total_metres || 0).toFixed(1)}m</span>
                <span className="tabular-nums">{s.days_worked || 0}d</span>
                <span className="tabular-nums">{s.boreholes_worked || 0} BH</span>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-lg font-bold text-emerald-700 tabular-nums">{s.total_points || 0}</p>
              <p className="text-[10px] text-slate-400 font-medium">pts</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}