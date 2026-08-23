// Shared weather work-safe threshold logic.
// Used by getJobWeatherStatus (on-demand job detail check) and
// checkSiteWeatherAlerts (scheduled automation) so the "okay to work"
// indicator and the email alerts use identical rules.

import { fetchWeatherApi, fetchOpenMeteo } from './weatherClient.ts';

export const DEFAULT_THRESHOLDS = {
  temp_min: 2,
  temp_max: 30,
  wind_max_mph: 38,
  rain_max_mm: 10,
  lightning_block: true,
};

// Resolve the active thresholds for a job: per-job override ?? global default.
export function resolveThresholds(job: any, defaults: any) {
  return {
    temp_min: job.weather_temp_min != null ? Number(job.weather_temp_min) : defaults.temp_min,
    temp_max: job.weather_temp_max != null ? Number(job.weather_temp_max) : defaults.temp_max,
    wind_max_mph: job.weather_wind_max_mph != null ? Number(job.weather_wind_max_mph) : defaults.wind_max_mph,
    rain_max_mm: job.weather_rain_max_mm != null ? Number(job.weather_rain_max_mm) : defaults.rain_max_mm,
    lightning_block: job.weather_lightning_block != null ? Boolean(job.weather_lightning_block) : defaults.lightning_block,
  };
}

// Evaluate live weather against thresholds. Returns { level, reasons, current, thresholds }.
// level: 'okay' | 'caution' | 'stop'
export function evaluateWeather(weather: any, t: any) {
  const current = weather.current || {};
  const today = (weather.daily && weather.daily[0]) || {};
  const temp = current.temperature_2m ?? today.temperature_2m_max ?? 0;
  const windMs = current.wind_speed_10m ?? today.wind_speed_10m_max ?? 0;
  const gustMs = current.wind_gusts_10m ?? today.wind_gusts_10m_max ?? windMs;
  const windMph = Math.round(windMs * 2.23694);
  const gustMph = Math.round(gustMs * 2.23694);
  const precip = current.precipitation ?? today.precipitation_sum ?? 0;
  const code = current.weather_code ?? today.weather_code ?? 0;

  let level = 'okay';
  const reasons: string[] = [];

  // Temperature
  if (t.temp_max != null && temp > t.temp_max) {
    level = 'stop';
    reasons.push(`Temperature ${Math.round(temp)}°C exceeds the maximum of ${t.temp_max}°C`);
  } else if (t.temp_max != null && temp >= t.temp_max - 2) {
    if (level !== 'stop') level = 'caution';
    reasons.push(`Temperature ${Math.round(temp)}°C is near the maximum of ${t.temp_max}°C`);
  }
  if (t.temp_min != null && temp < t.temp_min) {
    level = 'stop';
    reasons.push(`Temperature ${Math.round(temp)}°C is below the minimum of ${t.temp_min}°C`);
  } else if (t.temp_min != null && temp <= t.temp_min + 2) {
    if (level !== 'stop') level = 'caution';
    reasons.push(`Temperature ${Math.round(temp)}°C is near the minimum of ${t.temp_min}°C`);
  }

  // Wind (gusts for safety)
  if (t.wind_max_mph != null && gustMph > t.wind_max_mph) {
    level = 'stop';
    reasons.push(`Wind gusts ${gustMph} mph exceed the maximum of ${t.wind_max_mph} mph`);
  } else if (t.wind_max_mph != null && gustMph >= t.wind_max_mph * 0.85) {
    if (level !== 'stop') level = 'caution';
    reasons.push(`Wind gusts ${gustMph} mph are near the maximum of ${t.wind_max_mph} mph`);
  }

  // Rain
  if (t.rain_max_mm != null && precip > t.rain_max_mm) {
    level = 'stop';
    reasons.push(`Rainfall ${precip.toFixed(1)} mm exceeds the maximum of ${t.rain_max_mm} mm`);
  }

  // Lightning
  if (t.lightning_block && code >= 95) {
    level = 'stop';
    reasons.push('Thunderstorm detected — lightning risk');
  }

  if (reasons.length === 0) reasons.push('All conditions within safe working thresholds');

  return {
    level,
    reasons,
    current: {
      temp: Math.round(temp),
      wind_mph: windMph,
      gust_mph: gustMph,
      precip: Number(precip.toFixed(1)),
      weather_code: code,
    },
    thresholds: t,
  };
}

// Fetch current + today's weather. Uses WeatherAPI.com when apiKey is provided,
// otherwise falls back to Open-Meteo (free, no key).
export async function fetchSiteWeather(lat: number, lng: number, apiKey?: string): Promise<any | null> {
  const result = apiKey
    ? await fetchWeatherApi(lat, lng, apiKey)
    : await fetchOpenMeteo(lat, lng);
  return result.data || null;
}