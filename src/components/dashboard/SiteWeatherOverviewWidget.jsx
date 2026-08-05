import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Cloud, CloudRain, CloudSnow, Sun, CloudSun, CloudFog, CloudLightning,
  Wind, Droplets, MapPin, Loader2, ShieldAlert, ShieldCheck, ShieldX,
  ChevronRight, AlertTriangle, Navigation,
} from 'lucide-react';

const WEATHER_CODE_MAP = {
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

function assessConditions(current, today) {
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

const LEVEL_STYLES = {
  good: { border: 'border-emerald-200', bg: 'bg-emerald-50', dot: 'bg-emerald-500', text: 'text-emerald-600', icon: ShieldCheck, label: 'Good' },
  caution: { border: 'border-amber-200', bg: 'bg-amber-50', dot: 'bg-amber-500', text: 'text-amber-600', icon: ShieldAlert, label: 'Caution' },
  stop: { border: 'border-rose-200', bg: 'bg-rose-50', dot: 'bg-rose-500', text: 'text-rose-600', icon: ShieldX, label: 'Stop' },
};

// Fetch weather for a single coordinate pair
async function fetchWeather(lat, lng) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,precipitation` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max` +
    `&timezone=auto&forecast_days=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Weather fetch failed');
  return res.json();
}

function SiteWeatherCard({ job, weather, onClick }) {
  const wInfo = WEATHER_CODE_MAP[weather?.current?.weather_code] || WEATHER_CODE_MAP[3];
  const Icon = wInfo.icon;
  const temp = weather?.current ? Math.round(weather.current.temperature_2m) : '—';
  const wind = weather?.current ? Math.round((weather.current.wind_speed_10m || 0) * 2.23694) : '—';
  const assessment = weather ? assessConditions(weather.current, weather.daily?.[0]) : null;
  const lvl = assessment ? LEVEL_STYLES[assessment.level] : LEVEL_STYLES.good;
  const LvIcon = lvl.icon;

  return (
    <button onClick={onClick}
      className={`text-left rounded-xl border-2 ${lvl.border} ${lvl.bg} p-3 hover:shadow-md transition w-full`}>
      <div className="flex items-start gap-2">
        <Icon className={`w-6 h-6 ${wInfo.color} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-800 truncate">{job.name}</p>
          <p className="text-[10px] text-slate-500 truncate flex items-center gap-0.5">
            <MapPin className="w-2.5 h-2.5 flex-shrink-0" /> {job.location || 'No location'}
          </p>
        </div>
        <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${lvl.bg} border ${lvl.border} flex-shrink-0`}>
          <LvIcon className={`w-3 h-3 ${lvl.text}`} />
        </div>
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-xl font-bold text-slate-800 tabular-nums">{temp}°</span>
        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          <span className="flex items-center gap-0.5"><Wind className="w-2.5 h-2.5" /> {wind}mph</span>
          <span className="flex items-center gap-0.5"><Droplets className="w-2.5 h-2.5 text-blue-400" /> {weather?.daily?.[0]?.precipitation_probability_max || 0}%</span>
        </div>
      </div>
      {assessment && assessment.reasons.length > 0 && (
        <p className={`text-[10px] ${lvl.text} font-medium mt-1 truncate`}>{assessment.reasons[0]}</p>
      )}
    </button>
  );
}

/**
 * SiteWeatherOverviewWidget — dashboard widget showing current weather and
 * drilling conditions for ALL active job sites at once. Color-coded by
 * drilling safety verdict (Good/Caution/Stop). Uses free Open-Meteo API.
 */
export default function SiteWeatherOverviewWidget({ onSelectJob }) {
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });
  const [weatherData, setWeatherData] = useState({});
  const [loading, setLoading] = useState(true);

  const activeJobsWithCoords = useMemo(() => {
    return jobs.filter(j =>
      (j.status === 'in_progress' || j.status === 'planning') &&
      j.site_lat != null && j.site_lng != null
    );
  }, [jobs]);

  useEffect(() => {
    if (activeJobsWithCoords.length === 0) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const results = {};
      // Fetch weather for each site (limit concurrency to 5)
      const concurrency = 5;
      let idx = 0;
      const workers = Array.from({ length: Math.min(concurrency, activeJobsWithCoords.length) }, async () => {
        while (idx < activeJobsWithCoords.length) {
          const i = idx++;
          const job = activeJobsWithCoords[i];
          try {
            const w = await fetchWeather(job.site_lat, job.site_lng);
            results[job.id] = w;
          } catch (_) { /* skip */ }
        }
      });
      await Promise.all(workers);
      if (!cancelled) {
        setWeatherData(results);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeJobsWithCoords]);

  // Summary counts
  const summary = useMemo(() => {
    const counts = { good: 0, caution: 0, stop: 0, noData: 0 };
    for (const job of activeJobsWithCoords) {
      const w = weatherData[job.id];
      if (!w) { counts.noData++; continue; }
      const a = assessConditions(w.current, w.daily?.[0]);
      counts[a.level]++;
    }
    return counts;
  }, [activeJobsWithCoords, weatherData]);

  const hasStop = summary.stop > 0;
  const hasCaution = summary.caution > 0;

  return (
    <div className="space-y-3">
      {/* Header with summary */}
      <div className="flex items-center gap-2 flex-wrap">
        <Navigation className="w-4 h-4 text-cyan-600" />
        <h3 className="text-sm font-bold text-slate-800">Site Weather Conditions</h3>
        <div className="flex items-center gap-1.5 ml-auto">
          {summary.stop > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold">
              <ShieldX className="w-3 h-3" /> {summary.stop} Stop
            </span>
          )}
          {summary.caution > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
              <ShieldAlert className="w-3 h-3" /> {summary.caution} Caution
            </span>
          )}
          {summary.good > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
              <ShieldCheck className="w-3 h-3" /> {summary.good} Good
            </span>
          )}
        </div>
      </div>

      {/* Stop-work alert banner */}
      {hasStop && (
        <div className="flex items-center gap-2 bg-rose-50 border-2 border-rose-200 rounded-lg px-3 py-2">
          <ShieldX className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <p className="text-xs font-bold text-rose-700">
            {summary.stop} site{summary.stop > 1 ? 's' : ''} have STOP-WORK weather conditions — check before dispatching crews.
          </p>
        </div>
      )}
      {hasCaution && !hasStop && (
        <div className="flex items-center gap-2 bg-amber-50 border-2 border-amber-200 rounded-lg px-3 py-2">
          <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <p className="text-xs font-bold text-amber-700">
            {summary.caution} site{summary.caution > 1 ? 's' : ''} have caution conditions — brief crews on hazards.
          </p>
        </div>
      )}

      {/* Weather grid */}
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 text-cyan-600 animate-spin" />
          <span className="ml-2 text-xs text-slate-500">Fetching weather for {activeJobsWithCoords.length} active sites…</span>
        </div>
      ) : activeJobsWithCoords.length === 0 ? (
        <div className="text-center py-6 bg-slate-50 rounded-xl">
          <MapPin className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
          <p className="text-xs text-slate-400">No active jobs with site coordinates set.</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Set job locations to see weather conditions here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {activeJobsWithCoords.map(job => (
            <SiteWeatherCard
              key={job.id}
              job={job}
              weather={weatherData[job.id]}
              onClick={() => onSelectJob?.(job)}
            />
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-3 text-[10px] text-slate-400 px-1">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Good to drill</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Caution</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> Stop work</span>
      </div>
    </div>
  );
}