// Planner import constants — extracted from importPlannerSpreadsheet to keep
// the entry file under the line limit. Shared between the active importer
// and any future modules that need the same crew-section mappings.

export const SUBCONTRACTOR_TEAM_NAME = 'Subcontractors';
export const DIRECT_EMPLOYEE_TEAM_NAME = 'Direct Employees';
export const AGENCY_TEAM_NAME = 'Agency Workers';
export const DEPOT_TEAM_NAME = 'Dartford Depot';
export const DEPOT_ALIASES = ['dartford', 'yard', 'depot', 'warehouse'];
export const ANNUAL_LEAVE_TEAM_NAME = 'Annual Leave';

export const CREW_SECTION_TO_JOB_TYPE = {
  'cable': 'drilling', 'cable percussion': 'drilling',
  'rotary': 'drilling', 'coring': 'drilling',
  'groundworks': 'groundworks', 'groundworker': 'groundworks',
  'trial pit': 'groundworks', 'trial_pit': 'groundworks',
  'enabling': 'groundworks', 'enabling works': 'groundworks',
  'depot': 'groundworks', 'yard': 'groundworks', 'yard/depot': 'groundworks',
  'dartford': 'groundworks', 'warehouse': 'groundworks',
  'annual leave': 'groundworks', 'holiday': 'groundworks',
  'leave/sick': 'groundworks', 'leave': 'groundworks', 'sick': 'groundworks',
  'fitter': 'groundworks', 'plant fitter': 'groundworks',
};

export const CREW_SECTION_TO_JOB_TITLE = {
  'cable': 'Cable Percussion Driller', 'cable percussion': 'Cable Percussion Driller',
  'rotary': 'Rotary Driller', 'groundworks': 'Groundworker', 'groundworker': 'Groundworker',
  'coring': 'Coring Driller', 'trial pit': 'Trial Pit Operative', 'trial_pit': 'Trial Pit Operative',
  'enabling': 'Enabling Works Operative', 'enabling works': 'Enabling Works Operative',
  'depot': 'Yard/Depot Staff', 'yard': 'Yard/Depot Staff', 'yard/depot': 'Yard/Depot Staff',
  'dartford': 'Yard/Depot Staff', 'warehouse': 'Yard/Depot Staff',
  'annual leave': '', 'holiday': '',
  'leave/sick': '', 'leave': '', 'sick': '',
  'fitter': 'Plant Fitter', 'plant fitter': 'Plant Fitter',
};

export const CREW_SECTION_TO_DRILLING_METHOD = {
  'cable': 'cp', 'cable percussion': 'cp', 'rotary': 'rotary', 'coring': 'rotary',
  'groundworks': 'not_applicable', 'groundworker': 'not_applicable',
  'trial pit': 'not_applicable', 'trial_pit': 'not_applicable',
  'enabling': 'not_applicable', 'enabling works': 'not_applicable',
  'depot': 'not_applicable', 'yard': 'not_applicable', 'yard/depot': 'not_applicable',
  'dartford': 'not_applicable', 'warehouse': 'not_applicable',
  'annual leave': 'not_applicable', 'holiday': 'not_applicable',
  'leave/sick': 'not_applicable', 'leave': 'not_applicable', 'sick': 'not_applicable',
  'fitter': 'not_applicable', 'plant fitter': 'not_applicable',
};

export const NON_WORK_SECTION_KEYWORDS = [
  'annual leave', 'leave', 'sick', 'holiday', 'holidays', 'bh',
  'bank holiday', 'leave/sick', 'absence',
];

export const SUBCONTRACTOR_PATTERNS = ['subbies', 'subcontractor', 'sub-contractor', 'subby', 'sub.con', 'sub con', 'sub-con'];

export const KNOWN_AGENCY_NAMES = ['daniel owen', 'city sites', 'black swan'];

export const YARD_DEPOT_EXACT_TEXTS = ['yard', 'depot', 'yard/depot', 'yard - depot', 'yard depot', 'warehouse', 'dartford depot', 'dartford yard', 'yard duty', 'depot duty'];

export const FORCE_COMPLETE_MARKERS = ['[done]', '[closed]', '[complete]', '[completed]'];

export const TARGET_SHEET_PATTERNS = [
  /team\s*planner.*2026.*gw\+depot/i,
  /team\s*planner.*2026.*drilling/i,
  /^\s*drillers\s*$/i,
];