import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Calendar, Briefcase, Truck, FileText, ExternalLink, Clock, CheckCircle2, PlayCircle, ClipboardCheck, Ruler, ChevronDown, Camera, ShieldCheck, MessageSquare, XCircle, PauseCircle } from 'lucide-react';
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

export default function AssignmentCard({ assignment, job, vehicle, client, staff, defaultExpanded = false, onStart, onComplete, onSign, meterage, onMeterageChange, tasksSubmitted = false, needsBriefing = false, previousProgress = [], onConfirmShift, onDeclineShift }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [progressNote, setProgressNote] = useState(assignment.progress_notes || '');
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

      {job.status === 'on_hold' && (
        <div className="flex items-start gap-2 bg-amber-50 border-b border-amber-100 px-4 py-2.5">
          <PauseCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-800">This job is on hold</p>
            <p className="text-[11px] text-amber-700 mt-0.5">Do not start work until management confirms it has resumed. {job.status_reason ? `Reason: ${job.status_reason}` : ''}</p>
          </div>
        </div>
      )}

      {/* Compact header — always visible */}
      <button onClick={() => setExpanded(e => !e)} className="w-full text-left p-4 flex items-center gap-3 hover:bg-slate-50/60 transition">
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${jobTypeDot[job.job_type] || 'bg-slate-400'}`} />
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-slate-900 leading-tight truncate">{job.name}</h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold ${jobTypeBadgeColors[job.job_type]}`}>{formatJobType(job.job_type)}</span>
            {assignment.is_overtime && (
              <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-700 ring-1 ring-amber-200">
                Overtime{assignment.rate_multiplier ? ` · ${Number(assignment.rate_multiplier)}x` : ''}
              </span>
            )}
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
          {assignment.shift_status === 'confirmed' && (
            <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium ring-1 ring-emerald-200">
              <CheckCircle2 className="w-3 h-3" /> Confirmed
            </span>
          )}
          {assignment.shift_status === 'declined' && (
            <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 font-medium ring-1 ring-red-200">
              <XCircle className="w-3 h-3" /> Declined
            </span>
          )}
          {assignment.status === 'started' && assignment.started_at && (
            <span className="text-[10px] text-slate-400 hidden md:inline">since {format(new Date(assignment.started_at), 'HH:mm')}</span>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-100 pt-4">
          {/* Shift confirmation */}
          {(assignment.status || 'assigned') === 'assigned' && (!assignment.shift_status || assignment.shift_status === 'pending') && (
            <div className="flex items-center gap-2 mb-4 bg-slate-50 rounded-xl px-3.5 py-2.5 border border-slate-200">
              <span className="text-xs text-slate-500 font-medium flex-1">Can you make this shift?</span>
              <button onClick={() => onConfirmShift?.(assignment.id)}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 active:scale-95 transition touch-manipulation">
                <CheckCircle2 className="w-3.5 h-3.5" /> Confirm
              </button>
              <button onClick={() => onDeclineShift?.(assignment.id)}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 active:scale-95 transition touch-manipulation">
                <XCircle className="w-3.5 h-3.5" /> Decline
              </button>
            </div>
          )}

          {/* Quick actions row */}
          <div className="flex flex-wrap gap-2 mb-4">
            {(assignment.status || 'assigned') === 'assigned' && (
              canStart ? (
                <button onClick={() => onStart(assignment.id)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 active:scale-95 transition text-sm font-semibold touch-manipulation">
                  <PlayCircle className="w-4 h-4" /> Start Job{needsBriefing ? ' · Briefing' : ''}
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-500 rounded-xl text-xs font-semibold">
                  <Clock className="w-3.5 h-3.5" /> Starts {format(new Date(assignment.assigned_date + 'T00:00:00'), 'dd MMM')}{assignment.start_time ? ` · ${assignment.start_time}` : ''}
                </span>
              )
            )}
            {assignment.status === 'started' && (
              <div className="flex items-center gap-2 flex-wrap w-full">
                {isDriller && (
                  <input type="number" min="0" step="0.1" placeholder="Meterage (m)"
                    value={meterage || ''}
                    onChange={e => onMeterageChange(assignment.id, e.target.value)}
                    className="w-32 px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
                )}
                <button onClick={() => onComplete(assignment.id, { progress_notes: progressNote.trim() })}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 active:scale-95 transition text-sm font-semibold touch-manipulation ml-auto">
                  <CheckCircle2 className="w-4 h-4" /> Complete Shift
                </button>
              </div>
            )}
          </div>

          {/* Progress notes — for multi-day jobs */}
          {assignment.status === 'started' && (
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-600 mb-1.5">End-of-shift progress notes (optional)</label>
              <textarea value={progressNote} onChange={e => setProgressNote(e.target.value)} rows={2} placeholder="What was done today? What's left for the next shift?"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 resize-none" />
            </div>
          )}

          {/* Previous shift progress */}
          {previousProgress.length > 0 && (
            <div className="mb-4 bg-slate-50 rounded-xl border border-slate-200 p-3.5">
              <div className="flex items-center gap-1.5 mb-2">
                <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Previous Shifts</p>
              </div>
              <div className="space-y-2">
                {previousProgress.map((p, i) => (
                  <div key={i} className="text-sm">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium text-slate-500">{format(new Date(p.date + 'T00:00:00'), 'dd MMM')}</span>
                      <span className="text-xs text-slate-400">· {p.staffName}</span>
                    </div>
                    <p className="text-slate-600 text-xs leading-relaxed">{p.notes}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

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

          {/* Briefing status + photos */}
          <div className="pt-3 border-t border-slate-100 space-y-3">
            {assignment.briefing_signed ? (
              <div className="bg-emerald-50/50 rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-2 text-sm text-emerald-700">
                  <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                  <span className="font-medium">Briefing completed</span>
                  {assignment.briefing_signed_at && (
                    <span className="text-xs text-slate-400 ml-auto">{format(new Date(assignment.briefing_signed_at), 'dd MMM yyyy, HH:mm')}</span>
                  )}
                </div>
                {assignment.briefing_start_at && assignment.briefing_signed_at && (
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 pl-6">
                    <span>Start: {format(new Date(assignment.briefing_start_at), 'HH:mm')}</span>
                    <span>End: {format(new Date(assignment.briefing_signed_at), 'HH:mm')}</span>
                    <span className="font-medium text-slate-600">Duration: {Math.round((new Date(assignment.briefing_signed_at) - new Date(assignment.briefing_start_at)) / 60000)}m</span>
                  </div>
                )}
              </div>
            ) : needsBriefing ? (
              <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2.5">
                <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium">Site briefing required — tap "Start Job" to begin.</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                <ShieldCheck className="w-4 h-4 flex-shrink-0 text-slate-400" />
                <span>Briefing completed on a previous shift.</span>
              </div>
            )}
            {assignment.progress_notes && assignment.status === 'completed' && (
              <div className="bg-slate-50 rounded-lg px-3 py-2.5 text-sm">
                <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Shift Progress Notes</p>
                <p className="text-slate-600 text-xs leading-relaxed">{assignment.progress_notes}</p>
              </div>
            )}
            {tasksSubmitted ? (
              <SitePhotoUpload jobId={job.id} staffName={staff.name} />
            ) : (
              <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2.5">
                <Camera className="w-4 h-4 flex-shrink-0" />
                <span>Site photos unlock after you submit your daily tasks.</span>
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}