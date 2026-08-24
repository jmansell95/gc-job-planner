/**
 * AFP date helpers — shared by the Create AFP modal and the AFP Builder date editor.
 *
 * The four AFP dates:
 *   period_start_date       — when the AFP period begins (manual)
 *   period_end_date         — the submission deadline (manual) — we MUST send by this date
 *   certification_due_date   — auto = period_end + 5 days (when client certifies what they'll pay)
 *   final_payment_notice_date — auto = period_end + 30 days (last date client can pay)
 *
 * The auto-calculated dates are fully editable; these helpers only provide the
 * default values when the user hasn't overridden them.
 */

export function addDays(dateStr, days) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function defaultCertificationDue(periodEndDate) {
  return addDays(periodEndDate, 5);
}

export function defaultFinalPaymentNotice(periodEndDate) {
  return addDays(periodEndDate, 30);
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}