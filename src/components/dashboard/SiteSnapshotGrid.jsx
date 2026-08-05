import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  MapPin, Cog, ShieldCheck, ShieldAlert, ShieldX,
  ChevronRight, AlertTriangle, Activity, Radio, ClipboardList, CalendarClock, ChevronDown, Link2, Wrench, Package, Anchor
} from 'lucide-react';
import { format } from 'date-fns';
import { useJobFilter } from '@/components/dashboard/JobFilterContext';
import { getJobPrimaryType, getJobTypeLabel, getJobTypeColor } from '@/utils/jobTeams';
import DisciplinePills from '@/components/disciplines/DisciplinePills';
import { Skeleton } from '@/components/StateViews';

const complianceConfig = {
  compliant: { icon: ShieldCheck, cls: 'text-emerald-600 bg-emerald-50 ring-emerald-200', dot: 'bg-emerald-500', label: 'Compliant' },
  expiring: { icon: ShieldAlert, cls: 'text-amber-600 bg-amber-50 ring-amber-200', dot: 'bg-amber-500', label: 'Expiring' },
  expired: { icon: ShieldX, cls: 'text-rose-600 bg-rose-50 ring-rose-200', dot: 'bg-rose-500', label: 'Expired' },
  unknown: { icon: ShieldCheck, cls: 'text-slate-500 bg-slate-100 ring-slate-200', dot: 'bg-slate-400', label: 'Unknown' },
};

const statusBadge = {
  in_progress: { cls: 'bg-emerald-100 text-emerald-700 ring-emerald-200', label: 'Live', dot: 'bg-emerald-500' },
  decommissioning: { cls: 'bg-orange-100 text-orange-700 ring-orange-200', label: 'Decom', dot: 'bg-orange-500' },
  planning: { cls: 'bg-blue-100 text-blue-700 ring-blue-200', label: 'Planning', dot: 'bg-blue-500' },
  on_hold: { cls: 'bg-amber-100 text-amber-700 ring-amber-200', label: 'On Hold', dot: 'bg-amber-500' },
};

const gearTypeIcon = {
  machinery: Wrench, trailer: Package, lifting: Anchor, vehicle: Package, portable_appliance: Package, rig: Cog,
};

