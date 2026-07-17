import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import {
  Calendar, MapPin, CheckCircle2, Clock, PlayCircle, Briefcase, Building2,
  Activity, Ruler, Camera, FileText, Target, CheckCircle, Circle,
  AlertTriangle, RefreshCw, Users, User, Phone, HardHat, PoundSterling, UserCircle,
  StickyNote
} from 'lucide-react';
import { format, isToday, parseISO } from 'date-fns';
import PortalComments from '@/components/PortalComments';
import PortalTimeline from '@/components/PortalTimeline';
import PortalDocuments from '@/components/PortalDocuments';
import { formatJobType } from '@/utils/format';

const jobTypeBadges = {
  groundworks: 'bg-emerald-100 text-emerald-700',
  cp_drilling: 'bg-amber-100 text-amber-700',
  rotary_drilling: 'bg-blue-100 text-blue-700',
  enabling_works: 'bg-purple-100 text-purple-700',
  depot: 'bg-slate-100 text-slate-700'
};

const statusLabels = {
  planning: 'Planning', in_progress: 'In Progress', decommissioning: 'Decommissioning', completed: 'Completed', on_hold: 'On Hold'
};

const statusColors = {
  planning: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-emerald-100 text-emerald-700',
  decommissioning: 'bg-orange-100 text-orange-700',
  completed: 'bg-teal-100 text-teal-700',
  on_hold: 'bg-amber-100 text-amber-700'
};

const roleLabels = {
  groundworker: 'Groundworker',
  cp_driller: 'CP Driller',
  rotary_driller: 'Rotary Driller',
  enabling_crew: 'Enabling Crew',
  depot: 'Depot',
  supervisor: 'Supervisor'
};

const portalContainer = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } } };
const portalItem = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } } };

// Colored icon background per portal section for visual variety
const sectionAccent = {
  progress: 'bg-emerald-50 text-emerald-700',
  team: 'bg-blue-50 text-blue-700',
  client_info: 'bg-amber-50 text-amber-700',
  schedule: 'bg-violet-50 text-violet-700',
  notes: 'bg-slate-50 text-slate-600',
  photos: 'bg-rose-50 text-rose-700',
  milestones: 'bg-teal-50 text-teal-700',
  documents: 'bg-sky-50 text-sky-700',
  comments: 'bg-orange-50 text-orange-700',
  client_charge: 'bg-emerald-50 text-emerald-700',
};

function ProgressRing({ pct }) {
  const r = 26, c = 2 * Math.PI * r;
  const off = c - (c * pct) / 100;
  return (
    <svg width="72" height="72" viewBox="0 0 64 64" className="flex-shrink-0">
      <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="6" />
      <circle cx="32" cy="32" r={r} fill="none" stroke="white" strokeWidth="6" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 32 32)" className="transition-all duration-700" />
      <text x="32" y="37" textAnchor="middle" fontSize="16" fontWeight="700" fill="white">{pct}%</text>
    </svg>
  );
}

function StatTile({ icon: Icon, label, value, accent }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${accent}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-400 font-medium truncate">{label}</p>
        <p className="text-lg font-bold text-slate-900 leading-tight">{value}</p>
      </div>
    </div>
  );
}

