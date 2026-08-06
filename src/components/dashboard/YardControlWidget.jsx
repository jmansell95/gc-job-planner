import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Warehouse, Truck, ChevronRight, UserPlus, AlertCircle } from 'lucide-react';
import WidgetShell from '@/components/dashboard/WidgetShell';
import { Skeleton } from '@/components/StateViews';

export default function YardControlWidget({ onNavigate }) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const { data: yardRotas = [], isLoading } = useQuery({
    queryKey: ['yard-rotas-today', todayStr],
    queryFn: () => base44.entities.RotaAssignment.filter({
      assigned_date: todayStr,
      assignment_type: 'yard_depot',
    }),
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: () => base44.entities.Staff.list(),
  });

  const { data: conflicts = [] } = useQuery({
    queryKey: ['rota-conflicts-today', todayStr],
    queryFn: () => base44.entities.RotaAssignment.filter({
      assigned_date: todayStr,
      has_conflict: true,
    }),
  });

  const staffMap = {};
  (staff || []).forEach(s => { staffMap[s.id] = s; });

  const yardStaff = yardRotas
    .map(r => staffMap[r.staff_id])
    .filter(Boolean);

  // Identify drivers: staff with job_title containing 'driver' or 'delivery' or 'logistics'
  const drivers = yardStaff.filter(s => {
    const title = (s.job_title || '').toLowerCase();
    return title.includes('driver') || title.includes('delivery') || title.includes('logistics');
  });
  const otherStaff = yardStaff.filter(s => !drivers.includes(s));

  const conflictStaff = conflicts
    .map(c => staffMap[c.staff_id])
    .filter(Boolean);

  if (isLoading) {
    return (
      <WidgetShell icon={Warehouse} title="Yard Control" subtitle="Loading…">
        <Skeleton className="h-32 rounded-xl" />
      </WidgetShell>
    );
  }

  return (
    <WidgetShell
      icon={Warehouse}
      title="Yard Control"
      subtitle={`${yardStaff.length} on the bench · ${drivers.length} drivers available`}
      action={onNavigate && (
        <button
          onClick={() => onNavigate('scheduling')}
          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100"
        >
          Rota Builder
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    >
      {/* Conflict warning */}
      {conflictStaff.length > 0 && (
        <div className="mb-3 flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2.5 text-xs text-rose-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            <strong>{conflictStaff.length} staff member{conflictStaff.length !== 1 ? 's' : ''}</strong> with rota conflicts today — double-booked between yard and a job. Resolve in the Rota Builder.
          </span>
        </div>
      )}

      {yardStaff.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-8">
          <Warehouse className="w-10 h-10 text-slate-200 mb-2" />
          <p className="text-sm font-medium text-slate-400">No one on the bench today</p>
          <p className="text-xs text-slate-300 mt-1">All staff are assigned to jobs or off duty</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Drivers section */}
          {drivers.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Truck className="w-3.5 h-3.5 text-amber-600" />
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Drivers Available</p>
                <span className="text-xs font-bold text-amber-600 bg-amber-100 rounded-full px-2 py-0.5">{drivers.length}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {drivers.map(s => (
                  <div key={s.id} className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-bold text-[10px]">
                      {s.name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-700 leading-tight">{s.name}</p>
                      {s.job_title && <p className="text-[10px] text-slate-400 leading-tight">{s.job_title}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Other yard staff */}
          {otherStaff.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <UserPlus className="w-3.5 h-3.5 text-slate-400" />
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Yard / Depot Staff</p>
                <span className="text-xs font-bold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">{otherStaff.length}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {otherStaff.map(s => (
                  <div key={s.id} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center text-white font-bold text-[10px]">
                      {s.name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-700 leading-tight">{s.name}</p>
                      {s.job_title && <p className="text-[10px] text-slate-400 leading-tight">{s.job_title}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary footer */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <p className="text-xs text-slate-400">
              {yardStaff.length} available for reassignment
            </p>
            {onNavigate && (
              <button
                onClick={() => onNavigate('scheduling')}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition inline-flex items-center gap-0.5"
              >
                Assign to job <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}
    </WidgetShell>
  );
}