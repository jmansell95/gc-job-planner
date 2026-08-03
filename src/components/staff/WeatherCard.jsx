import React, { useState, useEffect } from 'react';
import { Cloud, CloudRain, CloudSnow, Sun, CloudSun, CloudFog, CloudLightning, Wind, Droplets, Thermometer, MapPin } from 'lucide-react';

const WEATHER_CODE_MAP = {
  0: { label: 'Clear sky', icon: Sun, color: 'text-amber-500', bg: 'bg-amber-50' },
  1: { label: 'Mainly clear', icon: Sun, color: 'text-amber-500', bg: 'bg-amber-50' },
  2: { label: 'Partly cloudy', icon: CloudSun, color: 'text-slate-500', bg: 'bg-slate-50' },
  3: { label: 'Overcast', icon: Cloud, color: 'text-slate-500', bg: 'bg-slate-50' },
  45: { label: 'Fog', icon: CloudFog, color: 'text-slate-400', bg: 'bg-slate-50' },
  48: { label: 'Rime fog', icon: CloudFog, color: 'text-slate-400', bg: 'bg-slate-50' },
  51: { label: 'Light drizzle', icon: CloudRain, color: 'text-blue-500', bg: 'bg-blue-50' },
  53: { label: 'Drizzle', icon: CloudRain, color: 'text-blue-500', bg: 'bg-blue-50' },
  55: { label: 'Heavy drizzle', icon: CloudRain, color: 'text-blue-600', bg: 'bg-blue-50' },
  56: { label: 'Freezing drizzle', icon: CloudRain, color: 'text-blue-500', bg: 'bg-blue-50' },
  57: { label: 'Freezing drizzle', icon: CloudRain, color: 'text-blue-600', bg: 'bg-blue-50' },
  61: { label: 'Light rain', icon: CloudRain, color: 'text-blue-500', bg: 'bg-blue-50' },
  63: { label: 'Rain', icon: CloudRain, color: 'text-blue-600', bg: 'bg-blue-50' },
  65: { label: 'Heavy rain', icon: CloudRain, color: 'text-blue-700', bg: 'bg-blue-100' },
  66: { label: 'Freezing rain', icon: CloudRain, color: 'text-blue-500', bg: 'bg-blue-50' },
  67: { label: 'Freezing rain', icon: CloudRain, color: 'text-blue-600', bg: 'bg-blue-50' },
  71: { label: 'Light snow', icon: CloudSnow, color: 'text-slate-400', bg: 'bg-slate-50' },
  73: { label: 'Snow', icon: CloudSnow, color: 'text-slate-500', bg: 'bg-slate-50' },
  75: { label: 'Heavy snow', icon: CloudSnow, color: 'text-slate-600', bg: 'bg-slate-100' },
  77: { label: 'Snow grains', icon: CloudSnow, color: 'text-slate-400', bg: 'bg-slate-50' },
  80: { label: 'Light showers', icon: CloudRain, color: 'text-blue-500', bg: 'bg-blue-50' },
  81: { label: 'Showers', icon: CloudRain, color: 'text-blue-600', bg: 'bg-blue-50' },
  82: { label: 'Heavy showers', icon: CloudRain, color: 'text-blue-700', bg: 'bg-blue-100' },
  85: { label: 'Snow showers', icon: CloudSnow, color: 'text-slate-500', bg: 'bg-slate-50' },
  86: { label: 'Heavy snow showers', icon: CloudSnow, color: 'text-slate-600', bg: 'bg-slate-100' },
  95: { label: 'Thunderstorm', icon: CloudLightning, color: 'text-purple-600', bg: 'bg-purple-50' },
  96: { label: 'Thunderstorm + hail', icon: CloudLightning, color: 'text-purple-700', bg: 'bg-purple-50' },
  99: { label: 'Severe thunderstorm', icon: CloudLightning, color: 'text-purple-700', bg: 'bg-purple-100' },
};

/**
 * WeatherCard — fetches current weather for a job site using the free
 * Open-Meteo API (no API key required). Shows current conditions and
 * today's high/low + rain probability.
 */
export default function WeatherCard({ lat, lng, locationName }) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
          `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation` +
          `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
          `&timezone=auto&forecast_days=1`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Weather fetch failed');
        const data = await res.json();
        if (!cancelled) setWeather(data);
      } catch (e) {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [lat, lng]);

  if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) {
    return (
      <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3">
        <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <p className="text-xs text-slate-500">No site coordinates set — ask your manager to set the job location for weather.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3">
        <div className="w-4 h-4 border-2 border-slate-200 border-t-slate-400 rounded-full animate-spin flex-shrink-0" />
        <p className="text-xs text-slate-400">Loading weather…</p>
      </div>
    );
  }

  if (error || !weather?.current) {
    return (
      <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3">
        <Cloud className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <p className="text-xs text-slate-500">Weather unavailable right now.</p>
      </div>
    );
  }

  const code = weather.current.weather_code;
  const wInfo = WEATHER_CODE_MAP[code] || WEATHER_CODE_MAP[3];
  const Icon = wInfo.icon;
  const temp = Math.round(weather.current.temperature_2m);
  const feelsLike = Math.round(weather.current.apparent_temperature);
  const wind = Math.round(weather.current.wind_speed_10m);
  const precip = weather.current.precipitation || 0;
  const daily = weather.daily?.[0];
  const maxTemp = daily ? Math.round(daily.temperature_2m_max) : null;
  const minTemp = daily ? Math.round(daily.temperature_2m_min) : null;
  const rainProb = daily?.precipitation_probability_max ?? null;

  return (
    <div className={`rounded-xl border px-3.5 py-3 ${wInfo.bg} border-slate-200`}>
      <div className="flex items-center gap-3">
        <Icon className={`w-8 h-8 ${wInfo.color} flex-shrink-0`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 tabular-nums">{temp}°C</span>
            <span className="text-xs text-slate-500 font-medium">{wInfo.label}</span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500 flex-wrap">
            <span className="flex items-center gap-1"><Thermometer className="w-3 h-3" /> Feels {feelsLike}°</span>
            {maxTemp != null && minTemp != null && (
              <span className="flex items-center gap-1"><span className="text-red-500 font-medium">↑{maxTemp}°</span> <span className="text-blue-500 font-medium">↓{minTemp}°</span></span>
            )}
            <span className="flex items-center gap-1"><Wind className="w-3 h-3" /> {wind} km/h</span>
            {rainProb != null && (
              <span className="flex items-center gap-1"><Droplets className="w-3 h-3 text-blue-500" /> {rainProb}% rain</span>
            )}
          </div>
        </div>
      </div>
      {precip > 0 && (
        <p className="text-[11px] text-blue-600 font-medium mt-1.5">Currently raining — take care on site.</p>
      )}
    </div>
  );
}