import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { HardHat, TrendingUp, PoundSterling, Briefcase, ChevronRight, ChevronDown, Wrench, Truck } from 'lucide-react';
import { Skeleton } from '@/components/StateViews';
import { eachDayOfInterval, isWeekend } from 'date-fns';
import { useJobFilter } from '@/components/dashboard/JobFilterContext';

const fmtGBP = (n) => '£' + (Math.round((n || 0) * 100) / 100).toLocaleString('en-GB');

function workingDays(start, end) {
  if (!start || !end) return 0;
  const s = new Date(start), e = new Date(end);
  if (e < s) return 0;
  return eachDayOfInterval({ start: s, end }).filter(d => !isWeekend(d)).length;
}

const GEAR_META = {
  machinery: { label: 'Machinery', icon: Wrench, color: 'text-blue-700 bg-blue-50' },
  trailer: { label: 'Trailer', icon: Truck, color: 'text-amber-700 bg-amber-50' },
  vehicle: { label: 'Vehicle', icon: Truck, color: 'text-violet-700 bg-violet-50' },
  lifting: { label: 'Lifting Gear', icon: Wrench, color: 'text-rose-700 bg-rose-50' },
};

export default function AssetCrewProfitability() {
  const [expandedRigs, setExpandedRigs] = useState(new Set());
  const { selectedJobId } = useJobFilter();
  const isAllJobs = selectedJobId === 'all';

  const toggleRig = (id) => {
    setExpandedRigs(prev => { const s = new Set(prev); if (s.has(id)) s.delete(id); else s.add(id); return s; });
  };

  const { data: assets = [], isLoading } = useQuery({ queryKey: ['site-assets-profit'], queryFn: () => base44.entities.SiteAsset.list() });
  const { data: assignments = [] } = useQuery({ queryKey: ['job-asset-assignments-profit'], queryFn: () => base44.entities.JobAssetAssignment.list() });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs-profit'], queryFn: () => base44.entities.Job.list() });

  const scopedAssignments = isAllJobs ? assignments : assignments.filter(a => a.job_id === selectedJobId);
  const jobById = useMemo(() => Object.fromEntries(jobs.map(j => [j.id, j])), [jobs]);

  // Only rigs currently on jobs (active assignments without a returned_date)
  const rigRows = useMemo(() => {
    const today = new Date();
    const rigs = assets.filter(a => a.asset_type === 'rig');
    const rigById = Object.fromEntries(rigs.map(r => [r.id, r]));

    // active assignments for rigs (returned_date not set)
    const activeByRig = {};
    scopedAssignments.forEach(a => {
      if (!rigById[a.asset_id]) return;
      if (a.returned_date) return; // already returned — not currently on job
      if (!activeByRig[a.asset_id]) activeByRig[a.asset_id] = [];
      activeByRig[a.asset_id].push(a);
    });

    const gearById = Object.fromEntries(assets.filter(a => a.asset_type !== 'rig').map(g => [g.id, g]));

    return rigs
      .map(r => {
        const active = activeByRig[r.id] || [];
        const jobIds = [...new Set(active.map(a => a.job_id))];
        const jobNames = jobIds.map(id => jobById[id]?.name).filter(Boolean);
        // revenue = sum of day rate × working days on each active assignment
        let revenue = 0;
        let days = 0;
        active.forEach(a => {
          const job = jobById[a.job_id];
          const from = a.arrived_on_site_date || a.assigned_date || job?.start_date;
          const to = a.returned_date || job?.end_date || today;
          const d = workingDays(from, to);
          days += d;
          revenue += (r.daily_billing_rate || 0) * d;
        });
        const gear = (r.linked_equipment_ids || []).map(id => gearById[id]).filter(Boolean);
        return { id: r.id, name: r.name, rigType: r.rig_type, billingRate: r.daily_billing_rate || 0, revenue, days, jobIds, jobNames, gear };
      })
      .filter(r => r.jobIds.length > 0) // only rigs currently on jobs
      .sort((a, b) => b.revenue - a.revenue);
  }, [assets, scopedAssignments, jobById]);

  const totalRevenue = useMemo(() => rigRows.reduce((s, r) => s + r.revenue, 0), [rigRows]);
  const activeRigCount = rigRows.length;

  if (isLoading) {
    return (
      <div className="card-modern rounded-2xl p-5">
        <Skeleton className="h-6 w-56 mb-4" />
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
      </div>
    );
  }

  return (
    <div className="card-modern rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-sm flex-shrink-0">
          <HardHat className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900">Rigs on Jobs</h2>
          <p className="text-xs text-slate-500">Rigs currently deployed and their earnings</p>
        </div>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="rounded-xl border border-slate-100 p-3 bg-slate-50 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg stat-gradient-emerald flex items-center justify-center flex-shrink-0"><PoundSterling className="w-5 h-5 text-white" /></div>
            <div><p className="text-base font-bold text-slate-900">{fmtGBP(totalRevenue)}</p><p className="text-[11px] text-slate-500 font-medium">Revenue Earned</p></div>
          </div>
          <div className="rounded-xl border border-slate-100 p-3 bg-slate-50 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg stat-gradient-blue flex items-center justify-center flex-shrink-0"><HardHat className="w-5 h-5 text-white" /></div>
            <div><p className="text-base font-bold text-slate-900">{activeRigCount}</p><p className="text-[11px] text-slate-500 font-medium">Rigs Deployed</p></div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 overflow-hidden">
          {rigRows.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">No rigs currently on jobs. Assign a rig to a job to see earnings here.</div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50/50 text-slate-500">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium">Rig</th>
                      <th className="text-left px-4 py-2.5 font-medium">On Job</th>
                      <th className="text-right px-4 py-2.5 font-medium">Day Rate</th>
                      <th className="text-right px-4 py-2.5 font-medium">Days</th>
                      <th className="text-right px-4 py-2.5 font-medium">Earnings</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rigRows.map(r => {
                      const hasGear = r.gear.length > 0;
                      const isExpanded = expandedRigs.has(r.id);
                      return (
                        <React.Fragment key={r.id}>
                          <tr className={`hover:bg-emerald-50/20 transition ${hasGear ? 'cursor-pointer' : ''}`} onClick={hasGear ? () => toggleRig(r.id) : undefined}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {hasGear ? (
                                  <span className="w-5 h-5 flex items-center justify-center text-slate-400 flex-shrink-0">
                                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                  </span>
                                ) : <span className="w-5 h-5 flex-shrink-0" />}
                                <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-emerald-700 bg-emerald-50"><HardHat className="w-3.5 h-3.5" /></span>
                                <div className="min-w-0">
                                  <p className="font-medium text-slate-800 truncate max-w-[180px]">{r.name}{hasGear && <span className="ml-1.5 text-[10px] text-slate-400 font-normal">+{r.gear.length}</span>}</p>
                                  {r.rigType && r.rigType !== 'n/a' && <p className="text-[10px] text-slate-400">{r.rigType.toUpperCase()}</p>}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {r.jobNames.length > 0 ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5 max-w-[240px] truncate">
                                  <Briefcase className="w-3 h-3 flex-shrink-0" />
                                  <span className="truncate">{r.jobNames.join(', ')}</span>
                                </span>
                              ) : <span className="text-slate-300 text-[11px]">—</span>}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-500">{r.billingRate ? fmtGBP(r.billingRate) : '—'}</td>
                            <td className="px-4 py-3 text-right text-slate-600">{r.days}</td>
                            <td className="px-4 py-3 text-right font-bold text-emerald-700">{fmtGBP(r.revenue)}</td>
                          </tr>
                          {hasGear && isExpanded && r.gear.map(g => {
                            const meta = GEAR_META[g.asset_type] || GEAR_META.machinery;
                            const GIcon = meta.icon;
                            return (
                              <tr key={g.id} className="bg-slate-50/40">
                                <td className="px-4 py-2.5 pl-12">
                                  <div className="flex items-center gap-2">
                                    <span className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.color} opacity-70`}><GIcon className="w-3 h-3" /></span>
                                    <p className="text-xs font-medium text-slate-600 truncate max-w-[180px]">{g.name}</p>
                                  </div>
                                </td>
                                <td className="px-4 py-2.5" colSpan={4} />
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="md:hidden divide-y divide-slate-100">
                {rigRows.map(r => {
                  const hasGear = r.gear.length > 0;
                  const isExpanded = expandedRigs.has(r.id);
                  return (
                    <div key={r.id}>
                      <div className={`p-4 space-y-2 ${hasGear ? 'cursor-pointer' : ''}`} onClick={hasGear ? () => toggleRig(r.id) : undefined}>
                        <div className="flex items-center gap-2">
                          {hasGear && (
                            <span className="text-slate-400 flex-shrink-0">
                              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </span>
                          )}
                          <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-emerald-700 bg-emerald-50"><HardHat className="w-4 h-4" /></span>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-slate-800 text-sm truncate">{r.name}{hasGear && <span className="ml-1 text-[10px] text-slate-400 font-normal">+{r.gear.length}</span>}</p>
                            {r.jobNames.length > 0 && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 mt-0.5">
                                <Briefcase className="w-2.5 h-2.5 flex-shrink-0" />
                                <span className="truncate">{r.jobNames.join(', ')}</span>
                              </span>
                            )}
                          </div>
                          <span className="text-sm font-bold text-emerald-700 flex-shrink-0">{fmtGBP(r.revenue)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                          <span className="text-slate-500">{r.days} days · {r.billingRate ? fmtGBP(r.billingRate) + '/day' : 'No rate'}</span>
                        </div>
                      </div>
                      {hasGear && isExpanded && r.gear.map(g => {
                        const meta = GEAR_META[g.asset_type] || GEAR_META.machinery;
                        const GIcon = meta.icon;
                        return (
                          <div key={g.id} className="pl-10 pr-4 py-2.5 bg-slate-50/40 border-t border-slate-100/70 flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.color} opacity-70`}><GIcon className="w-3 h-3" /></span>
                            <p className="text-xs font-medium text-slate-600 truncate">{g.name}</p>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}