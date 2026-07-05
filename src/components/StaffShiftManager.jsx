import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, Users } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { EmptyState } from '@/components/StateViews';

const DAYS = [
  { dow: 1, label: 'Monday' },
  { dow: 2, label: 'Tuesday' },
  { dow: 3, label: 'Wednesday' },
  { dow: 4, label: 'Thursday' },
  { dow: 5, label: 'Friday' },
  { dow: 6, label: 'Saturday' },
  { dow: 0, label: 'Sunday' },
];

const toMins = (t) => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const shiftLen = (s, e) => { const a = toMins(s), b = toMins(e); if (a == null || b == null || b <= a) return 0; return b - a; };
const fmtLen = (mins) => {
  const m = Math.round(mins || 0); const h = Math.floor(m / 60), r = m % 60;
  if (h && r) return `${h}h ${r}m`; if (h) return `${h}h`; return m > 0 ? `${r}m` : '—';
};

export default function StaffShiftManager() {
  const queryClient = useQueryClient();
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: shifts = [] } = useQuery({ queryKey: ['staff-shifts'], queryFn: () => base44.entities.StaffShift.list() });

  const [vals, setVals] = useState({});

  useEffect(() => {
    const map = {};
    shifts.forEach(s => {
      map[`${s.staff_id}|${s.day_of_week}`] = { start: s.start_time || '', end: s.end_time || '', id: s.id };
    });
    setVals(map);
  }, [shifts]);

  const save = async (staffId, dow, field, value) => {
    const key = `${staffId}|${dow}`;
    const cur = vals[key] || { start: '', end: '', id: null };
    const next = { ...cur, [field]: value };
    setVals(v => ({ ...v, [key]: next }));
    try {
      if (!next.start && !next.end) {
        if (cur.id) await base44.entities.StaffShift.delete(cur.id);
      } else if (cur.id) {
        await base44.entities.StaffShift.update(cur.id, { [field]: value });
      } else {
        await base44.entities.StaffShift.create({ staff_id: staffId, day_of_week: dow, start_time: next.start || '', end_time: next.end || '' });
      }
      queryClient.invalidateQueries({ queryKey: ['staff-shifts'] });
    } catch (e) { console.error(e); }
  };

  return (
    <div>
      <PageHeader title="Shift Times" icon={Clock} />
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5 flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <Clock className="w-5 h-5 text-emerald-700" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">Set each staff member's usual start and finish time per day</p>
          <p className="text-xs text-slate-500 mt-0.5">These feed the staff schedule — task times pre-fill from the shift and the day total is auto-calculated against these hours.</p>
        </div>
      </div>

      {staff.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200">
          <EmptyState icon={Users} title="No staff yet" message="Add staff in the Staff tab first to set their shift times." />
        </div>
      ) : (
        <div className="space-y-3">
          {staff.map(member => {
            const setCount = DAYS.filter(d => vals[`${member.id}|${d.dow}`] && (vals[`${member.id}|${d.dow}`].start || vals[`${member.id}|${d.dow}`].end)).length;
            return (
              <div key={member.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-700 font-bold text-xs">{member.name.charAt(0)}</span>
                  </div>
                  <p className="font-semibold text-slate-900 text-sm flex-1 truncate">{member.name}</p>
                  <span className="text-xs text-slate-400">{setCount}/7 days set</span>
                </div>
                <div className="divide-y divide-slate-50">
                  {DAYS.map(d => {
                    const v = vals[`${member.id}|${d.dow}`] || { start: '', end: '' };
                    const len = shiftLen(v.start, v.end);
                    return (
                      <div key={d.dow} className="px-4 py-2.5 flex items-center gap-3 flex-wrap">
                        <span className="text-sm text-slate-600 w-24 flex-shrink-0">{d.label}</span>
                        <div className="flex items-center gap-1.5">
                          <input type="time" value={v.start} onChange={e => save(member.id, d.dow, 'start', e.target.value)}
                            className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 text-slate-700" />
                          <span className="text-slate-400 text-xs">to</span>
                          <input type="time" value={v.end} onChange={e => save(member.id, d.dow, 'end', e.target.value)}
                            className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 text-slate-700" />
                        </div>
                        {len > 0 && <span className="text-xs text-emerald-700 font-medium ml-auto">{fmtLen(len)}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}