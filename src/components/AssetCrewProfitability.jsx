import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Wrench, Users, TrendingUp, TrendingDown, PoundSterling, Truck, Loader2, HardHat } from 'lucide-react';
import { Skeleton } from '@/components/StateViews';
import { eachDayOfInterval, isWeekend } from 'date-fns';

const fmtGBP = (n) => '£' + (Math.round((n || 0) * 100) / 100).toLocaleString('en-GB');

function workingDays(start, end) {
  if (!start || !end) return 0;
  const s = new Date(start), e = new Date(end);
  if (e < s) return 0;
  return eachDayOfInterval({ start: s, end }).filter(d => !isWeekend(d)).length;
}

const ASSET_TYPE_META = {
  rig: { label: 'Rig', icon: HardHat, color: 'text-emerald-700 bg-emerald-50' },
  machinery: { label: 'Machinery', icon: Wrench, color: 'text-blue-700 bg-blue-50' },
  trailer: { label: 'Trailer', icon: Truck, color: 'text-amber-700 bg-amber-50' },
  vehicle: { label: 'Vehicle', icon: Truck, color: 'text-violet-700 bg-violet-50' },
  lifting: { label: 'Lifting Gear', icon: Wrench, color: 'text-rose-700 bg-rose-50' },
};

export default function AssetCrewProfitability() {
  const [tab, setTab] = useState('assets');

  const { data: assets = [], isLoading: assetsLoading } = useQuery({ queryKey: ['site-assets-profit'], queryFn: () => base44.entities.SiteAsset.list() });
  const { data: assignments = [] } = useQuery({ queryKey: ['job-asset-assignments-profit'], queryFn: () => base44.entities.JobAssetAssignment.list() });
  const { data: costItems = [] } = useQuery({ queryKey: ['all-cost-items-profit'], queryFn: () => base44.entities.JobCostItem.list() });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs-profit'], queryFn: () => base44.entities.Job.list() });
  const { data: teams = [] } = useQuery({ queryKey: ['teams-profit'], queryFn: () => base44.entities.Team.list() });
  const { data: staff = [] } = useQuery({ queryKey: ['staff-profit'], queryFn: () => base44.entities.Staff.list() });
  const { data: timesheets = [] } = useQuery({ queryKey: ['timesheets-profit'], queryFn: () => base44.entities.Timesheet.list() });
  const { data: invLogs = [] } = useQuery({ queryKey: ['investigation-logs-profit'], queryFn: () => base44.entities.InvestigationLog.list() });
  const { data: deliveries = [] } = useQuery({ queryKey: ['delivery-logs-profit'], queryFn: () => base44.entities.DeliveryLog.list() });

  const jobById = useMemo(() => Object.fromEntries(jobs.map(j => [j.id, j])), [jobs]);

  // ---- Per-asset profitability ----
  const assetRows = useMemo(() => {
    const today = new Date();
    // hire cost per asset (internal = 0)
    const costByAsset = {};
    costItems.forEach(c => {
      if (!c.site_asset_id) return;
      if (c.category === 'contractor_supplied' || c.category === 'client_supplied') return;
      costByAsset[c.site_asset_id] = (costByAsset[c.site_asset_id] || 0) + (c.unit_cost || 0) * (c.quantity || 1);
    });

    // revenue & deployment days per asset from assignments
    const revByAsset = {};
    const daysByAsset = {};
    const jobsByAsset = {};
    assignments.forEach(a => {
      const job = jobById[a.job_id];
      const from = a.arrived_on_site_date || a.assigned_date || job?.start_date;
      const to = a.returned_date || job?.end_date || today;
      const days = workingDays(from, to);
      daysByAsset[a.asset_id] = (daysByAsset[a.asset_id] || 0) + days;
      jobsByAsset[a.asset_id] = (jobsByAsset[a.asset_id] || new Set());
      jobsByAsset[a.asset_id].add(a.job_id);
      const rate = assets.find(x => x.id === a.asset_id)?.daily_billing_rate || 0;
      revByAsset[a.asset_id] = (revByAsset[a.asset_id] || 0) + rate * days;
    });

    return assets.map(a => {
      const revenue = revByAsset[a.id] || 0;
      const cost = costByAsset[a.id] || 0;
      const days = daysByAsset[a.id] || 0;
      const jobCount = jobsByAsset[a.id]?.size || 0;
      const profit = revenue - cost;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
      const utilPct = days > 0 ? Math.min(100, Math.round((days / 250) * 100)) : 0; // ~250 working days/yr
      return {
        id: a.id, name: a.name, type: a.asset_type, rigType: a.rig_type,
        billingRate: a.daily_billing_rate || 0,
        revenue, cost, profit, margin, days, jobCount, utilPct,
        active: a.is_active !== false,
      };
    }).filter(r => r.days > 0 || r.cost > 0 || r.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);
  }, [assets, assignments, costItems, jobById]);

  const assetTotals = useMemo(() => assetRows.reduce((acc, r) => ({
    revenue: acc.revenue + r.revenue, cost: acc.cost + r.cost, profit: acc.profit + r.profit, days: acc.days + r.days,
  }), { revenue: 0, cost: 0, profit: 0, days: 0 }), [assetRows]);

  // ---- Per-crew revenue ----
  const crewRows = useMemo(() => {
    const staffByTeam = {};
    staff.forEach(s => {
      if (!s.team_id) return;
      if (!staffByTeam[s.team_id]) staffByTeam[s.team_id] = [];
      staffByTeam[s.team_id].push(s.id);
    });
    const staffIdSet = (teamId) => new Set(staffByTeam[teamId] || []);

    // revenue from chargeable timesheets
    const timesheetRevByTeam = {};
    timesheets.forEach(t => {
      if (!t.chargeable || !t.charge_amount) return;
      for (const teamId of Object.keys(staffByTeam)) {
        if (staffIdSet(teamId).has(t.staff_id)) {
          timesheetRevByTeam[teamId] = (timesheetRevByTeam[teamId] || 0) + t.charge_amount;
          break;
        }
      }
    });
    // revenue from investigation logs
    const invRevByTeam = {};
    invLogs.forEach(l => {
      if (!l.charge_amount) return;
      for (const teamId of Object.keys(staffByTeam)) {
        if (staffIdSet(teamId).has(l.staff_id)) {
          invRevByTeam[teamId] = (invRevByTeam[teamId] || 0) + l.charge_amount;
          break;
        }
      }
    });
    // revenue from deliveries (driver)
    const delivRevByTeam = {};
    deliveries.forEach(d => {
      if (!d.charge_amount) return;
      for (const teamId of Object.keys(staffByTeam)) {
        if (staffIdSet(teamId).has(d.driver_staff_id)) {
          delivRevByTeam[teamId] = (delivRevByTeam[teamId] || 0) + d.charge_amount;
          break;
        }
      }
    });

    return teams.map(t => {
      const memberIds = staffByTeam[t.id] || [];
      const activeMembers = staff.filter(s => s.team_id === t.id && s.is_active !== false).length;
      const revenue = (timesheetRevByTeam[t.id] || 0) + (invRevByTeam[t.id] || 0) + (delivRevByTeam[t.id] || 0);
      return {
        id: t.id, name: t.name, revenueStream: t.revenue_stream_type, markup: t.billing_default_markup || 0,
        members: memberIds.length, activeMembers,
        taskRevenue: timesheetRevByTeam[t.id] || 0,
        invRevenue: invRevByTeam[t.id] || 0,
        delivRevenue: delivRevByTeam[t.id] || 0,
      };
    }).filter(r => r.members > 0 || r.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);
  }, [teams, staff, timesheets, invLogs, deliveries]);

  const crewTotals = useMemo(() => crewRows.reduce((acc, r) => ({
    revenue: acc.revenue + r.revenue,
    taskRevenue: acc.taskRevenue + r.taskRevenue,
    invRevenue: acc.invRevenue + r.invRevenue,
    delivRevenue: acc.delivRevenue + r.delivRevenue,
  }), { revenue: 0, taskRevenue: 0, invRevenue: 0, delivRevenue: 0 }), [crewRows]);

  const REVENUE_STREAM_LABELS = {
    none: 'Per task', drilling_meterage: '£/m drilled', groundworks_unit: '£/unit', coring_unit: '£/core run',
    trial_pit_unit: '£/pit', day_rate: 'Daily rate', flat_fee: 'Flat fee',
  };

  if (assetsLoading && tab === 'assets') {
    return (
      <div className="card-modern rounded-2xl p-5">
        <Skeleton className="h-6 w-56 mb-4" />
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
      </div>
    );
  }

  return (
    <div className="card-modern rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-sm flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Revenue by Asset & Crew</h2>
            <p className="text-xs text-slate-500">Live revenue vs cost — per rig/equipment and per crew</p>
          </div>
        </div>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          <button onClick={() => setTab('assets')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${tab === 'assets' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}>
            <Wrench className="w-3.5 h-3.5 inline mr-1" /> Assets
          </button>
          <button onClick={() => setTab('crews')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${tab === 'crews' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}>
            <Users className="w-3.5 h-3.5 inline mr-1" /> Crews
          </button>
        </div>
      </div>

      <div className="p-5">
        {/* Summary stats */}
        {tab === 'assets' ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <div className="rounded-xl border border-slate-100 p-3 bg-slate-50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg stat-gradient-emerald flex items-center justify-center flex-shrink-0"><PoundSterling className="w-5 h-5 text-white" /></div>
              <div><p className="text-base font-bold text-slate-900">{fmtGBP(assetTotals.revenue)}</p><p className="text-[11px] text-slate-500 font-medium">Asset Revenue</p></div>
            </div>
            <div className="rounded-xl border border-slate-100 p-3 bg-slate-50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg stat-gradient-blue flex items-center justify-center flex-shrink-0"><Wrench className="w-5 h-5 text-white" /></div>
              <div><p className="text-base font-bold text-slate-900">{fmtGBP(assetTotals.cost)}</p><p className="text-[11px] text-slate-500 font-medium">Hire Cost</p></div>
            </div>
            <div className="rounded-xl border border-slate-100 p-3 bg-slate-50 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${assetTotals.profit >= 0 ? 'stat-gradient-amber' : 'stat-gradient-rose'}`}>
                {assetTotals.profit >= 0 ? <TrendingUp className="w-5 h-5 text-white" /> : <TrendingDown className="w-5 h-5 text-white" />}
              </div>
              <div><p className="text-base font-bold text-slate-900">{fmtGBP(assetTotals.profit)}</p><p className="text-[11px] text-slate-500 font-medium">Gross Profit</p></div>
            </div>
            <div className="rounded-xl border border-slate-100 p-3 bg-slate-50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg stat-gradient-slate flex items-center justify-center flex-shrink-0"><HardHat className="w-5 h-5 text-white" /></div>
              <div><p className="text-base font-bold text-slate-900">{assetTotals.days}</p><p className="text-[11px] text-slate-500 font-medium">Deploy Days</p></div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <div className="rounded-xl border border-slate-100 p-3 bg-slate-50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg stat-gradient-emerald flex items-center justify-center flex-shrink-0"><PoundSterling className="w-5 h-5 text-white" /></div>
              <div><p className="text-base font-bold text-slate-900">{fmtGBP(crewTotals.revenue)}</p><p className="text-[11px] text-slate-500 font-medium">Crew Revenue</p></div>
            </div>
            <div className="rounded-xl border border-slate-100 p-3 bg-slate-50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg stat-gradient-blue flex items-center justify-center flex-shrink-0"><Users className="w-5 h-5 text-white" /></div>
              <div><p className="text-base font-bold text-slate-900">{crewRows.reduce((s, r) => s + r.activeMembers, 0)}</p><p className="text-[11px] text-slate-500 font-medium">Active Crew</p></div>
            </div>
            <div className="rounded-xl border border-slate-100 p-3 bg-slate-50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg stat-gradient-amber flex items-center justify-center flex-shrink-0"><HardHat className="w-5 h-5 text-white" /></div>
              <div><p className="text-base font-bold text-slate-900">{fmtGBP(crewTotals.invRevenue)}</p><p className="text-[11px] text-slate-500 font-medium">Investigation</p></div>
            </div>
            <div className="rounded-xl border border-slate-100 p-3 bg-slate-50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg stat-gradient-slate flex items-center justify-center flex-shrink-0"><Truck className="w-5 h-5 text-white" /></div>
              <div><p className="text-base font-bold text-slate-900">{fmtGBP(crewTotals.delivRevenue)}</p><p className="text-[11px] text-slate-500 font-medium">Deliveries</p></div>
            </div>
          </div>
        )}

        {/* Asset table */}
        {tab === 'assets' && (
          <div className="rounded-xl border border-slate-100 overflow-hidden">
            {assetRows.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm">No deployed assets yet. Assign rigs or equipment to jobs to see revenue vs cost.</div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50/50 text-slate-500">
                      <tr>
                        <th className="text-left px-4 py-2.5 font-medium">Asset</th>
                        <th className="text-right px-4 py-2.5 font-medium">Day Rate</th>
                        <th className="text-right px-4 py-2.5 font-medium">Deploy Days</th>
                        <th className="text-right px-4 py-2.5 font-medium">Jobs</th>
                        <th className="text-right px-4 py-2.5 font-medium">Revenue</th>
                        <th className="text-right px-4 py-2.5 font-medium">Hire Cost</th>
                        <th className="text-right px-4 py-2.5 font-medium">Profit</th>
                        <th className="text-right px-4 py-2.5 font-medium">Margin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {assetRows.map(r => {
                        const meta = ASSET_TYPE_META[r.type] || ASSET_TYPE_META.machinery;
                        const Icon = meta.icon;
                        return (
                          <tr key={r.id} className="hover:bg-emerald-50/20 transition">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.color}`}><Icon className="w-3.5 h-3.5" /></span>
                                <div className="min-w-0">
                                  <p className="font-medium text-slate-800 truncate max-w-[180px]">{r.name}</p>
                                  <p className="text-[10px] text-slate-400">{meta.label}{r.rigType && r.rigType !== 'n/a' ? ` · ${r.rigType.toUpperCase()}` : ''}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right text-slate-500">{r.billingRate ? fmtGBP(r.billingRate) : '—'}</td>
                            <td className="px-4 py-3 text-right text-slate-600">{r.days}</td>
                            <td className="px-4 py-3 text-right text-slate-600">{r.jobCount}</td>
                            <td className="px-4 py-3 text-right font-semibold text-emerald-700">{fmtGBP(r.revenue)}</td>
                            <td className="px-4 py-3 text-right text-slate-600">{fmtGBP(r.cost)}</td>
                            <td className={`px-4 py-3 text-right font-bold ${r.profit >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>{fmtGBP(r.profit)}</td>
                            <td className="px-4 py-3 text-right">
                              <span className={`font-bold ${r.margin >= 40 ? 'text-emerald-600' : r.margin >= 20 ? 'text-amber-600' : 'text-rose-600'}`}>
                                {r.revenue > 0 ? r.margin.toFixed(0) + '%' : '—'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-slate-100">
                  {assetRows.map(r => {
                    const meta = ASSET_TYPE_META[r.type] || ASSET_TYPE_META.machinery;
                    const Icon = meta.icon;
                    return (
                      <div key={r.id} className="p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.color}`}><Icon className="w-4 h-4" /></span>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-slate-800 text-sm truncate">{r.name}</p>
                            <p className="text-[10px] text-slate-400">{meta.label} · {r.days} days · {r.jobCount} jobs</p>
                          </div>
                          <span className={`text-sm font-bold flex-shrink-0 ${r.profit >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>{fmtGBP(r.profit)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                          <span className="text-slate-500">Revenue <span className="font-semibold text-emerald-700">{fmtGBP(r.revenue)}</span></span>
                          <span className="text-slate-500">Cost <span className="font-semibold text-slate-700">{fmtGBP(r.cost)}</span></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* Crew table */}
        {tab === 'crews' && (
          <div className="rounded-xl border border-slate-100 overflow-hidden">
            {crewRows.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm">No crews with revenue yet. Assign staff to crews and log chargeable tasks to see crew revenue.</div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50/50 text-slate-500">
                      <tr>
                        <th className="text-left px-4 py-2.5 font-medium">Crew</th>
                        <th className="text-left px-4 py-2.5 font-medium">Revenue Stream</th>
                        <th className="text-right px-4 py-2.5 font-medium">Members</th>
                        <th className="text-right px-4 py-2.5 font-medium">Tasks</th>
                        <th className="text-right px-4 py-2.5 font-medium">Investigation</th>
                        <th className="text-right px-4 py-2.5 font-medium">Deliveries</th>
                        <th className="text-right px-4 py-2.5 font-medium">Total Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {crewRows.map(r => (
                        <tr key={r.id} className="hover:bg-emerald-50/20 transition">
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-800 truncate max-w-[160px]">{r.name}</p>
                            {r.markup > 0 && <p className="text-[10px] text-slate-400">+{r.markup}% markup</p>}
                          </td>
                          <td className="px-4 py-3 text-slate-500">{REVENUE_STREAM_LABELS[r.revenueStream] || '—'}</td>
                          <td className="px-4 py-3 text-right text-slate-600">{r.activeMembers}</td>
                          <td className="px-4 py-3 text-right text-slate-600">{fmtGBP(r.taskRevenue)}</td>
                          <td className="px-4 py-3 text-right text-slate-600">{fmtGBP(r.invRevenue)}</td>
                          <td className="px-4 py-3 text-right text-slate-600">{fmtGBP(r.delivRevenue)}</td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-700">{fmtGBP(r.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="md:hidden divide-y divide-slate-100">
                  {crewRows.map(r => (
                    <div key={r.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800 text-sm truncate">{r.name}</p>
                          <p className="text-[10px] text-slate-400">{REVENUE_STREAM_LABELS[r.revenueStream]} · {r.activeMembers} members</p>
                        </div>
                        <p className="text-sm font-bold text-emerald-700 flex-shrink-0">{fmtGBP(r.revenue)}</p>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                        <span>Tasks {fmtGBP(r.taskRevenue)}</span>
                        <span>Inv {fmtGBP(r.invRevenue)}</span>
                        <span>Del {fmtGBP(r.delivRevenue)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}