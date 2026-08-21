import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

// ---------------------------------------------------------------------------
// Migrate Jobs to Simplified Multi-Discipline Schema
// ---------------------------------------------------------------------------
// Maps every existing Job's legacy single-type fields and disciplines into
// the simplified 3-discipline model: drilling, groundworks, depot.
//
// Mapping rules:
//   - coring, trial_pit, cp_drilling, rotary_drilling → drilling
//   - enabling, enabling_works, supervisor → groundworks
//   - depot stays as depot
//   - groundworks stays as groundworks
//
// Idempotent: if a job already has disciplines in the new model (only
// drilling/groundworks/depot types), it is skipped.
// ---------------------------------------------------------------------------

const LEGACY_MAP = {
  enabling: 'groundworks',
  enabling_works: 'groundworks',
  supervisor: 'groundworks',
  coring: 'drilling',
  trial_pit: 'drilling',
  cp_drilling: 'drilling',
  rotary_drilling: 'drilling',
};

function mapDisciplineType(type) {
  return LEGACY_MAP[type] || type;
}

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
      // Check if already in the new model (all discipline types are valid new types)
      if (job.disciplines && Array.isArray(job.disciplines) && job.disciplines.length > 0) {
        const needsMigration = job.disciplines.some(d => LEGACY_MAP[d.type]);
        if (!needsMigration) {
          skipped++;
          continue;
        }
        // Migrate legacy discipline types to new model
        const newDisciplines = job.disciplines.map(d => ({
          ...d,
          type: mapDisciplineType(d.type),
        }));
        // Deduplicate if migration collapsed two legacy types into the same new type
        const seen = new Set();
        const deduped = [];
        for (const d of newDisciplines) {
          if (!seen.has(d.type)) {
            seen.add(d.type);
            deduped.push(d);
          }
        }
        updates.push({
          id: job.id,
          disciplines: deduped,
          primary_discipline: mapDisciplineType(job.primary_discipline || deduped[0]?.type),
        });
        migrated++;
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
      if (jtLower.includes('drill') || jtLower === 'cp' || jtLower === 'rotary') {
        disciplineType = 'drilling';
      }
      if (jtLower.includes('ground') || jtLower.includes('enabling') || jtLower.includes('trial') || jtLower.includes('coring')) {
        disciplineType = 'groundworks';
      }
      // Map any legacy type to the new model
      disciplineType = mapDisciplineType(disciplineType);

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