import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    const jobs = await base44.asServiceRole.entities.Job.list();
    const teams = await base44.asServiceRole.entities.Team.list();

    const results = [];
    let migrated = 0;
    let skipped = 0;

    for (const job of jobs) {
      // Already migrated — skip
      if (Array.isArray(job.required_team_ids) && job.required_team_ids.length > 0) {
        results.push({ id: job.id, name: job.name, skipped: true, reason: 'already has required_team_ids' });
        skipped++;
        continue;
      }

      if (!job.job_type) {
        results.push({ id: job.id, name: job.name, skipped: true, reason: 'no legacy job_type' });
        skipped++;
        continue;
      }

      // Automatic mapping: find teams whose job_type matches the job's legacy type
      const matchingTeams = teams.filter(t => t.job_type === job.job_type);
      if (matchingTeams.length === 0) {
        results.push({ id: job.id, name: job.name, skipped: true, reason: 'no team with matching job_type', job_type: job.job_type });
        skipped++;
        continue;
      }

      const teamIds = matchingTeams.map(t => t.id);
      await base44.asServiceRole.entities.Job.update(job.id, { required_team_ids: teamIds });
      results.push({ id: job.id, name: job.name, migrated: true, job_type: job.job_type, team_ids: teamIds, team_names: matchingTeams.map(t => t.name) });
      migrated++;
    }

    return Response.json({
      total_jobs: jobs.length,
      migrated,
      skipped,
      total_teams: teams.length,
      results
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});