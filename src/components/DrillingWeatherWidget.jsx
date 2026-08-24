import React, { useState, useEffect, useMemo } from 'react';
import {
  Cloud, CloudRain, CloudSnow, Sun, CloudSun, CloudFog, CloudLightning,
  Wind, Droplets, Thermometer, MapPin, AlertTriangle, ShieldAlert,
  ShieldCheck, ShieldX, Loader2, ChevronDown, ChevronRight, Clock,
  Gauge, Activity, TrendingUp,
} from 'lucide-react';

const WEATHER_CODE_MAP = {
  0: { label: 'Clear sky', icon: Sun, color: 'text-amber-500', bg: 'bg-amber-50', grad: 'from-amber-100 to-yellow-50' },
  1: { label: 'Mainly clear', icon: Sun, color: 'text-amber-500', bg: 'bg-amber-50', grad: 'from-amber-100 to-yellow-50' },
  2: { label: 'Partly cloudy', icon: CloudSun, color: 'text-slate-500', bg: 'bg-slate-50', grad: 'from-slate-100 to-slate-50' },
  3: { label: 'Overcast', icon: Cloud, color: 'text-slate-500', bg: 'bg-slate-50', grad: 'from-slate-100 to-slate-50' },
  45: { label: 'Fog', icon: CloudFog, color: 'text-slate-400', bg: 'bg-slate-50', grad: 'from-slate-200 to-slate-50' },
  48: { label: 'Rime fog', icon: CloudFog, color: 'text-slate-400', bg: 'bg-slate-50', grad: 'from-slate-200 to-slate-50' },
  51: { label: 'Light drizzle', icon: CloudRain, color: 'text-blue-500', bg: 'bg-blue-50', grad: 'from-blue-100 to-blue-50' },
  53: { label: 'Drizzle', icon: CloudRain, color: 'text-blue-500', bg: 'bg-blue-50', grad: 'from-blue-100 to-blue-50' },
  55: { label: 'Heavy drizzle', icon: CloudRain, color: 'text-blue-600', bg: 'bg-blue-50', grad: 'from-blue-100 to-blue-50' },
  56: { label: 'Freezing drizzle', icon: CloudRain, color: 'text-blue-500', bg: 'bg-blue-50', grad: 'from-blue-100 to-blue-50' },
  57: { label: 'Freezing drizzle', icon: CloudRain, color: 'text-blue-600', bg: 'bg-blue-50', grad: 'from-blue-100 to-blue-50' },
  61: { label: 'Light rain', icon: CloudRain, color: 'text-blue-500', bg: 'bg-blue-50', grad: 'from-blue-100 to-blue-50' },
  63: { label: 'Rain', icon: CloudRain, color: 'text-blue-600', bg: 'bg-blue-50', grad: 'from-blue-100 to-blue-50' },
  65: { label: 'Heavy rain', icon: CloudRain, color: 'text-blue-700', bg: 'bg-blue-100', grad: 'from-blue-200 to-blue-100' },
  66: { label: 'Freezing rain', icon: CloudRain, color: 'text-blue-500', bg: 'bg-blue-50', grad: 'from-blue-100 to-blue-50' },
  67: { label: 'Freezing rain', icon: CloudRain, color: 'text-blue-600', bg: 'bg-blue-50', grad: 'from-blue-100 to-blue-50' },
  71: { label: 'Light snow', icon: CloudSnow, color: 'text-slate-400', bg: 'bg-slate-50', grad: 'from-slate-100 to-slate-50' },
  73: { label: 'Snow', icon: CloudSnow, color: 'text-slate-500', bg: 'bg-slate-50', grad: 'from-slate-100 to-slate-50' },
  75: { label: 'Heavy snow', icon: CloudSnow, color: 'text-slate-600', bg: 'bg-slate-100', grad: 'from-slate-200 to-slate-100' },
  77: { label: 'Snow grains', icon: CloudSnow, color: 'text-slate-400', bg: 'bg-slate-50', grad: 'from-slate-100 to-slate-50' },
  80: { label: 'Light showers', icon: CloudRain, color: 'text-blue-500', bg: 'bg-blue-50', grad: 'from-blue-100 to-blue-50' },
  81: { label: 'Showers', icon: CloudRain, color: 'text-blue-600', bg: 'bg-blue-50', grad: 'from-blue-100 to-blue-50' },
  82: { label: 'Heavy showers', icon: CloudRain, color: 'text-blue-700', bg: 'bg-blue-100', grad: 'from-blue-200 to-blue-100' },
  85: { label: 'Snow showers', icon: CloudSnow, color: 'text-slate-500', bg: 'bg-slate-50', grad: 'from-slate-100 to-slate-50' },
  86: { label: 'Heavy snow showers', icon: CloudSnow, color: 'text-slate-600', bg: 'bg-slate-100', grad: 'from-slate-200 to-slate-100' },
  95: { label: 'Thunderstorm', icon: CloudLightning, color: 'text-purple-600', bg: 'bg-purple-50', grad: 'from-purple-100 to-purple-50' },
  96: { label: 'Thunderstorm + hail', icon: CloudLightning, color: 'text-purple-700', bg: 'bg-purple-50', grad: 'from-purple-200 to-purple-100' },
  99: { label: 'Severe thunderstorm', icon: CloudLightning, color: 'text-purple-700', bg: 'bg-purple-100', grad: 'from-purple-200 to-purple-100' },
};

