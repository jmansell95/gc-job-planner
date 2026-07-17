import { format, addDays } from 'date-fns';

/**
 * Compute smart warnings for a published/draft rota week.
 * Returns an array of { severity, type, title, message } warnings.
 *
 * Checks:
 *  1. Double-booking — same staff assigned to 2+ different jobs on the same date
 *  2. Unstaffed active jobs — jobs requiring teams but with no assignments this week
 *  3. Leave conflicts — staff scheduled on an approved-leave or recurring day-off
 */
export function computeRotaWarnings({ weekStartStr, rotas = [], staff = [], jobs = [], absences = [], recurring = [] }) {
  const warnings = [];
  const weekEndDate = format(addDays(new Date(weekStartStr + 'T00:00:00'), 6), 'yyyy-MM-dd');
  const staffMap = Object.fromEntries(staff.map(s => [s.id, s]));

  // 1. Double-booking
  const byStaffDate = {};
  rotas.forEach(r => {
    const k = `${r.staff_id}|${r.assigned_date}`;
    (byStaffDate[k] ||= []).push(r);
  });
  Object.entries(byStaffDate).forEach(([key, items]) => {
    const [staffId, date] = key.split('|');
    const jobIds = [...new Set(items.map(r => r.job_id))];
    if (jobIds.length > 1) {
      const member = staffMap[staffId];
      warnings.push({
        severity: 'critical',
        type: 'double_booking',
        title: `${member?.name || 'Staff member'} double-booked`,
        message: `Scheduled on ${jobIds.length} different jobs on ${format(new Date(date + 'T00:00:00'), 'EEE dd MMM')}.`,
      });
    }
  });

  // 2. Unstaffed active jobs overlapping this week
  const activeJobs = jobs.filter(j => {
    if (['completed', 'cancelled', 'on_hold'].includes(j.status)) return false;
    if (!j.required_team_ids || j.required_team_ids.length === 0) return false;
    const jStart = j.start_date || '1900-01-01';
    const jEnd = j.end_date || '2999-12-31';
    return jStart <= weekEndDate && jEnd >= weekStartStr;
  });
  const assignedJobIds = new Set(rotas.map(r => r.job_id));
  activeJobs.forEach(j => {
    if (!assignedJobIds.has(j.id)) {
      warnings.push({
        severity: 'warning',
        type: 'unstaffed_job',
        title: `${j.name} — no crew scheduled`,
        message: `Active job requires teams but nobody is assigned in this rota week.`,
      });
    }
  });

  // 3. Leave / day-off conflicts
  const leaveState = (staffId, dateStr) => {
    const dow = new Date(dateStr + 'T00:00:00').getDay();
    const rec = recurring.find(r => r.staff_id === staffId && r.is_active !== false && Array.isArray(r.days_of_week) && r.days_of_week.includes(dow));
    if (rec) return rec.label || 'Day Off';
    const leave = absences.some(a => a.staff_id === staffId && a.status === 'approved' && a.start_date <= dateStr && a.end_date >= dateStr);
    if (leave) return 'On Leave';
    return null;
  };
  const seenLeave = new Set();
  rotas.forEach(r => {
    const ls = leaveState(r.staff_id, r.assigned_date);
    if (ls) {
      const key = `${r.staff_id}|${r.assigned_date}`;
      if (seenLeave.has(key)) return;
      seenLeave.add(key);
      const member = staffMap[r.staff_id];
      warnings.push({
        severity: 'warning',
        type: 'leave_conflict',
        title: `${member?.name || 'Staff member'} scheduled during ${ls}`,
        message: `Assigned on ${format(new Date(r.assigned_date + 'T00:00:00'), 'EEE dd MMM')} but marked as ${ls.toLowerCase()}.`,
      });
    }
  });

  return warnings;
}