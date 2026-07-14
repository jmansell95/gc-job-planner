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
  if (t?.status === 'merged') return 0;
  if (t?.task_type === 'travel_to' || t?.task_type === 'travel_from') return 0;
  return Number(t.task_duration_minutes) || (t.total_hours ? t.total_hours * 60 : 0);
}

// Returns the effective pay multiplier for a rota assignment.
// Per-assignment rate_multiplier takes priority; otherwise falls back to the
// day-of-week rate from the supplied rateMap.
export function getAssignmentMultiplier(assignment, rateMap) {
  if (!assignment) return 1.0;
  if (assignment.rate_multiplier != null && assignment.rate_multiplier !== '') {
    const v = Number(assignment.rate_multiplier);
    if (!isNaN(v) && v > 0) return v;
  }
  if (assignment.is_overtime) {
    const day = new Date(assignment.assigned_date + 'T00:00:00').getDay();
    return rateMap ? (rateMap[day] ?? 1.5) : 1.5;
  }
  return 1.0;
}

export function isWeekend(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr + 'T00:00:00').getDay();
  return d === 0 || d === 6;
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
// Payroll cost is handled outside this system — only hours & overtime multipliers are tracked here.
// Returns: { [entryId]: { regularMins, otMins, multiplier, isOvertime } }
export function computeStaffOvertime(allStaffEntries, rateMap, thresholdHours) {
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
      const explicitOT = !!t.is_overtime;
      const regularMins = explicitOT ? 0 : Math.max(0, Math.min(mins, thresholdMins - prior));
      const otMins = explicitOT ? mins : mins - regularMins;
      cumulative += mins;
      const day = new Date(t.date + 'T00:00:00').getDay();
      const mult = explicitOT && t.rate_multiplier != null && t.rate_multiplier !== '' ? Number(t.rate_multiplier) : (rateMap[day] ?? 1.0);
      result[t.id] = { regularMins, otMins, multiplier: mult, isOvertime: otMins > 0 };
    });
  });
  return result;
}