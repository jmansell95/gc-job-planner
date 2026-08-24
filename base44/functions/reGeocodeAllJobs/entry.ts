import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { geocodeAddress } from '../../shared/ukGeocoder.ts';

/**
 * reGeocodeAllJobs — admin-only one-time fix.
 * Re-runs accurate postcode geocoding for every job that has a location,
 * updating site_lat/site_lng where the new coordinates differ from the
 * stored ones. Corrects jobs that share duplicate/imprecise AI-geocoded coords.
 *
 * Returns: { total, updated, skipped, failed }
 */
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const jobs = await base44.asServiceRole.entities.Job.list('-created_date', 1000);

    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (const job of jobs) {
      const loc = (job.location || '').trim();
      if (!loc) { skipped++; continue; }

      const result = await geocodeAddress(loc);
      if (!result) { failed++; continue; }

      const sameLat = Math.abs((job.site_lat || 0) - result.lat) < 0.0001;
      const sameLng = Math.abs((job.site_lng || 0) - result.lng) < 0.0001;
      if (sameLat && sameLng) { skipped++; continue; }

      await base44.asServiceRole.entities.Job.update(job.id, {
        site_lat: Math.round(result.lat * 1e6) / 1e6,
        site_lng: Math.round(result.lng * 1e6) / 1e6,
      });
      updated++;
    }

    return Response.json({ total: jobs.length, updated, skipped, failed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}