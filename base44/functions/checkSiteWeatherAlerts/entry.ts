import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// checkSiteWeatherAlerts — scheduled automation that checks
// weather conditions for all active drilling job sites and
// emails registered crew/admins when stop-work conditions
// are detected. Uses the free Open-Meteo API (no API key).
// ============================================================
// Run daily at 06:00 before crews head to site.
//
// Assessment thresholds (drilling-specific):
//   STOP:  wind gusts ≥ 45 mph, thunderstorm, freezing rain,
//          heavy snow showers
//   CAUTION: wind gusts ≥ 35 mph, heavy rain (≥10mm), snow,
//            frost (min temp < 0°C), rain risk ≥ 85%

interface WeatherResponse {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
    wind_speed_10m?: number;
    wind_gusts_10m?: number;
    precipitation?: number;
  };
  daily?: Array<{
    weather_code?: number;
    temperature_2m_max?: number;
    temperature_2m_min?: number;
    precipitation_sum?: number;
    precipitation_probability_max?: number;
    wind_speed_10m_max?: number;
    wind_gusts_10m_max?: number;
  }>;
}

function assessConditions(w: WeatherResponse): { level: string; reasons: string[] } {
  const current = w.current || {};
  const today = w.daily?.[0] || {};
  const windMs = current.wind_speed_10m || today.wind_speed_10m_max || 0;
  const gustMs = current.wind_gusts_10m || today.wind_gusts_10m_max || windMs;
  const windMph = Math.round(windMs * 2.23694);
  const gustMph = Math.round(gustMs * 2.23694);
  const code = current.weather_code || today.weather_code || 0;
  const rainProb = today.precipitation_probability_max || 0;
  const precip = today.precipitation_sum || 0;
  const tempMin = today.temperature_2m_min ?? 0;

  let level = 'good';
  const reasons: string[] = [];

  if (gustMph >= 45 || windMph >= 38) {
    level = 'stop';
    reasons.push(`Wind ${windMph} mph (gusts ${gustMph})`);
  } else if (gustMph >= 35 || windMph >= 25) {
    if (level !== 'stop') level = 'caution';
    reasons.push(`Wind ${windMph} mph (gusts ${gustMph})`);
  }
  if (code >= 95) { level = 'stop'; reasons.push('Thunderstorm'); }
  if (precip >= 10 || rainProb >= 85) {
    if (level !== 'stop') level = 'caution';
    reasons.push(precip >= 10 ? `Heavy rain ${precip.toFixed(0)}mm` : `Rain risk ${rainProb}%`);
  }
  if (code >= 71 && code <= 77) {
    if (level !== 'stop') level = 'caution';
    reasons.push('Snow');
  }
  if (code >= 85 && code <= 86) { level = 'stop'; reasons.push('Heavy snow'); }
  if (tempMin < 0) {
    if (level !== 'stop') level = 'caution';
    reasons.push(`Frost ${Math.round(tempMin)}°C`);
  }
  if (code === 66 || code === 67 || code === 56 || code === 57) {
    level = 'stop';
    reasons.push('Freezing rain');
  }

  return { level, reasons };
}

async function fetchWeather(lat: number, lng: number): Promise<WeatherResponse | null> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&current=temperature_2m,weather_code,wind_speed_10m,wind_gusts_10m,precipitation` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max` +
    `&timezone=auto&forecast_days=1`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // Fetch all active drilling jobs with site coordinates
    const jobs = await base44.asServiceRole.entities.Job.list('-created_date', 500);
    const activeDrillingJobs = jobs.filter((j: any) =>
      (j.status === 'in_progress' || j.status === 'planning') &&
      j.site_lat != null && j.site_lng != null
    );

    if (activeDrillingJobs.length === 0) {
      return Response.json({ ok: true, message: 'No active jobs with site coordinates — no weather check needed.', alerts: [] });
    }

    // Check weather for each site
    const stopAlerts: any[] = [];
    const cautionAlerts: any[] = [];

    for (const job of activeDrillingJobs) {
      const weather = await fetchWeather(job.site_lat, job.site_lng);
      if (!weather) continue;

      const assessment = assessConditions(weather);
      if (assessment.level === 'stop') {
        stopAlerts.push({ job, weather, assessment });
      } else if (assessment.level === 'caution') {
        cautionAlerts.push({ job, weather, assessment });
      }
    }

    // Build email alert if any stop-work or caution conditions found
    if (stopAlerts.length === 0 && cautionAlerts.length === 0) {
      return Response.json({
        ok: true,
        message: `All clear — ${activeDrillingJobs.length} active site(s) checked, no adverse weather.`,
        alerts: [],
        stop_count: 0,
        caution_count: 0,
      });
    }

    // Fetch admin users to email
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

    // Build email body
    const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    let body = `<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto">`;
    body += `<div style="background:#2E5A1A;color:white;padding:20px;border-radius:12px 12px 0 0">`;
    body += `<h1 style="margin:0;font-size:20px">🌤️ Site Weather Alert — ${today}</h1>`;
    body += `<p style="margin:4px 0 0;opacity:0.9;font-size:14px">Automated drilling conditions check</p>`;
    body += `</div>`;

    if (stopAlerts.length > 0) {
      body += `<div style="background:#fef2f2;border:2px solid #fecaca;padding:16px;margin-top:12px;border-radius:0 0 12px 12px">`;
      body += `<h2 style="color:#991b1b;margin:0 0 8px;font-size:16px">🛑 STOP-WORK CONDITIONS (${stopAlerts.length} site${stopAlerts.length > 1 ? 's' : ''})</h2>`;
      body += `<p style="color:#7f1d1d;font-size:13px;margin:0 0 12px">Do not dispatch drilling crews to these sites today:</p>`;
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
      body += `<h2 style="color:#92400e;margin:0 0 8px;font-size:16px">⚠️ CAUTION CONDITIONS (${cautionAlerts.length} site${cautionAlerts.length > 1 ? 's' : ''})</h2>`;
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

    // Send to each admin (SendEmail reaches registered users only)
    const subject = stopAlerts.length > 0
      ? `🛑 STOP-WORK Weather Alert — ${stopAlerts.length} site${stopAlerts.length > 1 ? 's' : ''} unsafe for drilling`
      : `⚠️ Weather Caution — ${cautionAlerts.length} site${cautionAlerts.length > 1 ? 's' : ''} need crew briefing`;

    let emailed = 0;
    for (const email of adminEmails) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: email,
          subject,
          body,
        });
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