function RigCard({ rigAsset, assetMap, costItems, jobId }) {
  const [expanded, setExpanded] = useState(false);
  const comp = complianceConfig[rigAsset.compliance_status] || complianceConfig.unknown;
  const CompIcon = comp.icon;
  const linkedIds = rigAsset.linked_equipment_ids || [];

  // Find linked gear that is also on this job
  const linkedOnJob = linkedIds
    .map(id => {
      const asset = assetMap[id];
      if (!asset) return null;
      const costItem = costItems.find(c => c.job_id === jobId && c.site_asset_id === id && (c.hire_status || 'active') === 'active');
      return asset && costItem ? { asset, costItem } : null;
    })
    .filter(Boolean);

  return (
    <div className="bg-gradient-to-r from-blue-50/60 to-slate-50 rounded-lg overflow-hidden border border-blue-100/50">
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <div className="w-6 h-6 rounded-md bg-blue-100 flex items-center justify-center flex-shrink-0">
          <Cog className="w-3.5 h-3.5 text-blue-600" />
        </div>
        <span className="text-xs font-semibold text-slate-800 truncate flex-1">{rigAsset.asset_name}</span>
        {rigAsset.serial_number && (
          <span className="text-[9px] font-mono text-slate-500 bg-white px-1 py-0.5 rounded flex-shrink-0">#{rigAsset.serial_number}</span>
        )}
        <span className={`inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full font-semibold ring-1 ${comp.cls} flex-shrink-0`}>
          <CompIcon className="w-2.5 h-2.5" />{comp.label}
        </span>
        {linkedOnJob.length > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-blue-600 hover:text-blue-800 px-1 py-0.5 rounded-md hover:bg-blue-100 transition flex-shrink-0"
          >
            <Link2 className="w-2.5 h-2.5" />
            {linkedOnJob.length}
            <ChevronDown className={`w-2.5 h-2.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>
      {expanded && linkedOnJob.length > 0 && (
        <div className="px-2.5 pb-2 pt-1 space-y-1 border-t border-slate-200/60">
          {linkedOnJob.map(({ asset, costItem }) => {
            const GearIcon = gearTypeIcon[asset.asset_type] || Package;
            return (
              <div key={asset.id} className="flex items-center gap-1.5 text-[11px] text-slate-600">
                <GearIcon className="w-3 h-3 text-slate-400 flex-shrink-0" />
                <span className="font-medium truncate flex-1">{asset.name}</span>
                {asset.serial_number && <span className="text-[9px] font-mono text-slate-400">#{asset.serial_number}</span>}
                <span className="text-[9px] text-slate-400 capitalize">{asset.asset_type}</span>
                {(costItem.current_location || 'yard') === 'site' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function SiteSnapshotGrid({ onSelectJob, onNavigate }) {
  const { selectedJobId } = useJobFilter();
  const isAll = selectedJobId === 'all';

  const { data: jobs = [], isLoading } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });
  // Source of truth: JobCostItem + SiteAsset (same as JobAssetsWidget).
  // JobAssetAssignment is an unreliable denormalised snapshot.
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

  const assetMap = {};
  (assets || []).forEach(a => { assetMap[a.id] = a; });

  // Only show active sites (in_progress, decommissioning) unless a specific job is focused
  const scopedJobs = isAll
    ? jobs.filter(j => j.status === 'in_progress' || j.status === 'decommissioning')
    : jobs.filter(j => j.id === selectedJobId);

  const logsByJob = {};
  invLogs.forEach(l => {
    if (!logsByJob[l.job_id]) logsByJob[l.job_id] = 0;
    logsByJob[l.job_id]++;
  });

  const rotasByJob = {};
  todayRotas.forEach(r => {
    if (!rotasByJob[r.job_id]) rotasByJob[r.job_id] = [];
    rotasByJob[r.job_id].push(r);
  });

  // Build assets-by-job from JobCostItem linked to SiteAsset (active only)
  const activeAssetItems = (costItems || []).filter(c =>
    c.site_asset_id &&
    c.site_asset_id.trim() !== '' &&
    (c.hire_status || 'active') === 'active' &&
    c.category !== 'labour' &&
    c.category !== 'contractor_supplied' &&
    c.category !== 'client_supplied'
  );

  const assetsByJob = {};
  activeAssetItems.forEach(c => {
    const asset = assetMap[c.site_asset_id];
    if (!asset) return;
    if (!assetsByJob[c.job_id]) assetsByJob[c.job_id] = [];
    assetsByJob[c.job_id].push({
      id: c.id,
      asset_id: asset.id,
      asset_name: asset.name || c.description,
      asset_type: asset.asset_type || 'machinery',
      serial_number: asset.serial_number || '',
      linked_equipment_ids: asset.linked_equipment_ids || [],
      compliance_status: asset.compliance_status || 'unknown',
      on_site: (c.current_location || 'yard') === 'site',
    });
  });

  // Risk assessment per site
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
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Live Site Activity</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 rounded-2xl" />)}
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
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Live Site Activity</h2>
        </div>
        <div className="insight-card rounded-2xl p-8 text-center">
          <Radio className="w-10 h-10 text-slate-200 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">No active sites right now</p>
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
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Live Site Activity</h2>
        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold">{scopedJobs.length} {scopedJobs.length === 1 ? 'Site' : 'Sites'}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {scopedJobs.map(job => {
          const jobAssets = assetsByJob[job.id] || [];
          const jobRigs = jobAssets.filter(a => a.asset_type === 'rig');
          const jobGear = jobAssets.filter(a => a.asset_type !== 'rig');
          const jobRotas = rotasByJob[job.id] || [];
          const crewToday = jobRotas.map(r => staff.find(s => s.id === r.staff_id)).filter(Boolean);
          const primaryType = getJobPrimaryType(job, teams);
          const colors = getJobTypeColor(primaryType);
          const st = statusBadge[job.status] || statusBadge.in_progress;
          const risks = assessRisk(job, jobRigs, jobRotas);
          const hasCritical = risks.some(r => r.level === 'critical');
          const activityCount = logsByJob[job.id] || 0;

          const meterageProgress = job.meterage_target > 0 && job.meterage != null
            ? Math.min(100, (Number(job.meterage) / job.meterage_target) * 100)
            : null;

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
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${colors.bar}`} />

              {/* Header row */}
              <div className="flex items-start justify-between gap-2 mb-3 pl-1.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${st.cls} ring-1`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${st.dot} ${job.status === 'in_progress' ? 'animate-pulse' : ''}`} />
                      {st.label}
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${colors.badge}`}>{getJobTypeLabel(primaryType)}</span>
                    {job.job_reference && (
                      <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">{job.job_reference}</span>
                    )}
                    <DisciplinePills job={job} size="sm" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm leading-tight truncate">{job.name}</h3>
                  <p className="text-xs text-slate-400 truncate flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 flex-shrink-0" /> {job.location || 'No location'}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#2E5A1A] group-hover:translate-x-0.5 transition flex-shrink-0" />
              </div>

              {/* Quick stats strip — colourful at-a-glance metrics */}
              <div className="flex items-center gap-1.5 mb-3 pl-1.5">
                <div className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-lg text-[10px] font-semibold">
                  <Cog className="w-3 h-3" />
                  {jobRigs.length} {jobRigs.length === 1 ? 'Rig' : 'Rigs'}
                </div>
                <div className="flex items-center gap-1 bg-purple-50 text-purple-700 px-2 py-1 rounded-lg text-[10px] font-semibold">
                  <Wrench className="w-3 h-3" />
                  {jobGear.length} Gear
                </div>
                <div className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg text-[10px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {crewToday.length} Crew
                </div>
                {activityCount > 0 && (
                  <div className="flex items-center gap-1 bg-violet-50 text-violet-700 px-2 py-1 rounded-lg text-[10px] font-semibold">
                    <Activity className="w-3 h-3" />
                    {activityCount}
                  </div>
                )}
              </div>

              {/* Rigs with serial + linked gear dropdown */}
              {jobRigs.length > 0 ? (
                <div className="space-y-1.5 mb-3 pl-1.5" onClick={(e) => e.stopPropagation()}>
                  {jobRigs.map(r => (
                    <RigCard key={r.id} rigAsset={r} assetMap={assetMap} costItems={activeAssetItems} jobId={job.id} />
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-2.5 py-1.5 mb-3 pl-2.5">
                  <Cog className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                  <span className="text-xs text-slate-400">No rig assigned</span>
                </div>
              )}



              {/* Crew avatars footer */}
              <div className="flex items-center gap-2 pl-1.5 pt-2 border-t border-slate-100">
                {crewToday.length > 0 ? (
                  <>
                    <div className="flex -space-x-1.5">
                      {crewToday.slice(0, 4).map(m => (
                        <div key={m.id} className="w-6 h-6 rounded-full bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] ring-2 ring-white flex items-center justify-center" title={m.name}>
                          <span className="text-white font-bold text-[9px]">{m.name?.charAt(0) || '?'}</span>
                        </div>
                      ))}
                      {crewToday.length > 4 && (
                        <div className="w-6 h-6 rounded-full bg-slate-200 ring-2 ring-white flex items-center justify-center">
                          <span className="text-slate-600 font-bold text-[9px]">+{crewToday.length - 4}</span>
                        </div>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500 truncate">{crewToday.map(m => m.name?.split(' ')[0]).join(', ')}</span>
                  </>
                ) : (
                  <span className="text-[11px] text-slate-400 italic">No crew on site today</span>
                )}
              </div>

              {/* Risk flags */}
              {risks.length > 0 && (
                <div className="mt-2.5 pl-1.5 flex flex-wrap gap-1">
                  {risks.map((r, i) => (
                    <span key={i} className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${
                      r.level === 'critical' ? 'bg-rose-100 text-rose-700' :
                      r.level === 'warning' ? 'bg-amber-100 text-amber-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      <AlertTriangle className="w-2.5 h-2.5" />{r.reason}
                    </span>
                  ))}
                </div>
              )}

              {/* Progress bar (drilling) */}
              {meterageProgress != null && (
                <div className="mt-2.5 pl-1.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                    <span>Drilling progress</span>
                    <span className="font-semibold text-slate-600">{Math.round(meterageProgress)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full" style={{ width: `${meterageProgress}%` }} />
                  </div>
                </div>
              )}

              {/* Quick actions */}
              {onNavigate && (
                <div className="mt-3 pl-1.5 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <button type="button" onClick={() => onNavigate('scheduling')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-[#2E5A1A] bg-[#2E5A1A]/8 hover:bg-[#2E5A1A]/15 transition">
                    <CalendarClock className="w-3 h-3" /> Rota
                  </button>
                  <button type="button" onClick={() => onNavigate('log-qc')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 transition">
                    <ClipboardList className="w-3 h-3" /> Logs
                  </button>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}