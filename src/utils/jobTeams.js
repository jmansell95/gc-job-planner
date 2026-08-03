/**
 * Team-centric job helpers.
 *
 * Jobs used to carry a single `job_type` enum that hard-restricted which staff
 * could be assigned. That field is now legacy — the source of truth is
 * `required_team_ids` (an array of Team IDs). These helpers bridge the two so
 * display logic and business rules keep working for both old and new records.
 */

const DRILLING_TYPES = ['drilling', 'cp_drilling', 'rotary_drilling'];

export const JOB_TYPE_COLORS = {
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500', border: 'border-emerald-200', bar: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-800', dot: 'bg-amber-500', border: 'border-amber-200', bar: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200' },
  blue: { bg: 'bg-blue-100', text: 'text-blue-800', dot: 'bg-blue-500', border: 'border-blue-200', bar: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-800', dot: 'bg-purple-500', border: 'border-purple-200', bar: 'bg-purple-500', badge: 'bg-purple-100 text-purple-700 ring-1 ring-purple-200' },
  slate: { bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-400', border: 'border-slate-200', bar: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200' },
  rose: { bg: 'bg-rose-100', text: 'text-rose-800', dot: 'bg-rose-500', border: 'border-rose-200', bar: 'bg-rose-500', badge: 'bg-rose-100 text-rose-700 ring-1 ring-rose-200' },
  teal: { bg: 'bg-teal-100', text: 'text-teal-800', dot: 'bg-teal-500', border: 'border-teal-200', bar: 'bg-teal-500', badge: 'bg-teal-100 text-teal-700 ring-1 ring-teal-200' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-800', dot: 'bg-orange-500', border: 'border-orange-200', bar: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700 ring-1 ring-orange-200' },
};

export function getJobTypeColor(typeKey, jobTypes = []) {
  const jt = jobTypes.find(t => t.key === typeKey);
  const colorName = jt?.color || 'slate';
  return JOB_TYPE_COLORS[colorName] || JOB_TYPE_COLORS.slate;
}

export function getJobTypeLabel(typeKey, jobTypes = []) {
  if (!typeKey) return 'General';
  const jt = jobTypes.find(t => t.key === typeKey);
  if (jt?.label) return jt.label;
  return typeKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** Returns the array of required team IDs for a job (empty if none). */
export function getJobTeamIds(job) {
  if (!job) return [];
  if (Array.isArray(job.required_team_ids)) return job.required_team_ids;
  return [];
}

/**
 * Returns the "primary" job type for display purposes (colors, badges, labels).
 * Falls back to the legacy `job_type` field, then to the first required team's
 * `job_type`. Returns null when no type can be derived.
 */
export function getJobPrimaryType(job, teams = []) {
  if (!job) return null;
  if (job.job_type) return job.job_type;
  const teamIds = getJobTeamIds(job);
  if (teamIds.length > 0) {
    const team = teams.find(t => t.id === teamIds[0]);
    if (team?.job_type) return team.job_type;
  }
  return null;
}

/** True when a job type string is a drilling type (CP or rotary). */
export function isDrillingJobType(jobType, jobTypes = []) {
  if (!jobType) return false;
  const jt = jobTypes.find(t => t.key === jobType);
  return jt ? !!jt.is_drilling : DRILLING_TYPES.includes(jobType);
}

/**
 * Whether a job is a drilling job — checks the legacy `job_type` first, then
 * falls back to whether any of its required teams handle drilling.
 */
export function isDrillingJob(job, teams = [], jobTypes = []) {
  if (!job) return false;
  if (job.job_type) return isDrillingJobType(job.job_type, jobTypes);
  const teamIds = getJobTeamIds(job);
  return teamIds.some(id => {
    const team = teams.find(t => t.id === id);
    return team && isDrillingJobType(team.job_type, jobTypes);
  });
}

/**
 * Soft-warning check: returns true when the staff member's team is NOT among
 * the job's required teams. Returns false (no warning) when the job has no
 * required teams set, the staff has no team, or the staff's team is listed.
 */
export function isStaffOutsideJobTeams(staff, job, teams = []) {
  if (!staff || !job) return false;
  const teamIds = getJobTeamIds(job);
  if (teamIds.length === 0) return false;
  if (!staff.team_id) return false;
  return !teamIds.includes(staff.team_id);
}