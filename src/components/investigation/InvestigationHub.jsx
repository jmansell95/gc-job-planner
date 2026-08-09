import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  FlaskConical, Filter, Search, ChevronRight, Ruler, Droplets, Gauge, Camera,
  CheckCircle2, AlertTriangle, XCircle, User, PoundSterling, Layers,
  TestTube, Wrench, MapPin, Tablet, Beaker, Radar, Ban, Waves, ShieldAlert,
  ShieldCheck, Undo2, Eye, ArrowLeft, ClipboardList, Drill
} from 'lucide-react';
import { Skeleton, EmptyState } from '@/components/StateViews';
import BulkApproveBar from '@/components/investigation/BulkApproveBar';
import { titleCase } from '@/utils/format';
import {
  strataConfig, serviceEncounterConfig, pitStabilityConfig, reviewStatusConfig,
  fluidLossConfig, obstructionConfig, logTypeConfig,
  getMissingFields, getAnomalyFlags
} from '@/components/investigation/shared';
import { useToast } from '@/components/ui/use-toast';

const REVIEW_FILTERS = [
  { key: 'all', label: 'All', cls: '' },
  { key: 'pending', label: 'Pending', cls: 'bg-amber-100 text-amber-700' },
  { key: 'queried', label: 'Queried', cls: 'bg-red-100 text-red-700' },
  { key: 'approved', label: 'Approved', cls: 'bg-emerald-100 text-emerald-700' },
];

