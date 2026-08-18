import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ---------------------------------------------------------------------------
// purgeCompletedJobs — Hard-deletes every Job with status 'completed' and
// ALL related child records, in dependency-safe batches (≤500 per deleteMany).
//
// Admin only. Supports dry_run=true to preview counts without deleting.
// Writes a SystemAuditLog entry on commit.
//
// Payload: { dry_run?: boolean }
// ---------------------------------------------------------------------------

// Child entities that reference jobs via job_id, in deletion order (children
// first, jobs last). Each entry: [EntityName, hasJobIdField]
const CHILD_ENTITIES = [
  'Invoice',
  'JobCostItem',
  'RotaAssignment',
  'Timesheet',
  'InvestigationLog',
  'DeliveryLog',
  'JobAssetAssignment',
  'SubcontractorLog',
  'JobComment',
  'SitePhoto',
  'JobDocument',
  'JobMilestone',
  'HotelBooking',
  'JobDelayLog',
  'JobBillingContract',
  'JobBillOfQuantities',
  'BriefingSignature',
  'AssetReturnLog',
];

const BATCH_SIZE = 500;

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const contentType = req.headers.get('content-type') || '';
    let dryRun = true;
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      dryRun = formData.get('dry_run') !== 'false';
    } else {
      const body = await req.json().catch(() => ({}));
      dryRun = body.dry_run !== false;
    }

    const sr = base44.asServiceRole;

    // 1. Fetch all completed jobs
    const allJobs = await sr.entities.Job.list('-created_date', 5000);
    const completedJobs = allJobs.filter((j: any) => j.status === 'completed');
    const completedJobIds = new Set(completedJobs.map((j: any) => j.id));

    if (completedJobs.length === 0) {
      return Response.json({
        status: 'success',
        dry_run: dryRun,
        summary: { completed_jobs: 0, child_records: {}, total_child_records: 0 },
        message: 'No completed jobs found to purge.',
      });
    }

    // 2. Count related child records for each entity
    const childCounts: Record<string, number> = {};
    const childIds: Record<string, string[]> = {};
    for (const entityName of CHILD_ENTITIES) {
      try {
        const items = await sr.entities[entityName].list('-created_date', 5000);
        const matching = items.filter((r: any) => r.job_id && completedJobIds.has(r.job_id));
        childCounts[entityName] = matching.length;
        childIds[entityName] = matching.map((r: any) => r.id);
      } catch {
        childCounts[entityName] = 0;
        childIds[entityName] = [];
      }
    }

    const totalChildRecords = Object.values(childCounts).reduce((s: number, n: any) => s + (n || 0), 0);

    const summary = {
      completed_jobs: completedJobs.length,
      child_records: childCounts,
      total_child_records: totalChildRecords,
      job_names: completedJobs.map((j: any) => ({ id: j.id, name: j.name, end_date: j.end_date || '' })),
    };

    // Dry run — return preview only
    if (dryRun) {
      return Response.json({
        status: 'success',
        dry_run: true,
        summary,
      });
    }

    // 3. Delete child records in batches (dependency-safe order)
    const deletedCounts: Record<string, number> = {};
    for (const entityName of CHILD_ENTITIES) {
      const ids = childIds[entityName] || [];
      deletedCounts[entityName] = 0;
      if (ids.length === 0) continue;
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batch = ids.slice(i, i + BATCH_SIZE);
        await sr.entities[entityName].deleteMany({ id: { $in: batch } });
        deletedCounts[entityName] += batch.length;
      }
    }

    // 4. Delete the completed jobs themselves in batches
    let jobsDeleted = 0;
    const completedIdArr = [...completedJobIds];
    for (let i = 0; i < completedIdArr.length; i += BATCH_SIZE) {
      const batch = completedIdArr.slice(i, i + BATCH_SIZE);
      await sr.entities.Job.deleteMany({ id: { $in: batch } });
      jobsDeleted += batch.length;
    }

    // 5. Write audit log
    try {
      await sr.entities.SystemAuditLog.create({
        entity_name: 'Job',
        entity_id: 'batch',
        action: 'delete',
        changed_fields: ['status'],
        field_changes: JSON.stringify({ purged: 'completed jobs', count: jobsDeleted }),
        record_summary: `Purged ${jobsDeleted} completed jobs and ${totalChildRecords} related records`,
        actor_user_id: user.id,
        actor_name: user.full_name || user.email || 'Admin',
        source: 'manual',
        integrity_status: 'valid',
      });
    } catch {
      // Audit log write failure is non-fatal
    }

    return Response.json({
      status: 'success',
      dry_run: false,
      summary: {
        ...summary,
        jobs_deleted: jobsDeleted,
        child_records_deleted: deletedCounts,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}