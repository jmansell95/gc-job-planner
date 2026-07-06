import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Calendar, Briefcase, Truck, FileText, ExternalLink, Clock, CheckCircle2, PlayCircle, ClipboardCheck, Ruler, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import SitePhotoUpload from '@/components/SitePhotoUpload';
import { formatJobType } from '@/utils/format';

const jobTypeDot = {
  groundworks: 'bg-green-500',
  cp_drilling: 'bg-amber-500',
  rotary_drilling: 'bg-blue-500',
  enabling_works: 'bg-purple-500',
  depot: 'bg-slate-400'
};
const jobTypeAccent = {
  groundworks: 'bg-green-500',
  cp_drilling: 'bg-amber-500',
  rotary_drilling: 'bg-blue-500',
  enabling_works: 'bg-purple-500',
  depot: 'bg-slate-400'
};
const jobTypeBadgeColors = {
  groundworks: 'bg-green-100 text-green-700 ring-1 ring-green-200',
  cp_drilling: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200',
  rotary_drilling: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200',
  enabling_works: 'bg-purple-100 text-purple-700 ring-1 ring-purple-200',
  depot: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'
};
const statusConfig = {
  assigned: { label: 'Assigned', icon: Clock, badge: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200' },
  started: { label: 'In Progress', icon: PlayCircle, badge: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' },
  completed: { label: 'Completed', icon: CheckCircle2, badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' }
};

export default function AssignmentCard({ assignment, job, vehicle, client, staff, defaultExpanded = false, onStart, onComplete, onSign, meterage, onMeterageChange }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const status = statusConfig[assignment.status || 'assigned'] || statusConfig.assigned;
  const StatusIcon = status.icon;
  const isDriller = job?.job_type === 'cp_drilling' || job?.job_type === 'rotary_drilling';
  const accent = jobTypeAccent[job?.job_type] || jobTypeAccent.depot;
  const scheduledStart = new Date(assignment.assigned_date + 'T' + (assignment.start_time || '00:00:00'));
  const canStart = new Date() >= scheduledStart;
  if (!job) return null;

  return (
    <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } } }}
      className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className={`h-1.5 ${accent}`} />

      {/* Compact header — always visible */}
      <button onClick={() => setExpanded(e => !e)} className="w-full text-left p-4 flex items-center gap-3 hover:bg-slate-50/60 transition">
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${jobTypeDot[job.job_type] || 'bg-slate-400'}`} />
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-slate-900 leading-tight truncate">{job.name}</h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold ${jobTypeBadgeColors[job.job_type]}`}>{formatJobType(job.job_type)}</span>
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <Calendar className="w-3 h-3" /> {format(new Date(assignment.assigned_date), 'EEE, dd MMM')}
            </span>
            {assignment.start_time && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <Clock className="w-3 h-3" /> {assignment.start_time}{assignment.end_time ? `–${assignment.end_time}` : ''}
              </span>
            )}
            {vehicle && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <Truck className="w-3 h-3" /> <span className="font-mono font-semibold">{vehicle.registration_number}</span>
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${status.badge}`}>
            <StatusIcon className="w-3 h-3" /> <span className="hidden sm:inline">{status.label}</span>
          </span>
          {assignment.status === 'started' && assignment.started_at && (
            <span className="text-[10px] text-slate-400 hidden md:inline">since {format(new Date(assignment.started_at), 'HH:mm')}</span>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-100 pt-4">
          {/* Quick actions row */}
          <div className="flex flex-wrap gap-2 mb-4">
            {(assignment.status || 'assigned') === 'assigned' && (
              canStart ? (
                <button onClick={() => onStart(assignment.id)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 active:scale-95 transition text-sm font-semibold touch-manipulation">
                  <PlayCircle className="w-4 h-4" /> Start Job
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-500 rounded-xl text-xs font-semibold">
                  <Clock className="w-3.5 h-3.5" /> Starts {format(new Date(assignment.assigned_date + 'T00:00:00'), 'dd MMM')}{assignment.start_time ? ` · ${assignment.start_time}` : ''}
                </span>
              )
            )}
            {assignment.status === 'started' && (
              <div className="flex items-center gap-2 flex-wrap">
                {isDriller && (
                  <input type="number" min="0" step="0.1" placeholder="Meterage (m)"
                    value={meterage || ''}
                    onChange={e => onMeterageChange(assignment.id, e.target.value)}
                    className="w-32 px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
                )}
                <button onClick={() => onComplete(assignment.id)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 active:scale-95 transition text-sm font-semibold touch-manipulation">
                  <CheckCircle2 className="w-4 h-4" /> Complete
                </button>
              </div>
            )}
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div className="space-y-2">
              <div className="flex items-start gap-2 text-sm text-slate-600">
                <MapPin className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span className="break-words">{job.location}</span>
              </div>
              {client && (
                <div className="flex items-start gap-2 text-sm text-slate-600">
                  <Briefcase className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span>Client: <span className="font-medium text-slate-700">{client.name}</span></span>
                </div>
              )}
              {assignment.meterage != null && assignment.meterage > 0 && (
                <div className="flex items-center gap-2 text-sm text-amber-700">
                  <Ruler className="w-4 h-4" /> {assignment.meterage}m recorded
                </div>
              )}
            </div>
            <div className="space-y-2">
              {job.requisition_list_url && (
                <a href={job.requisition_list_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-between gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100 hover:bg-emerald-100 transition group">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span className="font-semibold text-emerald-900 text-sm truncate">{job.requisition_list_name || 'Requisition List'}</span>
                  </div>
                  <ExternalLink className="w-4 h-4 text-emerald-600 flex-shrink-0 group-hover:translate-x-0.5 transition" />
                </a>
              )}
              {job.notes && (
                <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100">
                  <p className="font-semibold text-slate-900 text-xs mb-1">Notes</p>
                  <p className="text-slate-600 text-sm whitespace-pre-wrap leading-relaxed">{job.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Briefing + photos */}
          <div className="pt-3 border-t border-slate-100 space-y-3">
            {assignment.briefing_signed ? (
              <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50/50 rounded-lg px-3 py-2">
                <ClipboardCheck className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium">Briefing signed off</span>
                {assignment.briefing_signed_at && (
                  <span className="text-xs text-slate-400 ml-auto">{format(new Date(assignment.briefing_signed_at), 'dd MMM HH:mm')}</span>
                )}
              </div>
            ) : (
              <button onClick={() => onSign(assignment.id)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl hover:bg-slate-900 active:scale-95 transition text-sm font-medium w-full sm:w-auto touch-manipulation">
                <ClipboardCheck className="w-4 h-4" /> Sign Off Job Briefing
              </button>
            )}
            <SitePhotoUpload jobId={job.id} staffName={staff.name} />
          </div>
        </div>
      )}
    </motion.div>
  );
}