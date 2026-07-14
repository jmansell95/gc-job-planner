import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Timer, Save, Check, Info, TrendingUp, Clock, Users } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { DAY_LABELS, buildRateMap, computeStaffOvertime } from '@/utils/overtime';

export default function OvertimeRatesManager() {
  const queryClient = useQueryClient();
  const { data: rates = [] } = useQuery({ queryKey: ['overtime-rates'], queryFn: () => base44.entities.OvertimeRate.list() });
  const { data: setting } = useQuery({
    queryKey: ['overtime-setting'],
    queryFn: async () => { const l = await base44.entities.OvertimeSetting.list(); return l[0] || null; }
  });
  const { data: timesheets = [] } = useQuery({ queryKey: ['all-timesheets-ot-stats'], queryFn: () => base44.entities.Timesheet.list('-created_date', 500) });
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });

  const [multipliers, setMultipliers] = useState([2.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.5]);
  const [threshold, setThreshold] = useState(40);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (rates.length) {
      const map = [2.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.5];
      rates.forEach(r => { if (r.day_of_week >= 0 && r.day_of_week <= 6) map[r.day_of_week] = Number(r.multiplier); });
      setMultipliers(map);
    }
  }, [rates]);

  useEffect(() => { if (setting) setThreshold(setting.weekly_threshold_hours ?? 40); }, [setting]);

  const existingByDay = {};
  rates.forEach(r => { existingByDay[r.day_of_week] = r; });

  // Overtime totals across approved timesheets
  const approvedTs = timesheets.filter(t => t.status === 'approved');
  const savedRateMap = buildRateMap(rates);
  const savedThreshold = setting?.weekly_threshold_hours ?? 40;
  const perPerson = staff.map(s => {
    const entries = approvedTs.filter(t => t.staff_id === s.id);
    if (entries.length === 0) return null;
    const bd = computeStaffOvertime(entries, savedRateMap, savedThreshold, 0);
    let stdMins = 0, otMins = 0;
    entries.forEach(t => {
      const b = bd[t.id] || {};
      stdMins += b.regularMins || 0;
      otMins += b.otMins || 0;
    });
    return { name: s.name, role: s.job_role, stdMins, otMins };
  }).filter(Boolean);
  const totalStdMins = perPerson.reduce((s, p) => s + p.stdMins, 0);
  const totalOtMins = perPerson.reduce((s, p) => s + p.otMins, 0);
  const otStaffCount = perPerson.filter(p => p.otMins > 0).length;
  const fmtH = (mins) => (mins / 60).toFixed(1) + 'h';

  const save = async () => {
    setSaving(true);
    try {
      for (let d = 0; d < 7; d++) {
        const existing = existingByDay[d];
        const mult = Number(multipliers[d]);
        if (existing) {
          if (Number(existing.multiplier) !== mult) {
            await base44.entities.OvertimeRate.update(existing.id, { day_of_week: d, multiplier: mult, label: DAY_LABELS[d] });
          }
        } else {
          await base44.entities.OvertimeRate.create({ day_of_week: d, multiplier: mult, label: DAY_LABELS[d] });
        }
      }
      if (setting) {
        if (Number(setting.weekly_threshold_hours) !== Number(threshold)) {
          await base44.entities.OvertimeSetting.update(setting.id, { weekly_threshold_hours: Number(threshold) });
        }
      } else {
        await base44.entities.OvertimeSetting.create({ weekly_threshold_hours: Number(threshold) });
      }
      queryClient.invalidateQueries({ queryKey: ['overtime-rates'] });
      queryClient.invalidateQueries({ queryKey: ['overtime-setting'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const isWeekend = (d) => d === 0 || d === 6;

  return (
    <div>
      <PageHeader title="Overtime Rates" icon={Timer} />

      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 p-5 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-700 flex items-center justify-center flex-shrink-0">
            <Info className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-slate-900 mb-1">How overtime works</h3>
            <p className="text-sm text-slate-600">Staff are paid their normal hourly rate up to the weekly threshold ({threshold}h). Any hours beyond that are paid at the day's overtime multiplier. Weekend days typically carry a higher multiplier.</p>
          </div>
        </div>
      </div>

      {perPerson.length > 0 && (
        <div className="mb-6 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-emerald-700" /><p className="text-xs text-slate-500 font-medium">Standard time</p></div>
              <p className="text-2xl font-bold text-slate-900 mt-1">{fmtH(totalStdMins)}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-amber-600" /><p className="text-xs text-slate-500 font-medium">Overtime</p></div>
              <p className="text-2xl font-bold text-amber-600 mt-1">{fmtH(totalOtMins)}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center gap-2"><Users className="w-4 h-4 text-blue-700" /><p className="text-xs text-slate-500 font-medium">Staff with OT</p></div>
              <p className="text-2xl font-bold text-blue-700 mt-1">{otStaffCount}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-700" />
              <h2 className="font-semibold text-slate-900">Overtime by person</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {perPerson.map((p, i) => (
                <div key={i} className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{p.name}</p>
                    <p className="text-xs text-slate-400 capitalize">{p.role?.replace(/_/g, ' ')}</p>
                  </div>
                  <div className="flex items-center gap-4 text-sm flex-shrink-0">
                    <div className="text-right"><p className="text-xs text-slate-400">Standard</p><p className="font-semibold text-slate-900">{fmtH(p.stdMins)}</p></div>
                    <div className="text-right"><p className="text-xs text-slate-400">Overtime</p><p className={`font-semibold ${p.otMins > 0 ? 'text-amber-600' : 'text-slate-300'}`}>{fmtH(p.otMins)}</p></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <label className="block text-sm font-medium text-slate-700 mb-1">Weekly threshold (hours)</label>
            <p className="text-xs text-slate-400">Regular hours before overtime kicks in</p>
          </div>
          <input type="number" min="0" step="0.5" value={threshold} onChange={(e) => setThreshold(e.target.value)}
            className="w-24 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm text-center font-semibold flex-shrink-0" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-700" />
          <h2 className="font-semibold text-slate-900">Day multipliers</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {DAY_LABELS.map((label, d) => (
            <div key={d} className="px-5 py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${isWeekend(d) ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                  {label.slice(0, 3)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{label}</p>
                  <p className="text-xs text-slate-400">{isWeekend(d) ? 'Weekend rate' : 'Standard rate'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-slate-400">×</span>
                <input type="number" min="0" step="0.1" value={multipliers[d]}
                  onChange={(e) => setMultipliers(prev => { const n = [...prev]; n[d] = e.target.value; return n; })}
                  className="w-20 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm text-center font-semibold" />
              </div>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60 text-xs text-slate-500">
          1.0 = normal rate · 1.5 = time-and-a-half · 2.0 = double time
        </div>
      </div>

      <button onClick={save} disabled={saving}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-700 text-white rounded-lg text-sm font-medium hover:bg-emerald-800 transition disabled:opacity-50">
        {saving ? 'Saving...' : <><Save className="w-4 h-4" /> Save rates</>}
      </button>
      {saved && <span className="ml-3 text-sm text-emerald-700 font-medium inline-flex items-center gap-1"><Check className="w-4 h-4" /> Saved</span>}
    </div>
  );
}