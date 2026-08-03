const jobTypeLabels = {
  drilling: 'Drilling',
  groundworks: 'Groundworks',
  cp_drilling: 'CP Drilling',
  rotary_drilling: 'Rotary Drilling',
  enabling_works: 'Enabling Works',
  depot: 'Depot',
};

const jobRoleLabels = {
  groundworker: 'Groundworker',
  cp_driller: 'CP Driller',
  rotary_driller: 'Rotary Driller',
  enabling_crew: 'Enabling Crew',
  depot: 'Depot',
  supervisor: 'Supervisor',
};

export function formatJobType(type, jobTypes = []) {
  if (!type) return '';
  const jt = jobTypes.find(t => t.key === type);
  if (jt?.label) return jt.label;
  return jobTypeLabels[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function formatJobRole(role) {
  if (!role) return '';
  return jobRoleLabels[role] || role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const workerTypeLabels = {
  direct_employee: 'Direct Employee',
  subcontractor: 'Subcontractor',
  agency: 'Agency Worker',
};

export function formatWorkerType(type) {
  if (!type) return '';
  return workerTypeLabels[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function titleCase(str) {
  if (!str) return '';
  return str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

import { format as dfFormat } from 'date-fns';

/**
 * Safe date formatter — returns a fallback string instead of throwing
 * when the input is null, undefined, or an invalid date. This prevents
 * a single bad record from blanking out an entire page.
 */
export function safeFormat(date, formatStr, fallback = '—') {
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return fallback;
    return dfFormat(d, formatStr);
  } catch {
    return fallback;
  }
}