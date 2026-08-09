import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// AI-powered crew allocation suggestions.
// Analyses a job's requirements (disciplines, required teams, location) against
// available staff (skills, team, current assignments, proximity) and returns
// ranked crew recommendations with reasoning.

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { job_id, assigned_date } = body;
    if (!job_id) return Response.json({ error: 'job_id is required' }, { status: 400 });

    // Fetch the job
    const job = await base44.entities.Job.get(job_id);
    if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });

    // Fetch all active staff and their teams
    const [allStaff, teams, existingAssignments] = await Promise.all([
      base44.entities.Staff.list(),
      base44.entities.Team.list(),
      base44.entities.RotaAssignment.filter({ assigned_date: assigned_date || new Date().toISOString().split('T')[0] }),
    ]);

    const activeStaff = allStaff.filter(s => s.is_active !== false);
    const assignedStaffIds = new Set(existingAssignments.map(a => a.staff_id));

    // Build staff profiles for the LLM
    const staffProfiles = activeStaff.map(s => {
      const team = teams.find(t => t.id === s.team_id);
      const isAssigned = assignedStaffIds.has(s.id);
      return {
        id: s.id,
        name: s.name,
        job_title: s.job_title || '',
        team: team?.name || 'Unassigned',
        team_job_type: team?.job_type || '',
        worker_type: s.worker_type || '',
        is_assigned_today: isAssigned,
      };
    });

    // Build job context
    const jobContext = {
      name: job.name,
      location: job.location || '',
      job_type: job.job_type || job.primary_discipline || '',
      disciplines: (job.disciplines || []).map(d => d.type),
      required_team_ids: job.required_team_ids || [],
      start_date: job.start_date,
      end_date: job.end_date,
    };

    // Build the prompt
    const prompt = `You are a construction site operations manager. Based on the job requirements and available crew, recommend the best 3-5 staff members to assign to this job.

JOB:
${JSON.stringify(jobContext, null, 2)}

AVAILABLE STAFF (excluding those already assigned today):
${JSON.stringify(staffProfiles.filter(s => !s.is_assigned_today), null, 2)}

Rules:
1. Prioritise staff whose team job_type matches the job's discipline/type
2. Consider worker_type (direct_employee preferred over subcontractor for core roles)
3. Prefer staff not already assigned on the target date
4. If the job has required_team_ids, prefer staff in those teams

Return a JSON object with this exact schema:
{
  "recommendations": [
    {
      "staff_id": "the staff id",
      "name": "staff name",
      "match_score": 0-100,
      "reason": "1-2 sentence explanation of why this person is a good fit"
    }
  ],
  "summary": "1-2 sentence overview of the recommended crew composition"
}

Sort recommendations by match_score descending (highest first). Return at most 5 recommendations.`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          recommendations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                staff_id: { type: 'string' },
                name: { type: 'string' },
                match_score: { type: 'number' },
                reason: { type: 'string' },
              },
            },
          },
          summary: { type: 'string' },
        },
      },
    });

    // Validate that recommended staff IDs actually exist
    const validIds = new Set(activeStaff.map(s => s.id));
    if (result && result.recommendations) {
      result.recommendations = result.recommendations.filter(r => validIds.has(r.staff_id));
    }

    return Response.json({ success: true, ...result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}