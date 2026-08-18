import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useScopedEntity } from '@/hooks/useScopedEntity';
import { User, Mail, Phone, Wrench } from 'lucide-react';
import { Skeleton } from '@/components/StateViews';

/**
 * Card-grid directory of all active staff with avatars, role, team,
 * and a compliance status dot. Replaces the flat list with a visual
 * overview for quick identification.
 */
export default function StaffDirectoryGrid({ onSelect }) {
  const { data: staff = [], isLoading } = useScopedEntity('Staff', { queryKey: ['staff-directory'], filter: { is_active: true }, sort: 'name' });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => base44.entities.Team.list(),
  });

  const teamMap = React.useMemo(() => {
    const m = {};
    teams.forEach(t => { m[t.id] = t; });
    return m;
  }, [teams]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {staff.map(s => {
        const team = teamMap[s.team_id];
        const initials = (s.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
        return (
          <button
            key={s.id}
            onClick={() => onSelect?.(s)}
            className="text-left bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md hover:border-slate-300 transition group"
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-11 h-11 rounded-full bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center text-white font-bold text-sm shadow-sm">
                {s.avatar_url ? (
                  <img src={s.avatar_url} alt={s.name} className="w-full h-full rounded-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-[#2E5A1A] transition">
                  {s.name}
                </p>
                <p className="text-xs text-slate-500 truncate">{s.job_title || 'Staff'}</p>
                {team && (
                  <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                    <Wrench className="w-2.5 h-2.5" />
                    {team.name || team.team_name || 'Team'}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-50">
              {s.email && (
                <span className="flex items-center gap-1 text-[11px] text-slate-400 truncate">
                  <Mail className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{s.email}</span>
                </span>
              )}
              {s.phone && (
                <span className="flex items-center gap-1 text-[11px] text-slate-400 truncate">
                  <Phone className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{s.phone}</span>
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}