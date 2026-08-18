import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  DIRECT_SCOPED_ENTITIES,
  resolveRecordDivision,
} from '../../shared/divisionScope.ts';

// ---------------------------------------------------------------------------
// backfillDivisionTags — one-time migration that tags records with a blank
// division_id so strict server-side isolation doesn't hide them.
// ---------------------------------------------------------------------------
// Idempotent: only touches records where division_id is blank/null/missing.
// Re-running after a commit is safe (already-tagged records are skipped).
//
// Payload:
//   dry_run      — true (default) = preview only, report counts; false = commit.
//   division_id  — optional fallback division to assign records that can't be
//                  auto-resolved via job_id/staff_id links (e.g. orphan Jobs).
//
// Resolution per entity:
//   RotaAssignment / Timesheet / ShiftSwap / StaffMessage — inherit from the
//     linked Staff member's division_id (staff_id / offering_staff_id / sender_id).
//   Job — inherit via... Jobs have no upstream link, so unresolved Jobs use the
//     fallback division_id. Without a fallback they're reported as unresolved.
//   Staff — unresolved without a fallback (a staff member's division is the
//     source of truth, can't be inherited from elsewhere).
//   Vehicle — skipped. Blank division_id is INTENTIONAL for shared-pool
//     vehicles (available to all divisions), so they are not backfilled.
// ---------------------------------------------------------------------------
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dry_run !== false;
    const fallbackDivisionId = body?.division_id || null;

    // Entities to backfill. Vehicle is excluded (blank = shared pool).
    const entities = [...DIRECT_SCOPED_ENTITIES].filter((e) => e !== 'Vehicle');

    const staffCache = new Map();
    const jobCache = new Map();
    const report = {};
    const updates = []; // { id, entity, division_id }

    for (const entity of entities) {
      const entityClient = base44.asServiceRole.entities[entity];
      if (!entityClient) continue;

      // Fetch records with a blank division_id. We pull a broad set and
      // filter client-side for "blank" because blank can be null, undefined,
      // or empty string depending on how the record was created.
      const all = await entityClient.filter({}, null, 1000);
      const untagged = (all || []).filter(
        (r) => !r.division_id || r.division_id === ''
      );

      let resolved = 0;
      let unresolved = 0;
      const unresolvedSamples = [];

      for (const record of untagged) {
        const divId = await resolveRecordDivision(
          base44,
          entity,
          record,
          staffCache,
          jobCache,
          fallbackDivisionId
        );
        if (divId) {
          resolved++;
          updates.push({ id: record.id, entity, division_id: divId });
        } else {
          unresolved++;
          if (unresolvedSamples.length < 3) {
            unresolvedSamples.push({
              id: record.id,
              name: record.name || record.job_name || record.staff_id || record.id,
            });
          }
        }
      }

      report[entity] = {
        untagged: untagged.length,
        resolved,
        unresolved,
        unresolvedSamples,
      };
    }

    // Commit: apply the resolved division_id to each record. Single-record
    // updates (not bulkUpdate) so per-record side effects fire correctly.
    let committed = 0;
    const commitErrors = [];
    if (!dryRun) {
      for (const u of updates) {
        try {
          await base44.asServiceRole.entities[u.entity].update(u.id, {
            division_id: u.division_id,
          });
          committed++;
        } catch (e) {
          commitErrors.push({ id: u.id, entity: u.entity, error: e.message });
        }
      }
    }

    return Response.json({
      dry_run: dryRun,
      fallback_division_id: fallbackDivisionId,
      report,
      total_untagged: updates.length + Object.values(report).reduce(
        (s, e) => s + (e.unresolved || 0),
        0
      ),
      total_resolvable: updates.length,
      committed: dryRun ? 0 : committed,
      commit_errors: commitErrors,
      message: dryRun
        ? 'Dry-run preview. No records were changed. Re-run with dry_run: false to commit.'
        : `Backfill complete. ${committed} records tagged.`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}