import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

// ---------------------------------------------------------------------------
// Migrate Jobs to Multi-Discipline Schema
// ---------------------------------------------------------------------------
// One-time migration: maps every existing Job's legacy single-type fields
// (job_type, drilling_method, required_team_ids, revenue_method, etc.) into
// the new `disciplines` array. Each job gets one discipline entry based on
// its current job_type/drilling_method, marked as the primary discipline.
//
// Idempotent: if a job already has disciplines populated, it is skipped.
// ---------------------------------------------------------------------------

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const allJobs = await base44.asServiceRole.entities.Job.list('-created_date', 5000);

    const updates = [];
    let migrated = 0;
    let skipped = 0;

    for (const job of allJobs) {
      // Skip if already migrated
      if (job.disciplines && Array.isArray(job.disciplines) && job.disciplines.length > 0) {
        skipped++;
        continue;
      }

      // Determine discipline type from legacy job_type or drilling_method
      let disciplineType = job.job_type || 'groundworks';
      // Normalise: if drilling_method is set and not not_applicable, it's drilling
      if (job.drilling_method && job.drilling_method !== 'not_applicable' && disciplineType !== 'drilling') {
        disciplineType = 'drilling';
      }
      // If job_type contains 'drill' or 'cp' or 'rotary', it's drilling
      const jtLower = String(disciplineType).toLowerCase();
      if (jtLower.includes('drill') || jtLower === 'cp' || jtLower === 'rotary' || jtLower === 'cp_drilling' || jtLower === 'rotary_drilling') {
        disciplineType = 'drilling';
      }
      if (jtLower.includes('ground') || jtLower.includes('enabling') || jtLower.includes('trial')) {
        disciplineType = 'groundworks';
      }

      const discipline = {
        type: disciplineType,
        status: job.status === 'completed' ? 'completed' : (job.status === 'planning' ? 'planning' : 'active'),
        drilling_method: job.drilling_method || 'not_applicable',
        start_date: job.start_date,
        end_date: job.end_date,
        revenue_method: job.revenue_method || 'none',
        unit_price: job.unit_price || undefined,
        meterage_rate: disciplineType === 'drilling' ? job.meterage_rate : undefined,
        meterage_target: disciplineType === 'drilling' ? job.meterage_target : undefined,
        required_team_ids: job.required_team_ids || [],
      };

      updates.push({
        id: job.id,
        disciplines: [discipline],
        primary_discipline: disciplineType,
      });
      migrated++;
    }

    // Apply in batches of 400
    let applied = 0;
    for (let i = 0; i < updates.length; i += 400) {
      const batch = updates.slice(i, i + 400);
      await base44.asServiceRole.entities.Job.bulkUpdate(batch);
      applied += batch.length;
    }

    return Response.json({
      status: 'success',
      total_jobs: allJobs.length,
      migrated,
      skipped_already_migrated: skipped,
      applied,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}