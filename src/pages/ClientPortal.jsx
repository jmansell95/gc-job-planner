import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Calendar, MapPin, CheckCircle2, Clock, PlayCircle, Briefcase, Building2, Activity, Ruler, Camera, FileText, Target, Download, CheckCircle, Circle } from 'lucide-react';
import { format } from 'date-fns';

const jobTypeBadges = {
  groundworks: 'bg-green-100 text-green-700',
  cp_drilling: 'bg-amber-100 text-amber-700',
  rotary_drilling: 'bg-blue-100 text-blue-700',
  enabling_works: 'bg-purple-100 text-purple-700',
  depot: 'bg-slate-100 text-slate-700'
};

const statusLabels = {
  planning: 'Planning', in_progress: 'In Progress', completed: 'Completed', on_hold: 'On Hold'
};

const statusColors = {
  planning: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-teal-100 text-teal-700',
  on_hold: 'bg-amber-100 text-amber-700'
};

export default function ClientPortal() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadJob() {
      try {
        const response = await base44.functions.invoke('getJobByPortalToken', { portal_token: token });
        setData(response.data);
      } catch (err) {
        setError(err.response?.data?.error || 'Unable to load job details');
      } finally {
        setLoading(false);
      }
    }
    if (token) loadJob();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-700 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Access Unavailable</h1>
          <p className="text-slate-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const { job, client, schedule, progress } = data;
  const sortedDates = Object.keys(schedule).sort();
  const progressPct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
  const totalMeterage = Object.values(schedule).flat().reduce((sum, e) => sum + (e.meterage || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-emerald-900 text-white">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-10">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-5 h-5 text-emerald-300" />
            <span className="text-emerald-300 text-sm font-medium">Client Portal</span>
          </div>
          <h1 className="text-2xl md:text-4xl font-bold mb-2">{job.name}</h1>
          <div className="flex flex-wrap gap-2 mb-4">
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${jobTypeBadges[job.job_type] || 'bg-slate-100 text-slate-700'}`}>
              {job.job_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </span>
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusColors[job.status] || statusColors.planning}`}>
              {statusLabels[job.status] || 'Planning'}
            </span>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-emerald-100">
            <div className="flex items-center gap-1.5"><MapPin className="w-4 h-4" />{job.location}</div>
            {job.start_date && (
              <div className="flex items-center gap-1.5"><Calendar className="w-4 h-4" />{format(new Date(job.start_date), 'dd MMM yyyy')}{job.end_date ? ` → ${format(new Date(job.end_date), 'dd MMM yyyy')}` : ''}</div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
        {/* Progress Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-emerald-700" />
            <h2 className="font-semibold text-slate-900">Project Progress</h2>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-600">{progress.completed} of {progress.total} shifts completed</span>
            <span className="text-sm font-bold text-emerald-700">{progressPct}%</span>
          </div>
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-600 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="flex flex-wrap gap-4 mt-4 text-xs">
            <div className="flex items-center gap-1.5"><PlayCircle className="w-3.5 h-3.5 text-blue-600" /><span className="text-slate-600">{progress.started} in progress</span></div>
            <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-slate-400" /><span className="text-slate-600">{Math.max(0, progress.total - progress.completed - progress.started)} assigned</span></div>
            {totalMeterage > 0 && (
              <div className="flex items-center gap-1.5"><Ruler className="w-3.5 h-3.5 text-amber-600" /><span className="text-slate-600">{totalMeterage}m drilled</span></div>
            )}
          </div>
        </div>

        {/* Client Info */}
        {client && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 md:p-6">
            <div className="flex items-center gap-2 mb-3">
              <Briefcase className="w-5 h-5 text-emerald-700" />
              <h2 className="font-semibold text-slate-900">Client</h2>
            </div>
            <p className="text-lg font-semibold text-slate-900">{client.name}</p>
            {client.contact_name && <p className="text-sm text-slate-500">{client.contact_name}</p>}
          </div>
        )}

        {/* Schedule */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-700" />
            <h2 className="font-semibold text-slate-900">Work Schedule</h2>
            <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{sortedDates.length} days</span>
          </div>
          {sortedDates.length === 0 ? (
            <div className="px-5 py-8 text-center text-slate-400 text-sm">No scheduled work days yet</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {sortedDates.map(date => {
                const daySchedule = schedule[date];
                const d = new Date(date + 'T00:00:00');
                return (
                  <div key={date} className="px-5 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-slate-900">{format(d, 'EEEE, dd MMM yyyy')}</span>
                      <span className="text-xs text-slate-400">{daySchedule.length} {daySchedule.length === 1 ? 'person' : 'people'}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {daySchedule.map((entry, i) => (
                        <div key={i} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs">
                          <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-emerald-700 font-bold text-[10px]">{entry.staff_name.charAt(0)}</span>
                          </div>
                          <div>
                            <span className="font-medium text-slate-700">{entry.staff_name}</span>
                            {entry.role && <span className="text-slate-400 ml-1.5 capitalize">· {entry.role.replace(/_/g, ' ')}</span>}
                          </div>
                          {entry.meterage > 0 && <span className="text-amber-600 font-medium ml-1">{entry.meterage}m</span>}
                          {entry.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />}
                          {entry.status === 'started' && <PlayCircle className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Notes */}
        {job.notes && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 md:p-6">
            <h2 className="font-semibold text-slate-900 mb-3">Project Notes</h2>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{job.notes}</p>
          </div>
        )}

        {/* Site Photos */}
        {data.photos && data.photos.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <Camera className="w-5 h-5 text-emerald-700" />
              <h2 className="font-semibold text-slate-900">Site Photos</h2>
              <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{data.photos.length}</span>
            </div>
            <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-3">
              {data.photos.map((photo, i) => (
                <div key={i}>
                  <img src={photo.photo_url} alt={photo.caption || 'Site photo'}
                    className="w-full h-32 md:h-40 object-cover rounded-lg border border-slate-200" />
                  {photo.caption && (
                    <p className="text-xs text-slate-500 mt-1 truncate">{photo.caption}</p>
                  )}
                  {photo.uploaded_by && (
                    <p className="text-[10px] text-slate-400">by {photo.uploaded_by}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Progress Timeline */}
        {data.milestones && data.milestones.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <Target className="w-5 h-5 text-emerald-700" />
              <h2 className="font-semibold text-slate-900">Project Milestones</h2>
              <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                {data.milestones.filter(m => m.completed).length}/{data.milestones.length}
              </span>
            </div>
            <div className="p-5">
              <div className="space-y-1">
                {data.milestones.map((m, i) => (
                  <div key={i} className="flex items-start gap-3 relative">
                    {i < data.milestones.length - 1 && (
                      <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-slate-200" />
                    )}
                    <div className="flex-shrink-0 mt-0.5">
                      {m.completed ? (
                        <CheckCircle className="w-5 h-5 text-emerald-600 relative z-10" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-300 relative z-10" />
                      )}
                    </div>
                    <div className="pb-4">
                      <p className={`text-sm font-medium ${m.completed ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{m.name}</p>
                      {m.target_date && (
                        <p className="text-xs text-slate-400 mt-0.5">Target: {format(new Date(m.target_date + 'T00:00:00'), 'dd MMM yyyy')}</p>
                      )}
                      {m.completed && m.completed_date && (
                        <p className="text-xs text-emerald-600 mt-0.5">Completed {format(new Date(m.completed_date + 'T00:00:00'), 'dd MMM yyyy')}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Document Vault */}
        {data.documents && data.documents.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-700" />
              <h2 className="font-semibold text-slate-900">Documents</h2>
              <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{data.documents.length}</span>
            </div>
            <div className="p-5 space-y-2">
              {data.documents.map((doc, i) => (
                <a key={i} href={doc.document_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3 hover:border-emerald-300 transition">
                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-slate-500" />
                  </div>
                  <span className="text-sm font-medium text-slate-900 truncate flex-1">{doc.document_name}</span>
                  <span className="text-xs text-slate-400 capitalize flex-shrink-0">{(doc.category || 'other').replace(/_/g, ' ')}</span>
                  <Download className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="text-center text-xs text-slate-400 py-4">
          Powered by GC Job Planner · Updated {format(new Date(), 'dd MMM yyyy HH:mm')}
        </div>
      </div>
    </div>
  );
}