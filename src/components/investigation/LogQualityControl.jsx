import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  FlaskConical, ShieldCheck, AlertTriangle, CheckCircle2, XCircle, Clock,
  ArrowDownToLine, TestTube, MapPin, Package, Wrench, Undo2, Ruler,
  Droplets, Calculator, Layers, Gauge, Waves, MapPinned, Camera, FileText, Eye
} from 'lucide-react';
import { strataConfig, serviceEncounterConfig, pitStabilityConfig, reviewStatusConfig, getMissingFields, getAnomalyFlags } from './shared';

const fmt = (n) => n != null ? (Number(n).toFixed(n % 1 === 0 ? 0 : 1)) : '—';

export default function LogQualityControl() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('pending'); // pending | approved | queried | all
  const [selectedLog, setSelectedLog] = useState(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewing, setReviewing] = useState(false);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['log-quality-control'],
    queryFn: async () => {
      const all = await base44.entities.InvestigationLog.list('-created_date', 500);
      return all.sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date));
    },
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs-for-log-qc'],
    queryFn: () => base44.entities.Job.list('-created_date', 200),
  });

  const jobMap = useMemo(() => {
    const m = {};
    jobs.forEach(j => { m[j.id] = j; });
    return m;
  }, [jobs]);

  const filteredLogs = useMemo(() => {
    if (filter === 'all') return logs;
    return logs.filter(l => (l.manager_review_status || 'pending') === filter);
  }, [logs, filter]);

  const stats = useMemo(() => {
    const pending = logs.filter(l => (l.manager_review_status || 'pending') === 'pending').length;
    const approved = logs.filter(l => l.manager_review_status === 'approved').length;
    const queried = logs.filter(l => l.manager_review_status === 'queried').length;
    const withAnomalies = logs.filter(l => getAnomalyFlags(l).length > 0).length;
    const incomplete = logs.filter(l => getMissingFields(l).length > 0).length;
    return { pending, approved, queried, withAnomalies, incomplete, total: logs.length };
  }, [logs]);

  const handleReview = async (status) => {
    if (!selectedLog) return;
    setReviewing(true);
    try {
      const me = await base44.auth.me();
      await base44.entities.InvestigationLog.update(selectedLog.id, {
        manager_review_status: status,
        manager_review_note: reviewNote || '',
        manager_reviewed_by: me?.full_name || me?.email || 'Manager',
        manager_reviewed_at: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ['log-quality-control'] });
      queryClient.invalidateQueries({ queryKey: ['investigation-logs'] });
      setSelectedLog(null);
      setReviewNote('');
    } catch (e) {
      console.error(e);
    }
    setReviewing(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="w-5 h-5 text-blue-700" />
        </div>
        <div>
          <h2 className="font-bold text-slate-900">Log Quality Control</h2>
          <p className="text-xs text-slate-500">Review field logs for geotechnical accuracy and reporting readiness</p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Pending Review" value={stats.pending} icon={Clock} color="text-amber-700 bg-amber-50 border-amber-200" onClick={() => setFilter('pending')} active={filter === 'pending'} />
        <StatCard label="Approved" value={stats.approved} icon={CheckCircle2} color="text-emerald-700 bg-emerald-50 border-emerald-200" onClick={() => setFilter('approved')} active={filter === 'approved'} />
        <StatCard label="Queried" value={stats.queried} icon={XCircle} color="text-red-700 bg-red-50 border-red-200" onClick={() => setFilter('queried')} active={filter === 'queried'} />
        <StatCard label="Incomplete" value={stats.incomplete} icon={AlertTriangle} color="text-orange-700 bg-orange-50 border-orange-200" />
        <StatCard label="Anomalies" value={stats.withAnomalies} icon={AlertTriangle} color="text-red-700 bg-red-50 border-red-200" />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-full sm:w-auto sm:inline-flex">
        {[
          { key: 'pending', label: 'Pending' },
          { key: 'approved', label: 'Approved' },
          { key: 'queried', label: 'Queried' },
          { key: 'all', label: 'All' },
        ].map(t => (
          <button key={t.key} onClick={() => setFilter(t.key)}
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-xs font-medium transition ${filter === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Log list */}
      {isLoading ? (
        <div className="text-center py-10 text-slate-400 text-sm">Loading logs…</div>
      ) : filteredLogs.length === 0 ? (
        <div className="text-center py-10 text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl">
          No {filter !== 'all' ? filter : ''} logs to review.
        </div>
      ) : (
        <div className="space-y-2">
          {filteredLogs.map(log => {
            const job = log.job_id ? jobMap[log.job_id] : null;
            const missing = getMissingFields(log);
            const anomalies = getAnomalyFlags(log);
            const reviewStatus = log.manager_review_status || 'pending';
            const rc = reviewStatusConfig[reviewStatus];
            const photos = (log.photo_urls || log.verification_photo_urls || '').split(',').filter(Boolean);
            return (
              <div key={log.id} className="bg-white border border-slate-200 rounded-xl p-3 hover:shadow-sm transition">
                <div className="flex items-start gap-3">
                  <div className={`w-1.5 h-full min-h-[3rem] rounded-full ${rc.dot} flex-shrink-0`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${rc.badge}`}>{rc.label}</span>
                      <LogTypeBadge logType={log.log_type} />
                      {log.borehole_ref && <span className="text-xs font-mono font-bold text-slate-700">{log.borehole_ref}</span>}
                      {log.sample_id && <span className="text-xs font-mono font-bold text-purple-700">{log.sample_id}</span>}
                      {job && <span className="text-xs text-slate-500 truncate">{job.name}</span>}
                      <span className="text-xs text-slate-400 ml-auto">{format(new Date(log.date + 'T00:00:00'), 'dd MMM')}</span>
                    </div>

                    {/* Key data summary */}
                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                      {log.depth_from != null && log.depth_to != null && (
                        <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
                          <Ruler className="w-2.5 h-2.5" /> {log.depth_from}→{log.depth_to}m
                        </span>
                      )}
                      {log.spt_n_value != null && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
                          <Calculator className="w-2.5 h-2.5" /> N={log.spt_n_value}
                        </span>
                      )}
                      {log.strata_descriptor && log.strata_descriptor !== 'other' && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${strataConfig[log.strata_descriptor]?.color || 'bg-slate-100 text-slate-600'}`}>
                          {strataConfig[log.strata_descriptor]?.label || log.strata_descriptor}
                        </span>
                      )}
                      {log.groundwater_strike_depth != null && (
                        <span className="text-xs bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
                          <Droplets className="w-2.5 h-2.5" /> {fmt(log.groundwater_strike_depth)}m
                        </span>
                      )}
                      {log.coring_recovery != null && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
                          <Layers className="w-2.5 h-2.5" /> {fmt(log.coring_recovery)}%
                        </span>
                      )}
                      {log.pit_stability_rating && log.pit_stability_rating !== 'not_assessed' && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${pitStabilityConfig[log.pit_stability_rating]?.badge || 'bg-slate-100'}`}>
                          {pitStabilityConfig[log.pit_stability_rating]?.label || log.pit_stability_rating}
                        </span>
                      )}
                      {log.service_encounter_type && log.service_encounter_type !== 'none' && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5 ${serviceEncounterConfig[log.service_encounter_type]?.color || 'bg-slate-100'}`}>
                          <Waves className="w-2.5 h-2.5" /> {serviceEncounterConfig[log.service_encounter_type]?.label || log.service_encounter_type}
                        </span>
                      )}
                      {log.cbr_value != null && (
                        <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
                          <Gauge className="w-2.5 h-2.5" /> CBR {fmt(log.cbr_value)}%
                        </span>
                      )}
                      {log.vane_strength != null && (
                        <span className="text-xs bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium">Vane {fmt(log.vane_strength)}kPa</span>
                      )}
                      {log.reinstatement_type && log.reinstatement_type !== 'none' && (
                        <span className="text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full font-medium">{log.reinstatement_type.replace(/_/g, ' ')}</span>
                      )}
                      {photos.length > 0 && (
                        <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
                          <Camera className="w-2.5 h-2.5" /> {photos.length}
                        </span>
                      )}
                    </div>

                    {/* Warnings */}
                    {(missing.length > 0 || anomalies.length > 0) && (
                      <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                        {missing.map((m, i) => (
                          <span key={`m${i}`} className="text-xs bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
                            <AlertTriangle className="w-2.5 h-2.5" /> Missing: {m}
                          </span>
                        ))}
                        {anomalies.map((a, i) => (
                          <span key={`a${i}`} className="text-xs bg-red-50 text-red-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
                            <AlertTriangle className="w-2.5 h-2.5" /> {a}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Description + staff */}
                    <div className="mt-1.5 flex items-center gap-2">
                      {log.strata_description_detail && <p className="text-xs text-slate-600 truncate">{log.strata_description_detail}</p>}
                      {log.description && <p className="text-xs text-slate-500 truncate">{log.description}</p>}
                      <span className="text-xs text-slate-400 ml-auto flex-shrink-0">{log.staff_name || '—'}</span>
                    </div>

                    {/* Action button */}
                    <button onClick={() => { setSelectedLog(log); setReviewNote(log.manager_review_note || ''); }}
                      className="mt-2 text-xs font-medium text-blue-700 hover:text-blue-900 inline-flex items-center gap-1">
                      <Eye className="w-3 h-3" /> Review
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setSelectedLog(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-3 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Review Log Entry</h3>
              <button onClick={() => setSelectedLog(null)} className="text-slate-400 hover:text-slate-600 text-sm">Close</button>
            </div>
            <div className="p-5 space-y-4">
              <LogDetailBlock log={selectedLog} />
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Review Note</label>
                <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)} rows={2}
                  placeholder="Add a note for the crew (optional)…"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-600 resize-none" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleReview('approved')} disabled={reviewing}
                  className="flex-1 px-4 py-2.5 bg-emerald-700 text-white rounded-xl font-semibold text-sm hover:bg-emerald-800 transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Approve
                </button>
                <button onClick={() => handleReview('queried')} disabled={reviewing}
                  className="flex-1 px-4 py-2.5 bg-red-700 text-white rounded-xl font-semibold text-sm hover:bg-red-800 transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5">
                  <XCircle className="w-4 h-4" /> Query
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, onClick, active }) {
  return (
    <button onClick={onClick} disabled={!onClick}
      className={`text-left p-3 rounded-xl border transition ${color} ${active ? 'ring-2 ring-offset-1 ring-slate-300' : ''} ${onClick ? 'hover:shadow-sm cursor-pointer' : 'cursor-default'}`}>
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</span>
      </div>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </button>
  );
}

function LogTypeBadge({ logType }) {
  const config = {
    borehole_progress: { label: 'Borehole', icon: ArrowDownToLine, badge: 'bg-blue-100 text-blue-700' },
    sample_collection: { label: 'Sample', icon: TestTube, badge: 'bg-purple-100 text-purple-700' },
    pit_excavation: { label: 'Trial Pit', icon: MapPin, badge: 'bg-amber-100 text-amber-700' },
    installation: { label: 'Installation', icon: Package, badge: 'bg-emerald-100 text-emerald-700' },
    site_setup: { label: 'Setup', icon: Wrench, badge: 'bg-slate-100 text-slate-600' },
    reinstatement: { label: 'Reinstatement', icon: Undo2, badge: 'bg-teal-100 text-teal-700' },
    other: { label: 'Other', icon: FileText, badge: 'bg-slate-100 text-slate-600' },
  };
  const c = config[logType] || config.other;
  const Icon = c.icon;
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5 ${c.badge}`}>
      <Icon className="w-2.5 h-2.5" /> {c.label}
    </span>
  );
}

function LogDetailBlock({ log }) {
  const photos = (log.photo_urls || '').split(',').filter(Boolean);
  const verificationPhotos = (log.verification_photo_urls || '').split(',').filter(Boolean);
  const allPhotos = [...photos, ...verificationPhotos];

  const fields = [
    { label: 'Borehole / Pit Ref', value: log.borehole_ref },
    { label: 'Depth', value: log.depth_from != null && log.depth_to != null ? `${log.depth_from}m → ${log.depth_to}m` : null },
    { label: 'Sample ID', value: log.sample_id },
    { label: 'Sample Type', value: log.sample_type && log.sample_type !== 'none' ? log.sample_type : null },
    { label: 'Strata', value: log.strata_descriptor && log.strata_descriptor !== 'other' ? strataConfig[log.strata_descriptor]?.label : null },
    { label: 'Strata Detail', value: log.strata_description_detail },
    { label: 'SPT N-value', value: log.spt_n_value },
    { label: 'SPT Blows', value: log.spt_blows?.length ? log.spt_blows.join(' / ') : null },
    { label: 'Water Strike', value: log.groundwater_strike_depth != null ? `${log.groundwater_strike_depth}m` : null },
    { label: 'Static Water Level', value: log.groundwater_static_level != null ? `${log.groundwater_static_level}m` : null },
    { label: 'Core Run', value: log.core_run_number },
    { label: 'Core Recovery', value: log.coring_recovery != null ? `${log.coring_recovery}%` : null },
    { label: 'RQD', value: log.coring_rqd != null ? `${log.coring_rqd}%` : null },
    { label: 'Dimensions', value: log.dimensions },
    { label: 'Pit Stability', value: log.pit_stability_rating && log.pit_stability_rating !== 'not_assessed' ? pitStabilityConfig[log.pit_stability_rating]?.label : null },
    { label: 'Service Encountered', value: log.service_encounter_type && log.service_encounter_type !== 'none' ? serviceEncounterConfig[log.service_encounter_type]?.label : null },
    { label: 'Service GPS', value: log.service_encounter_gps },
    { label: 'CBR', value: log.cbr_value != null ? `${log.cbr_value}%` : null },
    { label: 'Vane Strength', value: log.vane_strength != null ? `${log.vane_strength} kPa` : null },
    { label: 'Reinstatement', value: log.reinstatement_type && log.reinstatement_type !== 'none' ? log.reinstatement_type.replace(/_/g, ' ') : null },
    { label: 'Backfill', value: log.backfill_material },
    { label: 'Description', value: log.description },
    { label: 'Staff', value: log.staff_name },
  ].filter(f => f.value);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {fields.map((f, i) => (
          <div key={i} className="bg-slate-50 rounded-lg p-2">
            <p className="text-xs text-slate-400 font-medium">{f.label}</p>
            <p className="text-sm text-slate-800 font-medium">{f.value}</p>
          </div>
        ))}
      </div>
      {allPhotos.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-600 mb-2">Photos ({allPhotos.length})</p>
          <div className="grid grid-cols-3 gap-2">
            {allPhotos.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block">
                <img src={url} alt={`Evidence ${i + 1}`} className="w-full h-20 object-cover rounded-lg border border-slate-200" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}