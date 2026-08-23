// Shared weather client.
// Uses WeatherAPI.com (API-key based) when a key is configured in AppSetting
// 'weather_api_config'. Falls back to Open-Meteo (free, no key) when no key.
//
// WeatherAPI.com is preferred because it identifies traffic by API key rather
// than by source IP — the free Open-Meteo API rate-limits the shared backend
// runtime IP, causing persistent 429s. WeatherAPI.com's free tier allows
// 1M calls/month with no shared-IP throttling.

// WeatherAPI.com condition code → WMO weather code (used by Open-Meteo).
// Only thunderstorm codes (>= 95) matter for the lightning block; the rest
// are best-effort mappings so WEATHER_LABELS display sensibly.
const WEATHERAPI_TO_WMO: Record<number, number> = {
  1000: 0, 1003: 2, 1006: 3, 1009: 3,
  1030: 45, 1135: 45, 1147: 48,
  1063: 61, 1150: 51, 1153: 53, 1180: 80, 1183: 61, 1186: 63, 1189: 65,
  1192: 65, 1195: 65, 1240: 80, 1243: 81, 1246: 82,
  1066: 71, 1210: 71, 1213: 73, 1216: 73, 1219: 75, 1222: 75, 1225: 75,
  1255: 85, 1258: 86, 1114: 73, 1117: 75, 1207: 75,
  1069: 73, 1204: 73, 1249: 85, 1252: 86,
  1072: 51, 1168: 56, 1171: 57, 1198: 66, 1201: 67, 1237: 56,
  1087: 95, 1273: 95, 1276: 95, 1261: 95, 1264: 95,
  1279: 96, 1282: 96,
};

export async function fetchWeatherApi(lat: number, lng: number, apiKey: string): Promise<{ data?: any; error?: string }> {
  const url = `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${lat},${lng}&days=1&aqi=no&alerts=no`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'GC-Mission-Control/1.0 (weather sync)' },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { error: `WeatherAPI HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    const json = await res.json();
    const cur = json.current || {};
    const fday = json.forecast?.forecastday?.[0];
    const day = fday?.day || {};
    const wmoCur = WEATHERAPI_TO_WMO[cur.condition?.code] ?? 0;
    const wmoDay = WEATHERAPI_TO_WMO[day.condition?.code] ?? 0;
    // Normalize to Open-Meteo response shape so downstream consumers
    // (evaluateWeather, sync functions, WEATHER_LABELS) work unchanged.
    return {
      data: {
        current: {
          temperature_2m: cur.temp_c,
          wind_speed_10m: (cur.wind_kph || 0) / 3.6,
          wind_gusts_10m: (cur.gust_kph || 0) / 3.6,
          precipitation: cur.precip_mm || 0,
          weather_code: wmoCur,
        },
        daily: {
          time: [fday?.date || new Date().toISOString().slice(0, 10)],
          weather_code: [wmoDay],
          temperature_2m_max: [day.maxtemp_c],
          temperature_2m_min: [day.mintemp_c],
          precipitation_sum: [day.totalprecip_mm || 0],
          precipitation_probability_max: [day.daily_chance_of_rain || 0],
          wind_speed_10m_max: [(day.maxwind_kph || 0) / 3.6],
          wind_gusts_10m_max: [(day.maxwind_kph || 0) / 3.6],
        },
      },
    };
  } catch (e: any) {
    return { error: e?.message || String(e) };
  }
}

// Open-Meteo fallback (free, no key) — used when no API key is configured.
export async function fetchOpenMeteo(lat: number, lng: number): Promise<{ data?: any; error?: string }> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&current=temperature_2m,weather_code,wind_speed_10m,wind_gusts_10m,precipitation` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max` +
    `&timezone=auto&forecast_days=1`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'GC-Mission-Control/1.0 (weather sync)' },
    });
    if (!res.ok) return { error: `Open-Meteo HTTP ${res.status}` };
    const json = await res.json();
    if (!json?.daily?.time?.length) return { error: 'No daily data from Open-Meteo' };
    return { data: json };
  } catch (e: any) {
    return { error: e?.message || String(e) };
  }
}