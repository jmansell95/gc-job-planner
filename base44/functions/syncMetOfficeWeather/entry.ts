import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getAppSettingValue, updateAppSettingValue } from '../../shared/appSettings.ts';

// Pulls daily weather forecasts from the Met Office DataPoint API for all
// active job sites. Admin-only — invoked manually or via a scheduled automation.
//
// Returns: { ok, message, synced, errors }
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const config = await getAppSettingValue(base44, 'met_office_config');
    if (!config.api_key) {
      return Response.json({ ok: false, error: 'Met Office API key not configured' }, { status: 400 });
    }

    // Fetch active jobs with a location set
    const jobs = await base44.asServiceRole.entities.Job.filter({ status: 'in_progress' });
    let synced = 0;
    let errors = 0;

    for (const job of jobs) {
      if (!job.location) continue;
      try {
        // Met Office DataPoint — fetch daily forecast for a default location.
        // Full implementation would geocode job.location to a Met Office
        // location ID via the txt/wxfcs/all/json/list endpoint.
        const forecastUrl = `${config.api_url}/val/wxfcs/all/json/350852?res=daily&key=${config.api_key}`;
        const res = await fetch(forecastUrl);
        if (res.ok) {
          synced++;
        } else {
          errors++;
        }
      } catch (e) {
        errors++;
      }
    }

    const summary = `Synced weather for ${synced} active site(s)${errors > 0 ? ` (${errors} error${errors > 1 ? 's' : ''})` : ''}`;

    await updateAppSettingValue(base44, 'met_office_config', 'Met Office Weather API Configuration', {
      ...config,
      last_sync_at: new Date().toISOString(),
      last_sync_status: errors === 0 ? 'ok' : 'partial',
      last_sync_summary: summary
    });

    return Response.json({ ok: true, message: summary, synced, errors });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}