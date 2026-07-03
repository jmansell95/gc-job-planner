const jobTypeLabels = {
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

export function formatJobType(type) {
  if (!type) return '';
  return jobTypeLabels[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function formatJobRole(role) {
  if (!role) return '';
  return jobRoleLabels[role] || role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}