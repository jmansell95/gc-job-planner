import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PoundSterling, TrendingUp, Percent, Calculator, Save, Check,
  ChevronDown, ChevronUp, AlertTriangle
} from 'lucide-react';

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
        <div className="bg-white rounded-lg p-3 border border-slate-100">
          <p className="text-xs text-slate-400">Budget</p>
          <p className="text-base font-bold text-slate-900 truncate">{hasBudget ? fmt(budget) : 'Not set'}</p>
        </div>
        <div className="bg-white rounded-lg p-3 border border-slate-100">
          <p className="text-xs text-slate-400">Actual cost (net)</p>
          <p className={`text-base font-bold truncate ${overBudget ? 'text-red-600' : 'text-slate-900'}`}>{fmt(actualNet)}</p>
        </div>
        <div className="bg-white rounded-lg p-3 border border-slate-100">
          <p className="text-xs text-slate-400">{hasBudget ? 'Variance' : 'Profit'}</p>
          <p className={`text-base font-bold truncate ${hasBudget ? (overBudget ? 'text-red-600' : 'text-emerald-700') : 'text-emerald-700'}`}>
            {hasBudget ? `${variance >= 0 ? '+' : ''}${fmt(variance)}` : fmt(profit)}
          </p>
        </div>
        <div className="bg-white rounded-lg p-3 border border-slate-100">
          <p className="text-xs text-slate-400">Margin</p>
          <p className="text-base font-bold text-emerald-700 truncate">{marginPct.toFixed(1)}%</p>
        </div>
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
  const [showLabour, setShowLabour] = useState(false);

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

  const itemNet = (c) => (Number(c.unit_cost) || 0) * (Number(c.quantity) || 1);
  const itemVat = (c) => c.vat_exempt ? 0 : itemNet(c) * (Number(vatRate) / 100);
  const equipmentNet = items.reduce((s, c) => s + itemNet(c), 0);
  const equipmentVat = items.reduce((s, c) => s + itemVat(c), 0);
  const labourNet = Number(totalCost) || 0;
  const labourVat = labourNet * (Number(vatRate) / 100);
  const internalNet = labourNet + equipmentNet;
  const internalVat = labourVat + equipmentVat;
  const internalTotal = internalNet + internalVat;
  const markupAmount = internalNet * (Number(markup) / 100);
  const deliveryCharges = deliveries.filter(d => d.chargeable !== false).reduce((s, d) => s + (Number(d.charge_amount) || 0), 0);
  const taskCharges = jobTimesheets.filter(t => t.chargeable && !t.is_break).reduce((s, t) => s + (Number(t.charge_amount) || 0), 0);
  const additionalCharges = deliveryCharges + taskCharges;
  const clientNet = internalNet + markupAmount + additionalCharges;
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

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <PoundSterling className="w-5 h-5 text-emerald-700" />
        <h2 className="font-semibold text-slate-900">Costing & Billing</h2>
        <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">{items.length} cost items</span>
      </div>

      <div className="px-5 py-4 space-y-5">
        {/* Client-facing total banner */}
        <div className="hero-gradient rounded-xl p-5 text-white">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-emerald-200" />
            <span className="text-xs font-medium text-emerald-100">Client Total (incl. VAT & markup)</span>
          </div>
          <p className="text-3xl font-bold">{fmt(clientTotal)}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-emerald-100">
            <span>Net: {fmt(clientNet)}</span>
            <span>VAT ({Number(vatRate) || 0}%): {fmt(clientVat)}</span>
            <span>Markup: {Number(markup) || 0}%</span>
            {additionalCharges > 0 && <span>Delivery & Task Charges: {fmt(additionalCharges)}</span>}
          </div>
        </div>

        {/* Budget & Margin tracker */}
        <BudgetMarginTracker budget={Number(job.budget_amount) || 0} actualNet={internalNet} clientNet={clientNet} markup={Number(markup) || 0} />

        {/* Internal cost summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-400">Labour (net)</p>
            <p className="text-base font-bold text-slate-900 truncate">{fmt(labourNet)}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-400">Equipment (net)</p>
            <p className="text-base font-bold text-slate-900 truncate">{fmt(equipmentNet)}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-400">Internal total</p>
            <p className="text-base font-bold text-slate-900 truncate">{fmt(internalTotal)}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-400">Markup amount</p>
            <p className="text-base font-bold text-emerald-700 truncate">{fmt(markupAmount)}</p>
          </div>
          {additionalCharges > 0 && (
            <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
              <p className="text-xs text-emerald-600">Delivery & Task Charges</p>
              <p className="text-base font-bold text-emerald-800 truncate">{fmt(additionalCharges)}</p>
              <p className="text-[10px] text-emerald-500 mt-0.5">
                {deliveries.filter(d => d.chargeable !== false && Number(d.charge_amount) > 0).length} deliveries · {jobTimesheets.filter(t => t.chargeable && Number(t.charge_amount) > 0).length} chargeable tasks
              </p>
            </div>
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

        {/* Labour breakdown */}
        {staffCosts && staffCosts.length > 0 && (
          <div className="border-t border-slate-100 pt-3">
            <button onClick={() => setShowLabour(!showLabour)} className="flex items-center justify-between w-full text-sm font-medium text-slate-700 hover:text-emerald-700 transition">
              <span className="inline-flex items-center gap-2"><Calculator className="w-3.5 h-3.5" /> Labour breakdown ({staffCosts.length} staff)</span>
              {showLabour ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showLabour && (
              <div className="mt-3 space-y-2">
                {staffCosts.map((sc, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="min-w-0">
                      <span className="font-medium text-slate-900">{sc.name}</span>
                      {sc.costType === 'meterage'
                        ? <span className="text-xs text-slate-400 ml-2">{sc.meterage}m × £{sc.meterageRate}/m</span>
                        : sc.costType === 'timesheet'
                        ? <span className="text-xs text-slate-400 ml-2">{(sc.timesheetMinutes / 60).toFixed(1)}h × £{sc.hourlyRate.toFixed(0)}/h</span>
                        : <span className="text-xs text-slate-400 ml-2">{sc.shifts} shifts × £{sc.dayRate}</span>}
                    </div>
                    <span className="font-semibold text-slate-700 flex-shrink-0">{fmt(sc.cost)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="font-semibold text-slate-900">Labour total</span>
                  <span className="font-bold text-emerald-700">{fmt(totalCost)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}