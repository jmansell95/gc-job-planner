import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Eye, CheckCircle2, CalendarDays, Users, CalendarRange } from 'lucide-react';
import { format } from 'date-fns';

const weekStart = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00');
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  return format(d, 'yyyy-MM-dd');
};

const MODES = [
  { key: 'day', label: 'By day', icon: CalendarDays },
  { key: 'week', label: 'By week', icon: CalendarRange },
  { key: 'staff', label: 'By staff', icon: Users },
];

export default function WithdrawnAcknowledgementPanel({ timesheets, staff, jobs, currentUser }) {
  const [mode, setMode] = useState('day');
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();

  const pending = timesheets.filter(t => t.status === 'deleted' && !t.withdrawal_acknowledged);

  const groupKey = (t) => mode === 'day' ? t.date : mode === 'week' ? weekStart(t.date) : t.staff_id;
  const groups = {};
  pending.forEach(t => { const k = groupKey(t); (groups[k] = groups[k] || []).push(t); });
  const groupEntries = Object.entries(groups).sort((a, b) => (a[0] < b[0] ? 1 : -1));

  const acknowledge = async (items) => {
    setBusy(true);
    try {
      const name = currentUser?.full_name || 'Manager';
      await base44.entities.Timesheet.bulkUpdate(items.map(t => ({
        id: t.id,
        withdrawal_acknowledged: true,
        withdrawal_acknowledged_by: name,
        withdrawal_acknowledged_at: new Date().toISOString()
      })));
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
    } catch (e) { console.error(e); }
    setBusy(false);
  };

  const acknowledgeAll = async () => {
    if (!pending.length) return;
    if (!confirm(`Acknowledge all ${pending.length} pending withdrawal(s)?`)) return;
    await acknowledge(pending);
  };

  if (pending.length === 0) return null;

  const groupLabel = (key) => {
    if (mode === 'day') return format(new Date(key + 'T00:00:00'), 'EEEE, dd MMM yyyy');
    if (mode === 'week') return `Week starting ${format(new Date(key + 'T00:00:00'), 'dd MMM yyyy')}`;
    const m = staff.find(s => s.id === key);
    return m?.name || 'Unknown staff';
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 flex-wrap">
        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
          <Eye className="w-4 h-4 text-amber-700" />
        </div>
        <h2 className="font-semibold text-slate-900">Withdrawals to acknowledge</h2>
        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{pending.length} pending</span>
        <div className="ml-auto flex gap-1">
          {MODES.map(m => {
            const Icon = m.icon;
            return (
              <button key={m.key} onClick={() => setMode(m.key)}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${mode === m.key ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                <Icon className="w-3.5 h-3.5" /> {m.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {groupEntries.map(([key, items]) => (
          <div key={key} className="px-5 py-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{groupLabel(key)}</p>
                <p className="text-xs text-slate-400">{items.length} withdrawal{items.length === 1 ? '' : 's'}</p>
              </div>
              <button onClick={() => acknowledge(items)} disabled={busy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-semibold hover:bg-emerald-800 active:scale-95 transition disabled:opacity-50">
                <CheckCircle2 className="w-3.5 h-3.5" /> Acknowledge {items.length}
              </button>
            </div>
            <div className="mt-2 space-y-1.5">
              {items.map(t => {
                const member = staff.find(s => s.id === t.staff_id);
                const job = jobs.find(j => j.id === t.job_id);
                const who = mode === 'staff'
                  ? (job?.name || '—')
                  : `${member?.name || 'Unknown staff'}${mode === 'week' ? ` · ${format(new Date(t.date + 'T00:00:00'), 'dd MMM')}` : ''}`;
                return (
                  <div key={t.id} className="text-xs flex gap-2 items-start">
                    <span className="font-medium text-slate-700 flex-shrink-0 min-w-[90px]">{who}</span>
                    <span className="text-slate-500">{t.deletion_reason || <span className="italic text-slate-300">No reason given</span>}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="px-5 py-3 bg-slate-50/60 border-t border-slate-100 flex justify-end">
        <button onClick={acknowledgeAll} disabled={busy}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-emerald-300 text-emerald-700 rounded-lg text-xs font-semibold hover:bg-emerald-50 active:scale-95 transition disabled:opacity-50">
          <CheckCircle2 className="w-3.5 h-3.5" /> Acknowledge all {pending.length}
        </button>
      </div>
    </div>
  );
}