export default function ClientPortal() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

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
  }, [token, reloadKey]);

  const handleRetry = () => {
    setLoading(true); setError(null); setData(null); setReloadKey(k => k + 1);
  };

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
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Access Unavailable</h1>
          <p className="text-slate-500 text-sm mb-5">{error}</p>
          <button onClick={handleRetry}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-700 text-white rounded-lg text-sm font-medium hover:bg-emerald-800 active:scale-95 transition">
            <RefreshCw className="w-4 h-4" /> Try again
          </button>
        </div>
      </div>
    );
  }

  const { job, client, contractor, schedule, progress, team, totals } = data;
  const sortedDates = Object.keys(schedule).sort();
  const progressPct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
  const isDrilling = job.job_type === 'cp_drilling' || job.job_type === 'rotary_drilling';

  const sec = job.portal_sections || {};
  const visible = (k) => sec[k] !== false;

  const startDate = job.start_date ? parseISO(job.start_date) : null;
  const endDate = job.end_date ? parseISO(job.end_date) : null;
  const running = job.status === 'in_progress';

  const todayEntry = sortedDates.find(d => isToday(parseISO(d)));

  const fmtMoney = (v) => v != null && v !== '' ? `£${Number(v).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero header */}
      <div className="hero-gradient text-white relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-9 relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-5 h-5 text-emerald-200" />
            <span className="text-emerald-100 text-sm font-medium tracking-wide">Client Portal</span>
            {running && (
              <span className="ml-auto inline-flex items-center gap-1.5 text-xs bg-white/15 backdrop-blur px-2.5 py-1 rounded-full font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" /> Live
              </span>
            )}
          </div>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl md:text-4xl font-bold mb-2 leading-tight">{job.name}</h1>
              <div className="flex flex-wrap gap-2 mb-3">
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${jobTypeBadges[job.job_type] || 'bg-slate-100 text-slate-700'}`}>
                  {formatJobType(job.job_type)}
                </span>
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusColors[job.status] || statusColors.planning}`}>
                  {statusLabels[job.status] || 'Planning'}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-emerald-50">
                <div className="flex items-center gap-1.5"><MapPin className="w-4 h-4" />{job.location}</div>
                {startDate && (
                  <div className="flex items-center gap-1.5"><Calendar className="w-4 h-4" />{format(startDate, 'dd MMM yyyy')}{endDate ? ` → ${format(endDate, 'dd MMM yyyy')}` : ''}</div>
                )}
                {job.job_reference && <div className="flex items-center gap-1.5"><FileText className="w-4 h-4" />Ref: {job.job_reference}</div>}
              </div>
            </div>
            {visible('progress') && (
              <div className="hidden sm:block">
                <ProgressRing pct={progressPct} />
              </div>
            )}
          </div>
        </div>
      </div>

      <motion.div variants={portalContainer} initial="hidden" animate="show"
        className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">

        {/* Stat tiles */}
        {visible('progress') && (
          <motion.div variants={portalItem} className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatTile icon={Users} label="On the team" value={totals?.staff ?? 0} accent="bg-emerald-100 text-emerald-700" />
            <StatTile icon={Calendar} label="Shifts" value={totals?.shifts ?? 0} accent="bg-blue-100 text-blue-700" />
            <StatTile icon={Clock} label="Hours worked" value={`${totals?.hours ?? 0}h`} accent="bg-purple-100 text-purple-700" />
            {isDrilling ? (
              <StatTile icon={Ruler} label="Metres drilled" value={`${totals?.meterage ?? 0}m`} accent="bg-amber-100 text-amber-700" />
            ) : (
              <StatTile icon={CheckCircle2} label="Shifts done" value={progress.completed} accent="bg-teal-100 text-teal-700" />
            )}
          </motion.div>
        )}

        {/* Progress detail (mobile ring + breakdown) */}
        {visible('progress') && (
          <motion.div variants={portalItem} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 md:p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${sectionAccent.progress}`}><Activity className="w-4 h-4" /></div>
              <h2 className="font-semibold text-slate-900">Project Progress</h2>
            </div>
            <div className="flex items-center gap-4 sm:hidden mb-4">
              <ProgressRing pct={progressPct} />
              <p className="text-sm text-slate-500">{progress.completed} of {progress.total} shifts completed.</p>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden mb-3">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-700 transition-all duration-700" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="bg-slate-50 rounded-lg p-2">
                <p className="text-lg font-bold text-slate-900">{progress.total}</p>
                <p className="text-xs text-slate-400">Total shifts</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-2">
                <p className="text-lg font-bold text-blue-700">{progress.started}</p>
                <p className="text-xs text-slate-400">In progress</p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-2">
                <p className="text-lg font-bold text-emerald-700">{progress.completed}</p>
                <p className="text-xs text-slate-400">Completed</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Activity timeline */}
        {(() => {
          const hasShifts = sortedDates.some(d => schedule[d].some(e => e.status === 'completed'));
          const hasMilestones = data.milestones && data.milestones.some(m => m.completed && m.completed_date);
          if (!hasShifts && !hasMilestones) return null;
          return (
            <motion.div variants={portalItem}>
              <PortalTimeline data={data} />
            </motion.div>
          );
        })()}

        {/* On site today */}
        {visible('schedule') && todayEntry && (
          <motion.div variants={portalItem} className="bg-emerald-700 text-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 flex items-center gap-2 border-b border-white/10">
              <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center"><PlayCircle className="w-5 h-5" /></div>
              <h2 className="font-semibold">On Site Today</h2>
              <span className="ml-auto text-xs bg-white/15 px-2 py-0.5 rounded-full font-medium">{format(parseISO(todayEntry), 'dd MMM')}</span>
            </div>
            <div className="px-5 py-4 flex flex-wrap gap-2">
              {schedule[todayEntry].map((entry, i) => (
                <div key={i} className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2 text-sm">
                  <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold">{entry.staff_name.charAt(0)}</div>
                  <span className="font-medium">{entry.staff_name}</span>
                  {entry.role && <span className="text-emerald-100 text-xs">· {roleLabels[entry.role] || entry.role.replace(/_/g, ' ')}</span>}
                  {entry.meterage > 0 && <span className="text-amber-200 text-xs font-medium">{entry.meterage}m</span>}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Project team */}
        {visible('team') && team && team.length > 0 && (
          <motion.div variants={portalItem} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${sectionAccent.team}`}><Users className="w-4 h-4" /></div>
              <h2 className="font-semibold text-slate-900">Project Team</h2>
              <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{team.length} people</span>
            </div>
            <div className="divide-y divide-slate-100">
              {team.map((m, i) => (
                <div key={i} className="px-5 py-3.5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-700 font-bold text-sm">{m.name.charAt(0)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 truncate">{m.name}</p>
                    <p className="text-xs text-slate-400">{roleLabels[m.role] || m.role?.replace(/_/g, ' ') || 'Team member'}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-slate-400">{m.shifts} {m.shifts === 1 ? 'shift' : 'shifts'}</p>
                    {m.meterage > 0 && <p className="text-xs text-amber-600 font-medium">{m.meterage}m</p>}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Contacts */}
        {visible('client_info') && (
          <motion.div variants={portalItem} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${sectionAccent.client_info}`}><Briefcase className="w-4 h-4" /></div>
              <h2 className="font-semibold text-slate-900">Contacts</h2>
            </div>
            <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {client && (
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0"><Building2 className="w-4 h-4 text-emerald-700" /></div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400 uppercase font-medium">Client</p>
                    <p className="text-sm font-semibold text-slate-900">{client.name}</p>
                    {client.contact_name && <p className="text-xs text-slate-500">{client.contact_name}</p>}
                  </div>
                </div>
              )}
              {job.project_manager && (
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0"><UserCircle className="w-4 h-4 text-blue-700" /></div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400 uppercase font-medium">Project Manager</p>
                    <p className="text-sm font-semibold text-slate-900">{job.project_manager}</p>
                  </div>
                </div>
              )}
              {(job.site_contact_name || job.site_contact_phone) && (
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0"><HardHat className="w-4 h-4 text-amber-700" /></div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400 uppercase font-medium">Site Contact</p>
                    {job.site_contact_name && <p className="text-sm font-semibold text-slate-900">{job.site_contact_name}</p>}
                    {job.site_contact_phone && (
                      <a href={`tel:${job.site_contact_phone}`} className="flex items-center gap-1 text-xs text-emerald-700 hover:underline mt-0.5"><Phone className="w-3 h-3" />{job.site_contact_phone}</a>
                    )}
                  </div>
                </div>
              )}
              {contractor && (
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0"><User className="w-4 h-4 text-purple-700" /></div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400 uppercase font-medium">Contractor</p>
                    <p className="text-sm font-semibold text-slate-900">{contractor.name}</p>
                    {contractor.contact_name && <p className="text-xs text-slate-500">{contractor.contact_name}</p>}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Schedule */}
        {visible('schedule') && (
          <motion.div variants={portalItem} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${sectionAccent.schedule}`}><Calendar className="w-4 h-4" /></div>
              <h2 className="font-semibold text-slate-900">Work Schedule</h2>
              <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{sortedDates.length} days</span>
            </div>
            {sortedDates.length === 0 ? (
              <div className="px-5 py-8 text-center text-slate-400 text-sm">No scheduled work days yet</div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                {sortedDates.map(date => {
                  const daySchedule = schedule[date];
                  const d = parseISO(date);
                  const isTodayDay = isToday(d);
                  return (
                    <div key={date} className={`px-5 py-4 ${isTodayDay ? 'bg-emerald-50/40' : ''}`}>
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
                              {entry.role && <span className="text-slate-400 ml-1.5">· {roleLabels[entry.role] || entry.role.replace(/_/g, ' ')}</span>}
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
          </motion.div>
        )}

        {/* Project investment / billing */}
        {visible('client_charge') && data.billing && data.billing.total > 0 && (
          <motion.div variants={portalItem} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${sectionAccent.client_charge}`}><PoundSterling className="w-4 h-4" /></div>
              <h2 className="font-semibold text-slate-900">{data.billing.quote_label || 'Project Investment'}</h2>
            </div>
            <div className="px-5 py-4">
              {data.billing.line_items && data.billing.line_items.length > 0 && (
                <div className="mb-4 space-y-1.5">
                  {data.billing.line_items.map((li, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-slate-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                      {li.description}
                    </div>
                  ))}
                  <div className="flex items-center gap-2 text-sm text-slate-600 pt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                    Labour & Crew
                  </div>
                </div>
              )}
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="font-medium text-slate-900">{fmtMoney(data.billing.subtotal)}</span>
                </div>
                {!data.billing.legacy && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">VAT ({data.billing.vat_rate}%)</span>
                    <span className="font-medium text-slate-900">{fmtMoney(data.billing.vat_amount)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="font-semibold text-slate-900">Total</span>
                  <span className="text-xl font-bold text-emerald-700">{fmtMoney(data.billing.total)}</span>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-3">For any billing queries, please contact your project manager.</p>
            </div>
          </motion.div>
        )}

        {/* Notes */}
        {visible('notes') && job.notes && (
          <motion.div variants={portalItem} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 md:p-6">
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${sectionAccent.notes}`}><StickyNote className="w-4 h-4" /></div>
              <h2 className="font-semibold text-slate-900">Project Notes</h2>
            </div>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{job.notes}</p>
          </motion.div>
        )}

        {/* Milestones */}
        {visible('milestones') && data.milestones && data.milestones.length > 0 && (
          <motion.div variants={portalItem} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${sectionAccent.milestones}`}><Target className="w-4 h-4" /></div>
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
                      {m.completed ? <CheckCircle className="w-5 h-5 text-emerald-600 relative z-10" /> : <Circle className="w-5 h-5 text-slate-300 relative z-10" />}
                    </div>
                    <div className="pb-4">
                      <p className={`text-sm font-medium ${m.completed ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{m.name}</p>
                      {m.target_date && <p className="text-xs text-slate-400 mt-0.5">Target: {format(parseISO(m.target_date), 'dd MMM yyyy')}</p>}
                      {m.completed && m.completed_date && <p className="text-xs text-emerald-600 mt-0.5">Completed {format(parseISO(m.completed_date), 'dd MMM yyyy')}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Site Photos */}
        {visible('photos') && data.photos && data.photos.length > 0 && (
          <motion.div variants={portalItem} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${sectionAccent.photos}`}><Camera className="w-4 h-4" /></div>
              <h2 className="font-semibold text-slate-900">Site Photos</h2>
              <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{data.photos.length}</span>
            </div>
            <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-3">
              {data.photos.map((photo, i) => (
                <div key={i}>
                  <img src={photo.photo_url} alt={photo.caption || 'Site photo'}
                    className="w-full h-32 md:h-40 object-cover rounded-lg border border-slate-200" />
                  {photo.caption && <p className="text-xs text-slate-500 mt-1 truncate">{photo.caption}</p>}
                  {photo.uploaded_by && <p className="text-[10px] text-slate-400">by {photo.uploaded_by}</p>}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Documents (with client acknowledgement) */}
        {visible('documents') && data.documents && data.documents.length > 0 && (
          <motion.div variants={portalItem}>
            <PortalDocuments token={token} documents={data.documents} />
          </motion.div>
        )}

        {/* Comments */}
        {visible('comments') && (
          <motion.div variants={portalItem}>
            <PortalComments token={token} comments={data.comments} />
          </motion.div>
        )}

        <div className="text-center text-xs text-slate-400 py-4">
          Powered by GC Job Planner · Updated {format(new Date(), 'dd MMM yyyy HH:mm')}
        </div>
      </motion.div>
    </div>
  );
}