import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// logDailyWeather — scheduled automation that snapshots today's
// weather forecast for every active job site and stores it as a
// WeatherLog record. Also checks flood risk via the EA API.
// Run daily (e.g. 06:00) before crews head to site.
// ============================================================

interface WeatherResponse {
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_sum?: number[];
    precipitation_probability_max?: number[];
    wind_speed_10m_max?: number[];
    wind_gusts_10m_max?: number[];
  };
}

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

async function fetchWeather(lat: number, lng: number): Promise<{ data?: WeatherResponse; error?: string }> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max` +
    `&timezone=auto&forecast_days=1`;
  // Retry once on 429 (rate limit) with a backoff — Open-Meteo's free tier
  // throttles burst requests from the backend runtime IP.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'GC-Mission-Control/1.0 (weather sync; contact@groundcontrol.co.uk)' },
      });
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

async function checkFlood(lat: number, lng: number): Promise<{ level: string; count: number }> {
  try {
    const eaRes = await fetch('https://environment.data.gov.uk/flood-monitoring/id/floods', {
      headers: { 'Accept': 'application/json' },
    }).catch(() => null);
    if (!eaRes || !eaRes.ok) return { level: 'none', count: 0 };
    const eaJson = await eaRes.json().catch(() => null);
    const floods: any[] = Array.isArray(eaJson?.items) ? eaJson.items : [];

    const R = 6371;
    let count = 0;
    let maxRank = 0;
    let maxLevel = 'none';
    const rankMap: Record<string, number> = {
      'Severe flood warning': 4, 'Flood warning': 3, 'Flood alert': 2,
    };
    const labelMap: Record<string, string> = {
      'Severe flood warning': 'severe', 'Flood warning': 'high', 'Flood alert': 'moderate',
    };

    for (const f of floods) {
      const area = f.floodArea || {};
      const fLat = area.lat ? Number(area.lat) : null;
      const fLng = area.long ? Number(area.long) : null;
      if (fLat == null || fLng == null) continue;
      const dLat = (fLat - lat) * Math.PI / 180;
      const dLng = (fLng - lng) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat * Math.PI / 180) * Math.cos(fLat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
      const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      if (dist <= 5) {
        count++;
        const sev = f.severityLevel || '';
        const rank = rankMap[sev] || 0;
        if (rank > maxRank) { maxRank = rank; maxLevel = labelMap[sev] || 'low'; }
      }
    }
    return { level: maxLevel, count };
  } catch {
    return { level: 'none', count: 0 };
  }
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    const jobs = await base44.asServiceRole.entities.Job.list('-created_date', 500);
    const activeJobs = jobs.filter((j: any) =>
      (j.status === 'in_progress' || j.status === 'planning') &&
      j.site_lat != null && j.site_lng != null
    );

    if (activeJobs.length === 0) {
      return Response.json({ ok: true, message: 'No active jobs with site coordinates.', logged: 0 });
    }

    const today = new Date().toISOString().slice(0, 10);
    let logged = 0;
    let errors = 0;
    let lastError = '';

    for (const job of activeJobs) {
      try {
        // Pace requests so Open-Meteo doesn't rate-limit the backend IP.
        if (logged + errors > 0) await sleep(800);
        const result = await fetchWeather(job.site_lat, job.site_lng);
        if (result.error) { errors++; lastError = `${job.name}: ${result.error}`; continue; }
        const weather = result.data!;

        const i = 0;
        const day = {
          weather_code: weather.daily!.weather_code![i],
          temperature_2m_max: weather.daily!.temperature_2m_max![i],
          temperature_2m_min: weather.daily!.temperature_2m_min![i],
          precipitation_sum: weather.daily!.precipitation_sum![i],
          precipitation_probability_max: weather.daily!.precipitation_probability_max![i],
          wind_speed_10m_max: weather.daily!.wind_speed_10m_max![i],
          wind_gusts_10m_max: weather.daily!.wind_gusts_10m_max![i],
        };

        const verdict = assessVerdict(day);
        const flood = await checkFlood(job.site_lat, job.site_lng);

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
          flood_risk_level: flood.level,
          flood_warning_count: flood.count,
        });
        logged++;
      } catch (e: any) {
        errors++;
        lastError = e?.message || String(e);
      }
    }

    return Response.json({
      ok: true,
      message: `Weather logged for ${logged} of ${activeJobs.length} active job(s). ${errors} error(s)` + (lastError ? ` — ${lastError}` : ''),
      logged,
      errors,
      total_jobs: activeJobs.length,
      last_error: lastError || null,
    });
  } catch (error: any) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}