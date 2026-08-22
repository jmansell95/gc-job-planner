import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  TrendingUp, TrendingDown, Loader2, Search, Calendar,
  Trophy, Wrench, Clock, PoundSterling, Filter,
} from 'lucide-react';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 });
const fmtPct = (n) => (n > 0 ? '+' : '') + Number(n || 0).toFixed(1) + '%';

/**
 * RigProfitabilityView — shows each rig's earned vs cost with margin %.
 * Filterable by date range. Mobile card layout + desktop table.
 */
export default function RigProfitabilityView({ dateRange }) {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['rig-profitability', dateRange],
    queryFn: async () => {
      const res = await base44.functions.invoke('getRigProfitability', dateRange);
      return res.data || res;
    },
  });

  const rigs = useMemo(() => {
    if (!data?.rigs) return [];
    if (!search) return data.rigs;
    const q = search.toLowerCase();
    return data.rigs.filter(r => (r.rig_name || '').toLowerCase().includes(q));
  }, [data, search]);

  if (isLoading) {
    return (
      <div className="insight-card rounded-2xl p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (!data?.rigs || data.rigs.length === 0) {
    return (
      <div className="insight-card rounded-2xl p-6 sm:p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
          <TrendingUp className="w-7 h-7 text-slate-300" />
        </div>
        <p className="text-sm font-semibold text-slate-500">No rig data in this period</p>
        <p className="text-xs text-slate-400 mt-1">Assign rigs to jobs and populate AFPs to see profitability.</p>
      </div>
    );
  }

  const totals = data.totals || {};

  return (
    <div className="space-y-3">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <KPICard icon={PoundSterling} label="Total Earned" value={fmt(totals.total_earned)} gradient="stat-gradient-brand" />
        <KPICard icon={Wrench} label="Total Cost" value={fmt(totals.total_cost)} gradient="stat-gradient-rose" />
        <KPICard icon={TrendingUp} label="Total Margin" value={fmt(totals.total_margin)} gradient="stat-gradient-emerald" />
        <KPICard icon={Trophy} label="Active Rigs" value={totals.rigs_count || 0} gradient="stat-gradient-amber" />
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search rigs…"
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#2E5A1A]"
        />
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-2.5">
        {rigs.map((rig, i) => {
          const isProfit = rig.margin >= 0;
          return (
            <div key={rig.rig_id} className="insight-card rounded-2xl p-3.5 relative overflow-hidden">
              {i === 0 && rig.earned > 0 && (
                <div className="absolute top-0 right-0 px-2 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-bold rounded-bl-lg flex items-center gap-1">
                  <Trophy className="w-2.5 h-2.5" /> TOP
                </div>
              )}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-800 text-sm truncate">{rig.rig_name}</p>
                  <p className="text-[10px] text-slate-400 uppercase">{rig.rig_type} · {rig.jobs_count} jobs</p>
                </div>
                <span className={`text-sm font-bold tabular-nums ${isProfit ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {fmtPct(rig.margin_pct)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-center">
                <div className="px-1.5 py-1.5 rounded-lg bg-emerald-50">
                  <p className="text-[9px] text-emerald-600 uppercase font-semibold">Earned</p>
                  <p className="text-xs font-bold text-emerald-700 tabular-nums">{fmt(rig.earned)}</p>
                </div>
                <div className="px-1.5 py-1.5 rounded-lg bg-rose-50">
                  <p className="text-[9px] text-rose-600 uppercase font-semibold">Cost</p>
                  <p className="text-xs font-bold text-rose-600 tabular-nums">{fmt(rig.cost)}</p>
                </div>
                <div className={`px-1.5 py-1.5 rounded-lg ${isProfit ? 'bg-slate-50' : 'bg-rose-50'}`}>
                  <p className="text-[9px] text-slate-400 uppercase font-semibold">Margin</p>
                  <p className={`text-xs font-bold tabular-nums ${isProfit ? 'text-slate-700' : 'text-rose-600'}`}>{fmt(rig.margin)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400">
                <span className="inline-flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {rig.operating_hours}h</span>
                <span className={`inline-flex items-center gap-1 ${rig.maintenance_status === 'overdue' ? 'text-rose-500' : rig.maintenance_status === 'due_soon' ? 'text-amber-500' : ''}`}>
                  ● {rig.maintenance_status}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="insight-card rounded-2xl overflow-hidden hidden sm:block">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50/80">
              <tr className="text-slate-500 uppercase tracking-wide text-[10px]">
                <th className="text-left px-3 py-2.5 font-semibold">Rank</th>
                <th className="text-left px-3 py-2.5 font-semibold">Rig</th>
                <th className="text-center px-3 py-2.5 font-semibold">Type</th>
                <th className="text-right px-3 py-2.5 font-semibold">Jobs</th>
                <th className="text-right px-3 py-2.5 font-semibold">Hours</th>
                <th className="text-right px-3 py-2.5 font-semibold">Earned</th>
                <th className="text-right px-3 py-2.5 font-semibold">Cost</th>
                <th className="text-right px-3 py-2.5 font-semibold">Margin</th>
                <th className="text-right px-3 py-2.5 font-semibold">Margin %</th>
                <th className="text-center px-3 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rigs.map((rig, i) => {
                const isProfit = rig.margin >= 0;
                return (
                  <tr key={rig.rig_id} className="hover:bg-emerald-50/30 transition">
                    <td className="px-3 py-2.5">
                      {i === 0 && rig.earned > 0 ? (
                        <span className="inline-flex items-center gap-1 text-amber-600 font-bold">
                          <Trophy className="w-3 h-3" /> {i + 1}
                        </span>
                      ) : (
                        <span className="text-slate-400 tabular-nums">{i + 1}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-slate-800">{rig.rig_name}</td>
                    <td className="text-center px-3 py-2.5 text-slate-500 uppercase text-[10px]">{rig.rig_type}</td>
                    <td className="text-right px-3 py-2.5 text-slate-600 tabular-nums">{rig.jobs_count}</td>
                    <td className="text-right px-3 py-2.5 text-slate-600 tabular-nums">{rig.operating_hours}h</td>
                    <td className="text-right px-3 py-2.5 font-semibold text-emerald-700 tabular-nums">{fmt(rig.earned)}</td>
                    <td className="text-right px-3 py-2.5 text-rose-600 tabular-nums">{fmt(rig.cost)}</td>
                    <td className={`text-right px-3 py-2.5 font-bold tabular-nums ${isProfit ? 'text-slate-800' : 'text-rose-600'}`}>{fmt(rig.margin)}</td>
                    <td className={`text-right px-3 py-2.5 font-bold tabular-nums ${isProfit ? 'text-emerald-700' : 'text-rose-600'}`}>{fmtPct(rig.margin_pct)}</td>
                    <td className="text-center px-3 py-2.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        rig.maintenance_status === 'overdue' ? 'bg-rose-100 text-rose-700' :
                        rig.maintenance_status === 'due_soon' ? 'bg-amber-100 text-amber-700' :
                        rig.maintenance_status === 'ok' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {rig.maintenance_status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50/80 border-t-2 border-slate-200">
              <tr className="font-bold text-slate-800">
                <td colSpan={5} className="px-3 py-2.5">Portfolio Total ({rigs.length} rigs)</td>
                <td className="text-right px-3 py-2.5 text-emerald-700 tabular-nums">{fmt(totals.total_earned)}</td>
                <td className="text-right px-3 py-2.5 text-rose-600 tabular-nums">{fmt(totals.total_cost)}</td>
                <td className="text-right px-3 py-2.5 tabular-nums">{fmt(totals.total_margin)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function KPICard({ icon: Icon, label, value, gradient }) {
  return (
    <div className="insight-card rounded-2xl p-3.5 relative overflow-hidden">
      <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full ${gradient} opacity-[0.08]`} />
      <div className={`relative w-9 h-9 rounded-lg ${gradient} flex items-center justify-center mb-2 shadow-sm`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <p className="relative text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="relative text-lg sm:text-xl font-bold text-slate-900 tabular-nums leading-tight mt-0.5">{value}</p>
    </div>
  );
}