import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const DAYS = [
  { dow: 1, label: 'Mon' }, { dow: 2, label: 'Tue' }, { dow: 3, label: 'Wed' },
  { dow: 4, label: 'Thu' }, { dow: 5, label: 'Fri' }, { dow: 6, label: 'Sat' }, { dow: 0, label: 'Sun' },
];

const toMins = (t) => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const len = (s, e) => { const a = toMins(s), b = toMins(e); if (a == null || b == null || b <= a) return 0; return b - a; };
const fmtLen = (mins) => {
  const m = Math.round(mins || 0); const h = Math.floor(m / 60), r = m % 60;
  if (h && r) return `${h}h ${r}m`; if (h) return `${h}h`; return m > 0 ? `${r}m` : '—';
};

export default function StaffShiftEditor({ staffId }) {
  const queryClient = useQueryClient();
  const { data: shifts = [] } = useQuery({ queryKey: ['staff-shifts', staffId], queryFn: () => base44.entities.StaffShift.filter({ staff_id: staffId }), enabled: !!staffId });
  const [vals, setVals] = useState({});

  useEffect(() => {
    const map = {};
    shifts.forEach(s => { map[s.day_of_week] = { start: s.start_time || '', end: s.end_time || '', id: s.id }; });
    setVals(map);
  }, [shifts]);

  const save = async (dow, field, value) => {
    const cur = vals[dow] || { start: '', end: '', id: null };
    const next = { ...cur, [field]: value };
    setVals(v => ({ ...v, [dow]: next }));
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
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5">
      {DAYS.map(d => {
        const v = vals[d.dow] || { start: '', end: '' };
        const l = len(v.start, v.end);
        return (
          <div key={d.dow} className="flex items-center gap-2 py-1.5">
            <span className="text-xs text-slate-500 w-9 flex-shrink-0">{d.label}</span>
            <input type="time" value={v.start} onChange={e => save(d.dow, 'start', e.target.value)}
              className="px-2 py-1 border border-slate-300 rounded-md text-xs focus:outline-none focus:border-emerald-600 text-slate-700 w-[5.5rem]" />
            <span className="text-slate-300 text-[10px]">–</span>
            <input type="time" value={v.end} onChange={e => save(d.dow, 'end', e.target.value)}
              className="px-2 py-1 border border-slate-300 rounded-md text-xs focus:outline-none focus:border-emerald-600 text-slate-700 w-[5.5rem]" />
            {l > 0 ? <span className="text-[10px] text-emerald-600 font-medium ml-auto">{fmtLen(l)}</span> : <span className="text-[10px] text-slate-300 ml-auto">Off</span>}
          </div>
        );
      })}
    </div>
  );
}