/**
 * Job-type-aware terminology helpers.
 *
 * Returns the correct crew/personnel label depending on the job type,
 * so the UI always says the right thing (e.g. "Driller" on drilling jobs,
 * "Groundworker" on groundworks jobs, "Operative" for enabling works).
 *
 * Used alongside getJobPrimaryType() from @/utils/jobTeams.
 */

/**
 * Returns the singular label for a crew member on a given job type.
 * e.g. cp_drilling → "Driller", groundworks → "Groundworker"
 */
export function getCrewMemberLabel(jobType) {
  switch (jobType) {
    case 'cp_drilling':
    case 'rotary_drilling':
      return 'Driller';
    case 'groundworks':
    case 'trial_pit':
      return 'Groundworker';
    case 'coring':
      return 'Corer';
    case 'enabling_works':
      return 'Operative';
    case 'depot':
      return 'Operative';
    default:
      return 'Crew Member';
  }
}

/**
 * Returns the collective label for the crew on a given job type.
 * e.g. cp_drilling → "Drilling Crew", groundworks → "Groundworks Crew"
 */
export function getCrewLabel(jobType, count) {
  const plural = count !== undefined && count !== 1;
  switch (jobType) {
    case 'cp_drilling':
      return plural ? 'Drilling Crew' : 'Driller';
    case 'rotary_drilling':
      return plural ? 'Rotary Crew' : 'Rotary Driller';
    case 'groundworks':
      return plural ? 'Groundworks Crew' : 'Groundworker';
    case 'trial_pit':
      return plural ? 'Trial Pit Crew' : 'Groundworker';
    case 'coring':
      return plural ? 'Coring Crew' : 'Corer';
    case 'enabling_works':
      return plural ? 'Enabling Crew' : 'Operative';
    case 'depot':
      return plural ? 'Depot Staff' : 'Operative';
    default:
      return plural ? 'Crew' : 'Crew Member';
  }
}

/**
 * Returns the shift/assignment label appropriate for the job type.
 * Drilling jobs say "shift"; other field jobs say "shift" too; depot says "shift".
 * Kept simple — "shift" works everywhere — but exposed for future tuning.
 */
export function getShiftLabel(jobType, count) {
  return count === 1 ? 'shift' : 'shifts';
}

/**
 * Returns a human-friendly work activity label for the job type.
 * e.g. drilling → "drilling", groundworks → "groundworks", enabling → "enabling works"
 */
export function getWorkLabel(jobType) {
  switch (jobType) {
    case 'cp_drilling':
    case 'rotary_drilling':
      return 'drilling';
    case 'groundworks':
    case 'trial_pit':
      return 'groundworks';
    case 'coring':
      return 'coring';
    case 'enabling_works':
      return 'enabling works';
    case 'depot':
      return 'depot work';
    default:
      return 'work';
  }
}