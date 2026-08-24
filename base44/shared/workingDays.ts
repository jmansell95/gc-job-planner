/**
 * Working-day calculator — computes business days between two dates,
 * excluding weekends (Sat/Sun) and UK bank holidays (from the BankHoliday entity).
 *
 * Used by the AFP variation cost-agreement lifecycle (Period From VO Date,
 * Period From Budget Issue, etc.) and available for any other date-spreadsheet
 * feature that needs UK working-day counts.
 */

// ── Fetch bank holiday dates for a year range (inclusive) ──
// Returns a Set of ISO date strings (YYYY-MM-DD).
export async function loadBankHolidays(base44: any, yearStart: number, yearEnd: number): Promise<Set<string>> {
  try {
    const holidays = await base44.asServiceRole.entities.BankHoliday.filter(
      { year: { $gte: yearStart, $lte: yearEnd } },
      null,
      500,
    );
    return new Set((holidays || []).map((h: any) => String(h.holiday_date).slice(0, 10)));
  } catch (_) {
    return new Set();
  }
}

// ── Count working days between two dates (exclusive of start, inclusive of end) ──
// This is the standard "elapsed working days" convention: if the VO date is Monday
// and the budget issue date is Friday, that's 4 working days (Tue, Wed, Thu, Fri).
// Returns 0 if either date is missing or end < start.
export function workingDaysBetween(startDate: string, endDate: string, bankHolidays: Set<string> = new Set()): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  if (end < start) return 0;
  let count = 0;
  const cur = new Date(start);
  cur.setDate(cur.getDate() + 1); // exclusive of start
  while (cur <= end) {
    const day = cur.getDay();
    const ds = cur.toISOString().slice(0, 10);
    if (day !== 0 && day !== 6 && !bankHolidays.has(ds)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

// ── Determine the cost-agreement stage status for a variation ──
// Returns one of: 'agreed' (all 4 dates set), 'budget_issued', 'firm_issued',
// 'assessment_issued', 'pending' (no dates yet), with an overdue flag when
// a stage has been open too long without progressing.
export function variationStageStatus(variation: any, bankHolidays: Set<string> = new Set()): { stage: string; overdue: boolean; daysInStage: number } {
  const today = new Date().toISOString().slice(0, 10);
  if (variation.cost_agreed_date) return { stage: 'agreed', overdue: false, daysInStage: 0 };
  if (variation.client_assessment_issue_date) {
    const days = workingDaysBetween(variation.client_assessment_issue_date, today, bankHolidays);
    return { stage: 'assessment_issued', overdue: days > 10, daysInStage: days };
  }
  if (variation.firm_cost_issue_date) {
    const days = workingDaysBetween(variation.firm_cost_issue_date, today, bankHolidays);
    return { stage: 'firm_issued', overdue: days > 10, daysInStage: days };
  }
  if (variation.budget_cost_issue_date) {
    const days = workingDaysBetween(variation.budget_cost_issue_date, today, bankHolidays);
    return { stage: 'budget_issued', overdue: days > 10, daysInStage: days };
  }
  if (variation.vo_date) {
    const days = workingDaysBetween(variation.vo_date, today, bankHolidays);
    return { stage: 'pending', overdue: days > 15, daysInStage: days };
  }
  return { stage: 'pending', overdue: false, daysInStage: 0 };
}