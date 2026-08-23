import { fetchSignaturesForWeek } from '@/utils/signatureFlow';

export const fmtDur = (mins) => {
  const m = Math.round(Number(mins) || 0);
  const h = Math.floor(m / 60), r = m % 60;
  if (h && r) return `${h}h ${r}m`;
  if (h) return `${h}h`;
  return m > 0 ? `${r}m` : '—';
};

export const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Compute the full week status from daily summary entries + signatures.
 * Returns all the flags the UI needs to render the card and action buttons.
 */
export function computeWeekStatus(dailySummaries, signatures = []) {
  const weeklyRecord = dailySummaries.find((t) => t.is_weekly_summary);
  const nonWeekly = dailySummaries.filter((t) => !t.is_weekly_summary);
  const workedDays = nonWeekly.filter((t) => t.status !== 'deleted' && t.status !== 'rejected');

  const allApproved = workedDays.length > 0 && workedDays.every((t) => t.status === 'approved');
  const hasSubmitted = workedDays.some((t) => t.status === 'submitted');
  const hasRejected = workedDays.some((t) => t.status === 'rejected');
  const isMerged = !!weeklyRecord || workedDays.some((t) => t.status === 'merged');

  const staffSigned = !!signatures.find((s) => s.tier === 'daily_worker');
  const managerSigned = !!signatures.find((s) => s.tier === 'weekly_official');

  return {
    weeklyRecord,
    workedDays,
    allApproved,
    hasSubmitted,
    hasRejected,
    isMerged,
    staffSigned,
    managerSigned,
    readyToMerge: allApproved && !isMerged,
    // Staff has signed + there are submitted days awaiting manager approval
    awaitingManager: staffSigned && hasSubmitted && !allApproved,
  };
}

/**
 * Fetch signatures for a week, returning an empty array on error.
 */
export async function getWeekSignatures(weekStart, staffId) {
  try {
    return await fetchSignaturesForWeek(weekStart, staffId);
  } catch {
    return [];
  }
}

/**
 * Build the 7 week dates (Mon–Sun) from a weekStart string.
 */
export function buildWeekDates(weekStart) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart + 'T00:00:00');
    d.setDate(d.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });
}

/**
 * Group daily summary entries by date.
 */
export function groupByDate(entries) {
  const byDate = {};
  entries.forEach((t) => {
    if (!byDate[t.date]) byDate[t.date] = [];
    byDate[t.date].push(t);
  });
  return byDate;
}