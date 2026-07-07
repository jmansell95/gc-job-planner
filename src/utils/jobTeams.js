/**
 * Team-centric job helpers.
 *
 * Jobs used to carry a single `job_type` enum that hard-restricted which staff
 * could be assigned. That field is now legacy — the source of truth is
 * `required_team_ids` (an array of Team IDs). These helpers bridge the two so
 * display logic and business rules keep working for both old and new records.
 */

const DRILLING_TYPES = ['cp_drilling', 'rotary_drilling'];

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
export function isDrillingJobType(jobType) {
  return DRILLING_TYPES.includes(jobType);
}

/**
 * Whether a job is a drilling job — checks the legacy `job_type` first, then
 * falls back to whether any of its required teams handle drilling.
 */
export function isDrillingJob(job, teams = []) {
  if (!job) return false;
  if (job.job_type) return isDrillingJobType(job.job_type);
  const teamIds = getJobTeamIds(job);
  return teamIds.some(id => {
    const team = teams.find(t => t.id === id);
    return team && isDrillingJobType(team.job_type);
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