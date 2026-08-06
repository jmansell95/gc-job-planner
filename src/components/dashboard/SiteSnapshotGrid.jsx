import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  MapPin, Cog, ShieldCheck, ShieldAlert, ShieldX,
  ChevronRight, AlertTriangle, Activity, Radio, ClipboardList, CalendarClock, ChevronDown, Link2, Wrench, Package, Anchor, Users, Briefcase, Truck
} from 'lucide-react';
import { format, differenceInCalendarDays } from 'date-fns';
import { useJobFilter } from '@/components/dashboard/JobFilterContext';
import { getJobPrimaryType, getJobTypeLabel, getJobTypeColor } from '@/utils/jobTeams';
import { hasDiscipline, getJobDisciplines, getDisciplineConfig } from '@/utils/jobDisciplines';
import DisciplinePills from '@/components/disciplines/DisciplinePills';
import { Skeleton } from '@/components/StateViews';

const complianceConfig = {
  compliant: { icon: ShieldCheck, cls: 'text-emerald-600 bg-emerald-50 ring-emerald-200', dot: 'bg-emerald-500', label: 'Compliant' },
  expiring: { icon: ShieldAlert, cls: 'text-amber-600 bg-amber-50 ring-amber-200', dot: 'bg-amber-500', label: 'Expiring' },
  expired: { icon: ShieldX, cls: 'text-rose-600 bg-rose-50 ring-rose-200', dot: 'bg-rose-500', label: 'Expired' },
  unknown: { icon: ShieldCheck, cls: 'text-slate-500 bg-slate-100 ring-slate-200', dot: 'bg-slate-400', label: 'Unknown' },
};

const statusBadge = {
  in_progress: { cls: 'bg-emerald-500 text-white', label: 'Live', dot: 'bg-emerald-400' },
  decommissioning: { cls: 'bg-orange-500 text-white', label: 'Decom', dot: 'bg-orange-400' },
  planning: { cls: 'bg-blue-500 text-white', label: 'Planning', dot: 'bg-blue-400' },
  on_hold: { cls: 'bg-amber-500 text-white', label: 'On Hold', dot: 'bg-amber-400' },
};

const gearTypeIcon = {
  machinery: Wrench, trailer: Package, lifting: Anchor, vehicle: Package, portable_appliance: Package, rig: Cog,
};

