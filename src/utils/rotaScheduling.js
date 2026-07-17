import { SITE_OPEN_TIME, SITE_CLOSE_TIME } from '@/utils/siteHours';

/** Convert "HH:MM" to minutes since midnight. Returns null if invalid/empty. */
export function timeToMinutes(t) {
  if (!t || typeof t !== 'string') return null;
  const [h, m] = t.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

export const SITE_OPEN_TIME_MIN = timeToMinutes(SITE_OPEN_TIME);   // 480
export const SITE_CLOSE_TIME_MIN = timeToMinutes(SITE_CLOSE_TIME);  // 1020

/** Convert minutes to "HH:MM". */
export function minutesToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Detect time overlaps for a given staff member on a given date.
 * Only considers assignments that have both start_time and end_time.
 * Returns array of { a, b } overlapping pairs.
 */
export function detectOverlaps(assignments, staffId, date) {
  const day = assignments.filter(r =>
    r.staff_id === staffId &&
    r.assigned_date === date &&
    r.start_time && r.end_time
  );
  const overlaps = [];
  for (let i = 0; i < day.length; i++) {
    for (let j = i + 1; j < day.length; j++) {
      const a = timeToMinutes(day[i].start_time);
      const b = timeToMinutes(day[i].end_time);
      const c = timeToMinutes(day[j].start_time);
      const d = timeToMinutes(day[j].end_time);
      if (a == null || b == null || c == null || d == null) continue;
      // overlap if a < d && c < b
      if (a < d && c < b) {
        overlaps.push({ a: day[i], b: day[j] });
      }
    }
  }
  return overlaps;
}

/**
 * Check if a new/edited assignment would overlap an existing one.
 * Returns the conflicting assignment or null.
 */
export function findConflict(assignments, staffId, date, startTime, endTime, excludeId) {
  if (!startTime || !endTime) return null;
  const newStart = timeToMinutes(startTime);
  const newEnd = timeToMinutes(endTime);
  if (newStart == null || newEnd == null || newStart >= newEnd) return null;
  return assignments.find(r =>
    r.staff_id === staffId &&
    r.assigned_date === date &&
    r.id !== excludeId &&
    r.start_time && r.end_time &&
    (() => {
      const s = timeToMinutes(r.start_time);
      const e = timeToMinutes(r.end_time);
      return s != null && e != null && newStart < e && s < newEnd;
    })()
  ) || null;
}

/**
 * Suggest non-overlapping start/end times for a staff member's Nth job on a date.
 * Site hours are 08:00–17:00. If the staff already has assignments that day,
 * this packs the new job into the next free slot after the last one ends.
 * Returns { start_time, end_time } or null if no slot fits.
 */
export function suggestAutoTimes(assignments, staffId, date, options = {}) {
  const jobDurationMins = options.durationMins || 480; // default 8h full day
  const openMin = timeToMinutes(SITE_OPEN_TIME);   // 480 (08:00)
  const closeMin = timeToMinutes(SITE_CLOSE_TIME); // 1020 (17:00)

  const existing = assignments
    .filter(r => r.staff_id === staffId && r.assigned_date === date && r.start_time && r.end_time)
    .map(r => ({ start: timeToMinutes(r.start_time), end: timeToMinutes(r.end_time) }))
    .filter(s => s.start != null && s.end != null)
    .sort((a, b) => a.start - b.start);

  if (existing.length === 0) {
    // First job of the day — full site hours
    return { start_time: SITE_OPEN_TIME, end_time: SITE_CLOSE_TIME };
  }

  // Find a free gap that fits jobDurationMins.
  // Strategy: try the gap after the last assignment ends (up to close).
  const lastEnd = existing[existing.length - 1].end;
  if (lastEnd + jobDurationMins <= closeMin) {
    return {
      start_time: minutesToTime(lastEnd),
      end_time: minutesToTime(Math.min(lastEnd + jobDurationMins, closeMin)),
    };
  }

  // Otherwise look for gaps between assignments
  let cursor = openMin;
  for (const slot of existing) {
    if (slot.start - cursor >= jobDurationMins) {
      return { start_time: minutesToTime(cursor), end_time: minutesToTime(cursor + jobDurationMins) };
    }
    cursor = Math.max(cursor, slot.end);
  }
  // trailing gap
  if (closeMin - cursor >= jobDurationMins) {
    return { start_time: minutesToTime(cursor), end_time: minutesToTime(cursor + jobDurationMins) };
  }

  // No slot fits the full duration — return the remaining gap (partial) or null
  if (closeMin - cursor > 0) {
    return { start_time: minutesToTime(cursor), end_time: minutesToTime(closeMin) };
  }
  return null;
}

/**
 * Summarise a staff member's shifts for one date.
 * Returns { totalMinutes, assignments: sortedByStart, hasOverlap }
 */
export function getDailyShiftSummary(assignments, staffId, date) {
  const day = assignments
    .filter(r => r.staff_id === staffId && r.assigned_date === date)
    .sort((a, b) => (timeToMinutes(a.start_time) || 0) - (timeToMinutes(b.start_time) || 0));
  const totalMinutes = day.reduce((sum, r) => {
    const s = timeToMinutes(r.start_time);
    const e = timeToMinutes(r.end_time);
    if (s != null && e != null && e > s) return sum + (e - s);
    return sum;
  }, 0);
  const hasOverlap = detectOverlaps(assignments, staffId, date).length > 0;
  return { totalMinutes, assignments: day, hasOverlap };
}