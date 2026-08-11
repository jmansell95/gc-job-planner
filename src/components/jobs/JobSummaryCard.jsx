import React from 'react';
import {
  MapPin, Calendar, CalendarClock, Users, Clock, Ruler, PoundSterling, Layers,
  FileText, Eye, Edit2, Copy, Trash2, FolderOpen, User, Phone, Mountain, Wrench, StickyNote,
} from 'lucide-react';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { getJobPrimaryType, getJobTypeColor, getJobTypeLabel } from '@/utils/jobTeams';
import DisciplinePills from '@/components/disciplines/DisciplinePills';

const statusBadge = {
  planning: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  in_progress: 'bg-[#2E5A1A]/15 text-[#2E5A1A] ring-1 ring-[#2E5A1A]/20',
  decommissioning: 'bg-orange-100 text-orange-700 ring-1 ring-orange-200',
  completed: 'bg-teal-100 text-teal-700 ring-1 ring-teal-200',
  on_hold: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200',
  cancelled: 'bg-red-100 text-red-700 ring-1 ring-red-200',
};
const statusLabels = {
  planning: 'Planning', in_progress: 'In Progress', decommissioning: 'Decommissioning',
  completed: 'Completed', on_hold: 'On Hold', cancelled: 'Cancelled',
};

const fmtDateShort = (d) => {
  try { return d ? format(parseISO(d), 'dd MMM') : '—'; } catch { return d || '—'; }
};
const calcDuration = (start, end) => {
  if (!start || !end) return null;
  try {
    const days = differenceInCalendarDays(parseISO(end), parseISO(start)) + 1;
    return days <= 0 ? 1 : days;
  } catch { return null; }
};

function DateBlock({ label, date, bg }) {
  const parts = fmtDateShort(date).split(' ');
  return (
    <div className={`flex flex-col items-center justify-center min-w-[48px] px-2 py-1.5 rounded-lg ${bg} text-white`}>
      <span className="text-[9px] font-semibold uppercase tracking-wider text-white/60 leading-none">{label}</span>
      <span className="text-sm font-bold leading-tight mt-0.5">{parts[0]}</span>
      <span className="text-[10px] font-medium text-white/80 leading-none">{parts[1] || ''}</span>
    </div>
  );
}

function DetailItem({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <Icon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
      <span className="text-[10px] text-slate-400 uppercase font-medium flex-shrink-0">{label}</span>
      <span className="text-slate-700 font-medium truncate">{value}</span>
    </div>
  );
}

export default function JobSummaryCard({
  job, client, project, siblingCount, crewCount, rigCount, jobTypes, teams, cloningId,
  onView, onEdit, onClone, onDelete, onProjectClick,
}) {
  const primaryType = getJobPrimaryType(job, teams);
  const colors = getJobTypeColor(primaryType, jobTypes);
  const duration = calcDuration(job.start_date, job.end_date);
  const isDrillingJob = ['cp', 'rotary', 'mixed'].includes(job.drilling_method);
  const methodLabel = { cp: 'CP', rotary: 'Rotary', mixed: 'Mixed' }[job.drilling_method] || '';
  const siteCount = Array.isArray(job.sites) ? job.sites.length : 0;

  return (
    <div className="card-modern rounded-xl overflow-hidden flex flex-col group">
      <div className={`h-1.5 ${colors.bar}`} />
      <div className="p-4 flex-1 space-y-2.5">
        {/* Badges */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${colors.badge}`}>{getJobTypeLabel(primaryType, jobTypes)}</span>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusBadge[job.status || 'planning']}`}>{statusLabels[job.status || 'planning']}</span>
            <DisciplinePills job={job} size="sm" />
          </div>
          {job.requisition_list_url && <FileText className="w-4 h-4 text-[#2E5A1A] flex-shrink-0 mt-0.5" title="Has requisition list" />}
        </div>

        {/* Title */}
        <h3 className="font-bold text-slate-900 text-base leading-tight line-clamp-2">{job.name}</h3>

        {/* Project + ref + client */}
        <div className="space-y-0.5">
          {project && (
            <button onClick={onProjectClick} className="flex items-center gap-1.5 hover:underline">
              <FolderOpen className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
              <span className="text-xs font-medium text-indigo-600 truncate">{project.name}</span>
              <span className="text-[10px] text-slate-400">· {siblingCount} job{siblingCount !== 1 ? 's' : ''}</span>
            </button>
          )}
          {job.job_reference && <p className="text-xs text-slate-400 truncate">Ref: {job.job_reference}</p>}
          {client && <p className="text-xs text-slate-400 truncate">{client.name}</p>}
        </div>

        {/* Location */}
        <div className="flex items-center gap-1.5 text-slate-500 text-sm">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">{job.location}</span>
          {siteCount > 1 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold flex-shrink-0">
              <Layers className="w-3 h-3" />{siteCount} sites
            </span>
          )}
        </div>

        {/* Date blocks */}
        <div className="flex items-stretch gap-2">
          <DateBlock label="Start" date={job.start_date} bg="bg-slate-900" />
          <DateBlock label="End" date={job.end_date} bg="bg-slate-700" />
          {duration != null && (
            <span className={`inline-flex items-center self-center text-xs font-bold px-2 py-0.5 rounded-full ${
              duration === 1 ? 'bg-blue-50 text-blue-700' :
              duration <= 7 ? 'bg-emerald-50 text-emerald-700' :
              duration <= 30 ? 'bg-amber-50 text-amber-700' :
              'bg-violet-50 text-violet-700'
            }`}>
              <CalendarClock className="w-3 h-3 mr-1" />{duration} {duration === 1 ? 'day' : 'days'}
            </span>
          )}
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs pt-0.5">
          {job.project_manager && <DetailItem icon={User} label="PM" value={job.project_manager} />}
          {job.site_contact_name && <DetailItem icon={Phone} label="Site" value={job.site_contact_name} />}
          {isDrillingJob && methodLabel && <DetailItem icon={Mountain} label="Method" value={methodLabel} />}
          {job.budget_amount != null && job.budget_amount > 0 && <DetailItem icon={PoundSterling} label="Budget" value={`£${Number(job.budget_amount).toLocaleString()}`} />}
          {job.meterage_target != null && job.meterage_target > 0 && <DetailItem icon={Ruler} label="Target" value={`${job.meterage_target}m`} />}
          {crewCount > 0 && <DetailItem icon={Users} label="Crew" value={`${crewCount} ${crewCount === 1 ? 'person' : 'people'}`} />}
          {rigCount > 0 && <DetailItem icon={Wrench} label="Rigs" value={`${rigCount} ${rigCount === 1 ? 'rig' : 'rigs'}`} />}
        </div>

        {/* Notes preview */}
        {job.notes && (
          <div className="flex items-start gap-1.5 text-xs text-slate-400 pt-1 border-t border-slate-100">
            <StickyNote className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <p className="line-clamp-2 break-words">{job.notes}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-2">
        <button onClick={() => onView(job)} className="flex items-center gap-1.5 text-sm font-medium text-[#2E5A1A] hover:text-[#1c4a12] transition">
          <Eye className="w-4 h-4" /> View Details
        </button>
        <div className="flex gap-1">
          <button onClick={() => onEdit(job)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Edit"><Edit2 className="w-4 h-4" /></button>
          <button onClick={() => onClone(job)} disabled={cloningId === job.id} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition disabled:opacity-50" title="Clone job"><Copy className="w-4 h-4" /></button>
          <button onClick={() => onDelete(job.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
}