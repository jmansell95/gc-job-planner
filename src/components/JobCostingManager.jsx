import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PoundSterling, TrendingUp, Percent, Calculator, Save, Check,
  AlertTriangle, Ruler, Hotel, Loader2
} from 'lucide-react';
import RigCostAnalysis from '@/components/RigCostAnalysis';
import MeterageReport from '@/components/MeterageReport';
import { useJobFinancials } from '@/hooks/useJobFinancials';
import StatCard from '@/components/dashboard/StatCard';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm";

function BudgetMarginTracker({ budget, actualNet, clientNet, markup }) {
  const hasBudget = budget > 0;
  const profit = clientNet - actualNet;
  const marginPct = clientNet > 0 ? (profit / clientNet) * 100 : 0;
  const variance = hasBudget ? budget - actualNet : 0;
  const overBudget = hasBudget && actualNet > budget;
  const budgetPct = hasBudget ? Math.min((actualNet / budget) * 100, 100) : 0;

  if (!hasBudget && actualNet === 0) return null;

  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/40">
      <div className="flex items-center gap-2 mb-3">
        <Calculator className="w-4 h-4 text-emerald-700" />
        <h3 className="text-sm font-semibold text-slate-800">Budget & Margin</h3>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={PoundSterling} value={hasBudget ? fmt(budget) : 'Not set'} label="Budget" gradient="stat-gradient-emerald" />
        <StatCard icon={Calculator} value={fmt(actualNet)} label="Actual cost (net)" gradient={overBudget ? 'stat-gradient-rose' : 'stat-gradient-amber'} valueClassName={overBudget ? 'text-rose-600' : ''} />
        <StatCard icon={TrendingUp} value={hasBudget ? `${variance >= 0 ? '+' : ''}${fmt(variance)}` : fmt(profit)} label={hasBudget ? 'Variance' : 'Profit'} gradient={hasBudget ? (overBudget ? 'stat-gradient-rose' : 'stat-gradient-blue') : 'stat-gradient-emerald'} valueClassName={hasBudget ? (overBudget ? 'text-rose-600' : 'text-emerald-600') : 'text-emerald-600'} />
        <StatCard icon={Percent} value={`${marginPct.toFixed(1)}%`} label="Margin" gradient="stat-gradient-violet" valueClassName="text-emerald-600" />
      </div>

      {hasBudget && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-500 font-medium">Budget used</span>
            <span className={overBudget ? 'text-red-600 font-semibold' : 'text-slate-600'}>
              {budgetPct.toFixed(0)}%{overBudget && ` · ${fmt(actualNet - budget)} over`}
            </span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${overBudget ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${budgetPct}%` }} />
          </div>
          {overBudget && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              This job is over budget by {fmt(actualNet - budget)}.
            </div>
          )}
        </div>
      )}
      {!hasBudget && (
        <p className="text-xs text-slate-400 mt-2">Set a job budget in the job details to track spend against it.</p>
      )}
    </div>
  );
}

export default function JobCostingManager({ job, staffCosts, totalCost, isDrillingJob, totalMeterage }) {
  const queryClient = useQueryClient();
  const [markup, setMarkup] = useState(job.markup_percentage ?? 0);
  const [vatRate, setVatRate] = useState(job.vat_rate ?? 20);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const fin = useJobFinancials(job);
  const [revenueMethod, setRevenueMethod] = useState(job.revenue_method || 'none');
  const [unitPrice, setUnitPrice] = useState(job.unit_price ?? '');
  const [savingRevenue, setSavingRevenue] = useState(false);

  const { data: items = [] } = useQuery({
    queryKey: ['job-cost-items', job.id],
    queryFn: () => base44.entities.JobCostItem.filter({ job_id: job.id })
  });
  const { data: deliveries = [] } = useQuery({
    queryKey: ['job-deliveries-costing', job.id],
    queryFn: () => base44.entities.DeliveryLog.filter({ job_id: job.id })
  });
  const { data: jobTimesheets = [] } = useQuery({
    queryKey: ['job-timesheets-costing', job.id],
    queryFn: () => base44.entities.Timesheet.filter({ job_id: job.id })
  });

  const itemNet = (c) => {
    const rate = c.price_confirmed && c.negotiated_unit_cost != null ? Number(c.negotiated_unit_cost) : (Number(c.unit_cost) || 0);
    return rate * (Number(c.quantity) || 1);
  };
  const itemVat = (c) => c.vat_exempt ? 0 : itemNet(c) * (Number(vatRate) / 100);
  const equipmentNet = items.reduce((s, c) => s + itemNet(c), 0);
  const equipmentVat = items.reduce((s, c) => s + itemVat(c), 0);
  // Hotel accommodation costs from the auto-financials hook
  const hotelNet = fin.costs.hotelNet;
  const hotelVat = fin.costs.hotelVat;
  // Labour cost tracking removed — payroll handled outside this system.
  const internalNet = equipmentNet + hotelNet;
  const internalVat = equipmentVat + hotelVat;
  const internalTotal = internalNet + internalVat;
  const markupAmount = equipmentNet * (Number(markup) / 100);
  const deliveryCharges = deliveries.filter(d => d.chargeable !== false).reduce((s, d) => s + (Number(d.charge_amount) || 0), 0);
  const taskCharges = jobTimesheets.filter(t => t.chargeable && !t.is_break).reduce((s, t) => s + (Number(t.charge_amount) || 0), 0);
  const additionalCharges = deliveryCharges + taskCharges;
  // Revenue: use the job's revenue method when set, otherwise fall back to legacy markup-on-cost model
  const useMethodRevenue = fin.revenue.method !== 'none';
  const clientNet = useMethodRevenue ? fin.revenue.net : (internalNet + markupAmount + additionalCharges);
  const clientVat = clientNet * (Number(vatRate) / 100);
  const clientTotal = clientNet + clientVat;

  const configDirty = (job.markup_percentage ?? 0) !== (Number(markup) || 0) || (job.vat_rate ?? 20) !== (Number(vatRate) || 0);

  const saveConfig = async () => {
    setSavingConfig(true);
    try {
      await base44.entities.Job.update(job.id, {
        markup_percentage: Number(markup) || 0,
        vat_rate: Number(vatRate) || 0
      });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 2000);
    } catch (e) { console.error(e); }
    setSavingConfig(false);
  };

  const saveRevenueMethod = async () => {
    setSavingRevenue(true);
    try {
      await base44.entities.Job.update(job.id, {
        revenue_method: revenueMethod,
        unit_price: unitPrice === '' ? null : Number(unitPrice) || 0
      });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    } catch (e) { console.error(e); }
    setSavingRevenue(false);
  };

  const REVENUE_METHODS = [
    { value: 'none', label: 'Cost + Markup', hint: 'Legacy model: internal cost + markup %', icon: Calculator },
    { value: 'day_rate', label: 'Day Rate', hint: 'Crew day rates × working days', icon: TrendingUp },
    { value: 'meterage_rate', label: 'Meterage', hint: 'Metres drilled × £/m rate', icon: Ruler },
    { value: 'unit_rate', label: 'Unit Rate', hint: 'Units completed × £/unit', icon: Calculator },
    { value: 'flat_fee', label: 'Flat Fee', hint: 'Single agreed project fee', icon: PoundSterling },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <PoundSterling className="w-5 h-5 text-emerald-700" />
        <h2 className="font-semibold text-slate-900">Revenue Breakdown</h2>
        <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">{items.length} billing items</span>
      </div>

      <div className="px-5 py-4 space-y-5">
        {/* Client-facing total banner */}
        <div className="hero-gradient rounded-xl p-5 text-white">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-emerald-200" />
            <span className="text-xs font-medium text-emerald-100">{useMethodRevenue ? fin.revenue.label : 'Client Total (incl. VAT & markup)'}</span>
          </div>
          <p className="text-3xl font-bold">{fmt(clientTotal)}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-emerald-100">
            <span>Net: {fmt(clientNet)}</span>
            <span>VAT ({Number(vatRate) || 0}%): {fmt(clientVat)}</span>
            {!useMethodRevenue && <span>Markup: {Number(markup) || 0}%</span>}
            {useMethodRevenue && fin.revenue.breakdown.length > 0 && fin.revenue.breakdown.map((b, i) => <span key={i}>{b.label}: {fmt(b.value)}</span>)}
            {additionalCharges > 0 && <span>Delivery & Task Charges: {fmt(additionalCharges)}</span>}
          </div>
        </div>

        {/* Revenue Method Selector */}
        <div className="border border-slate-200 rounded-xl p-4 bg-white">
          <div className="flex items-center gap-2 mb-3">
            <Calculator className="w-4 h-4 text-emerald-700" />
            <h3 className="text-sm font-semibold text-slate-800">Revenue Method</h3>
            <span className="ml-auto text-xs text-slate-400">How this job is billed to the client</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
            {REVENUE_METHODS.map(m => {
              const Icon = m.icon;
              const active = revenueMethod === m.value;
              return (
                <button key={m.value} type="button" onClick={() => setRevenueMethod(m.value)}
                  className={`flex flex-col items-start gap-1 px-3 py-2.5 rounded-lg border text-left transition ${active ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                  <Icon className={`w-4 h-4 ${active ? 'text-emerald-700' : 'text-slate-400'}`} />
                  <span className="text-xs font-semibold">{m.label}</span>
                  <span className="text-[10px] text-slate-400 leading-tight">{m.hint}</span>
                </button>
              );
            })}
          </div>
          {revenueMethod === 'unit_rate' && (
            <div className="flex items-center gap-2 mb-3">
              <label className="text-xs font-medium text-slate-600">£ per unit</label>
              <input type="number" min="0" step="0.01" value={unitPrice} onChange={e => setUnitPrice(e.target.value)}
                className="w-28 px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" placeholder="0.00" />
            </div>
          )}
          {revenueMethod !== 'none' && (
            <div className="bg-emerald-50 rounded-lg px-3 py-2 text-xs text-emerald-800 flex items-center justify-between">
              <span>Calculated revenue: <strong>{fmt(fin.revenue.net)}</strong> {fin.revenue.breakdown.length > 0 && <span className="text-emerald-600">({fin.revenue.breakdown[0].label})</span>}</span>
              <span className="text-emerald-500">{fin.revenue.label}</span>
            </div>
          )}
          <div className="flex items-center gap-2 mt-3">
            <button onClick={saveRevenueMethod} disabled={savingRevenue || ((job.revenue_method || 'none') === revenueMethod && (job.unit_price ?? '') === unitPrice)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-medium hover:bg-emerald-800 transition disabled:opacity-50">
              {savingRevenue ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save method
            </button>
          </div>
        </div>

        {/* Budget & Margin tracker */}
        <BudgetMarginTracker budget={Number(job.budget_amount) || 0} actualNet={internalNet} clientNet={clientNet} markup={Number(markup) || 0} />

        {/* Meterage rate & revenue report (drilling jobs billed per metre) */}
        {isDrillingJob && <MeterageReport job={job} />}

        {/* Rig & crew cost analysis from schedule of rates */}
        <RigCostAnalysis job={job} />

        {/* System-generated cost summary */}
        <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/40">
          <div className="flex items-center gap-2 mb-3">
            <Hotel className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-slate-800">System-Generated Cost Summary</h3>
            <span className="ml-auto text-xs text-slate-400">Auto-calculated from assignments</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={Calculator} value={fmt(equipmentNet)} label="Equipment (net)" gradient="stat-gradient-slate" />
            <StatCard icon={Hotel} value={fmt(hotelNet)} label="Accommodation (net)" sub={fin.costs.hotelRows.length > 0 ? `${fin.costs.hotelRows.length} booking${fin.costs.hotelRows.length === 1 ? '' : 's'}` : undefined} gradient="stat-gradient-blue" valueClassName="text-blue-700" />
            <StatCard icon={PoundSterling} value={fmt(internalNet)} label="Total cost (net)" gradient="stat-gradient-emerald" />
            <StatCard icon={PoundSterling} value={fmt(internalTotal)} label="Total cost (gross)" gradient="stat-gradient-slate" />
          </div>
          {fin.costs.hotelRows.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {fin.costs.hotelRows.map(h => (
                <div key={h.id} className="flex items-center justify-between text-xs bg-white rounded-lg px-3 py-2 border border-slate-100">
                  <span className="text-slate-600 font-medium">{h.name}</span>
                  <span className="text-slate-400">{h.nights}n × {h.rooms}r × £{h.perNight.toFixed(2)}</span>
                  <span className="font-bold text-blue-700">{fmt(h.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Internal cost summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Calculator} value={fmt(equipmentNet)} label="Equipment (net)" gradient="stat-gradient-slate" />
          <StatCard icon={Hotel} value={fmt(hotelNet)} label="Accommodation (net)" gradient="stat-gradient-blue" valueClassName="text-blue-700" />
          <StatCard icon={PoundSterling} value={fmt(internalTotal)} label="Internal total" gradient="stat-gradient-emerald" />
          {additionalCharges > 0 && (
            <StatCard icon={TrendingUp} value={fmt(additionalCharges)} label="Delivery & Task Charges" sub={`${deliveries.filter(d => d.chargeable !== false && Number(d.charge_amount) > 0).length} deliveries · ${jobTimesheets.filter(t => t.chargeable && Number(t.charge_amount) > 0).length} chargeable tasks`} gradient="stat-gradient-emerald" valueClassName="text-emerald-700" />
          )}
        </div>

        {/* Markup & VAT config */}
        <div className="border border-slate-200 rounded-lg p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5"><Percent className="w-4 h-4 text-emerald-700" /> Markup %</label>
              <input type="number" min="0" step="0.1" value={markup} onChange={(e) => setMarkup(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5"><PoundSterling className="w-4 h-4 text-emerald-700" /> VAT rate %</label>
              <input type="number" min="0" step="0.1" value={vatRate} onChange={(e) => setVatRate(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button onClick={saveConfig} disabled={savingConfig || !configDirty} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-medium hover:bg-emerald-800 transition disabled:opacity-50">
              {savingConfig ? <span>Saving...</span> : <><Save className="w-3.5 h-3.5" /> Save rates</>}
            </button>
            {configSaved && <span className="text-xs text-emerald-700 font-medium inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Saved</span>}
            {!configDirty && !configSaved && <span className="text-xs text-slate-400">Rates applied to this job</span>}
          </div>
        </div>

      </div>
    </div>
  );
}