import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, Calendar, Clock, Truck, PlayCircle, Briefcase, ChevronRight, CheckCircle2, Ruler } from 'lucide-react';
import { format } from 'date-fns';
import { formatJobType } from '@/utils/format';

const jobTypeAccent = {
  groundworks: 'from-green-500 to-emerald-600',
  cp_drilling: 'from-amber-500 to-orange-600',
  rotary_drilling: 'from-blue-500 to-indigo-600',
  enabling_works: 'from-purple-500 to-fuchsia-600',
  depot: 'from-slate-500 to-slate-600'
};

export default function NextJobCard({ assignment, job, vehicle, client, onStart, onComplete, canStart, meterage, onMeterageChange }) {
  if (!job) return null;
  const accent = jobTypeAccent[job.job_type] || jobTypeAccent.depot;
  const isDriller = job.job_type === 'cp_drilling' || job.job_type === 'rotary_drilling';

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className={`rounded-3xl bg-gradient-to-br ${accent} text-white shadow-lg overflow-hidden`}>
      <div className="p-5 md:p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm text-[11px] font-bold uppercase tracking-wide">
            {canStart ? 'Ready to start' : 'Next up'}
          </span>
          {client && (
            <span className="inline-flex items-center gap-1 text-xs text-white/80">
              <Briefcase className="w-3 h-3" /> {client.name}
            </span>
          )}
        </div>

        <h2 className="text-2xl md:text-3xl font-extrabold leading-tight mb-3 break-words">{job.name}</h2>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/90 mb-4">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="w-4 h-4" /> {format(new Date(assignment.assigned_date), 'EEEE, dd MMM')}
          </span>
          {assignment.start_time && (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-4 h-4" /> {assignment.start_time}{assignment.end_time ? ` – ${assignment.end_time}` : ''}
            </span>
          )}
          <span className="inline-flex items-start gap-1.5 max-w-full">
            <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" /> <span className="break-words">{job.location}</span>
          </span>
          {vehicle && (
            <span className="inline-flex items-center gap-1.5">
              <Truck className="w-4 h-4" /> <span className="font-mono font-bold">{vehicle.registration_number}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {(assignment.status || 'assigned') === 'assigned' && canStart && (
            <button onClick={() => onStart(assignment.id)}
              className="flex items-center gap-2 px-5 py-3 bg-white text-slate-900 rounded-xl font-bold text-sm hover:bg-white/90 active:scale-95 transition touch-manipulation shadow-md">
              <PlayCircle className="w-5 h-5" /> Start Job
            </button>
          )}
          {(assignment.status || 'assigned') === 'assigned' && !canStart && (
            <span className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/15 rounded-xl text-sm font-semibold">
              <Clock className="w-4 h-4" /> Starts {format(new Date(assignment.assigned_date + 'T00:00:00'), 'dd MMM')}{assignment.start_time ? ` · ${assignment.start_time}` : ''}
            </span>
          )}
          {assignment.status === 'started' && (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/15 rounded-xl text-sm font-semibold">
                <PlayCircle className="w-4 h-4" /> In progress since {assignment.started_at ? format(new Date(assignment.started_at), 'HH:mm') : ''}
              </span>
              {isDriller && (
                <input type="number" min="0" step="0.1" placeholder="Meterage (m)"
                  value={meterage || ''}
                  onChange={e => onMeterageChange(assignment.id, e.target.value)}
                  className="w-32 px-3 py-2.5 bg-white/90 text-slate-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-white/50 placeholder:text-slate-400" />
              )}
              <button onClick={() => onComplete(assignment.id)}
                className="flex items-center gap-2 px-5 py-3 bg-white text-slate-900 rounded-xl font-bold text-sm hover:bg-white/90 active:scale-95 transition touch-manipulation shadow-md">
                <CheckCircle2 className="w-5 h-5" /> Complete Job
              </button>
            </div>
          )}
          {assignment.status === 'completed' && (
            <span className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/15 rounded-xl text-sm font-semibold">
              <CheckCircle2 className="w-4 h-4" /> Completed
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}