import React, { useState } from 'react';
import { Cloud, CloudRain, CloudSnow, Sun, CloudSun, CloudFog, CloudLightning, Cloud as CloudIcon, X, ChevronDown } from 'lucide-react';
import { useJobWeather } from '@/hooks/useJobWeather';
import { WEATHER_CODE_MAP, assessConditions, LEVEL_STYLES } from '@/utils/siteWeather';
import WeatherWorkSafeCard from '@/components/WeatherWorkSafeCard';
import DrillingWeatherWidget from '@/components/DrillingWeatherWidget';
import FloodRiskWidget from '@/components/jobs/FloodRiskWidget';

/**
 * JobWeatherChip — compact weather pill for the Job Detail hero header.
 * Shows current temp + condition icon + work-safe dot. Click to open a
 * drill-down modal with the full weather widgets (WorkSafe, drilling, flood).
 */
export default function JobWeatherChip({ job, isDrillingJob }) {
  const [open, setOpen] = useState(false);
  const hasCoords = job.site_lat != null && job.site_lng != null;
  const { data: weather, isLoading } = useJobWeather(job.site_lat, job.site_lng, hasCoords);

  if (!hasCoords) return null;

  const current = weather?.current;
  const today = weather?.daily?.[0];
  const code = current?.weather_code ?? 0;
  const meta = WEATHER_CODE_MAP[code] || { icon: CloudIcon, label: '—', color: 'text-white/70' };
  const Icon = meta.icon;
  const temp = current?.temperature_2m != null ? Math.round(current.temperature_2m) : null;
  const { level } = assessConditions(current, today);
  const levelStyle = LEVEL_STYLES[level] || LEVEL_STYLES.good;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white/10 backdrop-blur-sm rounded-xl border border-white/15 hover:bg-white/15 transition text-white"
        title="View full weather details"
      >
        {isLoading ? (
          <CloudIcon className="w-4 h-4 text-white/50 animate-pulse" />
        ) : (
          <Icon className={`w-4 h-4 ${meta.color}`} />
        )}
        {temp != null && (
          <span className="text-xs font-bold tabular-nums">{temp}°</span>
        )}
        {!isLoading && (
          <span className={`w-2 h-2 rounded-full ${levelStyle.dot} flex-shrink-0`} />
        )}
        <ChevronDown className="w-3 h-3 text-white/50" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[75] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-pop-in" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="px-5 py-4 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <Cloud className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Site Weather</h3>
                  <p className="text-[11px] text-white/70">{job.location || job.name}</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Body — full weather widgets */}
            <div className="p-4 space-y-4">
              <WeatherWorkSafeCard job={job} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {isDrillingJob && (
                  <DrillingWeatherWidget
                    lat={job.site_lat}
                    lng={job.site_lng}
                    locationName={job.location}
                    compact={false}
                    rigType={job.drilling_method === 'cp' ? 'cp' : job.drilling_method === 'rotary' ? 'rotary' : undefined}
                  />
                )}
                <FloodRiskWidget
                  lat={job.site_lat}
                  lng={job.site_lng}
                  locationName={job.location}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}