// Rig-aware wind thresholds (mph).
// CP (cable percussion) rigs have a tall exposed mast and are more sensitive
// to wind — lower stop/caution thresholds. Rotary rigs are heavier and can
// operate in slightly higher winds. Default thresholds apply when no rig
// type is specified.
const RIG_WIND_LIMITS = {
  cp: { stopGust: 38, stopWind: 30, cautionGust: 30, cautionWind: 22 },
  rotary: { stopGust: 45, stopWind: 38, cautionGust: 38, cautionWind: 28 },
  default: { stopGust: 45, stopWind: 38, cautionGust: 35, cautionWind: 25 },
};

// Drilling-specific weather assessment with rig-aware wind thresholds.
// Rules based on typical drilling rig operating limits:
// - Wind (rig-specific thresholds) → STOP or CAUTION
// - Thunderstorm → STOP (lightning risk with rig masts)
// - Heavy rain (>8mm/day or >80% prob) → CAUTION (ground conditions, water ingress)
// - Snow/Ice → STOP or CAUTION (ground conditions, freezing)
// - Freezing temps < 0°C → CAUTION (ground frost, equipment)
function assessDrillingConditions(day, rigType) {
  const windMs = day.wind_speed_10m_max || 0;
  const windMph = Math.round(windMs * 2.23694);
  const code = day.weather_code;
  const rainProb = day.precipitation_probability_max || 0;
  const precip = day.precipitation_sum || 0;
  const tempMin = day.temperature_2m_min || 0;
  const gustMs = day.wind_gusts_10m_max || windMs;
  const gustMph = Math.round(gustMs * 2.23694);

  const limits = RIG_WIND_LIMITS[rigType] || RIG_WIND_LIMITS.default;
  const rigLabel = rigType === 'cp' ? 'CP rig' : rigType === 'rotary' ? 'Rotary rig' : 'Rig';

  const reasons = [];
  let level = 'good'; // good | caution | stop

  // Wind limits (rig-aware)
  if (gustMph >= limits.stopGust || windMph >= limits.stopWind) {
    level = 'stop';
    reasons.push(`High wind ${windMph} mph (gusts ${gustMph} mph) — ${rigLabel} operations unsafe`);
  } else if (gustMph >= limits.cautionGust || windMph >= limits.cautionWind) {
    if (level !== 'stop') level = 'caution';
    reasons.push(`Strong wind ${windMph} mph (gusts ${gustMph} mph) — reduced ${rigLabel} operations`);
  }

  // Thunderstorm
  if (code >= 95) {
    level = 'stop';
    reasons.push('Thunderstorm — lightning risk with rig mast');
  }

  // Heavy rain
  if (precip >= 10 || rainProb >= 85) {
    if (level !== 'stop') level = 'caution';
    reasons.push(precip >= 10 ? `Heavy rain ${precip.toFixed(1)}mm — ground conditions` : `High rain probability ${rainProb}% — plan for wet ground`);
  }

  // Snow / freezing
  if (code >= 71 && code <= 77) {
    if (level !== 'stop') level = 'caution';
    reasons.push('Snow — slippery ground conditions');
  }
  if (code >= 85 && code <= 86) {
    level = 'stop';
    reasons.push('Heavy snow showers — unsafe working conditions');
  }
  if (tempMin < 0) {
    if (level !== 'stop') level = 'caution';
    reasons.push(`Freezing temperatures ${Math.round(tempMin)}°C — ground frost, equipment risk`);
  }

  // Freezing rain
  if (code === 66 || code === 67 || code === 56 || code === 57) {
    level = 'stop';
    reasons.push('Freezing rain — ice hazard on site');
  }

  if (reasons.length === 0) {
    reasons.push('Conditions suitable for drilling operations');
  }

  return { level, reasons, windMph, gustMph };
}

