import React from 'react';
import { PoundSterling, TrendingUp, TrendingDown } from 'lucide-react';

export default function JobBudgetCard({ job, totalCost }) {
  const budget = job.budget_amount || 0;
  const remaining = budget - totalCost;
  const pct = budget > 0 ? Math.min(100, Math.round((totalCost / budget) * 100)) : 0;
  const overBudget = totalCost > budget && budget > 0;

  if (!budget) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <PoundSterling className="w-5 h-5 text-emerald-700" />
          <h2 className="font-semibold text-slate-900">Budget</h2>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-slate-400">No budget set. Add a budget amount when creating or editing this job to track costs.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <PoundSterling className="w-5 h-5 text-emerald-700" />
        <h2 className="font-semibold text-slate-900">Budget vs Actual</h2>
      </div>
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-600">Spent</span>
          <span className={`text-sm font-bold ${overBudget ? 'text-red-600' : 'text-emerald-700'}`}>{pct}%</span>
        </div>
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-3">
          <div className={`h-full rounded-full transition-all duration-500 ${overBudget ? 'bg-red-500' : 'bg-emerald-600'}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-400">Budget</p>
            <p className="text-lg font-bold text-slate-900">£{budget.toLocaleString()}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-400">Actual Cost</p>
            <p className={`text-lg font-bold ${overBudget ? 'text-red-600' : 'text-slate-900'}`}>£{totalCost.toLocaleString()}</p>
          </div>
        </div>
        <div className={`flex items-center gap-2 mt-3 text-sm ${overBudget ? 'text-red-600' : remaining < budget * 0.2 ? 'text-amber-600' : 'text-emerald-600'}`}>
          {overBudget ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
          <span className="font-medium">
            {overBudget ? `£${Math.abs(remaining).toLocaleString()} over budget` : `£${remaining.toLocaleString()} remaining`}
          </span>
        </div>
      </div>
    </div>
  );
}