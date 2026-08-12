import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays, MapPin, Cog, Truck, Navigation, Clock, ChevronRight,
  Loader2, CalendarOff, ArrowRight,
} from 'lucide-react';

const STATUS_META = {
  assigned: { label: 'Assigned', tint: 'bg-blue-50 text-blue-700' },
  started: { label: 'Started', tint: 'bg-emerald-50 text-emerald-700' },
  completed: { label: 'Completed', tint: 'bg-slate-100 text-slate-600' },
};

/**
 * My Today — the field staff member's daily summary. Shows today's job
 * assignments with job name, location, rig, and shift status. Includes a
 * "View Full Schedule" button linking to the staff schedule page.
 */
export default function MyTodayTab({ staffProfile, allAssets = [] }) {
  const navigate = useNavigate();
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['my-today-rota', staffProfile?.id, today],
    queryFn: async () => {
      if (!staffProfile?.id) return [];
      const all = await base44.entities.RotaAssignment.filter({ staff_id: staffProfile.id, assigned_date: today });
      return all.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
    },
    enabled: !!staffProfile?.id,
  });

  const jobIds = [...new Set(assignments.map(a => a.job_id).filter(Boolean))];
  const { data: jobs = [] } = useQuery({
    queryKey: ['my-today-jobs', jobIds.join('|')],
    queryFn: async () => {
      if (jobIds.length === 0) return [];
      const all = await base44.entities.Job.list();
      return all.filter(j => jobIds.includes(j.id));
    },
    enabled: jobIds.length > 0,
  });

  const rigIds = [...new Set(assignments.map(a => a.rig_asset_id).filter(Boolean))];
  const rigs = allAssets.filter(a => rigIds.includes(a.id));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <CalendarOff className="w-10 h-10 text-slate-300" />
        </div>
        <p className="text-slate-500 font-medium text-base">No assignments today</p>
        <p className="text-slate-400 text-sm mt-1 mb-5">Your schedule will appear here once assigned</p>
        <button
          onClick={() => navigate('/staff-schedule')}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200 transition active:scale-95"
        >
          <CalendarDays className="w-4 h-4" /> View Full Schedule
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Date header */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <CalendarDays className="w-4 h-4" />
        <span className="font-semibold text-slate-700">{format(new Date(), 'EEEE, dd MMM yyyy')}</span>
      </div>

      {/* Assignment cards */}
      {assignments.map(a => {
        const job = jobs.find(j => j.id === a.job_id);
        const rig = rigs.find(r => r.id === a.rig_asset_id);
        const statusMeta = STATUS_META[a.status] || STATUS_META.assigned;
        const isNonJob = a.assignment_type !== 'job';

        return (
          <div key={a.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            {/* Status badge */}
            <div className="flex items-center justify-between mb-3">
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${statusMeta.tint}`}>
                {statusMeta.label}
              </span>
              {a.start_time && (
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {a.start_time}{a.end_time ? ` – ${a.end_time}` : ''}
                </span>
              )}
            </div>

            {/* Job info */}
            {isNonJob ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                  <CalendarOff className="w-5 h-5 text-slate-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{a.non_job_label || a.assignment_type}</p>
                  <p className="text-xs text-slate-400">Non-job day</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-emerald-700" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900">{job?.name || 'Unknown Job'}</p>
                    {job?.location && (
                      <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {job.location}
                      </p>
                    )}
                  </div>
                </div>

                {/* Rig info */}
                {rig && (
                  <div className="mt-3 flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                    <Cog className="w-4 h-4 text-slate-500" />
                    <span className="text-xs font-semibold text-slate-700">{rig.name}</span>
                    {rig.serial_number && (
                      <span className="text-[11px] text-slate-400 font-mono">· {rig.serial_number}</span>
                    )}
                    <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      rig.compliance_status === 'compliant' ? 'bg-emerald-50 text-emerald-700' :
                      rig.compliance_status === 'expired' ? 'bg-red-50 text-red-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {(rig.compliance_status || 'unknown').toUpperCase()}
                    </span>
                  </div>
                )}

                {/* Progress notes */}
                {a.progress_notes && (
                  <p className="text-xs text-slate-500 mt-2 italic">"{a.progress_notes}"</p>
                )}
              </>
            )}
          </div>
        );
      })}

      {/* View full schedule button */}
      <button
        onClick={() => navigate('/staff-schedule')}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#2E5A1A] text-white rounded-xl text-sm font-bold hover:bg-[#1c4a12] transition active:scale-95"
      >
        <CalendarDays className="w-4 h-4" /> View Full Schedule
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}