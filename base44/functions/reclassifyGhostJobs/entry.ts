import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { categorizeNonJobCell, normalizeName } from '../../shared/spreadsheetParser.ts';

// ---------------------------------------------------------------------------
// Reclassify Ghost Jobs — one-time cleanup that moves non-job entries
// (Holiday, Off, Depot, Yard, etc.) out of the Job entity and into
// RotaAssignments with the correct assignment_type (yard_depot, annual_leave,
// sick, training). The ghost Job records are then deleted.
//
//   dry_run: true  → preview what would be reclassified, no writes
//   dry_run: false → apply the reclassification
// ---------------------------------------------------------------------------

const YARD_DEPOT_EXACT_TEXTS = [
  'yard', 'depot', 'yard/depot', 'yard - depot', 'yard depot',
  'warehouse', 'dartford depot', 'dartford yard', 'yard duty', 'depot duty',
];

function isYardDepotText(text: string): boolean {
  if (!text) return false;
  const lower = normalizeName(text).toLowerCase().trim();
  return YARD_DEPOT_EXACT_TEXTS.includes(lower);
}

function classifyGhostJob(name: string): { isGhost: boolean; type?: string; label?: string } {
  if (!name) return { isGhost: false };
  const lower = normalizeName(name).toLowerCase().trim();

  // Check if it matches a known non-job category (holiday, sick, training, etc.)
  const cat = categorizeNonJobCell(name);
  if (cat) return { isGhost: true, type: cat, label: name };

  // Check if it's a yard/depot text
  if (isYardDepotText(name)) return { isGhost: true, type: 'yard_depot', label: name };

  // Check common non-job single-word patterns
  const ghostWords = ['holiday', 'off', 'annual leave', 'al', 'sick', 'training', 'leave', 'bh', 'bank holiday'];
  if (ghostWords.includes(lower)) return { isGhost: true, type: 'annual_leave', label: name };

  return { isGhost: false };
}

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run !== false;

    // Load all jobs and rota assignments in parallel
    const [allJobs, allRotas] = await Promise.all([
      base44.asServiceRole.entities.Job.list('-created_date', 5000),
      base44.asServiceRole.entities.RotaAssignment.list('-created_date', 5000),
    ]);

    // Identify ghost jobs and determine their non-job type
    const ghostJobMap = new Map<string, { type: string; label: string; name: string }>();
    for (const j of allJobs) {
      const result = classifyGhostJob(j.name);
      if (result.isGhost) {
        ghostJobMap.set(j.id, { type: result.type!, label: result.label!, name: j.name });
      }
    }

    // Find rota assignments linked to ghost jobs
    const rotasOnGhostJobs = allRotas.filter((r: any) => r.job_id && ghostJobMap.has(r.job_id));

    // Build summary
    const rotasByType: Record<string, number> = {};
    for (const r of rotasOnGhostJobs) {
      const info = ghostJobMap.get(r.job_id)!;
      if (!rotasByType[info.type]) rotasByType[info.type] = 0;
      rotasByType[info.type]++;
    }

    const summary = {
      total_jobs: allJobs.length,
      ghost_jobs_found: ghostJobMap.size,
      ghost_job_names: [...ghostJobMap.values()].map((g) => g.name),
      rotas_to_update: rotasOnGhostJobs.length,
      rotas_by_type: rotasByType,
    };

    if (dryRun) {
      return Response.json({ status: 'success', dry_run: true, summary });
    }

    // Update rota assignments: set assignment_type + non_job_label, unset job_id.
    // updateMany with $unset on job_id ensures the rows no longer match the
    // query after the update (job_id is removed), so no infinite re-match.
    let rotasUpdated = 0;
    for (const [jobId, info] of ghostJobMap) {
      const count = rotasOnGhostJobs.filter((r: any) => r.job_id === jobId).length;
      await base44.asServiceRole.entities.RotaAssignment.updateMany(
        { job_id: jobId },
        { $set: { assignment_type: info.type, non_job_label: info.label }, $unset: { job_id: '' } }
      );
      rotasUpdated += count;
    }

    // Delete ghost jobs
    let jobsDeleted = 0;
    for (const j of allJobs) {
      if (ghostJobMap.has(j.id)) {
        await base44.asServiceRole.entities.Job.delete(j.id);
        jobsDeleted++;
      }
    }

    return Response.json({
      status: 'success',
      dry_run: false,
      summary: {
        ...summary,
        rotas_updated: rotasUpdated,
        jobs_deleted: jobsDeleted,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}