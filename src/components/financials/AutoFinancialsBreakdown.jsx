import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  PoundSterling, TrendingUp, Percent, Calculator, AlertTriangle,
  Loader2, RefreshCw, Mountain, ChevronDown, ChevronRight, User,
  CheckCircle2, XCircle, FileText, Target, Gauge, Truck, Save, Check, Ruler
} from 'lucide-react';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#2E5A1A] text-sm";

const ROLE_LABELS = {
  driller: { label: 'Driller', color: 'bg-amber-100 text-amber-700' },
  engineer: { label: 'Engineer', color: 'bg-blue-100 text-blue-700' },
  groundworker: { label: 'Groundworker', color: 'bg-emerald-100 text-emerald-700' },
  enabling_crew: { label: 'Enabling Crew', color: 'bg-violet-100 text-violet-700' },
  supervisor: { label: 'Supervisor', color: 'bg-indigo-100 text-indigo-700' },
  subcontractor: { label: 'Subcontractor', color: 'bg-orange-100 text-orange-700' },
  client: { label: 'Client', color: 'bg-slate-100 text-slate-700' },
  contractor: { label: 'Contractor', color: 'bg-slate-100 text-slate-700' },
  ags_import: { label: 'AGS Import', color: 'bg-slate-100 text-slate-500' },
  unspecified: { label: 'No name entered', color: 'bg-red-100 text-red-600' },
};

