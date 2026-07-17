import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Truck, Calculator, AlertTriangle, Plus, Loader2, Trash2, CalendarDays } from 'lucide-react';
import { eachDayOfInterval, isWeekend } from 'date-fns';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function workingDaysBetween(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (end < start) return 0;
  return eachDayOfInterval({ start, end }).filter(d => !isWeekend(d)).length;
}

export default function RigCostAnalysis({ job }) {
  const [rateSelections, setRateSelections] = useState({});
  const [extraCrews, setExtraCrews] = useState([]);
  const [daysOverride, setDaysOverride] = useState(null);

  const { data: rateItems = [] } = useQuery({
    queryKey: ['rate-card-items-labour-day'],
    queryFn: async () => {
      const all = await base44.entities.RateCardItem.filter({ category: 'labour' });
      return all.filter(r => r.unit === 'day' && r.price != null)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    }
  });

  const { data: rigAssignments = [], isLoading } = useQuery({
    queryKey: ['job-rig-assignments-cost', job.id],
    queryFn: async () => {
      const all = await base44.entities.JobAssetAssignment.filter({ job_id: job.id });
      return all.filter(a => a.asset_type === 'rig');
    }
  });

  const autoMatchRate = (rigType, rigName = '') => {
    const name = String(rigName || '').toLowerCase();
    // Window sampling rigs — match by name keywords (tracked, modular, terrier)
    const wsEntries = rateItems.filter(r => r.subcategory === 'Window Sampling');
    if (wsEntries.length > 0) {
      if (/modular/i.test(name)) {
        const m = wsEntries.find(r => /modular/i.test(r.description) && !/additional/i.test(r.description));
        if (m) return m.id;
      }
      if (/tracked|terrier/i.test(name)) {
        const t = wsEntries.find(r => /tracked/i.test(r.description));
        if (t) return t.id;
      }
    }
    if (rigType === 'rotary') return rateItems.find(r => /rotary crew/i.test(r.description))?.id;
    if (rigType === 'cp') return rateItems.find(r => /^cable percussive crew$/i.test(r.description.trim()))?.id;
    return null;
  };

  useEffect(() => {
    if (rateItems.length === 0 || rigAssignments.length === 0) return;
    setRateSelections(prev => {
      const next = { ...prev };
      let changed = false;
      rigAssignments.forEach(a => {
        if (!next[a.id]) {
          const match = autoMatchRate(a.rig_type, a.asset_name);
          if (match) { next[a.id] = match; changed = true; }
        }
      });
      return changed ? next : prev;
    });
  }, [rateItems, rigAssignments]);

  const plannedDays = useMemo(() => {
    if (daysOverride != null && daysOverride !== '') return Number(daysOverride) || 0;
    return workingDaysBetween(job.start_date, job.end_date);
  }, [job.start_date, job.end_date, daysOverride]);

  const rigCostRows = useMemo(() => {
    const rows = [];
    rigAssignments.forEach(a => {
      const rateId = rateSelections[a.id];
      const rate = rateItems.find(r => r.id === rateId);
      if (rate) {
        rows.push({
          key: a.id,
          label: a.asset_name || 'Rig',
          sub: a.rig_type === 'rotary' ? 'Rotary rig' : a.rig_type === 'cp' ? 'Cable Percussive' : 'Rig',
          rateName: rate.description,
          dayRate: rate.price,
          days: plannedDays,
          total: rate.price * plannedDays,
          type: 'rig',
          assignmentId: a.id,
        });
      }
    });
    extraCrews.forEach((c, i) => {
      const rate = rateItems.find(r => r.id === c.rateCardItemId);
      if (rate) {
        rows.push({
          key: `extra-${i}`,
          label: rate.description,
          sub: 'Manual crew line',
          rateName: rate.description,
          dayRate: rate.price,
          days: c.days ?? plannedDays,
          total: rate.price * (c.days ?? plannedDays),
          type: 'extra',
          extraIndex: i,
        });
      }
    });
    return rows;
  }, [rigAssignments, rateSelections, rateItems, extraCrews, plannedDays]);

  const totalRigCost = rigCostRows.reduce((s, r) => s + r.total, 0);
  const budget = Number(job.budget_amount) || 0;
  const remaining = budget - totalRigCost;
  const overBudget = budget > 0 && totalRigCost > budget;
  const budgetPct = budget > 0 ? Math.min((totalRigCost / budget) * 100, 100) : 0;

  const groupedRates = useMemo(() => {
    const map = {};
    rateItems.forEach(r => {
      const k = r.subcategory || 'General';
      if (!map[k]) map[k] = [];
      map[k].push(r);
    });
    return map;
  }, [rateItems]);

  const setRigRate = (assignmentId, rateId) =>
    setRateSelections(prev => ({ ...prev, [assignmentId]: rateId }));

  const addExtraCrew = () =>
    setExtraCrews(prev => [...prev, { rateCardItemId: rateItems[0]?.id || '', days: plannedDays }]);

  const updateExtraCrew = (i, field, value) =>
    setExtraCrews(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c));

  const removeExtraCrew = (i) =>
    setExtraCrews(prev => prev.filter((_, idx) => idx !== i));

  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/40">
      <div className="flex items-center gap-2 mb-3">
        <Truck className="w-4 h-4 text-emerald-700" />
        <h3 className="text-sm font-semibold text-slate-800">Rig & Crew Cost Analysis</h3>
        <span className="ml-auto text-xs text-slate-500">vs job budget</span>
      </div>

      {/* Days control */}
      <div className="flex flex-wrap items-center gap-3 mb-3 bg-white rounded-lg p-3 border border-slate-200">
        <div className="flex items-center gap-1.5 text-sm text-slate-600">
          <CalendarDays className="w-4 h-4 text-slate-400" />
          <span className="font-medium">Working days:</span>
          <input type="number" min="0" value={daysOverride ?? plannedDays}
            onChange={e => setDaysOverride(e.target.value)}
            className="w-16 px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:border-emerald-600" />
          <span className="text-xs text-slate-400 ml-1">
            {daysOverride == null && `auto from job dates (${job.start_date || '?'} → ${job.end_date || '?'})`}
          </span>
          {daysOverride != null && (
            <button onClick={() => setDaysOverride(null)} className="text-xs text-emerald-700 hover:underline ml-1">reset</button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
      ) : (
        <>
          {/* Rig rows */}
          {rigAssignments.length > 0 && (
            <div className="space-y-2 mb-2">
              {rigAssignments.map(a => {
                const rateId = rateSelections[a.id];
                const rate = rateItems.find(r => r.id === rateId);
                return (
                  <div key={a.id} className="bg-white rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{a.asset_name || 'Rig'}</p>
                        <p className="text-xs text-slate-400">{a.rig_type === 'rotary' ? 'Rotary rig' : a.rig_type === 'cp' ? 'Cable Percussive' : 'Rig'}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-slate-900">{rate ? fmt(rate.price * plannedDays) : '—'}</p>
                        {rate && <p className="text-[11px] text-slate-400">{fmt(rate.price)} × {plannedDays} days</p>}
                      </div>
                    </div>
                    <select value={rateId || ''} onChange={e => setRigRate(a.id, e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-emerald-600">
                      <option value="">Select crew rate…</option>
                      {Object.entries(groupedRates).map(([group, items]) => (
                        <optgroup key={group} label={group}>
                          {items.map(r => <option key={r.id} value={r.id}>{r.description} — {fmt(r.price)}/day</option>)}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          )}

          {/* Extra crew rows */}
          {extraCrews.map((c, i) => {
            const rate = rateItems.find(r => r.id === c.rateCardItemId);
            return (
              <div key={`extra-${i}`} className="bg-white rounded-lg border border-slate-200 p-3 flex items-center gap-2">
                <select value={c.rateCardItemId} onChange={e => updateExtraCrew(i, 'rateCardItemId', e.target.value)}
                  className="flex-1 min-w-0 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-emerald-600">
                  <option value="">Select crew rate…</option>
                  {Object.entries(groupedRates).map(([group, items]) => (
                    <optgroup key={group} label={group}>
                      {items.map(r => <option key={r.id} value={r.id}>{r.description} — {fmt(r.price)}/day</option>)}
                    </optgroup>
                  ))}
                </select>
                <input type="number" min="0" value={c.days ?? ''} onChange={e => updateExtraCrew(i, 'days', e.target.value)}
                  className="w-16 px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-emerald-600" placeholder="days" />
                <span className="text-sm font-bold text-slate-900 w-20 text-right flex-shrink-0">
                  {rate ? fmt(rate.price * (c.days || 0)) : '—'}
                </span>
                <button onClick={() => removeExtraCrew(i)} className="p-1 text-slate-400 hover:text-red-500 transition flex-shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}

          {rigAssignments.length === 0 && extraCrews.length === 0 && (
            <div className="text-center py-6 text-sm text-slate-400">
              No rigs assigned to this job. Add a crew line below to calculate costs.
            </div>
          )}

          <button onClick={addExtraCrew} disabled={rateItems.length === 0}
            className="w-full flex items-center justify-center gap-1.5 py-2 mt-1 text-xs text-slate-500 hover:text-emerald-700 hover:bg-emerald-50/50 rounded-lg transition border border-dashed border-slate-200 disabled:opacity-50">
            <Plus className="w-3.5 h-3.5" /> Add crew line
          </button>

          {/* Budget comparison */}
          {totalRigCost > 0 && (
            <div className="mt-3 bg-white rounded-lg border border-slate-200 p-3">
              {budget > 0 ? (
                <>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-500 font-medium">Rig & crew cost vs budget</span>
                    <span className={overBudget ? 'text-red-600 font-semibold' : 'text-slate-600'}>
                      {fmt(totalRigCost)} / {fmt(budget)} · {overBudget ? `${fmt(totalRigCost - budget)} over` : `${fmt(remaining)} remaining`}
                    </span>
                  </div>
                  <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${overBudget ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${budgetPct}%` }} />
                  </div>
                  {overBudget && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      Rig & crew costs exceed the job budget by {fmt(totalRigCost - budget)}.
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">Total rig & crew cost</span>
                  <span className="text-sm font-bold text-slate-900">{fmt(totalRigCost)}</span>
                </div>
              )}
              {!budget && <p className="text-[11px] text-slate-400 mt-1.5">Set a job budget in the job details to track spend against it.</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}