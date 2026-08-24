import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * splitMultiSiteJobs — one-off migration that splits multi-site jobs into
 * standalone projects. For each Job with a non-empty `sites` array, the
 * primary site stays on the original job and every additional site becomes
 * a new standalone Job with its own PRJ- reference. The original job's
 * `sites` array is cleared afterwards. Idempotent: jobs with an empty sites
 * array are skipped.
 *
 * Pass { dry_run: true } to preview the split plan without creating anything.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;

    const admin = base44.asServiceRole;
    const jobs = await admin.entities.Job.list('-created_date', 1000);
    const multiSiteJobs = jobs.filter((j) => Array.isArray(j.sites) && j.sites.length > 0);

    if (dryRun) {
      return Response.json({
        ok: true,
        dry_run: true,
        multi_site_count: multiSiteJobs.length,
        split_plan: multiSiteJobs.map((j) => ({
          job_id: j.id,
          job_name: j.name,
          job_reference: j.job_reference,
          additional_sites: j.sites.length,
          sites: j.sites.map((s) => s.name || s.location || 'Unnamed'),
        })),
      });
    }

    const results = [];
    for (const job of multiSiteJobs) {
      const sites = job.sites;
      const splits = [];
      for (let i = 0; i < sites.length; i++) {
        const site = sites[i];
        const newRef = job.job_reference
          ? `PRJ-${job.job_reference}-S${i + 1}`
          : `PRJ-SITE-${i + 1}`;
        const newJob = {
          name: site.name ? `${job.name} — ${site.name}` : `${job.name} (Site ${i + 1})`,
          division_id: job.division_id,
          job_reference: newRef,
          location: site.location || job.location,
          site_lat: site.lat ?? job.site_lat,
          site_lng: site.lng ?? job.site_lng,
          what3words: site.what3words || job.what3words,
          geofence_radius_override: site.geofence_radius_override ?? job.geofence_radius_override,
          status: 'planning',
          start_date: site.start_date || job.start_date,
          end_date: site.end_date || job.end_date,
          client_id: job.client_id,
          contractor_id: job.contractor_id,
          project_manager: job.project_manager,
          notes: job.notes,
          budget_amount: job.budget_amount,
          revenue_method: job.revenue_method,
          drilling_method: job.drilling_method,
          meterage_rate: job.meterage_rate,
          meterage_target: job.meterage_target,
          unit_price: job.unit_price,
          markup_percentage: job.markup_percentage,
          vat_rate: job.vat_rate,
          job_type: job.job_type,
          disciplines: job.disciplines,
          primary_discipline: job.primary_discipline,
          required_team_ids: job.required_team_ids,
        };
        try {
          const created = await admin.entities.Job.create(newJob);
          splits.push({ site_name: site.name || `Site ${i + 1}`, new_job_id: created.id, new_reference: newRef });
        } catch (e) {
          splits.push({ site_name: site.name || `Site ${i + 1}`, error: e.message });
        }
      }
      try {
        await admin.entities.Job.update(job.id, { sites: [] });
      } catch (_) { /* non-fatal */ }
      results.push({
        job_id: job.id,
        job_name: job.name,
        sites_split: splits.length,
        splits,
      });
    }

    return Response.json({
      ok: true,
      jobs_processed: multiSiteJobs.length,
      total_sites_split: results.reduce((s, r) => s + r.sites_split, 0),
      results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}