const LEVEL_CONFIG = {
  good: { label: 'Good to Drill', icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  caution: { label: 'Caution', icon: ShieldAlert, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500' },
  stop: { label: 'Stop Work', icon: ShieldX, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', dot: 'bg-rose-500' },
};

function DayForecastCard({ day, index, isToday, rigType }) {
  const [expanded, setExpanded] = useState(isToday);
  const wInfo = WEATHER_CODE_MAP[day.weather_code] || WEATHER_CODE_MAP[3];
  const Icon = wInfo.icon;
  const assessment = assessDrillingConditions(day, rigType);
  const lvl = LEVEL_CONFIG[assessment.level];
  const LvIcon = lvl.icon;
  const date = new Date(day.date + 'T00:00:00');
  const dayName = isToday ? 'Today' : date.toLocaleDateString('en-GB', { weekday: 'short' });
  const dateStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  return (
    <div className={`rounded-xl border-2 transition ${lvl.border} ${lvl.bg} overflow-hidden`}>
      <button onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2.5 p-3 hover:bg-white/50 transition text-left">
        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />}
        <Icon className={`w-7 h-7 ${wInfo.color} flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-800">{dayName}</span>
            <span className="text-[10px] text-slate-400">{dateStr}</span>
          </div>
          <p className="text-[11px] text-slate-500 truncate">{wInfo.label}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs font-bold text-red-500">{Math.round(day.temperature_2m_max)}°</span>
          <span className="text-xs text-blue-500">{Math.round(day.temperature_2m_min)}°</span>
        </div>
        <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${lvl.bg} border ${lvl.border} flex-shrink-0`}>
          <LvIcon className={`w-3 h-3 ${lvl.color}`} />
          <span className={`text-[10px] font-bold ${lvl.color}`}>{lvl.label}</span>
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1 space-y-2 bg-white/40">
          {/* Quick stats grid */}
          <div className="grid grid-cols-4 gap-1.5">
            <div className="bg-white rounded-lg p-1.5 border border-slate-100 text-center">
              <Wind className="w-3 h-3 text-slate-400 mx-auto mb-0.5" />
              <p className="text-[8px] uppercase text-slate-400 font-semibold">Wind</p>
              <p className="text-xs font-bold text-slate-700 tabular-nums">{assessment.windMph}<span className="text-[8px] font-normal">mph</span></p>
            </div>
            <div className="bg-white rounded-lg p-1.5 border border-slate-100 text-center">
              <Gauge className="w-3 h-3 text-slate-400 mx-auto mb-0.5" />
              <p className="text-[8px] uppercase text-slate-400 font-semibold">Gusts</p>
              <p className="text-xs font-bold text-slate-700 tabular-nums">{assessment.gustMph}<span className="text-[8px] font-normal">mph</span></p>
            </div>
            <div className="bg-white rounded-lg p-1.5 border border-slate-100 text-center">
              <Droplets className="w-3 h-3 text-blue-400 mx-auto mb-0.5" />
              <p className="text-[8px] uppercase text-slate-400 font-semibold">Rain</p>
              <p className="text-xs font-bold text-slate-700 tabular-nums">{day.precipitation_probability_max || 0}<span className="text-[8px] font-normal">%</span></p>
            </div>
            <div className="bg-white rounded-lg p-1.5 border border-slate-100 text-center">
              <Thermometer className="w-3 h-3 text-slate-400 mx-auto mb-0.5" />
              <p className="text-[8px] uppercase text-slate-400 font-semibold">UV</p>
              <p className="text-xs font-bold text-slate-700 tabular-nums">{day.uv_index_max?.toFixed(1) || '—'}</p>
            </div>
          </div>

          {/* Drilling advisory */}
          <div className={`rounded-lg p-2 border ${lvl.border} ${lvl.bg}`}>
            <div className="flex items-start gap-1.5">
              <LvIcon className={`w-3.5 h-3.5 ${lvl.color} flex-shrink-0 mt-0.5`} />
              <div className="flex-1">
                <p className={`text-[10px] font-bold uppercase ${lvl.color}`}>Drilling Advisory</p>
                <ul className="space-y-0.5 mt-0.5">
                  {assessment.reasons.map((r, i) => (
                    <li key={i} className="text-[11px] text-slate-600 flex items-start gap-1">
                      <span className={`w-1 h-1 rounded-full ${lvl.dot} mt-1.5 flex-shrink-0`} />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Hourly breakdown (today only) */}
          {isToday && day.hourly && (
            <div>
              <p className="text-[10px] uppercase font-semibold text-slate-400 mb-1 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" /> Hourly Breakdown
              </p>
              <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
                {day.hourly.map((h, i) => {
                  const hw = WEATHER_CODE_MAP[h.weather_code] || WEATHER_CODE_MAP[3];
                  const HIcon = hw.icon;
                  const hAssess = assessDrillingConditions({
                    wind_speed_10m_max: h.wind_speed_10m,
                    wind_gusts_10m_max: h.wind_gusts_10m,
                    weather_code: h.weather_code,
                    precipitation_probability_max: h.precipitation_probability,
                    precipitation_sum: h.precipitation,
                    temperature_2m_min: h.temperature_2m,
                  }, rigType);
                  const hLvl = LEVEL_CONFIG[hAssess.level];
                  return (
                    <div key={i} className="flex-shrink-0 w-12 bg-white rounded-lg p-1.5 border border-slate-100 text-center">
                      <p className="text-[8px] text-slate-400 font-semibold">{i}:00</p>
                      <HIcon className={`w-4 h-4 ${hw.color} mx-auto my-0.5`} />
                      <p className="text-[10px] font-bold text-slate-700 tabular-nums">{Math.round(h.temperature_2m)}°</p>
                      <div className={`w-1.5 h-1.5 rounded-full ${hLvl.dot} mx-auto mt-0.5`} />
                      <p className="text-[7px] text-slate-400 mt-0.5">{hAssess.windMph}mph</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * DrillingWeatherWidget — visual multi-day weather forecast with drilling-specific
 * safety advisories. Uses the free Open-Meteo API (no API key required).
 *
 * Shows:
 * - 5-day forecast with drilling condition verdicts (Good/Caution/Stop)
 * - Wind speed, gusts, rain probability per day
 * - Drilling-specific safety rules (wind limits, lightning, ground conditions)
 * - Hourly breakdown for today
 * - Visual color-coded days
 */
export default function DrillingWeatherWidget({
  lat, lng, locationName, rigType, compact = false }) {
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
          `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,uv_index_max` +
          `&hourly=weather_code,temperature_2m,wind_speed_10m,wind_gusts_10m,precipitation,precipitation_probability` +
          `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,precipitation` +
          `&timezone=auto&forecast_days=5`;
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

  // Build day array with hourly data for today
  const days = useMemo(() => {
    if (!weather?.daily) return [];
    return weather.daily.time.map((date, i) => {
      const day = {
        date,
        weather_code: weather.daily.weather_code[i],
        temperature_2m_max: weather.daily.temperature_2m_max[i],
        temperature_2m_min: weather.daily.temperature_2m_min[i],
        precipitation_sum: weather.daily.precipitation_sum[i],
        precipitation_probability_max: weather.daily.precipitation_probability_max[i],
        wind_speed_10m_max: weather.daily.wind_speed_10m_max[i],
        wind_gusts_10m_max: weather.daily.wind_gusts_10m_max[i],
        uv_index_max: weather.daily.uv_index_max?.[i],
      };
      // Attach hourly data for today
      if (i === 0 && weather.hourly) {
        day.hourly = weather.hourly.time.map((t, hi) => ({
          time: t,
          weather_code: weather.hourly.weather_code[hi],
          temperature_2m: weather.hourly.temperature_2m[hi],
          wind_speed_10m: weather.hourly.wind_speed_10m[hi],
          wind_gusts_10m: weather.hourly.wind_gusts_10m[hi],
          precipitation: weather.hourly.precipitation[hi],
          precipitation_probability: weather.hourly.precipitation_probability?.[hi] || 0,
        })).filter(h => {
          const now = new Date();
          const hTime = new Date(h.time);
          return hTime >= now && hTime < new Date(now.getTime() + 24 * 60 * 60 * 1000);
        }).slice(0, 12);
      }
      return day;
    });
  }, [weather]);

  // Overall verdict
  const overallVerdict = useMemo(() => {
    if (days.length === 0) return null;
    const today = days[0];
    return assessDrillingConditions(today, rigType);
  }, [days, rigType]);

  if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) {
    return (
      <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3">
        <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <p className="text-xs text-slate-500">No site coordinates set — set the job location to see drilling weather forecasts.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-4">
        <Loader2 className="w-4 h-4 text-slate-400 animate-spin flex-shrink-0" />
        <p className="text-xs text-slate-500">Loading drilling weather forecast…</p>
      </div>
    );
  }

  if (error || !weather?.current) {
    return (
      <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3">
        <Cloud className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <p className="text-xs text-slate-500">Weather forecast unavailable right now.</p>
      </div>
    );
  }

  const code = weather.current.weather_code;
  const wInfo = WEATHER_CODE_MAP[code] || WEATHER_CODE_MAP[3];
  const Icon = wInfo.icon;
  const temp = Math.round(weather.current.temperature_2m);
  const wind = Math.round((weather.current.wind_speed_10m || 0) * 2.23694);
  const gust = Math.round((weather.current.wind_gusts_10m || 0) * 2.23694);
  const precip = weather.current.precipitation || 0;

  const overallLvl = overallVerdict ? LEVEL_CONFIG[overallVerdict.level] : null;

  return (
    <div className="space-y-3">
      {/* Current conditions hero card */}
      <div className={`rounded-2xl border border-slate-200 overflow-hidden bg-gradient-to-br ${wInfo.grad}`}>
        <div className="px-4 py-3 flex items-center gap-3">
          <Icon className={`w-10 h-10 ${wInfo.color} flex-shrink-0`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-900 tabular-nums">{temp}°C</span>
              <span className="text-sm text-slate-600 font-medium">{wInfo.label}</span>
            </div>
            {locationName && (
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3" /> {locationName}
              </p>
            )}
          </div>
          {overallLvl && (
            <div className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl ${overallLvl.bg} border-2 ${overallLvl.border}`}>
              <overallLvl.icon className={`w-5 h-5 ${overallLvl.color}`} />
              <span className={`text-[10px] font-bold uppercase ${overallLvl.color}`}>{overallLvl.label}</span>
            </div>
          )}
        </div>
        {/* Current quick stats */}
        <div className="px-4 pb-3 grid grid-cols-4 gap-2">
          <div className="bg-white/60 rounded-lg p-2 text-center">
            <Wind className="w-3.5 h-3.5 text-slate-500 mx-auto mb-0.5" />
            <p className="text-[9px] uppercase text-slate-500 font-semibold">Wind</p>
            <p className="text-sm font-bold text-slate-700 tabular-nums">{wind}<span className="text-[9px] font-normal">mph</span></p>
          </div>
          <div className="bg-white/60 rounded-lg p-2 text-center">
            <Gauge className="w-3.5 h-3.5 text-slate-500 mx-auto mb-0.5" />
            <p className="text-[9px] uppercase text-slate-500 font-semibold">Gusts</p>
            <p className="text-sm font-bold text-slate-700 tabular-nums">{gust}<span className="text-[9px] font-normal">mph</span></p>
          </div>
          <div className="bg-white/60 rounded-lg p-2 text-center">
            <Droplets className="w-3.5 h-3.5 text-blue-500 mx-auto mb-0.5" />
            <p className="text-[9px] uppercase text-slate-500 font-semibold">Rain</p>
            <p className="text-sm font-bold text-slate-700 tabular-nums">{precip.toFixed(1)}<span className="text-[9px] font-normal">mm</span></p>
          </div>
          <div className="bg-white/60 rounded-lg p-2 text-center">
            <Thermometer className="w-3.5 h-3.5 text-slate-500 mx-auto mb-0.5" />
            <p className="text-[9px] uppercase text-slate-500 font-semibold">Feels</p>
            <p className="text-sm font-bold text-slate-700 tabular-nums">{Math.round(weather.current.apparent_temperature)}°</p>
          </div>
        </div>
      </div>

      {/* Rig type indicator */}
      {rigType && rigType !== 'default' && (
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 px-1">
          <span className="font-semibold">Wind limits:</span>
          <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
            {rigType === 'cp' ? 'CP rig (conservative)' : 'Rotary rig (standard)'}
          </span>
        </div>
      )}

      {/* Stop-work banner if today is stop level */}
      {overallVerdict?.level === 'stop' && (
        <div className="flex items-start gap-2 bg-rose-50 border-2 border-rose-200 rounded-xl px-3.5 py-3">
          <ShieldX className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-rose-700">STOP WORK — Drilling Conditions Unsafe Today</p>
            <p className="text-xs text-rose-600 mt-0.5">{overallVerdict.reasons[0]}</p>
          </div>
        </div>
      )}
      {overallVerdict?.level === 'caution' && (
        <div className="flex items-start gap-2 bg-amber-50 border-2 border-amber-200 rounded-xl px-3.5 py-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-700">Caution — Reduced Drilling Operations Today</p>
            <p className="text-xs text-amber-600 mt-0.5">{overallVerdict.reasons[0]}</p>
          </div>
        </div>
      )}

      {/* 5-day drilling forecast */}
      {!compact && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-slate-600" />
            <h3 className="text-sm font-bold text-slate-800">5-Day Drilling Forecast</h3>
          </div>
          <div className="space-y-2">
            {days.map((day, i) => (
              <DayForecastCard key={i} day={day} index={i} isToday={i === 0} rigType={rigType} />
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      {!compact && (
        <div className="flex items-center gap-3 text-[10px] text-slate-400 px-1">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Good to Drill</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Caution</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> Stop Work</span>
        </div>
      )}
    </div>
  );
}