export function RoleBadge({ role }) {
  const r = ROLE_LABELS[role] || ROLE_LABELS.unspecified;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${r.color}`}>
      <User className="w-2.5 h-2.5" />
      {r.label}
    </span>
  );
}

/**
 * AutoFinancialsBreakdown — the single, unified financial dashboard.
 * Calls calculateJobFinancials to get every activity matched against rate
 * cards, rig crew costs, per-borehole meterage, and drilling performance
 * metrics — all with zero manual input.
 */
export default function AutoFinancialsBreakdown({ job }) {
  const queryClient = useQueryClient();
  const [showMatched, setShowMatched] = useState(false);
  const [showUnmatched, setShowUnmatched] = useState(false);
  const [showBoreholes, setShowBoreholes] = useState(false);

  // Inline billing setup editor
  const [billing, setBilling] = useState({
    meterage_rate: job.meterage_rate ?? '',
    meterage_target: job.meterage_target ?? '',
    budget_amount: job.budget_amount ?? '',
  });
  const [savingBilling, setSavingBilling] = useState(false);
  const [billingSaved, setBillingSaved] = useState(false);

  useEffect(() => {
    setBilling({
      meterage_rate: job.meterage_rate ?? '',
      meterage_target: job.meterage_target ?? '',
      budget_amount: job.budget_amount ?? '',
    });
  }, [job.id, job.meterage_rate, job.meterage_target, job.budget_amount]);

  const billingDirty = (Number(job.meterage_rate) || 0) !== (parseFloat(billing.meterage_rate) || 0) ||
                       (Number(job.meterage_target) || 0) !== (parseFloat(billing.meterage_target) || 0) ||
                       (Number(job.budget_amount) || 0) !== (parseFloat(billing.budget_amount) || 0);

  const saveBilling = async () => {
    setSavingBilling(true);
    try {
      await base44.entities.Job.update(job.id, {
        meterage_rate: parseFloat(billing.meterage_rate) || 0,
        meterage_target: parseFloat(billing.meterage_target) || 0,
        budget_amount: parseFloat(billing.budget_amount) || 0,
      });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['auto-job-financials', job.id] });
      setBillingSaved(true);
      setTimeout(() => setBillingSaved(false), 2000);
    } catch (e) { console.error(e); }
    setSavingBilling(false);
  };

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['auto-job-financials', job.id],
    queryFn: async () => {
      const res = await base44.functions.invoke('calculateJobFinancials', { job_id: job.id });
      return res.data;
    },
    enabled: !!job.id,
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-[#2E5A1A] animate-spin" />
        <span className="ml-2 text-sm text-slate-500">Calculating financials from logged activities…</span>
      </div>
    );
  }

  if (!data) return null;

  const s = data.summary;
  const dp = data.drilling_performance || {};
  const cb = data.cost_breakdown || {};
  const hasData = s.matched_count > 0 || s.total_cost_net > 0 || dp.total_metres > 0;
  const profitColor = s.profit >= 0 ? 'stat-gradient-emerald' : 'stat-gradient-rose';
  const isDrilling = dp.total_metres > 0 || (data.rig_cost_rows && data.rig_cost_rows.length > 0);
  const budget = Number(job.budget_amount) || 0;
  const overBudget = budget > 0 && s.total_cost_net > budget;

  return (
    <div className="space-y-4">
      {/* === HERO: Total Revenue === */}
      <div className="hero-gradient rounded-xl p-5 text-white">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-4 h-4 text-white/70" />
          <span className="text-xs font-medium text-white/80">Total Revenue (from rate cards & charges)</span>
          <button onClick={() => refetch()} disabled={isFetching} className="ml-auto text-white/60 hover:text-white transition">
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <p className="text-3xl font-bold">{fmt(s.total_revenue_gross)}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-white/80">
          <span>Net: {fmt(s.total_revenue_net)}</span>
          <span>VAT: {fmt(s.total_revenue_vat)}</span>
          {dp.total_metres > 0 && <span className="flex items-center gap-1"><Mountain className="w-3 h-3" /> {dp.total_metres.toFixed(1)}m drilled</span>}
          <span>{s.matched_count} activities matched</span>
        </div>
      </div>

      {/* === Summary Stats === */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryStat icon={PoundSterling} value={fmt(s.total_revenue_net)} label="Revenue (net)" gradient="stat-gradient-brand" />
        <SummaryStat icon={Calculator} value={fmt(s.total_cost_net)} label="Cost (net)" gradient="stat-gradient-amber" />
        <SummaryStat icon={TrendingUp} value={fmt(s.profit)} label="Profit" gradient={profitColor} />
        <SummaryStat icon={Percent} value={`${s.margin_pct.toFixed(1)}%`} label="Margin" gradient="stat-gradient-violet" />
      </div>

      {/* === Budget vs Cost === */}
      {budget > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-500 font-medium">Cost vs Budget</span>
            <span className={overBudget ? 'text-red-600 font-semibold' : 'text-slate-600'}>
              {fmt(s.total_cost_net)} / {fmt(budget)}
              {overBudget ? ` · ${fmt(s.total_cost_net - budget)} over` : ` · ${fmt(budget - s.total_cost_net)} remaining`}
            </span>
          </div>
          <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${overBudget ? 'bg-red-500' : 'bg-[#2E5A1A]'}`} style={{ width: `${budget > 0 ? Math.min((s.total_cost_net / budget) * 100, 100) : 0}%` }} />
          </div>
        </div>
      )}

      {/* === DRILLING PERFORMANCE (main focus) === */}
      {isDrilling && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg stat-gradient-brand flex items-center justify-center">
              <Mountain className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Drilling Performance</h3>
              <p className="text-[11px] text-slate-400">Rig cost vs metre revenue</p>
            </div>
          </div>

          {/* Performance stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <PerfStat icon={Gauge} value={`${(dp.total_metres || 0).toFixed(1)}m`} label="Total Drilled" sub={dp.working_days ? `${dp.working_days} working days` : undefined} gradient="stat-gradient-blue" />
            <PerfStat icon={PoundSterling} value={dp.meterage_rate > 0 ? fmt(dp.meterage_rate) : 'Auto'} label="Rate / metre" sub={dp.meterage_rate > 0 ? 'per metre' : 'from rate card'} gradient="stat-gradient-emerald" />
            <PerfStat icon={TrendingUp} value={fmt(dp.meterage_revenue > 0 ? dp.meterage_revenue : s.total_revenue_net)} label={dp.meterage_rate > 0 ? 'Metre Revenue' : 'Matched Revenue'} sub={dp.meterage_rate > 0 ? `${dp.total_metres?.toFixed(1)}m × ${fmt(dp.meterage_rate)}` : `${s.matched_count} activities`} gradient="stat-gradient-brand" />
            <PerfStat icon={Truck} value={fmt(dp.rig_cost)} label="Rig & Crew Cost" sub={data.rig_cost_rows?.length ? `${data.rig_cost_rows.length} rig(s)` : 'no rigs assigned'} gradient="stat-gradient-amber" />
          </div>

          {/* Per-metre metrics */}
          {dp.total_metres > 0 && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <MiniMetric label="Cost / metre" value={fmt(dp.cost_per_metre)} tone="amber" />
              <MiniMetric label="Revenue / metre" value={fmt(dp.revenue_per_metre)} tone="emerald" />
              <MiniMetric label="Profit / metre" value={fmt(dp.profit_per_metre)} tone={dp.profit_per_metre >= 0 ? 'emerald' : 'rose'} />
            </div>
          )}

          {/* Target progress */}
          {dp.target_metres > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-500 font-medium flex items-center gap-1"><Target className="w-3 h-3" /> Progress vs target</span>
                <span className="text-slate-600 font-semibold">{dp.target_pct}% · {(dp.total_metres || 0).toFixed(1)}m / {dp.target_metres}m</span>
              </div>
              <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-[#2E5A1A] rounded-full transition-all" style={{ width: `${dp.target_pct}%` }} />
              </div>
            </div>
          )}

          {/* Rig cost rows */}
          {data.rig_cost_rows?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-600 mb-1">Rig & Crew Costs</p>
              {data.rig_cost_rows.map((r, i) => (
                <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                  <Truck className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-700 truncate">{r.rig_name}</p>
                    <p className="text-[10px] text-slate-400">{r.rate_description} · {fmt(r.day_rate)}/day × {r.working_days}d</p>
                  </div>
                  <span className="text-sm font-bold text-slate-900 tabular-nums">{fmt(r.total_cost)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === BILLING SETUP (inline editor) === */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Ruler className="w-4 h-4 text-[#2E5A1A]" />
          <h3 className="text-sm font-semibold text-slate-800">Billing Setup</h3>
          <span className="ml-auto text-xs text-slate-400">Set per-metre rate & target for this job</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1">
              <PoundSterling className="w-3.5 h-3.5 text-emerald-700" /> Metre rate (£/m)
            </label>
            <input type="number" min="0" step="0.01" value={billing.meterage_rate} onChange={e => setBilling({ ...billing, meterage_rate: e.target.value })} placeholder="0.00" className={inputCls} />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1">
              <Target className="w-3.5 h-3.5 text-amber-600" /> Target (m)
            </label>
            <input type="number" min="0" step="0.1" value={billing.meterage_target} onChange={e => setBilling({ ...billing, meterage_target: e.target.value })} placeholder="0" className={inputCls} />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1">
              <Calculator className="w-3.5 h-3.5 text-slate-500" /> Budget (£)
            </label>
            <input type="number" min="0" step="0.01" value={billing.budget_amount} onChange={e => setBilling({ ...billing, budget_amount: e.target.value })} placeholder="0.00" className={inputCls} />
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <button onClick={saveBilling} disabled={savingBilling || !billingDirty} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2E5A1A] text-white rounded-lg text-xs font-medium hover:bg-[#1c4a12] transition disabled:opacity-50">
            {savingBilling ? <span>Saving…</span> : <><Save className="w-3.5 h-3.5" /> Save</>}
          </button>
          {billingSaved && <span className="text-xs text-[#2E5A1A] font-medium inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Saved</span>}
          {!billingDirty && !billingSaved && <span className="text-xs text-slate-400">Leave metre rate blank to auto-price from rate cards</span>}
        </div>
      </div>

      {/* === Per-borehole meterage === */}
      {data.borehole_meterage?.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <button onClick={() => setShowBoreholes(!showBoreholes)} className="w-full px-4 py-3 border-b border-slate-100 flex items-center gap-2 text-left hover:bg-slate-50/50 transition">
            {showBoreholes ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
            <Mountain className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-slate-800">Per-Borehole Meterage</h3>
            <span className="ml-auto text-xs text-slate-400">{data.borehole_meterage.length} boreholes · {dp.total_metres?.toFixed(1)}m total</span>
          </button>
          {showBoreholes && (
            <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
              {data.borehole_meterage.map(b => (
                <div key={b.borehole_ref} className="px-4 py-2 flex items-center gap-3">
                  <span className="font-mono text-xs font-bold text-blue-700 flex-shrink-0 w-32 truncate">{b.borehole_ref}</span>
                  <div className="flex-1">
                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-400 rounded-full" style={{ width: `${dp.total_metres > 0 ? Math.min((b.metres / dp.total_metres) * 100, 100) : 0}%` }} />
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-slate-700 tabular-nums flex-shrink-0 w-16 text-right">{b.metres.toFixed(1)}m</span>
                  <span className="text-[10px] text-slate-400 flex-shrink-0 w-16 text-right">{b.entries} {b.entries === 1 ? 'entry' : 'entries'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === Cost Breakdown === */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calculator className="w-4 h-4 text-[#2E5A1A]" />
          <h3 className="text-sm font-semibold text-slate-800">Cost Breakdown</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <MiniStat label="Equipment (hire)" value={cb.equipment_net} sub="from logistics tab" />
          <MiniStat label="Rig & Crew" value={cb.rig_cost} sub={dp.working_days ? `${dp.working_days} working days` : undefined} />
          <MiniStat label="Accommodation" value={cb.hotel_net} sub={cb.hotel_rows?.length > 0 ? `${cb.hotel_rows.length} booking(s)` : undefined} />
          <MiniStat label="Delivery Charges" value={cb.delivery_charges} />
          <MiniStat label="Task Charges" value={cb.task_charges} />
        </div>
      </div>

      {/* === Unmatched activities alert === */}
      {s.unmatched_count > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <button onClick={() => setShowUnmatched(!showUnmatched)} className="w-full flex items-center gap-2 text-left">
            {showUnmatched ? <ChevronDown className="w-4 h-4 text-amber-600" /> : <ChevronRight className="w-4 h-4 text-amber-600" />}
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-amber-800">{s.unmatched_count} activities with no rate card match</h3>
            <span className="ml-auto text-xs text-amber-600 font-medium">Click to review</span>
          </button>
          {showUnmatched && (
            <div className="mt-3 space-y-1.5 max-h-60 overflow-y-auto">
              {data.unmatched_entries.map((e, i) => (
                <div key={i} className="flex items-start gap-2 bg-white rounded-lg px-3 py-2 border border-amber-100">
                  <XCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-700 font-medium truncate">{e.description || e.log_type}</p>
                    <p className="text-[10px] text-slate-400">{e.date} · {e.borehole_ref || 'no ref'} · {e.log_type}</p>
                  </div>
                </div>
              ))}
              <p className="text-xs text-amber-700 pt-1 px-2">Add matching rate card items in Settings → Rate Cards to price these activities automatically.</p>
            </div>
          )}
        </div>
      )}

      {/* === Matched activities === */}
      {s.matched_count > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <button onClick={() => setShowMatched(!showMatched)} className="w-full px-4 py-3 border-b border-slate-100 flex items-center gap-2 text-left hover:bg-slate-50/50 transition">
            {showMatched ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-slate-800">Matched Activities ({s.matched_count})</h3>
            <span className="ml-auto text-xs text-slate-400">Click to expand</span>
          </button>
          {showMatched && (
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {data.matched_entries.map((m, i) => (
                <div key={i} className="px-4 py-2.5 flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">{m.date}</span>
                      {m.borehole_ref && <span className="text-[10px] text-slate-500">{m.borehole_ref}</span>}
                      <RoleBadge role={m.logged_by_role} />
                      {m.staff_name && <span className="text-[10px] text-slate-500">{m.staff_name}</span>}
                    </div>
                    <p className="text-xs text-slate-700 truncate">{m.description}</p>
                    <p className="text-[10px] text-[#2E5A1A] font-medium mt-0.5">
                      → {m.rate_card_description} ({m.rate_source} rate)
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-slate-900 tabular-nums">{fmt(m.line_total)}</p>
                    <p className="text-[10px] text-slate-400">{m.quantity} {m.unit} × {fmt(m.unit_price)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!hasData && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 text-center">
          <Calculator className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500 font-medium">No financial data yet</p>
          <p className="text-xs text-slate-400 mt-1">Upload an AGS file or log site activities to see auto-calculated revenue and costs here.</p>
        </div>
      )}
    </div>
  );
}

function SummaryStat({ icon: Icon, value, label, gradient }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg ${gradient} flex items-center justify-center flex-shrink-0`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-slate-400 uppercase font-medium truncate">{label}</p>
        <p className="text-base font-bold text-slate-900 tabular-nums truncate">{value}</p>
      </div>
    </div>
  );
}

function PerfStat({ icon: Icon, value, label, sub, gradient }) {
  return (
    <div className="bg-slate-50 rounded-lg border border-slate-100 p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`w-7 h-7 rounded-lg ${gradient} flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-3.5 h-3.5 text-white" />
        </div>
        <p className="text-[10px] text-slate-400 uppercase font-medium truncate">{label}</p>
      </div>
      <p className="text-base font-bold text-slate-900 tabular-nums truncate">{value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function MiniMetric({ label, value, tone }) {
  const tones = { amber: 'text-amber-700', emerald: 'text-emerald-700', rose: 'text-rose-600' };
  return (
    <div className="text-center bg-slate-50 rounded-lg border border-slate-100 p-2.5">
      <p className="text-[10px] text-slate-400 uppercase font-medium">{label}</p>
      <p className={`text-sm font-bold tabular-nums ${tones[tone] || 'text-slate-800'}`}>{value}</p>
    </div>
  );
}

function MiniStat({ label, value, sub }) {
  return (
    <div className="text-center bg-slate-50 rounded-lg border border-slate-100 p-2.5">
      <p className="text-[10px] text-slate-400 uppercase font-medium">{label}</p>
      <p className="text-sm font-bold text-slate-800 tabular-nums">{fmt(value)}</p>
      {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
    </div>
  );
}