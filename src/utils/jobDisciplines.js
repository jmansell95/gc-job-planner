/**
 * Multi-discipline helpers.
 *
 * Jobs now carry a `disciplines` array — each entry is an independent track
 * (drilling, groundworks, enabling, etc.) with its own status, dates, and
 * revenue method. These helpers bridge the new array with the legacy
 * single-type fields so display logic keeps working during migration.
 */

import { getJobPrimaryType } from './jobTeams';

// Discipline type → display config
export const DISCIPLINE_CONFIG = {
  drilling: { label: 'Drilling', color: 'amber', dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200', icon: 'Drill' },
  groundworks: { label: 'Groundworks', color: 'emerald', dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200', icon: 'HardHat' },
  enabling: { label: 'Enabling', color: 'purple', dot: 'bg-purple-500', badge: 'bg-purple-100 text-purple-700 ring-1 ring-purple-200', icon: 'Wrench' },
  enabling_works: { label: 'Enabling Works', color: 'purple', dot: 'bg-purple-500', badge: 'bg-purple-100 text-purple-700 ring-1 ring-purple-200', icon: 'Wrench' },
  coring: { label: 'Coring', color: 'blue', dot: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200', icon: 'CircleDot' },
  trial_pit: { label: 'Trial Pit', color: 'teal', dot: 'bg-teal-500', badge: 'bg-teal-100 text-teal-700 ring-1 ring-teal-200', icon: 'Shovel' },
  depot: { label: 'Depot', color: 'slate', dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200', icon: 'Warehouse' },
  supervisor: { label: 'Supervisor', color: 'rose', dot: 'bg-rose-500', badge: 'bg-rose-100 text-rose-700 ring-1 ring-rose-200', icon: 'UserCog' },
};

export function getDisciplineConfig(typeKey) {
  return DISCIPLINE_CONFIG[typeKey] || {
    label: typeKey ? typeKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'General',
    color: 'slate', dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200', icon: 'Briefcase',
  };
}

/**
 * Returns the disciplines array for a job. Falls back to a single-entry
 * array derived from the legacy job_type if the disciplines array is empty,
 * so old jobs display correctly before migration.
 */
export function getJobDisciplines(job) {
  if (!job) return [];
  if (Array.isArray(job.disciplines) && job.disciplines.length > 0) {
    return job.disciplines;
  }
  // Legacy fallback — derive from job_type
  const legacyType = job.job_type || getJobPrimaryType(job) || 'groundworks';
  return [{
    type: legacyType,
    status: job.status === 'completed' ? 'completed' : (job.status === 'planning' ? 'planning' : 'active'),
    drilling_method: job.drilling_method || 'not_applicable',
    start_date: job.start_date,
    end_date: job.end_date,
    revenue_method: job.revenue_method || 'none',
  }];
}

/**
 * Returns the primary discipline type key for a job.
 */
export function getPrimaryDisciplineType(job) {
  if (!job) return null;
  if (job.primary_discipline) return job.primary_discipline;
  const disciplines = getJobDisciplines(job);
  return disciplines.length > 0 ? disciplines[0].type : null;
}

/**
 * Returns true if the job has an active discipline of the given type.
 */
export function hasDiscipline(job, typeKey) {
  if (!job) return false;
  const disciplines = getJobDisciplines(job);
  return disciplines.some(d => d.type === typeKey && d.status !== 'completed');
}

/**
 * Returns the count of active (non-completed) disciplines.
 */
export function getActiveDisciplineCount(job) {
  const disciplines = getJobDisciplines(job);
  return disciplines.filter(d => d.status === 'active' || d.status === 'planning').length;
}