import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  FlaskConical, Layers, Ruler, TestTube, Wrench, MapPin, Package, ClipboardList, ArrowDownToLine,
  Droplets, Calculator, Gauge, Waves, Undo2, ShieldAlert, Camera, CheckCircle2, AlertTriangle, XCircle, Ban
} from 'lucide-react';
import { Skeleton, EmptyState } from '@/components/StateViews';
import {
  strataConfig, serviceEncounterConfig, pitStabilityConfig, reviewStatusConfig,
  fluidLossConfig, obstructionConfig,
  getMissingFields, getAnomalyFlags
} from '@/components/investigation/shared';

export default function InvestigationLogManager({ job, isDrillingJob }) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['investigation-logs', job.id],
    queryFn: () => base44.entities.InvestigationLog.filter({ job_id: job.id }),
  });

  const byDate = {};
  logs.forEach(l => {
    if (!byDate[l.date]) byDate[l.date] = [];
    byDate[l.date].push(l);
  });
  const sortedDates = Object.keys(byDate).sort().reverse();

  const totalDepth = logs.reduce((sum, l) => {
    if (l.depth_from != null && l.depth_to != null) return sum + (l.depth_to - l.depth_from);
    return sum;
  }, 0);
  const totalSamples = logs.filter(l => l.sample_type && l.sample_type !== 'none').length;
  const totalPits = logs.filter(l => l.log_type === 'pit_excavation').length;
  const totalInstallations = logs.filter(l => l.log_type === 'installation').reduce((sum, l) => sum + (l.units_completed || 0), 0);
  const uniqueBoreholes = [...new Set(logs.filter(l => l.borehole_ref).map(l => l.borehole_ref))];
  const pendingReview = logs.filter(l => (l.manager_review_status || 'pending') === 'pending').length;
  const queried = logs.filter(l => l.manager_review_status === 'queried').length;
  const standpipeReadings = logs.filter(l => l.log_type === 'standpipe_reading' || l.standpipe_ref);
  const standpipesByRef = {};
  standpipeReadings.forEach(l => {
    const ref = l.standpipe_ref || l.borehole_ref || '—';
    if (!standpipesByRef[ref]) standpipesByRef[ref] = [];
    standpipesByRef[ref].push(l);
  });
  const standpipeRefs = Object.keys(standpipesByRef).sort();

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 flex-wrap">
        <FlaskConical className="w-5 h-5 text-emerald-700" />
        <h2 className="font-semibold text-slate-900">Investigation Log</h2>
        <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{logs.length} entries</span>
        {pendingReview > 0 && (
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> {pendingReview} pending
          </span>
        )}
        {queried > 0 && (
          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1">
            <XCircle className="w-3 h-3" /> {queried} queried
          </span>
        )}
      </div>

      {logs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-5 py-4 bg-slate-50/50 border-b border-slate-100">
          {isDrillingJob ? (
            <>
              <div className="text-center">
                <p className="text-xs text-slate-400 uppercase font-medium">Total Depth</p>
                <p className="text-lg font-bold text-blue-700">{totalDepth.toFixed(1)}m</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400 uppercase font-medium">Boreholes</p>
                <p className="text-lg font-bold text-slate-800">{uniqueBoreholes.length}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400 uppercase font-medium">Samples</p>
                <p className="text-lg font-bold text-purple-700">{totalSamples}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400 uppercase font-medium">Entries</p>
                <p className="text-lg font-bold text-slate-800">{logs.length}</p>
              </div>
            </>
          ) : (
            <>
              <div className="text-center">
                <p className="text-xs text-slate-400 uppercase font-medium">Trial Pits</p>
                <p className="text-lg font-bold text-amber-700">{totalPits}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400 uppercase font-medium">Installations</p>
                <p className="text-lg font-bold text-emerald-700">{totalInstallations}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400 uppercase font-medium">Log Entries</p>
                <p className="text-lg font-bold text-slate-800">{logs.length}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400 uppercase font-medium">Days Logged</p>
                <p className="text-lg font-bold text-slate-800">{sortedDates.length}</p>
              </div>
            </>
          )}
        </div>
      )}

      <div className="p-5">
        {standpipeRefs.length > 0 && (
          <div className="mb-5 p-4 bg-cyan-50 rounded-xl border border-cyan-100">
            <div className="flex items-center gap-2 mb-3">
              <Gauge className="w-4 h-4 text-cyan-700" />
              <h3 className="text-sm font-bold text-cyan-900">Water Level Monitoring</h3>
              <span className="text-xs bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded-full font-medium">{standpipeRefs.length} standpipe{standpipeRefs.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="space-y-2">
              {standpipeRefs.map(ref => {
                const readings = standpipesByRef[ref].sort((a, b) => new Date(a.date) - new Date(b.date));
                const latest = readings[readings.length - 1];
                return (
                  <div key={ref} className="flex items-center gap-3 text-xs">
                    <span className="font-mono font-bold text-cyan-800 w-28 truncate">{ref}</span>
                    <div className="flex items-center gap-1.5 flex-1 flex-wrap">
                      {readings.map(r => (
                        <span key={r.id} className={`px-1.5 py-0.5 rounded-full font-medium ${r.id === latest.id ? 'bg-cyan-200 text-cyan-900' : 'bg-white text-cyan-700 border border-cyan-100'}`}>
                          {format(new Date(r.date), 'dd MMM')}: {r.standpipe_reading_m != null ? `${r.standpipe_reading_m}m` : '—'}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {isLoading ? (
          <Skeleton className="h-32 w-full rounded-lg" />
        ) : logs.length === 0 ? (
          <EmptyState icon={FlaskConical} title="No investigation logs yet" message={isDrillingJob ? "Drilling crews will log borehole progress and samples here during shifts." : "Groundworks crews will log trial pits, installations and site setup here during shifts."} />
        ) : (
          <div className="space-y-5">
            {sortedDates.map(date => {
              const dayLogs = byDate[date].sort((a, b) => (a.depth_from || 0) - (b.depth_from || 0));
              const d = new Date(date + 'T00:00:00');
              return (
                <div key={date}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{format(d, 'EEEE, dd MMM yyyy')}</span>
                    <span className="text-xs text-slate-400">{dayLogs.length} entries</span>
                  </div>
                  <div className="space-y-2">
                    {dayLogs.map(log => (
                      <LogEntryCard key={log.id} log={log} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function LogEntryCard({ log }) {
  const photos = (log.photo_urls || log.verification_photo_urls || '').split(',').filter(Boolean);
  const missing = getMissingFields(log);
  const anomalies = getAnomalyFlags(log);
  const reviewStatus = log.manager_review_status || 'pending';
  const rc = reviewStatusConfig[reviewStatus];
  const strata = log.strata_descriptor && strataConfig[log.strata_descriptor];
  const svc = log.service_encounter_type && serviceEncounterConfig[log.service_encounter_type];
  const stability = log.pit_stability_rating && pitStabilityConfig[log.pit_stability_rating];

  return (
    <div className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg">
      <div className={`w-1.5 h-full min-h-[2rem] rounded-full flex-shrink-0 ${reviewStatus === 'approved' ? 'bg-emerald-500' : reviewStatus === 'queried' ? 'bg-red-500' : 'bg-amber-500'}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${rc.badge}`}>{rc.label}</span>
          {log.borehole_ref && <span className="text-xs font-mono font-bold text-blue-700">{log.borehole_ref}</span>}
          {log.sample_id && <span className="text-xs font-mono font-bold text-purple-700">{log.sample_id}</span>}
          {log.core_run_number && <span className="text-xs font-mono text-purple-600">Run {log.core_run_number}</span>}
          <span className="text-xs text-slate-400 ml-auto inline-flex items-center gap-1">
            {log.completed_by_type && log.completed_by_type !== 'internal_staff' ? (
              <>
                <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-full font-medium">{log.completed_by_type === 'client' ? 'Client' : 'Contractor'}</span>
                {log.completed_by_name || ''}
              </>
            ) : log.staff_name}
          </span>
        </div>

        {/* Geotechnical data badges */}
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
          {strata && strata.label && log.strata_descriptor !== 'other' && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${strata.color}`}>{strata.label}</span>
          )}
          {log.groundwater_strike_depth != null && (
            <span className="text-xs bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
              <Droplets className="w-2.5 h-2.5" /> {log.groundwater_strike_depth}m
            </span>
          )}
          {log.coring_recovery != null && (
            <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
              <Layers className="w-2.5 h-2.5" /> {log.coring_recovery}%
            </span>
          )}
          {log.coring_rqd != null && (
            <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium">RQD {log.coring_rqd}%</span>
          )}
          {log.standpipe_ref && (
            <span className="text-xs bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
              <Gauge className="w-2.5 h-2.5" /> {log.standpipe_ref}{log.standpipe_reading_m != null ? ` · ${log.standpipe_reading_m}m` : ''}
            </span>
          )}
          {log.drilling_fluid_loss && log.drilling_fluid_loss !== 'none' && fluidLossConfig[log.drilling_fluid_loss] && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${fluidLossConfig[log.drilling_fluid_loss].badge}`}>
              {fluidLossConfig[log.drilling_fluid_loss].label}
            </span>
          )}
          {log.refusal_encountered && (
            <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
              <Ban className="w-2.5 h-2.5" /> Refusal
            </span>
          )}
          {log.obstruction_type && log.obstruction_type !== 'none' && obstructionConfig[log.obstruction_type] && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${obstructionConfig[log.obstruction_type].badge}`}>
              {obstructionConfig[log.obstruction_type].label}
            </span>
          )}
          {stability && log.pit_stability_rating !== 'not_assessed' && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${stability.badge} inline-flex items-center gap-0.5`}>
              <ShieldAlert className="w-2.5 h-2.5" /> {stability.label}
            </span>
          )}
          {svc && log.service_encounter_type !== 'none' && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5 ${svc.color}`}>
              <Waves className="w-2.5 h-2.5" /> {svc.label}
            </span>
          )}
          {log.cbr_value != null && (
            <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
              <Gauge className="w-2.5 h-2.5" /> CBR {log.cbr_value}%
            </span>
          )}
          {log.vane_strength != null && (
            <span className="text-xs bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium">Vane {log.vane_strength}kPa</span>
          )}
          {log.reinstatement_type && log.reinstatement_type !== 'none' && (
            <span className="text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
              <Undo2 className="w-2.5 h-2.5" /> {log.reinstatement_type.replace(/_/g, ' ')}
            </span>
          )}
          {photos.length > 0 && (
            <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
              <Camera className="w-2.5 h-2.5" /> {photos.length}
            </span>
          )}
        </div>

        {/* Text descriptions */}
        {log.strata_description_detail && <p className="text-sm text-slate-700 mt-1">{log.strata_description_detail}</p>}
        {log.description && <p className="text-sm text-slate-600 mt-0.5">{log.description}</p>}
        {log.backfill_material && <p className="text-xs text-slate-500 mt-0.5">Backfill: {log.backfill_material}</p>}
        {log.units_completed != null && log.units_completed > 0 && (
          <p className="text-sm text-slate-700 mt-0.5">{log.units_completed} {log.units_label || 'units'}</p>
        )}
        {log.dimensions && <p className="text-xs text-slate-500 mt-0.5">{log.dimensions}</p>}

        {/* Warnings */}
        {(missing.length > 0 || anomalies.length > 0) && (
          <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
            {missing.map((m, i) => (
              <span key={`m${i}`} className="text-xs bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
                <AlertTriangle className="w-2.5 h-2.5" /> {m}
              </span>
            ))}
            {anomalies.map((a, i) => (
              <span key={`a${i}`} className="text-xs bg-red-50 text-red-700 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
                <AlertTriangle className="w-2.5 h-2.5" /> {a}
              </span>
            ))}
          </div>
        )}

        {/* Manager review note */}
        {log.manager_review_note && (
          <div className="mt-1.5 p-2 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-xs text-slate-500">
              <span className="font-medium">Manager note ({log.manager_reviewed_by || ''}):</span> {log.manager_review_note}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}