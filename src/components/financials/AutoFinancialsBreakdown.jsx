import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  PoundSterling, TrendingUp, Percent, Calculator, AlertTriangle,
  Loader2, RefreshCw, Mountain, ChevronDown, ChevronRight, User,
  CheckCircle2, XCircle, FileText
} from 'lucide-react';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
 * AutoFinancialsBreakdown — the zero-touch financial dashboard.
 * Calls calculateJobFinancials backend function to get every activity
 * matched against rate cards and displayed as revenue + cost + profit.
 */
export default function AutoFinancialsBreakdown({ job }) {
  const [showMatched, setShowMatched] = useState(false);
  const [showUnmatched, setShowUnmatched] = useState(false);

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
  const hasData = s.matched_count > 0 || s.total_cost_net > 0;
  const profitColor = s.profit >= 0 ? 'stat-gradient-emerald' : 'stat-gradient-rose';
  const valueCls = valueClassName => valueClassName || '';

  return (
    <div className="space-y-4">
      {/* Main hero banner — total revenue */}
      <div className="hero-gradient rounded-xl p-5 text-white">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-4 h-4 text-white/70" />
          <span className="text-xs font-medium text-white/80">Auto-Calculated Revenue (from rate cards)</span>
          <button onClick={() => refetch()} disabled={isFetching} className="ml-auto text-white/60 hover:text-white transition">
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <p className="text-3xl font-bold">{fmt(s.total_revenue_gross)}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-white/80">
          <span>Net: {fmt(s.total_revenue_net)}</span>
          <span>VAT: {fmt(s.total_revenue_vat)}</span>
          {s.total_metres > 0 && <span className="flex items-center gap-1"><Mountain className="w-3 h-3" /> {s.total_metres.toFixed(1)}m drilled</span>}
          <span>{s.matched_count} activities matched</span>
        </div>
      </div>

      {/* Summary stat grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryStat icon={PoundSterling} value={fmt(s.total_revenue_net)} label="Revenue (net)" gradient="stat-gradient-brand" />
        <SummaryStat icon={Calculator} value={fmt(s.total_cost_net)} label="Cost (net)" gradient="stat-gradient-amber" />
        <SummaryStat icon={TrendingUp} value={fmt(s.profit)} label="Profit" gradient={profitColor} />
        <SummaryStat icon={Percent} value={`${s.margin_pct.toFixed(1)}%`} label="Margin" gradient="stat-gradient-violet" />
      </div>

      {/* Revenue by rate source */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-[#2E5A1A]" />
          <h3 className="text-sm font-semibold text-slate-800">Revenue by Rate Card Source</h3>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <SourceCard label="Staff Rates" value={data.revenue_by_source.staff} count={data.rate_card_levels.staff_rates_found} />
          <SourceCard label="Project Rates" value={data.revenue_by_source.project} count={data.rate_card_levels.project_rates_found} />
          <SourceCard label="Global Rates" value={data.revenue_by_source.global} count={data.rate_card_levels.global_rates_found} />
        </div>
      </div>

      {/* Cost breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calculator className="w-4 h-4 text-[#2E5A1A]" />
          <h3 className="text-sm font-semibold text-slate-800">Cost Breakdown</h3>
          <span className="ml-auto text-xs text-slate-400">Auto-calculated from assignments</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MiniStat label="Equipment" value={data.cost_breakdown.equipment_net} />
          <MiniStat label="Accommodation" value={data.cost_breakdown.hotel_net} sub={data.cost_breakdown.hotel_rows?.length > 0 ? `${data.cost_breakdown.hotel_rows.length} booking(s)` : undefined} />
          <MiniStat label="Delivery Charges" value={data.cost_breakdown.delivery_charges} />
          <MiniStat label="Task Charges" value={data.cost_breakdown.task_charges} />
        </div>
      </div>

      {/* Unmatched activities alert */}
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

      {/* Matched activities detail */}
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

function SourceCard({ label, value, count }) {
  return (
    <div className="bg-slate-50 rounded-lg border border-slate-100 p-3 text-center">
      <p className="text-[10px] text-slate-400 uppercase font-medium mb-1">{label}</p>
      <p className="text-sm font-bold text-slate-800 tabular-nums">{fmt(value)}</p>
      <p className="text-[10px] text-slate-400 mt-0.5">{count} rate(s)</p>
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