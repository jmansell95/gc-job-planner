import { complianceDaysUntil } from '@/utils/complianceDate';
import { ALL_QUALIFICATIONS } from '@/components/compliance/TrainingGapAnalysis';

export const QUAL_LABELS = Object.fromEntries(ALL_QUALIFICATIONS.map(q => [q.value, q.label]));
export const CRITICAL_QUALS = new Set(ALL_QUALIFICATIONS.filter(q => q.critical).map(q => q.value));

// Extra site-safety quals stored as 'other' in the ComplianceItem enum — matched by title.
const EXTRA_QUALS = new Set(['sts_triple', 'confined_space', 'asbestos_awareness', 'manual_handling', 'working_at_height']);

/**
 * Status of a single required qualification for a staff member.
 * Returns: 'ok' | 'missing' | 'expired' | 'expiring' | 'not_required'
 */
export function getQualStatus(qualType, complianceItems) {
  const matches = complianceItems.filter((c) => {
    if (c.qualification_type === qualType) return true;
    if (EXTRA_QUALS.has(qualType)) {
      return c.qualification_type === 'other' && c.title && c.title.toLowerCase().includes(qualType.replace(/_/g, ' '));
    }
    return false;
  });
  if (matches.length === 0) return 'missing';
  const sorted = matches.sort((a, b) => (b.expiry_date || '').localeCompare(a.expiry_date || ''));
  const item = sorted[0];
  if (item.status_override === 'missing') return 'missing';
  if (item.status_override === 'not_required') return 'not_required';
  if (!item.expiry_date) return 'ok';
  const days = complianceDaysUntil(item.expiry_date);
  if (days === null) return 'ok';
  if (days < 0) return 'expired';
  if (days <= 30) return 'expiring';
  return 'ok';
}

/**
 * Evaluate whether a staff member can be assigned to a job based on the
 * required qualifications of the job's teams.
 *
 * @param {object} params - { staff, job, teams, complianceItems }
 * @returns {{ blocked: Array, expiring: Array, requiredQuals: Array, missing: Array, expired: Array }}
 *   blocked = qualifications that HARD-BLOCK assignment (missing or expired)
 *   expiring = qualifications expiring within 30 days (warning only)
 */
export function evaluateAssignmentCompliance({ staff, job, teams, complianceItems }) {
  if (!staff || !job || !teams) {
    return { blocked: [], expiring: [], requiredQuals: [], missing: [], expired: [] };
  }
  // Gather required qualifications from the job's required teams.
  const teamIds = new Set(
    (job.required_team_ids || []).filter(Boolean)
  );
  const requiredQuals = [];
  const seen = new Set();
  teams.forEach((t) => {
    if (teamIds.has(t.id) && Array.isArray(t.required_qualifications)) {
      t.required_qualifications.forEach((q) => {
        if (!seen.has(q)) { seen.add(q); requiredQuals.push(q); }
      });
    }
  });
  if (requiredQuals.length === 0) {
    return { blocked: [], expiring: [], requiredQuals: [], missing: [], expired: [] };
  }
  const myItems = complianceItems.filter(
    (c) => c.category === 'staff' && (c.reference_id === staff.id || c.reference_name === staff.name)
  );
  const missing = [];
  const expired = [];
  const expiring = [];
  requiredQuals.forEach((q) => {
    const status = getQualStatus(q, myItems);
    if (status === 'missing') missing.push(q);
    else if (status === 'expired') expired.push(q);
    else if (status === 'expiring') expiring.push(q);
  });
  return {
    requiredQuals,
    missing,
    expired,
    expiring,
    blocked: [...missing, ...expired],
  };
}

export function qualLabel(q) {
  return QUAL_LABELS[q] || (q || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}