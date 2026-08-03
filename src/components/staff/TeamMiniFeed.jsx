import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Users, Phone, Mail } from 'lucide-react';
import { Skeleton, EmptyState } from '@/components/StateViews';

export default function TeamMiniFeed({ teamId, currentStaffId }) {
  const { data: allStaff = [], isLoading: staffLoading } = useQuery({
    queryKey: ['staff'],
    queryFn: () => base44.entities.Staff.list()
  });
  const teamMembers = allStaff.filter(s => s.team_id === teamId && s.is_active !== false);

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
                  {m.phone && (
                    <a href={`tel:${m.phone}`} className="text-xs text-emerald-600 truncate flex items-center gap-1 hover:underline">
                      <Phone className="w-3 h-3 flex-shrink-0" /> {m.phone}
                    </a>
                  )}
                </div>
                {m.phone && (
                  <a href={`tel:${m.phone}`} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition flex-shrink-0">
                    <Phone className="w-4 h-4" />
                  </a>
                )}
                {m.email && (
                  <a href={`mailto:${m.email}`} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition flex-shrink-0">
                    <Mail className="w-4 h-4" />
                  </a>
                )}
              </div>
            ))}
          </div>

        </div>
      )}
    </div>
  );
}