export default function InvestigationHub({ onNavigate }) {
  const [selectedLogId, setSelectedLogId] = useState(null);
  const [search, setSearch] = useState('');
  const [reviewFilter, setReviewFilter] = useState('all');
  const [jobFilter, setJobFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [bulkSelected, setBulkSelected] = useState(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['investigation-hub-logs'],
    queryFn: () => base44.entities.InvestigationLog.list('-created_date', 300),
  });
  const { data: jobs = [] } = useQuery({
    queryKey: ['investigation-hub-jobs'],
    queryFn: () => base44.entities.Job.list(),
  });

  const jobMap = useMemo(() => {
    const m = {};
    jobs.forEach(j => { m[j.id] = j; });
    return m;
  }, [jobs]);

  const filtered = useMemo(() => {
    return logs.filter(l => {
      if (reviewFilter !== 'all' && (l.manager_review_status || 'pending') !== reviewFilter) return false;
      if (jobFilter !== 'all' && l.job_id !== jobFilter) return false;
      if (typeFilter !== 'all' && l.log_type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const haystack = `${l.borehole_ref || ''} ${l.sample_id || ''} ${l.description || ''} ${l.strata_description_detail || ''} ${l.staff_name || ''} ${l.completed_by_name || ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [logs, reviewFilter, jobFilter, typeFilter, search]);

  const selectedLog = filtered.find(l => l.id === selectedLogId) || logs.find(l => l.id === selectedLogId) || null;

  // Borehole context — other logs for the same borehole_ref (any job)
  const boreholeContext = useMemo(() => {
    if (!selectedLog?.borehole_ref) return null;
    const ref = selectedLog.borehole_ref;
    const sameBorehole = logs
      .filter(l => l.borehole_ref === ref)
      .sort((a, b) => (a.depth_from ?? 0) - (b.depth_from ?? 0));
    const strataSequence = sameBorehole.filter(l => l.strata_descriptor && l.strata_descriptor !== 'other');
    const samples = sameBorehole.filter(l => l.sample_type && l.sample_type !== 'none');
    const installations = sameBorehole.filter(l => l.log_type === 'installation');
    const standpipeReadings = sameBorehole.filter(l => l.log_type === 'standpipe_reading' || l.standpipe_ref);
    return { ref, all: sameBorehole, strataSequence, samples, installations, standpipeReadings };
  }, [selectedLog, logs]);

  const handleReview = async (log, status, note) => {
    try {
      await base44.entities.InvestigationLog.update(log.id, {
        manager_review_status: status,
        manager_review_note: note || '',
        manager_reviewed_at: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ['investigation-hub-logs'] });
      queryClient.invalidateQueries({ queryKey: ['investigation-logs'] });
      toast({ title: status === 'approved' ? 'Log approved' : 'Log queried', duration: 2000 });
    } catch (e) {
      toast({ title: 'Failed to update review', variant: 'destructive' });
    }
  };

  const pendingCount = logs.filter(l => (l.manager_review_status || 'pending') === 'pending').length;
  const queriedCount = logs.filter(l => l.manager_review_status === 'queried').length;

  const toggleBulkSelect = (id) => {
    setBulkSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkDone = () => {
    queryClient.invalidateQueries({ queryKey: ['investigation-hub-logs'] });
    queryClient.invalidateQueries({ queryKey: ['investigation-logs'] });
    setBulkSelected(new Set());
  };

  return (
    <div>
      {/* Header */}
      <div className="insight-card rounded-2xl p-4 sm:p-5 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="p-2.5 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] rounded-xl shadow-sm">
            <FlaskConical className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">Investigation Hub</h2>
            <p className="text-sm text-slate-500">Cross-job review workspace for all site logs, borehole data, and field activity</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {pendingCount > 0 && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-semibold inline-flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> {pendingCount} pending
              </span>
            )}
            {queriedCount > 0 && (
              <span className="text-xs bg-red-100 text-red-700 px-2.5 py-1 rounded-full font-semibold inline-flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" /> {queriedCount} queried
              </span>
            )}
            <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-semibold">{logs.length} total</span>
            <button
              onClick={() => { setBulkMode(m => !m); setBulkSelected(new Set()); }}
              className={`text-xs px-2.5 py-1 rounded-full font-semibold transition ${bulkMode ? 'bg-[#2E5A1A] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {bulkMode ? 'Done' : 'Select'}
            </button>
          </div>
        </div>
      </div>

      {/* 3-column workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr_320px] gap-4">
        {/* Left: Log list with filters */}
        <div className="insight-card rounded-2xl overflow-hidden flex flex-col xl:h-[calc(100vh-220px)] xl:sticky xl:top-4">
          <div className="p-3 border-b border-slate-100 space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search borehole, sample, staff..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#2E5A1A]/20 focus:border-[#2E5A1A]/30 outline-none transition"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {REVIEW_FILTERS.map(f => (
                <button
                  key={f.key}
                  onClick={() => setReviewFilter(f.key)}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium transition ${
                    reviewFilter === f.key
                      ? 'bg-[#2E5A1A] text-white shadow-sm'
                      : f.cls || 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <select
                value={jobFilter}
                onChange={e => setJobFilter(e.target.value)}
                className="text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-[#2E5A1A]/20"
              >
                <option value="all">All Jobs</option>
                {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
              </select>
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-[#2E5A1A]/20"
              >
                <option value="all">All Types</option>
                {Object.entries(logTypeConfig).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState icon={Filter} title="No logs match" message="Try adjusting your filters" />
            ) : (
              filtered.map(log => (
                <LogListItem
                  key={log.id}
                  log={log}
                  jobName={jobMap[log.job_id]?.name || '—'}
                  isSelected={log.id === selectedLogId}
                  onClick={() => bulkMode ? toggleBulkSelect(log.id) : setSelectedLogId(log.id)}
                  bulkMode={bulkMode}
                  bulkSelected={bulkSelected.has(log.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Middle: Log detail */}
        <div className="insight-card rounded-2xl overflow-hidden flex flex-col xl:h-[calc(100vh-220px)]">
          {!selectedLog ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState icon={ClipboardList} title="Select a log to review" message="Click any log on the left to see full details and borehole context" />
            </div>
          ) : (
            <LogDetail log={selectedLog} jobName={jobMap[selectedLog.job_id]?.name || '—'} onReview={handleReview} onNavigate={onNavigate} />
          )}
        </div>

        {/* Right: Borehole context */}
        <div className="insight-card rounded-2xl overflow-hidden flex flex-col xl:h-[calc(100vh-220px)] xl:sticky xl:top-4">
          {!boreholeContext ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState icon={Layers} title="No borehole context" message="Select a log with a borehole reference to see related strata, samples, and installations" />
            </div>
          ) : (
            <BoreholeContextPanel context={boreholeContext} onSelectLog={setSelectedLogId} selectedLogId={selectedLogId} />
          )}
        </div>
      </div>
      {bulkMode && bulkSelected.size > 0 && (
        <BulkApproveBar
          selectedIds={Array.from(bulkSelected)}
          onClear={() => setBulkSelected(new Set())}
          onDone={handleBulkDone}
        />
      )}
    </div>
  );
}

function LogListItem({ log, jobName, isSelected, onClick, bulkMode, bulkSelected }) {
  const reviewStatus = log.manager_review_status || 'pending';
  const rc = reviewStatusConfig[reviewStatus];
  const typeConfig = logTypeConfig[log.log_type];
  const photos = (log.photo_urls || log.verification_photo_urls || '').split(',').filter(Boolean);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 transition hover:bg-slate-50 ${bulkSelected ? 'bg-[#2E5A1A]/10 border-l-2 border-l-[#2E5A1A]' : isSelected ? 'bg-[#2E5A1A]/5 border-l-2 border-l-[#2E5A1A]' : 'border-l-2 border-l-transparent'}`}
    >
      <div className="flex items-center gap-2 flex-wrap mb-1">
        {bulkMode && (
          <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${bulkSelected ? 'bg-[#2E5A1A] border-[#2E5A1A]' : 'border-slate-300 bg-white'}`}>
            {bulkSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
          </span>
        )}
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${rc.badge}`}>{rc.label}</span>
        {typeConfig && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${typeConfig.badge}`}>{typeConfig.label}</span>
        )}
        {log.source === 'ags_import' && (
          <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
            <Tablet className="w-2.5 h-2.5" />
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {log.borehole_ref && <span className="text-xs font-mono font-bold text-blue-700">{log.borehole_ref}</span>}
        {log.depth_from != null && log.depth_to != null && (
          <span className="text-[10px] text-slate-500 inline-flex items-center gap-0.5">
            <Ruler className="w-2.5 h-2.5" /> {log.depth_from}–{log.depth_to}m
          </span>
        )}
        {photos.length > 0 && (
          <span className="text-[10px] text-slate-500 inline-flex items-center gap-0.5">
            <Camera className="w-2.5 h-2.5" /> {photos.length}
          </span>
        )}
      </div>
      <p className="text-xs text-slate-600 mt-1 line-clamp-2">{log.description || log.strata_description_detail || typeConfig?.label || '—'}</p>
      <div className="flex items-center gap-1.5 mt-1.5">
        <span className="text-[10px] text-slate-400 truncate flex-1">{jobName}</span>
        <span className="text-[10px] text-slate-400">{format(new Date(log.date), 'dd MMM')}</span>
      </div>
    </button>
  );
}

function LogDetail({ log, jobName, onReview, onNavigate }) {
  const [reviewNote, setReviewNote] = useState(log.manager_review_note || '');
  const photos = (log.photo_urls || log.verification_photo_urls || '').split(',').filter(Boolean);
  const missing = getMissingFields(log);
  const anomalies = getAnomalyFlags(log);
  const reviewStatus = log.manager_review_status || 'pending';
  const rc = reviewStatusConfig[reviewStatus];
  const strata = log.strata_descriptor && strataConfig[log.strata_descriptor];
  const svc = log.service_encounter_type && serviceEncounterConfig[log.service_encounter_type];
  const stability = log.pit_stability_rating && pitStabilityConfig[log.pit_stability_rating];
  const typeConfig = logTypeConfig[log.log_type];

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Detail header */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${rc.badge}`}>{rc.label}</span>
          {typeConfig && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeConfig.badge}`}>{typeConfig.label}</span>
          )}
          {log.source === 'ags_import' && (
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
              <Tablet className="w-3 h-3" /> KeyLogBook
            </span>
          )}
          {log.borehole_ref && <span className="text-sm font-mono font-bold text-blue-700">{log.borehole_ref}</span>}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="font-medium text-slate-700">{jobName}</span>
          <span>·</span>
          <span>{format(new Date(log.date), 'EEEE, dd MMM yyyy')}</span>
          {log.created_at && <><span>·</span><span>{format(new Date(log.created_at), 'HH:mm')}</span></>}
        </div>
        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-slate-500">
          <User className="w-3.5 h-3.5" />
          {log.completed_by_type && log.completed_by_type !== 'internal_staff' ? (
            <>{log.completed_by_name || 'Unknown'} <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-full font-medium">{log.completed_by_type === 'client' ? 'Client' : 'Contractor'}</span></>
          ) : (
            <>{log.staff_name || 'Staff member'}</>
          )}
        </div>
      </div>

      {/* Detail body */}
      <div className="p-4 space-y-4">
        {/* Geotechnical data grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {log.depth_from != null && log.depth_to != null && (
            <DataTile icon={Ruler} label="Depth" value={`${log.depth_from}–${log.depth_to}m`} />
          )}
          {strata && strata.label && log.strata_descriptor !== 'other' && (
            <DataTile icon={Layers} label="Strata" value={strata.label} color={strata.color} />
          )}
          {log.sample_id && (
            <DataTile icon={TestTube} label="Sample" value={log.sample_id} />
          )}
          {log.sample_type && log.sample_type !== 'none' && (
            <DataTile icon={TestTube} label="Sample Type" value={titleCase(log.sample_type)} />
          )}
          {log.units_completed != null && log.units_completed > 0 && (
            <DataTile icon={Wrench} label="Units" value={`${log.units_completed} ${log.units_label || ''}`} />
          )}
          {log.groundwater_strike_depth != null && (
            <DataTile icon={Droplets} label="GW Strike" value={`${log.groundwater_strike_depth}m`} color="bg-cyan-50 text-cyan-700" />
          )}
          {log.standpipe_ref && (
            <DataTile icon={Gauge} label="Standpipe" value={`${log.standpipe_ref}${log.standpipe_reading_m != null ? ` · ${log.standpipe_reading_m}m` : ''}`} color="bg-cyan-50 text-cyan-700" />
          )}
          {log.cbr_value != null && (
            <DataTile icon={Gauge} label="CBR" value={`${log.cbr_value}%`} color="bg-blue-50 text-blue-700" />
          )}
          {log.vane_strength != null && (
            <DataTile icon={Gauge} label="Vane" value={`${log.vane_strength}kPa`} color="bg-indigo-50 text-indigo-700" />
          )}
          {log.spt_n_value != null && (
            <DataTile icon={Gauge} label="SPT N" value={String(log.spt_n_value)} color="bg-amber-50 text-amber-700" />
          )}
          {log.coring_rqd != null && (
            <DataTile icon={Layers} label="RQD" value={`${log.coring_rqd}%`} />
          )}
          {log.coring_recovery != null && (
            <DataTile icon={Layers} label="Recovery" value={`${log.coring_recovery}%`} />
          )}
          {log.grout_volume != null && (
            <DataTile icon={Beaker} label="Grout" value={`${log.grout_volume}L`} color="bg-rose-50 text-rose-700" />
          )}
          {log.probe_depth != null && (
            <DataTile icon={Radar} label="Probe Depth" value={`${log.probe_depth}m`} color="bg-violet-50 text-violet-700" />
          )}
          {log.seal_depth != null && (
            <DataTile icon={Ban} label="Seal" value={`${log.seal_depth}m`} color="bg-stone-50 text-stone-700" />
          )}
        </div>

        {/* SPT blows */}
        {log.spt_blows && log.spt_blows.length > 0 && (
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
            <p className="text-xs font-semibold text-amber-900 mb-1">SPT Blow Counts</p>
            <div className="flex gap-1 flex-wrap">
              {log.spt_blows.map((b, i) => (
                <span key={i} className="text-xs font-mono bg-white text-amber-700 px-1.5 py-0.5 rounded font-bold">{b}</span>
              ))}
              {log.spt_n_value != null && <span className="text-xs font-mono bg-amber-200 text-amber-900 px-2 py-0.5 rounded font-bold">N={log.spt_n_value}</span>}
            </div>
          </div>
        )}

        {/* Descriptions */}
        {log.strata_description_detail && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Strata Detail</p>
            <p className="text-sm text-slate-700">{log.strata_description_detail}</p>
          </div>
        )}
        {log.description && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Description</p>
            <p className="text-sm text-slate-700">{log.description}</p>
          </div>
        )}
        {log.dimensions && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Dimensions</p>
            <p className="text-sm text-slate-600">{log.dimensions}</p>
          </div>
        )}
        {log.backfill_material && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Backfill</p>
            <p className="text-sm text-slate-600">{log.backfill_material}</p>
          </div>
        )}

        {/* Stability / services / fluid */}
        {(stability && log.pit_stability_rating !== 'not_assessed') && (
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <span className="text-sm text-slate-700">Pit stability: <span className={`font-medium px-2 py-0.5 rounded-full text-xs ${stability.badge}`}>{stability.label}</span></span>
          </div>
        )}
        {svc && log.service_encounter_type !== 'none' && (
          <div className="flex items-center gap-2">
            <Waves className="w-4 h-4 text-red-600" />
            <span className="text-sm text-slate-700">Service encounter: <span className={`font-medium px-2 py-0.5 rounded-full text-xs ${svc.color}`}>{svc.label}</span></span>
          </div>
        )}
        {log.refusal_encountered && (
          <div className="flex items-center gap-2 text-red-700">
            <ShieldAlert className="w-4 h-4" />
            <span className="text-sm font-medium">Refusal encountered</span>
          </div>
        )}
        {log.drilling_fluid_loss && log.drilling_fluid_loss !== 'none' && (
          <div className="flex items-center gap-2 text-amber-700">
            <Droplets className="w-4 h-4" />
            <span className="text-sm">Fluid loss: {titleCase(log.drilling_fluid_loss)}</span>
          </div>
        )}
        {log.reinstatement_type && log.reinstatement_type !== 'none' && (
          <div className="flex items-center gap-2">
            <Undo2 className="w-4 h-4 text-teal-600" />
            <span className="text-sm text-slate-700">Reinstatement: {titleCase(log.reinstatement_type)}</span>
          </div>
        )}

        {/* Photos */}
        {photos.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Evidence Photos ({photos.length})</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {photos.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block aspect-square rounded-lg overflow-hidden border border-slate-200 hover:ring-2 hover:ring-[#2E5A1A]/30 transition">
                  <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Warnings */}
        {(missing.length > 0 || anomalies.length > 0) && (
          <div className="space-y-1.5">
            {missing.map((m, i) => (
              <div key={`m${i}`} className="flex items-center gap-2 text-xs bg-orange-50 text-orange-700 px-2.5 py-1.5 rounded-lg">
                <AlertTriangle className="w-3.5 h-3.5" /> {m}
              </div>
            ))}
            {anomalies.map((a, i) => (
              <div key={`a${i}`} className="flex items-center gap-2 text-xs bg-red-50 text-red-700 px-2.5 py-1.5 rounded-lg">
                <AlertTriangle className="w-3.5 h-3.5" /> {a}
              </div>
            ))}
          </div>
        )}

        {/* Billing */}
        {log.chargeable && (
          <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
            <div className="flex items-center gap-2 mb-1">
              <PoundSterling className="w-4 h-4 text-emerald-700" />
              <span className="text-sm font-semibold text-emerald-900">Chargeable</span>
              {log.charge_amount > 0 && (
                <span className="text-sm font-bold text-emerald-700 ml-auto">£{Number(log.charge_amount).toLocaleString('en-GB', { maximumFractionDigits: 0 })}</span>
              )}
            </div>
            {log.charge_breakdown && (
              <p className="text-xs text-emerald-600 mt-1">{log.charge_breakdown}</p>
            )}
          </div>
        )}

        {/* Manager review */}
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Manager Review</p>
          {log.manager_reviewed_by && (
            <p className="text-xs text-slate-500 mb-2">Last reviewed by {log.manager_reviewed_by} {log.manager_reviewed_at ? `on ${format(new Date(log.manager_reviewed_at), 'dd MMM yyyy')}` : ''}</p>
          )}
          <textarea
            value={reviewNote}
            onChange={e => setReviewNote(e.target.value)}
            placeholder="Add a review note (optional)..."
            rows={2}
            className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-[#2E5A1A]/20 focus:border-[#2E5A1A]/30 outline-none transition resize-none"
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => onReview(log, 'approved', reviewNote)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition"
            >
              <CheckCircle2 className="w-4 h-4" /> Approve
            </button>
            <button
              onClick={() => onReview(log, 'queried', reviewNote)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 transition"
            >
              <XCircle className="w-4 h-4" /> Query
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DataTile({ icon: Icon, label, value, color = 'bg-slate-50 text-slate-700' }) {
  return (
    <div className={`p-2.5 rounded-lg ${color}`}>
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon className="w-3.5 h-3.5 opacity-70" />
        <span className="text-[10px] font-medium uppercase tracking-wide opacity-70">{label}</span>
      </div>
      <p className="text-sm font-bold">{value}</p>
    </div>
  );
}

function BoreholeContextPanel({ context, onSelectLog, selectedLogId }) {
  const { ref, all, strataSequence, samples, installations, standpipeReadings } = context;
  const totalDepth = all.reduce((sum, l) => (l.depth_to != null) ? Math.max(sum, l.depth_to) : sum, 0);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4 border-b border-slate-100 bg-blue-50/50">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-100 rounded-lg">
            <Drill className="w-4 h-4 text-blue-700" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">{ref}</h3>
            <p className="text-xs text-slate-500">{all.length} logs · {totalDepth > 0 ? `${totalDepth.toFixed(1)}m max depth` : 'no depth data'}</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Strata sequence */}
        {strataSequence.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" /> Strata Sequence
            </p>
            <div className="space-y-1">
              {strataSequence.map((l, i) => {
                const strata = strataConfig[l.strata_descriptor];
                return (
                  <button
                    key={l.id}
                    onClick={() => onSelectLog(l.id)}
                    className={`w-full text-left flex items-center gap-2 p-2 rounded-lg transition hover:bg-slate-50 ${l.id === selectedLogId ? 'bg-[#2E5A1A]/5' : ''}`}
                  >
                    <div className="w-1 h-8 rounded-full bg-slate-300" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700">{strata?.label || l.strata_descriptor}</p>
                      <p className="text-[10px] text-slate-400">{l.depth_from}–{l.depth_to}m</p>
                    </div>
                    {l.id === selectedLogId && <ChevronRight className="w-3.5 h-3.5 text-[#2E5A1A]" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Samples */}
        {samples.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <TestTube className="w-3.5 h-3.5" /> Samples ({samples.length})
            </p>
            <div className="space-y-1">
              {samples.map(s => (
                <button
                  key={s.id}
                  onClick={() => onSelectLog(s.id)}
                  className={`w-full text-left flex items-center gap-2 p-2 rounded-lg transition hover:bg-slate-50 ${s.id === selectedLogId ? 'bg-[#2E5A1A]/5' : ''}`}
                >
                  <span className="text-xs font-mono font-bold text-purple-700">{s.sample_id || '—'}</span>
                  <span className="text-[10px] text-slate-400">{s.depth_from}–{s.depth_to}m</span>
                  <span className="text-[10px] text-slate-500 ml-auto">{titleCase(s.sample_type)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Installations */}
        {installations.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5" /> Installations ({installations.length})
            </p>
            <div className="space-y-1">
              {installations.map(inst => (
                <button
                  key={inst.id}
                  onClick={() => onSelectLog(inst.id)}
                  className={`w-full text-left flex items-center gap-2 p-2 rounded-lg transition hover:bg-slate-50 ${inst.id === selectedLogId ? 'bg-[#2E5A1A]/5' : ''}`}
                >
                  <span className="text-xs font-medium text-slate-700">{inst.units_completed} {inst.units_label || 'units'}</span>
                  {inst.standpipe_ref && <span className="text-[10px] text-cyan-700 font-mono">{inst.standpipe_ref}</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Standpipe readings */}
        {standpipeReadings.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5" /> Standpipe Readings ({standpipeReadings.length})
            </p>
            <div className="space-y-1">
              {standpipeReadings.sort((a, b) => new Date(a.date) - new Date(b.date)).map(r => (
                <button
                  key={r.id}
                  onClick={() => onSelectLog(r.id)}
                  className={`w-full text-left flex items-center gap-2 p-2 rounded-lg transition hover:bg-slate-50 ${r.id === selectedLogId ? 'bg-[#2E5A1A]/5' : ''}`}
                >
                  <span className="text-[10px] text-slate-400">{format(new Date(r.date), 'dd MMM')}</span>
                  <span className="text-xs font-mono font-bold text-cyan-700">{r.standpipe_reading_m != null ? `${r.standpipe_reading_m}m` : '—'}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* All logs */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">All Logs for {ref}</p>
          <div className="space-y-0.5">
            {all.map(l => {
              const typeConfig = logTypeConfig[l.log_type];
              return (
                <button
                  key={l.id}
                  onClick={() => onSelectLog(l.id)}
                  className={`w-full text-left flex items-center gap-2 p-1.5 rounded-lg text-xs transition hover:bg-slate-50 ${l.id === selectedLogId ? 'bg-[#2E5A1A]/5 font-medium' : ''}`}
                >
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${typeConfig?.badge || 'bg-slate-100 text-slate-600'}`}>
                    {typeConfig?.label || l.log_type}
                  </span>
                  {l.depth_from != null && <span className="text-[10px] text-slate-400">{l.depth_from}m</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}