function RigCard({ rigAsset, assetMap, costItems, jobId }) {
  const [expanded, setExpanded] = useState(false);
  const comp = complianceConfig[rigAsset.compliance_status] || complianceConfig.unknown;
  const CompIcon = comp.icon;
  const linkedIds = rigAsset.linked_equipment_ids || [];
  const onSite = rigAsset.on_site;

  const linkedOnJob = linkedIds
    .map(id => {
      const asset = assetMap[id];
      if (!asset) return null;
      const costItem = costItems.find(c => c.job_id === jobId && c.site_asset_id === id && (c.hire_status || 'active') === 'active');
      return asset && costItem ? { asset, costItem } : null;
    })
    .filter(Boolean);

  return (
    <div className="rounded-xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-white overflow-hidden">
      {/* Top row: icon + rig name (prominent, full width) */}
      <div className="flex items-center gap-2.5 px-3 pt-2.5 pb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${onSite ? 'bg-emerald-100' : 'bg-blue-100'}`}>
          <Cog className={`w-4 h-4 ${onSite ? 'text-emerald-600' : 'text-blue-600'}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-800 leading-tight truncate">{rigAsset.asset_name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {rigAsset.serial_number && (
              <span className="text-[10px] font-mono text-slate-400">#{rigAsset.serial_number}</span>
            )}
            {onSite && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />On site
              </span>
            )}
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold ring-1 ${comp.cls} flex-shrink-0`}>
          <CompIcon className="w-3 h-3" />{comp.label}
        </span>
      </div>
      {/* Linked gear toggle */}
      {linkedOnJob.length > 0 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100/60 transition border-t border-slate-200/60"
          >
            <Link2 className="w-3.5 h-3.5 text-slate-400" />
            {linkedOnJob.length} linked {linkedOnJob.length === 1 ? 'item' : 'items'}
            <ChevronDown className={`w-3.5 h-3.5 ml-auto transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
          {expanded && (
            <div className="px-3 pb-2.5 pt-1 space-y-1.5 bg-slate-50/50 border-t border-slate-200/60">
              {linkedOnJob.map(({ asset, costItem }) => {
                const GearIcon = gearTypeIcon[asset.asset_type] || Package;
                return (
                  <div key={asset.id} className="flex items-center gap-2 text-xs text-slate-600">
                    <GearIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="font-medium truncate flex-1">{asset.name}</span>
                    {asset.serial_number && <span className="text-[10px] font-mono text-slate-400">#{asset.serial_number}</span>}
                    {(costItem.current_location || 'yard') === 'site' && <span className="w-2 h-2 rounded-full bg-emerald-500" title="On site" />}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function SiteSnapshotGrid({ onSelectJob, onNavigate }) {
  const { selectedJobId, disciplineFilter, setDisciplineFilter } = useJobFilter();
  const isAll = selectedJobId === 'all';

  const { data: jobs = [], isLoading } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: costItems = [] } = useQuery({
    queryKey: ['job-cost-items-snapshot'],
    queryFn: () => base44.entities.JobCostItem.list('-updated_date', 500),
  });
  const { data: assets = [] } = useQuery({ queryKey: ['site-assets'], queryFn: () => base44.entities.SiteAsset.list('-created_date', 500) });
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: teams = [] } = useQuery({ queryKey: ['teams'], queryFn: () => base44.entities.Team.list() });

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const { data: todayRotas = [] } = useQuery({
    queryKey: ['rotas-today-snapshot', todayStr],
    queryFn: () => base44.entities.RotaAssignment.filter({ assigned_date: todayStr }),
  });

  const { data: invLogs = [] } = useQuery({
    queryKey: ['inv-logs-snapshot'],
    queryFn: () => base44.entities.InvestigationLog.list('-created_date', 100),
  });

  const { data: deliveryLegs = [] } = useQuery({
    queryKey: ['delivery-legs-snapshot'],
    queryFn: () => base44.entities.DeliveryLeg.list('-created_date', 200),
  });

  const assetMap = {};
  (assets || []).forEach(a => { assetMap[a.id] = a; });

  let scopedJobs = isAll
    ? jobs.filter(j => j.status === 'in_progress' || j.status === 'decommissioning')
    : jobs.filter(j => j.id === selectedJobId);
  if (disciplineFilter !== 'all') {
    scopedJobs = scopedJobs.filter(j => hasDiscipline(j, disciplineFilter));
  }

  const logsByJob = {};
  invLogs.forEach(l => { if (!logsByJob[l.job_id]) logsByJob[l.job_id] = 0; logsByJob[l.job_id]++; });

  const rotasByJob = {};
  todayRotas.forEach(r => { if (!rotasByJob[r.job_id]) rotasByJob[r.job_id] = []; rotasByJob[r.job_id].push(r); });

  const legsByJob = {};
  (deliveryLegs || []).forEach(l => { if (!legsByJob[l.job_id]) legsByJob[l.job_id] = []; legsByJob[l.job_id].push(l); });

  const activeAssetItems = (costItems || []).filter(c =>
    c.site_asset_id && c.site_asset_id.trim() !== '' &&
    (c.hire_status || 'active') === 'active' &&
    c.category !== 'labour' && c.category !== 'contractor_supplied' && c.category !== 'client_supplied'
  );

  const assetsByJob = {};
  activeAssetItems.forEach(c => {
    const asset = assetMap[c.site_asset_id];
    if (!asset) return;
    if (!assetsByJob[c.job_id]) assetsByJob[c.job_id] = [];
    assetsByJob[c.job_id].push({
      id: c.id, asset_id: asset.id, asset_name: asset.name || c.description,
      asset_type: asset.asset_type || 'machinery', serial_number: asset.serial_number || '',
      linked_equipment_ids: asset.linked_equipment_ids || [],
      compliance_status: asset.compliance_status || 'unknown',
      on_site: (c.current_location || 'yard') === 'site',
    });
  });

  const assessRisk = (job, jobRigs, jobRotas) => {
    const risks = [];
    const expiredRig = jobRigs.find(r => r.compliance_status === 'expired');
    const expiringRig = jobRigs.find(r => r.compliance_status === 'expiring');
    if (expiredRig) risks.push({ level: 'critical', reason: 'Rig compliance expired' });
    else if (expiringRig) risks.push({ level: 'warning', reason: 'Rig compliance expiring' });
    if (job.status === 'in_progress' && (!jobRotas || jobRotas.length === 0)) {
      risks.push({ level: 'warning', reason: 'No crew on site today' });
    }
    const primaryType = getJobPrimaryType(job, teams);
    const isDrilling = primaryType === 'cp_drilling' || primaryType === 'rotary_drilling';
    if (isDrilling && jobRigs.filter(r => r.asset_type === 'rig').length === 0) {
      risks.push({ level: 'info', reason: 'No rig assigned' });
    }
    return risks;
  };

  if (isLoading) {
    return (
      <div className="mb-6">
        <div className="flex items-center gap-2.5 mb-3 px-1">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center shadow-sm">
            <Radio className="w-4 h-4 text-white" />
          </div>
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Top 3 Active Sites</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-52 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (scopedJobs.length === 0) {
    return (
      <div className="mb-6">
        <div className="flex items-center gap-2.5 mb-3 px-1">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center shadow-sm">
            <Radio className="w-4 h-4 text-white" />
          </div>
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Top 3 Active Sites</h2>
        </div>
        <div className="insight-card rounded-2xl p-10 text-center">
          <Radio className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm font-medium">No active sites right now</p>
          <p className="text-slate-300 text-xs mt-1">Sites will appear here when jobs move to In Progress</p>
        </div>
      </div>
    );
  }

  const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
  const cardAnim = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } } };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="mb-6">
      <div className="flex items-center gap-2.5 mb-3 px-1">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center shadow-sm">
          <Radio className="w-4 h-4 text-white" />
        </div>
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Top 3 Active Sites</h2>
      </div>

      {/* Discipline filter strip */}
      {(() => {
        const allDisciplines = new Set();
        jobs.forEach(j => getJobDisciplines(j).forEach(d => allDisciplines.add(d.type)));
        const types = [...allDisciplines];
        if (types.length < 2) return null;
        return (
          <div className="flex flex-wrap items-center gap-1.5 mb-3 px-1">
            <button
              onClick={() => setDisciplineFilter('all')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition ${disciplineFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              All
            </button>
            {types.map(t => {
              const cfg = getDisciplineConfig(t);
              const active = disciplineFilter === t;
              return (
                <button
                  key={t}
                  onClick={() => setDisciplineFilter(active ? 'all' : t)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full transition inline-flex items-center gap-1.5 ${active ? 'ring-2 ring-offset-1 ' + cfg.badge : cfg.badge + ' hover:opacity-80'}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                  {cfg.label}
                </button>
              );
            })}
          </div>
        );
      })()}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {scopedJobs.slice(0, 3).map(job => {
          const jobAssets = assetsByJob[job.id] || [];
          const jobRigs = jobAssets.filter(a => a.asset_type === 'rig');
          const jobGear = jobAssets.filter(a => a.asset_type !== 'rig');
          const jobRotas = rotasByJob[job.id] || [];
          const crewToday = jobRotas.map(r => staff.find(s => s.id === r.staff_id)).filter(Boolean);
          const primaryType = getJobPrimaryType(job, teams);
          const st = statusBadge[job.status] || statusBadge.in_progress;
          const risks = assessRisk(job, jobRigs, jobRotas);
          const hasCritical = risks.some(r => r.level === 'critical');
          const activityCount = logsByJob[job.id] || 0;

          const meterageProgress = job.meterage_target > 0 && job.meterage != null
            ? Math.min(100, (Number(job.meterage) / job.meterage_target) * 100)
            : null;

          const jobLegs = legsByJob[job.id] || [];
          const activeLegs = jobLegs.filter(l => l.status !== 'complete');

          const drillingMethod = job.drilling_method || (job.disciplines || []).find(d => d.drilling_method && d.drilling_method !== 'not_applicable')?.drilling_method;
          const methodLabel = drillingMethod && drillingMethod !== 'not_applicable'
            ? (drillingMethod === 'cp' ? 'CP' : drillingMethod === 'rotary' ? 'Rotary' : drillingMethod === 'mixed' ? 'Mixed' : null)
            : null;

          let timelineProgress = null;
          if (meterageProgress == null && job.start_date && job.end_date) {
            const total = differenceInCalendarDays(new Date(job.end_date), new Date(job.start_date)) + 1;
            if (total > 0) {
              const elapsed = Math.max(0, differenceInCalendarDays(new Date(), new Date(job.start_date)) + 1);
              timelineProgress = { pct: Math.min(100, Math.round((elapsed / total) * 100)), elapsed: Math.min(elapsed, total), total };
            }
          }

          return (
            <motion.div
              key={job.id}
              variants={cardAnim}
              role="button"
              tabIndex={0}
              onClick={() => onSelectJob(job)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectJob(job); } }}
              className={`insight-card relative rounded-2xl p-5 text-left group overflow-hidden cursor-pointer ${hasCritical ? 'ring-2 ring-rose-300' : ''}`}
            >
              {/* Status accent bar */}
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${job.status === 'in_progress' ? 'bg-emerald-500' : 'bg-orange-500'}`} />

              {/* Header */}
              <div className="flex items-start justify-between gap-2 mb-3 pl-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${st.cls}`}>
                      <span className={`w-1.5 h-1.5 rounded-full bg-white/80 ${job.status === 'in_progress' ? 'animate-pulse' : ''}`} />
                      {st.label}
                    </span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{getJobTypeLabel(primaryType)}</span>
                    {methodLabel && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 ring-1 ring-blue-200">{methodLabel}</span>
                    )}
                    {job.job_reference && (
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">{job.job_reference}</span>
                    )}
                  </div>
                  <h3 className="font-bold text-slate-900 text-base leading-snug line-clamp-2">{job.name}</h3>
                  <p className="text-xs text-slate-400 truncate flex items-center gap-1 mt-1">
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0" /> {job.location || 'No location'}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-[#2E5A1A] group-hover:translate-x-0.5 transition flex-shrink-0 mt-1" />
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-2 mb-3 pl-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 text-xs">
                  <Cog className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-bold text-slate-700">{jobRigs.length}</span>
                  <span className="text-slate-400">{jobRigs.length === 1 ? 'Rig' : 'Rigs'}</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 text-xs">
                  <Wrench className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-bold text-slate-700">{jobGear.length}</span>
                  <span className="text-slate-400">Gear</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 text-xs">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-bold text-slate-700">{crewToday.length}</span>
                  <span className="text-slate-400">Crew</span>
                </div>
                {activityCount > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 text-xs">
                    <Activity className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-bold text-slate-700">{activityCount}</span>
                    <span className="text-slate-400">Logs</span>
                  </div>
                )}
                {activeLegs.length > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 text-xs">
                    <Truck className="w-3.5 h-3.5 text-amber-500" />
                    <span className="font-bold text-slate-700">{activeLegs.length}</span>
                    <span className="text-slate-400">Legs</span>
                  </div>
                )}
              </div>

              {/* Rigs */}
              {jobRigs.length > 0 ? (
                <div className="space-y-2 mb-3 pl-2" onClick={(e) => e.stopPropagation()}>
                  {jobRigs.map(r => (
                    <RigCard key={r.id} rigAsset={r} assetMap={assetMap} costItems={activeAssetItems} jobId={job.id} />
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2.5 mb-3 pl-4">
                  <Cog className="w-4 h-4 text-slate-300 flex-shrink-0" />
                  <span className="text-xs text-slate-400">No rig assigned</span>
                </div>
              )}

              {/* Crew avatars */}
              <div className="flex items-center gap-2.5 pl-2 pt-3 border-t border-slate-100">
                {crewToday.length > 0 ? (
                  <>
                    <div className="flex -space-x-2">
                      {crewToday.slice(0, 5).map(m => (
                        <div key={m.id} className="w-7 h-7 rounded-full bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] ring-2 ring-white flex items-center justify-center" title={m.name}>
                          <span className="text-white font-bold text-[10px]">{m.name?.charAt(0) || '?'}</span>
                        </div>
                      ))}
                      {crewToday.length > 5 && (
                        <div className="w-7 h-7 rounded-full bg-slate-200 ring-2 ring-white flex items-center justify-center">
                          <span className="text-slate-600 font-bold text-[10px]">+{crewToday.length - 5}</span>
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 truncate flex-1">{crewToday.map(m => m.name?.split(' ')[0]).join(', ')}</span>
                  </>
                ) : (
                  <span className="text-xs text-slate-400 italic">No crew on site today</span>
                )}
              </div>

              {/* Risk flags */}
              {risks.length > 0 && (
                <div className="mt-3 pl-2 flex flex-wrap gap-1.5">
                  {risks.map((r, i) => (
                    <span key={i} className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full font-semibold ${
                      r.level === 'critical' ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200' :
                      r.level === 'warning' ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' :
                      'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                    }`}>
                      <AlertTriangle className="w-3 h-3" />{r.reason}
                    </span>
                  ))}
                </div>
              )}

              {/* Drilling progress */}
              {meterageProgress != null && (
                <div className="mt-3 pl-2">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                    <span>Drilling progress</span>
                    <span className="font-semibold text-slate-600">{Math.round(meterageProgress)}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#2E5A1A] to-[#5A8C1E] rounded-full transition-all" style={{ width: `${meterageProgress}%` }} />
                  </div>
                </div>
              )}

              {/* Timeline progress (non-drilling jobs) */}
              {timelineProgress != null && (
                <div className="mt-3 pl-2">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                    <span>Timeline</span>
                    <span className="font-semibold text-slate-600">Day {timelineProgress.elapsed} of {timelineProgress.total}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full transition-all" style={{ width: `${timelineProgress.pct}%` }} />
                  </div>
                </div>
              )}

              {/* Quick actions */}
              {onNavigate && (
                <div className="mt-3 pl-2 flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <button type="button" onClick={() => onNavigate('scheduling')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#2E5A1A] bg-[#2E5A1A]/8 hover:bg-[#2E5A1A]/15 transition">
                    <CalendarClock className="w-3.5 h-3.5" /> Rota
                  </button>
                  <button type="button" onClick={() => onNavigate('log-qc')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 transition">
                    <ClipboardList className="w-3.5 h-3.5" /> Logs
                  </button>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* View All Jobs bar */}
      {onNavigate && scopedJobs.length > 0 && (
        <button
          onClick={() => onNavigate('jobs')}
          className="w-full mt-4 inline-flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:border-[#2E5A1A]/30 transition shadow-sm group"
        >
          <Briefcase className="w-4 h-4 text-[#2E5A1A] group-hover:scale-110 transition" />
          View All Jobs
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#2E5A1A] group-hover:translate-x-0.5 transition" />
        </button>
      )}
    </motion.div>
  );
}