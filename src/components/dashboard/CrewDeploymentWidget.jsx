import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import {
  Users, Truck, ChevronRight, AlertCircle, Warehouse,
  Clock, MapPin, PlayCircle, CheckCircle2,
} from 'lucide-react';
import WidgetShell from '@/components/dashboard/WidgetShell';
import { Skeleton } from '@/components/StateViews';

const statusConfig = {
  assigned: { label: 'Assigned', icon: Clock, cls: 'bg-slate-100 text-slate-600' },
  started: { label: 'Started', icon: PlayCircle, cls: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Done', icon: CheckCircle2, cls: 'bg-emerald-100 text-emerald-700' },
};

export default function CrewDeploymentWidget({ todaysRotas, staff, jobs, vehicles, onSelectJob, onNavigate }) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const { data: yardRotas = [] } = useQuery({
    queryKey: ['yard-rotas-merge', todayStr],
    queryFn: () => base44.entities.RotaAssignment.filter({
      assigned_date: todayStr,
      assignment_type: 'yard_depot',
    }),
  });

  const { data: conflicts = [] } = useQuery({
    queryKey: ['rota-conflicts-merge', todayStr],
    queryFn: () => base44.entities.RotaAssignment.filter({
      assigned_date: todayStr,
      has_conflict: true,
    }),
  });

  const staffMap = {};
  (staff || []).forEach(s => { staffMap[s.id] = s; });

  // Deduplicate field rota entries — one per staff per job
  const _seen = {};
  const fieldRotas = (todaysRotas || []).filter(r => {
    if (r.assignment_type && r.assignment_type !== 'job') return false;
    if (!r.assignment_type && !r.job_id) return false;
    const k = `${r.staff_id}|${r.job_id}`;
    if (_seen[k]) return false;
    _seen[k] = true;
    return true;
  });

  // Deduplicate — one entry per staff member (multiple yard rota rows = one person)
  const _yardSeen = new Set();
  const yardStaff = (yardRotas || []).filter(r => {
    if (!r.staff_id || _yardSeen.has(r.staff_id)) return false;
    _yardSeen.add(r.staff_id);
    return true;
  }).map(r => staffMap[r.staff_id]).filter(Boolean);
  const drivers = yardStaff.filter(s => {
    const title = (s.job_title || '').toLowerCase();
    return title.includes('driver') || title.includes('delivery') || title.includes('logistics');
  });
  const otherYardStaff = yardStaff.filter(s => !drivers.includes(s));

  const conflictStaff = (conflicts || []).map(c => staffMap[c.staff_id]).filter(Boolean);

  const isLoading = !todaysRotas || !staff;

  if (isLoading) {
    return (
      <WidgetShell icon={Users} title="Crew Deployment" subtitle="Loading…">
        <Skeleton className="h-48 rounded-xl" />
      </WidgetShell>
    );
  }

  return (
    <WidgetShell
      icon={Users}
      title="Crew Deployment"
      subtitle={`${fieldRotas.length} on jobs · ${yardStaff.length} on yard · ${conflictStaff.length} conflicts`}
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
      <div className="space-y-4">
        {/* Conflict warning */}
        {conflictStaff.length > 0 && (
          <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2.5 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              <strong>{conflictStaff.length} staff member{conflictStaff.length !== 1 ? 's' : ''}</strong> with rota conflicts today — double-booked between yard and a job.
            </span>
          </div>
        )}

        {/* Yard staff section */}
        {yardStaff.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Warehouse className="w-3.5 h-3.5 text-amber-600" />
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Yard / Depot</p>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">{yardStaff.length}</span>
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
              {otherYardStaff.map(s => (
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

        {/* Field crews section */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Truck className="w-3.5 h-3.5 text-emerald-600" />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">On Jobs</p>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-100 rounded-full px-2 py-0.5">{fieldRotas.length}</span>
          </div>
          {fieldRotas.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-2">No crews on site today</p>
          ) : (
            <div className="space-y-2 max-h-[320px] overflow-y-auto">
              {fieldRotas.map(r => {
                const member = staff.find(s => s.id === r.staff_id);
                const job = jobs.find(j => j.id === r.job_id);
                const status = statusConfig[r.status || 'assigned'] || statusConfig.assigned;
                const StatusIcon = status.icon;
                return (
                  <button
                    key={r.id}
                    onClick={() => job && onSelectJob?.(job)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border border-slate-100 hover:border-emerald-300 hover:bg-emerald-50/30 transition text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-xs">{member?.name?.charAt(0) || '?'}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 truncate">{member?.name || 'Unknown'}</p>
                      <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                        <MapPin className="w-3 h-3 flex-shrink-0" />{job?.name || '—'}
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${status.cls} flex-shrink-0`}>
                      <StatusIcon className="w-3 h-3" />{status.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </WidgetShell>
  );
}