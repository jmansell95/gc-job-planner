import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getAppSettingValue } from '../../shared/appSettings.ts';
import { DEFAULT_THRESHOLDS, resolveThresholds, evaluateWeather, fetchSiteWeather } from '../../shared/weatherThresholds.ts';

// ============================================================
// checkSiteWeatherAlerts — scheduled automation that checks
// weather conditions for all active job sites and emails
// admins when stop-work / caution conditions are detected.
// ============================================================
// Uses the configurable weather thresholds (global defaults from
// the 'weather_thresholds' AppSetting, with per-job overrides on
// the Job entity) so the scheduled alerts match the "okay to work"
// indicator shown on the job detail. Shared logic lives in
// weatherThresholds.ts. Run daily at 06:00 before crews head to site.

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    const defaultsRaw = await getAppSettingValue(base44, 'weather_thresholds', DEFAULT_THRESHOLDS);
    const defaults = { ...DEFAULT_THRESHOLDS, ...defaultsRaw };

    const weatherConfig = await getAppSettingValue(base44, 'weather_api_config', {});
    const apiKey = weatherConfig.api_key || undefined;

    const jobs = await base44.asServiceRole.entities.Job.list('-created_date', 500);
    const activeJobs = jobs.filter((j: any) =>
      (j.status === 'in_progress' || j.status === 'planning') &&
      j.site_lat != null && j.site_lng != null
    );

    if (activeJobs.length === 0) {
      return Response.json({ ok: true, message: 'No active jobs with site coordinates — no weather check needed.', alerts: [] });
    }

    const stopAlerts: any[] = [];
    const cautionAlerts: any[] = [];

    for (const job of activeJobs) {
      const weather = await fetchSiteWeather(job.site_lat, job.site_lng, apiKey);
      if (!weather) continue;
      const thresholds = resolveThresholds(job, defaults);
      const assessment = evaluateWeather(weather, thresholds);
      if (assessment.level === 'stop') {
        stopAlerts.push({ job, weather, assessment });
      } else if (assessment.level === 'caution') {
        cautionAlerts.push({ job, weather, assessment });
      }
    }

    if (stopAlerts.length === 0 && cautionAlerts.length === 0) {
      return Response.json({
        ok: true,
        message: `All clear — ${activeJobs.length} active site(s) checked, no adverse weather.`,
        alerts: [],
        stop_count: 0,
        caution_count: 0,
      });
    }

    const users = await base44.asServiceRole.entities.User.list('-created_date', 100);
    const adminEmails = users
      .filter((u: any) => u.role === 'admin' || u.role === 'super_admin')
      .map((u: any) => u.email)
      .filter(Boolean);

    if (adminEmails.length === 0) {
      return Response.json({
        ok: true,
        message: `${stopAlerts.length} stop + ${cautionAlerts.length} caution conditions found but no admin emails registered to alert.`,
        alerts: [...stopAlerts, ...cautionAlerts],
        stop_count: stopAlerts.length,
        caution_count: cautionAlerts.length,
      });
    }

    const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    let body = `<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto">`;
    body += `<div style="background:#2E5A1A;color:white;padding:20px;border-radius:12px 12px 0 0">`;
    body += `<h1 style="margin:0;font-size:20px">🌤️ Site Weather Alert — ${today}</h1>`;
    body += `<p style="margin:4px 0 0;opacity:0.9;font-size:14px">Automated working-conditions check</p>`;
    body += `</div>`;

    if (stopAlerts.length > 0) {
      body += `<div style="background:#fef2f2;border:2px solid #fecaca;padding:16px;margin-top:12px;border-radius:0 0 12px 12px">`;
      body += `<h2 style="color:#991b1b;margin:0 0 8px;font-size:16px">🛑 DO NOT WORK (${stopAlerts.length} site${stopAlerts.length > 1 ? 's' : ''})</h2>`;
      body += `<p style="color:#7f1d1d;font-size:13px;margin:0 0 12px">Conditions breach the safe working thresholds on these sites:</p>`;
      for (const a of stopAlerts) {
        const temp = a.weather.current ? Math.round(a.weather.current.temperature_2m) : '—';
        body += `<div style="background:white;border-radius:8px;padding:12px;margin-bottom:8px;border-left:4px solid #dc2626">`;
        body += `<strong style="color:#1e293b">${a.job.name}</strong>`;
        if (a.job.location) body += `<br><span style="color:#64748b;font-size:12px">📍 ${a.job.location}</span>`;
        body += `<br><span style="color:#dc2626;font-size:13px;font-weight:600">⚠️ ${a.assessment.reasons.join(', ')}</span>`;
        body += `<br><span style="color:#64748b;font-size:12px">🌡️ ${temp}°C</span>`;
        body += `</div>`;
      }
      body += `</div>`;
    }

    if (cautionAlerts.length > 0) {
      body += `<div style="background:#fffbeb;border:2px solid #fde68a;padding:16px;margin-top:12px;border-radius:12px">`;
      body += `<h2 style="color:#92400e;margin:0 0 8px;font-size:16px">⚠️ CAUTION (${cautionAlerts.length} site${cautionAlerts.length > 1 ? 's' : ''})</h2>`;
      body += `<p style="color:#78350f;font-size:13px;margin:0 0 12px">Brief crews on hazards before starting work:</p>`;
      for (const a of cautionAlerts) {
        const temp = a.weather.current ? Math.round(a.weather.current.temperature_2m) : '—';
        body += `<div style="background:white;border-radius:8px;padding:12px;margin-bottom:8px;border-left:4px solid #f59e0b">`;
        body += `<strong style="color:#1e293b">${a.job.name}</strong>`;
        if (a.job.location) body += `<br><span style="color:#64748b;font-size:12px">📍 ${a.job.location}</span>`;
        body += `<br><span style="color:#d97706;font-size:13px;font-weight:600">⚠️ ${a.assessment.reasons.join(', ')}</span>`;
        body += `<br><span style="color:#64748b;font-size:12px">🌡️ ${temp}°C</span>`;
        body += `</div>`;
      }
      body += `</div>`;
    }

    body += `<div style="text-align:center;padding:16px;color:#94a3b8;font-size:11px">`;
    body += `GC Mission Control · Automated weather check · ${new Date().toLocaleString('en-GB')}`;
    body += `</div></div>`;

    const subject = stopAlerts.length > 0
      ? `🛑 DO NOT WORK — ${stopAlerts.length} site${stopAlerts.length > 1 ? 's' : ''} breach weather thresholds`
      : `⚠️ Weather Caution — ${cautionAlerts.length} site${cautionAlerts.length > 1 ? 's' : ''} need crew briefing`;

    let emailed = 0;
    for (const email of adminEmails) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({ to: email, subject, body });
        emailed++;
      } catch (_) { /* skip individual failures */ }
    }

    return Response.json({
      ok: true,
      message: `${stopAlerts.length} stop-work + ${cautionAlerts.length} caution conditions found. ${emailed} admin(s) emailed.`,
      alerts: [...stopAlerts, ...cautionAlerts],
      stop_count: stopAlerts.length,
      caution_count: cautionAlerts.length,
      emailed,
    });
  } catch (error: any) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}