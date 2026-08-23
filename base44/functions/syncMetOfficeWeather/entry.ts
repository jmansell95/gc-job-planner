import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { updateAppSettingValue } from '../../shared/appSettings.ts';

// ============================================================
// syncMetOfficeWeather — pulls daily weather forecasts from the
// free Open-Meteo API (no API key required) for ALL active job
// sites across ALL divisions. Stores results as WeatherLog records.
//
// Open-Meteo provides global weather data from multiple NWP models
// (ECMWF, GFS, ICON, etc.) — more accurate than any single source.
// It is free for non-commercial use with no API key and no rate
// limits beyond fair-use (10,000 requests/day).
//
// Admin-only — invoked manually or via a scheduled automation.
// Returns: { ok, message, synced, errors }
// ============================================================

const WEATHER_LABELS: Record<number, string> = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Rime fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 71: 'Light snow', 73: 'Snow',
  75: 'Heavy snow', 80: 'Light showers', 81: 'Showers', 82: 'Heavy showers',
  85: 'Snow showers', 86: 'Heavy snow showers', 95: 'Thunderstorm', 96: 'Thunderstorm + hail',
  99: 'Severe thunderstorm',
};

function assessVerdict(d: any): { level: string; reasons: string[] } {
  const windMs = d.wind_speed_10m_max || 0;
  const windMph = Math.round(windMs * 2.23694);
  const gustMs = d.wind_gusts_10m_max || windMs;
  const gustMph = Math.round(gustMs * 2.23694);
  const code = d.weather_code || 0;
  const rainProb = d.precipitation_probability_max || 0;
  const precip = d.precipitation_sum || 0;
  const tempMin = d.temperature_2m_min ?? 0;

  let level = 'good';
  const reasons: string[] = [];

  if (gustMph >= 45 || windMph >= 38) {
    level = 'stop';
    reasons.push(`Wind ${windMph} mph (gusts ${gustMph})`);
  } else if (gustMph >= 35 || windMph >= 25) {
    level = 'caution';
    reasons.push(`Wind ${windMph} mph (gusts ${gustMph})`);
  }
  if (code >= 95) { level = 'stop'; reasons.push('Thunderstorm'); }
  if (precip >= 10 || rainProb >= 85) {
    if (level !== 'stop') level = 'caution';
    reasons.push(precip >= 10 ? `Heavy rain ${precip.toFixed(0)}mm` : `Rain risk ${rainProb}%`);
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWeather(lat: number, lng: number): Promise<{ data?: any; error?: string }> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max` +
    `&timezone=auto&forecast_days=1`;
  // Retry once on 429 (rate limit) with a backoff — Open-Meteo's free tier
  // throttles burst requests from the backend runtime IP.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429) {
        if (attempt === 0) { await sleep(2500); continue; }
        return { error: 'Open-Meteo rate limit (429) — try again in a minute' };
      }
      if (!res.ok) return { error: `Open-Meteo returned HTTP ${res.status}` };
      const json = await res.json();
      if (!json?.daily?.time?.length) return { error: `No daily.time in response (keys: ${Object.keys(json || {}).join(',')})` };
      return { data: json };
    } catch (e: any) {
      return { error: e?.message || String(e) };
    }
  }
  return { error: 'Open-Meteo rate limit (429) — try again in a minute' };
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    // Fetch ALL active jobs across ALL divisions (asServiceRole bypasses RLS)
    const jobs = await base44.asServiceRole.entities.Job.list('-created_date', 500);
    const activeJobs = jobs.filter((j: any) =>
      (j.status === 'in_progress' || j.status === 'planning') &&
      j.site_lat != null && j.site_lng != null
    );

    if (activeJobs.length === 0) {
      await updateAppSettingValue(base44, 'met_office_config', 'Open-Meteo Weather API Configuration', {
        last_sync_at: new Date().toISOString(),
        last_sync_status: 'ok',
        last_sync_summary: 'No active jobs with site coordinates.',
      });
      return Response.json({ ok: true, message: 'No active jobs with site coordinates.', synced: 0, errors: 0 });
    }

    const today = new Date().toISOString().slice(0, 10);
    let synced = 0;
    let errors = 0;
    let lastError = '';

    for (const job of activeJobs) {
      try {
        // Pace requests so Open-Meteo doesn't rate-limit the backend IP.
        if (synced + errors > 0) await sleep(800);
        const result = await fetchWeather(job.site_lat, job.site_lng);
        if (result.error) { errors++; lastError = `${job.name}: ${result.error}`; continue; }
        const weather = result.data;

        const i = 0;
        const day = {
          weather_code: weather.daily.weather_code[i],
          temperature_2m_max: weather.daily.temperature_2m_max[i],
          temperature_2m_min: weather.daily.temperature_2m_min[i],
          precipitation_sum: weather.daily.precipitation_sum[i],
          precipitation_probability_max: weather.daily.precipitation_probability_max[i],
          wind_speed_10m_max: weather.daily.wind_speed_10m_max[i],
          wind_gusts_10m_max: weather.daily.wind_gusts_10m_max[i],
        };

        const verdict = assessVerdict(day);

        await base44.asServiceRole.entities.WeatherLog.create({
          job_id: job.id,
          job_name: job.name,
          log_date: today,
          site_lat: job.site_lat,
          site_lng: job.site_lng,
          temp_max: Math.round(day.temperature_2m_max),
          temp_min: Math.round(day.temperature_2m_min),
          precipitation_mm: Math.round((day.precipitation_sum || 0) * 10) / 10,
          precipitation_probability: day.precipitation_probability_max || 0,
          wind_speed_max_mph: Math.round((day.wind_speed_10m_max || 0) * 2.23694),
          wind_gusts_max_mph: Math.round((day.wind_gusts_10m_max || 0) * 2.23694),
          weather_code: day.weather_code,
          weather_label: WEATHER_LABELS[day.weather_code] || 'Unknown',
          drilling_verdict: verdict.level,
          verdict_reasons: verdict.reasons.join(', '),
        });
        synced++;
      } catch (e: any) {
        errors++;
        lastError = e?.message || String(e);
      }
    }

    const summary = `Synced weather for ${synced} of ${activeJobs.length} active site(s)${errors > 0 ? ` (${errors} error${errors > 1 ? 's' : ''})` : ''}` + (lastError ? ` — ${lastError}` : '');

    await updateAppSettingValue(base44, 'met_office_config', 'Open-Meteo Weather API Configuration', {
      last_sync_at: new Date().toISOString(),
      last_sync_status: errors === 0 ? 'ok' : 'partial',
      last_sync_summary: summary,
    });

    return Response.json({ ok: true, message: summary, synced, errors, last_error: lastError || null });
  } catch (error: any) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}