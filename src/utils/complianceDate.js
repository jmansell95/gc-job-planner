import { format, differenceInDays } from 'date-fns';

// Parses a compliance date that may be in YYYY-MM or YYYY-MM-DD format
export function parseComplianceDate(str) {
  if (!str) return null;
  if (/^\d{4}-\d{2}$/.test(str)) return new Date(str + '-01T00:00:00');
  return new Date(str + 'T00:00:00');
}

// Formats for display — MMM yyyy for YYYY-MM, dd MMM yyyy for full dates
export function formatComplianceDate(str) {
  const d = parseComplianceDate(str);
  if (!d || isNaN(d.getTime())) return str || '';
  if (/^\d{4}-\d{2}$/.test(str)) return format(d, 'MMM yyyy');
  return format(d, 'dd MMM yyyy');
}

// Days until expiry (handles both formats)
export function complianceDaysUntil(str) {
  const d = parseComplianceDate(str);
  if (!d || isNaN(d.getTime())) return null;
  return differenceInDays(d, new Date());
}