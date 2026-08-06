import {
  Cloud, CloudRain, CloudSnow, Sun, CloudSun, CloudFog, CloudLightning,
  ShieldCheck, ShieldAlert, ShieldX,
} from 'lucide-react';

export const WEATHER_CODE_MAP = {
  0: { label: 'Clear', icon: Sun, color: 'text-amber-500' },
  1: { label: 'Mainly clear', icon: Sun, color: 'text-amber-500' },
  2: { label: 'Partly cloudy', icon: CloudSun, color: 'text-slate-500' },
  3: { label: 'Overcast', icon: Cloud, color: 'text-slate-500' },
  45: { label: 'Fog', icon: CloudFog, color: 'text-slate-400' },
  48: { label: 'Rime fog', icon: CloudFog, color: 'text-slate-400' },
  51: { label: 'Light drizzle', icon: CloudRain, color: 'text-blue-500' },
  53: { label: 'Drizzle', icon: CloudRain, color: 'text-blue-500' },
  55: { label: 'Heavy drizzle', icon: CloudRain, color: 'text-blue-600' },
  56: { label: 'Freezing drizzle', icon: CloudRain, color: 'text-blue-500' },
  57: { label: 'Freezing drizzle', icon: CloudRain, color: 'text-blue-600' },
  61: { label: 'Light rain', icon: CloudRain, color: 'text-blue-500' },
  63: { label: 'Rain', icon: CloudRain, color: 'text-blue-600' },
  65: { label: 'Heavy rain', icon: CloudRain, color: 'text-blue-700' },
  66: { label: 'Freezing rain', icon: CloudRain, color: 'text-blue-500' },
  67: { label: 'Freezing rain', icon: CloudRain, color: 'text-blue-600' },
  71: { label: 'Light snow', icon: CloudSnow, color: 'text-slate-400' },
  73: { label: 'Snow', icon: CloudSnow, color: 'text-slate-500' },
  75: { label: 'Heavy snow', icon: CloudSnow, color: 'text-slate-600' },
  77: { label: 'Snow grains', icon: CloudSnow, color: 'text-slate-400' },
  80: { label: 'Light showers', icon: CloudRain, color: 'text-blue-500' },
  81: { label: 'Showers', icon: CloudRain, color: 'text-blue-600' },
  82: { label: 'Heavy showers', icon: CloudRain, color: 'text-blue-700' },
  85: { label: 'Snow showers', icon: CloudSnow, color: 'text-slate-500' },
  86: { label: 'Heavy snow showers', icon: CloudSnow, color: 'text-slate-600' },
  95: { label: 'Thunderstorm', icon: CloudLightning, color: 'text-purple-600' },
  96: { label: 'Thunderstorm + hail', icon: CloudLightning, color: 'text-purple-700' },
  99: { label: 'Severe thunderstorm', icon: CloudLightning, color: 'text-purple-700' },
};

export const LEVEL_STYLES = {
  good: { border: 'border-emerald-200', bg: 'bg-emerald-50', dot: 'bg-emerald-500', text: 'text-emerald-600', icon: ShieldCheck, label: 'Good' },
  caution: { border: 'border-amber-200', bg: 'bg-amber-50', dot: 'bg-amber-500', text: 'text-amber-600', icon: ShieldAlert, label: 'Caution' },
  stop: { border: 'border-rose-200', bg: 'bg-rose-50', dot: 'bg-rose-500', text: 'text-rose-600', icon: ShieldX, label: 'Stop' },
};

export function assessConditions(current, today) {
  const windMs = current?.wind_speed_10m || 0;
  const windMph = Math.round(windMs * 2.23694);
  const gustMs = current?.wind_gusts_10m || windMs;
  const gustMph = Math.round(gustMs * 2.23694);
  const code = current?.weather_code || 0;
  const rainProb = today?.precipitation_probability_max || 0;
  const precip = today?.precipitation_sum || 0;
  const tempMin = today?.temperature_2m_min || 0;

  let level = 'good';
  const reasons = [];

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
    reasons.push(`Frost ${Math.round(tempMin)}°`);
  }
  if (code === 66 || code === 67 || code === 56 || code === 57) { level = 'stop'; reasons.push('Freezing rain'); }

  return { level, reasons, windMph, gustMph };
}

export async function fetchWeather(lat, lng) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,precipitation` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max` +
    `&timezone=auto&forecast_days=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Weather fetch failed');
  return res.json();
}