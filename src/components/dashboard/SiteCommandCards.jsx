import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Drill, HardHat, Layers, MapPin, Users, Gauge, Package,
  Truck, ArrowRight, Wrench, CalendarDays, TrendingUp,
} from 'lucide-react';
import { format, differenceInCalendarDays } from 'date-fns';
import WidgetShell from '@/components/dashboard/WidgetShell';
import { Skeleton } from '@/components/StateViews';

const DISCIPLINE_CONFIG = {
  drilling: { icon: Drill, label: 'Drilling', badge: 'bg-blue-100 text-blue-700 ring-blue-200' },
  coring: { icon: Drill, label: 'Coring', badge: 'bg-blue-100 text-blue-700 ring-blue-200' },
  groundworks: { icon: HardHat, label: 'Groundworks', badge: 'bg-amber-100 text-amber-700 ring-amber-200' },
  trial_pit: { icon: HardHat, label: 'Trial Pits', badge: 'bg-amber-100 text-amber-700 ring-amber-200' },
  enabling: { icon: Layers, label: 'Enabling', badge: 'bg-violet-100 text-violet-700 ring-violet-200' },
  enabling_works: { icon: Layers, label: 'Enabling Works', badge: 'bg-violet-100 text-violet-700 ring-violet-200' },
  depot: { icon: Package, label: 'Depot', badge: 'bg-slate-100 text-slate-700 ring-slate-200' },
  supervisor: { icon: Users, label: 'Supervisor', badge: 'bg-slate-100 text-slate-700 ring-slate-200' },
  default: { icon: HardHat, label: 'Site', badge: 'bg-slate-100 text-slate-700 ring-slate-200' },
};

function getDiscipline(job) {
  const key = (job.primary_discipline || job.job_type || '').toLowerCase();
  for (const [k, v] of Object.entries(DISCIPLINE_CONFIG)) {
    if (key.includes(k)) return { key: k, ...v };
  }
  if (job.disciplines && job.disciplines.length > 0) {
    const type = (job.disciplines[0].type || '').toLowerCase();
    for (const [k, v] of Object.entries(DISCIPLINE_CONFIG)) {
      if (type.includes(k)) return { key: k, ...v };
    }
  }
  return { key: 'default', ...DISCIPLINE_CONFIG.default };
}

const DRILLING_METHOD_LABELS = {
  cp: 'Cable Percussion',
  rotary: 'Rotary',
  mixed: 'Mixed',
  not_applicable: null,
};

function ProgressBar({ value, max, colorClass }) {
  if (!max || max <= 0) return <span className="text-xs text-slate-400 italic">No target set</span>;
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold text-slate-600 tabular-nums">{pct}%</span>
    </div>
  );
}

function TimelineProgress({ job }) {
  if (!job.start_date || !job.end_date) return <span className="text-xs text-slate-400 italic">Dates not set</span>;
  const total = differenceInCalendarDays(new Date(job.end_date), new Date(job.start_date)) + 1;
  if (total <= 0) return <span className="text-xs text-slate-400 italic">Invalid dates</span>;
  const elapsed = Math.max(0, differenceInCalendarDays(new Date(), new Date(job.start_date)) + 1);
  const pct = Math.min(100, Math.round((elapsed / total) * 100));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Day {Math.min(elapsed, total)} of {total}</span>
        <span className="font-bold text-slate-600">{pct}%</span>
      </div>
      <ProgressBar value={elapsed} max={total} colorClass="bg-emerald-500" />
    </div>
  );
}

function DrillingBody({ job, crewNames, costItems }) {
  const rig = costItems.find(ci => ci.site_asset_id && ci.category === 'internal_equipment');
  const methodLabel = DRILLING_METHOD_LABELS[job.drilling_method] || DRILLING_METHOD_LABELS[job.disciplines?.find(d => d.drilling_method && d.drilling_method !== 'not_applicable')?.drilling_method];
  const meterage = job.meterage || 0;
  const target = job.meterage_target || job.disciplines?.find(d => d.meterage_target)?.meterage_target || 0;

  return (
    <div className="space-y-2.5">
      {rig && (
        <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
          <Drill className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-slate-700 flex-1 truncate">{rig.description}</span>
          <span className="text-[10px] font-bold text-blue-600 bg-blue-100 rounded-full px-2 py-0.5">RIG</span>
        </div>
      )}
      {methodLabel && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Wrench className="w-3.5 h-3.5" />
          <span>{methodLabel}</span>
        </div>
      )}
      <div>
        <div className="flex items-center gap-1.5 mb-1">
          <Gauge className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-semibold text-slate-600">Meterage Progress</span>
          {target > 0 && <span className="text-xs text-slate-400 tabular-nums">{meterage}m / {target}m</span>}
        </div>
        <ProgressBar value={meterage} max={target} colorClass="bg-blue-500" />
      </div>
      {crewNames.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <Users className="w-3.5 h-3.5 text-slate-400" />
          <span>{crewNames.join(', ')}</span>
        </div>
      )}
    </div>
  );
}

