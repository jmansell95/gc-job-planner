// ---------------------------------------------------------------------------
// Division Scope — shared server-side division isolation logic
// ---------------------------------------------------------------------------
// Used by getDivisionScopedData (the scoped read layer) and backfillDivisionTags
// (the one-time migration). Centralises the entity classification so isolation
// rules are defined in exactly one place.
//
// Three entity classes:
//   DIRECT  — carries a top-level division_id; scoped by { division_id }.
//   JOB     — no division_id, but belongs to a division through its parent Job;
//             scoped by { job_id: { $in: divisionJobIds } }.
//   GLOBAL  — shared resources (clients, contractors, rate cards, assets);
//             not division-partitioned, returned unfiltered.
// ---------------------------------------------------------------------------

// Entities that carry a top-level division_id and can be scoped directly.
export const DIRECT_SCOPED_ENTITIES = new Set([
  'Job',
  'Staff',
  'Vehicle',
  'RotaAssignment',
  'Timesheet',
  'ShiftSwap',
  'StaffMessage',
  // — Full isolation: formerly-shared operational resources, now per-division —
  'Client',
  'Contractor',
  'Supplier',
  'SiteAsset',
  'RateCardItem',
  'Team',
  'ComplianceItem',
  'BillingRule',
  'Project',
]);

// Entities scoped via a job_id join. No division_id field, but they belong to
// a division through their parent Job. The scoped layer fetches the division's
// Job IDs first, then filters these by job_id IN [...].
export const JOB_SCOPED_ENTITIES = new Set([
  'Invoice',
  'JobCostItem',
  'JobAssetAssignment',
  'SitePhoto',
  'JobComment',
  'JobMilestone',
  'JobDocument',
  'InvestigationLog',
  'Sample',
  'MonitoringWell',
  'LabTestResult',
  'JobDelayLog',
  'SubcontractorLog',
  'DailyCost',
  'EquipmentCalibration',
  'DeliveryLog',
  'DeliveryLeg',
]);

// Global/shared entities — not division-partitioned. Returned unfiltered so
// they remain available in every division (e.g. a Client is shared across
// divisions that both work for that client).
// Enterprise-wide admin config — NOT division-partitioned. These define
// platform-level configuration (roles, integration keys, help content, type
// definitions) and are shared across every division by design.
export const GLOBAL_ENTITIES = new Set([
  'TrainingRequirement',
  'JobType',
  'Division',
  'PermissionGroup',
  'AppSetting',
  'HelpTopic',
]);

export function isScopedEntity(entity) {
  return DIRECT_SCOPED_ENTITIES.has(entity) || JOB_SCOPED_ENTITIES.has(entity);
}

// Fetch the IDs of all Jobs in a division (for job-join scoping).
// A per-request cache avoids re-querying the same division's jobs when
// multiple job-scoped entities are fetched in one call.
export async function getDivisionJobIds(base44, divisionId, cache) {
  if (cache && cache.has(divisionId)) return cache.get(divisionId);
  const jobs = await base44.asServiceRole.entities.Job.filter(
    { division_id: divisionId },
    null,
    1000
  );
  const ids = (jobs || []).map((j) => j.id);
  if (cache) cache.set(divisionId, ids);
  return ids;
}

// Build the scoped filter for an entity given the active division.
// Returns the Mongo filter to pass to asServiceRole.entities.X.filter().
// For GLOBAL entities, returns the base filter unchanged (no scoping).
// For DIRECT entities, merges { division_id } into the base filter.
// For JOB entities, merges { job_id: { $in: divisionJobIds } }.
export async function buildScopedFilter(
  base44,
  entity,
  divisionId,
  baseFilter,
  jobCache
) {
  const filter = baseFilter || {};

  if (GLOBAL_ENTITIES.has(entity)) {
    return filter;
  }

  if (DIRECT_SCOPED_ENTITIES.has(entity)) {
    return { ...filter, division_id: divisionId };
  }

  if (JOB_SCOPED_ENTITIES.has(entity)) {
    const jobIds = await getDivisionJobIds(base44, divisionId, jobCache);
    // $in: [] matches nothing — correct when the division has no jobs yet.
    return { ...filter, job_id: { $in: jobIds } };
  }

  // Unknown entity — return unfiltered (defence-in-depth: RLS still applies).
  return filter;
}

// Resolve the correct division_id for a record during backfill.
// Resolution order:
//   1. job_id  → inherit from the linked Job's division_id
//   2. staff_id → inherit from the linked Staff member's division_id
//   3. offering_staff_id / sender_id → inherit from that Staff member
//   4. fallbackDivisionId (admin-provided) for records with no link
// Returns null when no resolution is possible.
export async function resolveRecordDivision(
  base44,
  entity,
  record,
  staffCache,
  jobCache,
  fallbackDivisionId
) {
  // Already tagged — keep it.
  if (record.division_id) return record.division_id;

  // 1. job_id link
  if (record.job_id) {
    let job = jobCache.get(record.job_id);
    if (!job) {
      try {
        job = await base44.asServiceRole.entities.Job.get(record.job_id);
      } catch {
        job = null;
      }
      if (job) jobCache.set(record.job_id, job);
    }
    if (job && job.division_id) return job.division_id;
  }

  // 2. staff_id / offering_staff_id / sender_id link
  const staffId =
    record.staff_id || record.offering_staff_id || record.sender_id;
  if (staffId) {
    let staff = staffCache.get(staffId);
    if (!staff) {
      try {
        staff = await base44.asServiceRole.entities.Staff.get(staffId);
      } catch {
        staff = null;
      }
      if (staff) staffCache.set(staffId, staff);
    }
    if (staff && staff.division_id) return staff.division_id;
  }

  // 3. admin-provided fallback
  if (fallbackDivisionId) return fallbackDivisionId;

  return null;
}