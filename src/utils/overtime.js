export const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const DEFAULT_OVERTIME_RATES = [
  { day_of_week: 0, multiplier: 2.0 },
  { day_of_week: 1, multiplier: 1.0 },
  { day_of_week: 2, multiplier: 1.0 },
  { day_of_week: 3, multiplier: 1.0 },
  { day_of_week: 4, multiplier: 1.0 },
  { day_of_week: 5, multiplier: 1.0 },
  { day_of_week: 6, multiplier: 1.5 },
];

export function buildRateMap(rates) {
  const map = {};
  for (let i = 0; i < 7; i++) map[i] = 1.0;
  (rates || []).forEach(r => {
    const d = Number(r.day_of_week);
    if (d >= 0 && d <= 6) map[d] = Number(r.multiplier) || 1.0;
  });
  return map;
}

export function entryMinutes(t) {
  if (t?.is_break) return 0;
  return Number(t.task_duration_minutes) || (t.total_hours ? t.total_hours * 60 : 0);
}

export function weekKey(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(d);
  monday.setDate(d.getDate() - diff);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, '0');
  const dd = String(monday.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// Given all timesheet entries for ONE staff (across all jobs), compute per-entry OT breakdown.
// Returns: { [entryId]: { regularMins, otMins, multiplier, cost, isOvertime } }
export function computeStaffOvertime(allStaffEntries, rateMap, thresholdHours, hourlyRate) {
  const thresholdMins = (Number(thresholdHours) || 40) * 60;
  const byWeek = {};
  (allStaffEntries || []).forEach(t => {
    const wk = weekKey(t.date);
    if (!byWeek[wk]) byWeek[wk] = [];
    byWeek[wk].push(t);
  });
  const result = {};
  Object.values(byWeek).forEach(weekEntries => {
    const sorted = [...weekEntries].sort((a, b) => {
      const da = new Date(a.date + 'T00:00:00').getTime();
      const db = new Date(b.date + 'T00:00:00').getTime();
      if (da !== db) return da - db;
      return new Date(a.created_date || 0).getTime() - new Date(b.created_date || 0).getTime();
    });
    let cumulative = 0;
    sorted.forEach(t => {
      const mins = entryMinutes(t);
      const prior = cumulative;
      const regularMins = Math.max(0, Math.min(mins, thresholdMins - prior));
      const otMins = mins - regularMins;
      cumulative += mins;
      const day = new Date(t.date + 'T00:00:00').getDay();
      const mult = rateMap[day] ?? 1.0;
      const regCost = (regularMins / 60) * hourlyRate;
      const otCost = (otMins / 60) * hourlyRate * mult;
      result[t.id] = { regularMins, otMins, multiplier: mult, cost: regCost + otCost, isOvertime: otMins > 0 };
    });
  });
  return result;
}