function GroundworksBody({ job, crewNames, costItems }) {
  const gearOnSite = costItems.filter(ci => ci.current_location === 'site').length;
  return (
    <div className="space-y-2.5">
      <div>
        <div className="flex items-center gap-1.5 mb-1">
          <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-semibold text-slate-600">Timeline</span>
        </div>
        <TimelineProgress job={job} />
      </div>
      {gearOnSite > 0 && (
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <Package className="w-3.5 h-3.5 text-slate-400" />
          <span>{gearOnSite} gear item{gearOnSite !== 1 ? 's' : ''} on site</span>
        </div>
      )}
      {crewNames.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <Users className="w-3.5 h-3.5 text-slate-400" />
          <span>{crewNames.join(', ')}</span>
        </div>
      )}
    </div>
  );
}

function EnablingBody({ job, crewNames }) {
  return (
    <div className="space-y-2.5">
      <div>
        <div className="flex items-center gap-1.5 mb-1">
          <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-semibold text-slate-600">Timeline</span>
        </div>
        <TimelineProgress job={job} />
      </div>
      {crewNames.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <Users className="w-3.5 h-3.5 text-slate-400" />
          <span>{crewNames.join(', ')}</span>
        </div>
      )}
    </div>
  );
}

function DefaultBody({ job, crewNames, costItems }) {
  const gearOnSite = costItems.filter(ci => ci.current_location === 'site').length;
  return (
    <div className="space-y-2.5">
      <div>
        <div className="flex items-center gap-1.5 mb-1">
          <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-semibold text-slate-600">Timeline</span>
        </div>
        <TimelineProgress job={job} />
      </div>
      {gearOnSite > 0 && (
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <Package className="w-3.5 h-3.5 text-slate-400" />
          <span>{gearOnSite} gear item{gearOnSite !== 1 ? 's' : ''} on site</span>
        </div>
      )}
      {crewNames.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <Users className="w-3.5 h-3.5 text-slate-400" />
          <span>{crewNames.join(', ')}</span>
        </div>
      )}
    </div>
  );
}

function SiteCard({ job, todayRotas, staff, costItems, deliveryLegs, onSelectJob }) {
  const discipline = getDiscipline(job);
  const DiscIcon = discipline.icon;
  const crew = todayRotas.filter(r => r.job_id === job.id);
  const crewNames = crew.map(r => staff.find(s => s.id === r.staff_id)?.name).filter(Boolean);
  const jobCostItems = costItems.filter(ci => ci.job_id === job.id);
  const jobLegs = deliveryLegs.filter(l => l.job_id === job.id);
  const activeLegs = jobLegs.filter(l => l.status !== 'complete');

  return (
    <div
      className="bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-md transition cursor-pointer"
      onClick={() => onSelectJob?.(job)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 flex-1">
          <h4 className="font-bold text-slate-800 text-sm truncate">{job.name}</h4>
          {job.location && (
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 truncate">
              <MapPin className="w-3 h-3 flex-shrink-0" />{job.location}
            </p>
          )}
        </div>
        <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold ring-1 flex-shrink-0 ${discipline.badge}`}>
          <DiscIcon className="w-3 h-3" />{discipline.label}
        </span>
      </div>

      {/* Domain-specific body */}
      {discipline.key === 'drilling' || discipline.key === 'coring' ? (
        <DrillingBody job={job} crewNames={crewNames} costItems={jobCostItems} />
      ) : discipline.key === 'groundworks' || discipline.key === 'trial_pit' ? (
        <GroundworksBody job={job} crewNames={crewNames} costItems={jobCostItems} />
      ) : discipline.key === 'enabling' || discipline.key === 'enabling_works' ? (
        <EnablingBody job={job} crewNames={crewNames} />
      ) : (
        <DefaultBody job={job} crewNames={crewNames} costItems={jobCostItems} />
      )}

      {/* Logistics footer */}
      {activeLegs.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-1.5 text-xs text-slate-500">
          <Truck className="w-3.5 h-3.5 text-amber-500" />
          <span>{activeLegs.length} active delivery leg{activeLegs.length !== 1 ? 's' : ''}</span>
        </div>
      )}
    </div>
  );
}

export default function SiteCommandCards({ onSelectJob }) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list(),
  });
  const { data: todayRotas = [] } = useQuery({
    queryKey: ['rotas-today-cards', todayStr],
    queryFn: () => base44.entities.RotaAssignment.filter({ assigned_date: todayStr }),
  });
  const { data: staff = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: () => base44.entities.Staff.list(),
  });
  const { data: costItems = [] } = useQuery({
    queryKey: ['cost-items-cards'],
    queryFn: () => base44.entities.JobCostItem.list('-created_date', 500),
  });
  const { data: deliveryLegs = [] } = useQuery({
    queryKey: ['delivery-legs-cards'],
    queryFn: () => base44.entities.DeliveryLeg.list('-created_date', 200),
  });

  const activeJobs = jobs
    .filter(j => j.status === 'in_progress')
    .slice(0, 6);

  const isLoading = jobsLoading;

  return (
    <WidgetShell
      title="Site Command Cards"
      subtitle={`${activeJobs.length} active site${activeJobs.length !== 1 ? 's' : ''} · domain-specific metrics`}
      icon={HardHat}
    >
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        </div>
      ) : activeJobs.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">No active sites right now.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {activeJobs.map(job => (
            <SiteCard
              key={job.id}
              job={job}
              todayRotas={todayRotas}
              staff={staff}
              costItems={costItems}
              deliveryLegs={deliveryLegs}
              onSelectJob={onSelectJob}
            />
          ))}
        </div>
      )}
    </WidgetShell>
  );
}