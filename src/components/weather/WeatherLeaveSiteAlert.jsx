import React from 'react';
import { useJobWeather } from '@/hooks/useJobWeather';
import { assessConditions, LEVEL_STYLES } from '@/utils/siteWeather';
import { ShieldX, DoorOpen, Wind, AlertTriangle } from 'lucide-react';

/**
 * WeatherLeaveSiteAlert — auto-prompt banner shown on the field staff active
 * job card when severe weather (level === 'stop') is detected for the job's
 * location. Offers a prominent "Leave site now (weather)" action that triggers
 * the early-leave flow with 'Weather' as the pre-filled reason.
 *
 * Only renders when the job is started and severe weather is active.
 */
export default function WeatherLeaveSiteAlert({ lat, lng, isDrillingJob, onLeaveSite }) {
  const { data: w } = useJobWeather(lat, lng);

  if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return null;
  if (!w?.current) return null;

  const assessment = assessConditions(w.current, w.daily?.[0]);
  if (assessment.level !== 'stop') return null;

  const lvl = LEVEL_STYLES.stop;
  const reasons = assessment.reasons;

  return (
    <div className={`rounded-2xl border-2 ${lvl.border} ${lvl.bg} overflow-hidden animate-slide-up`}>
      <div className="flex items-center gap-2.5 px-4 py-3 bg-rose-100/60 border-b border-rose-200">
        <div className="w-9 h-9 rounded-xl bg-rose-200/70 flex items-center justify-center flex-shrink-0">
          <ShieldX className="w-5 h-5 text-rose-700" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-rose-900 uppercase tracking-wide">Severe Weather Alert</p>
          <p className="text-xs text-rose-800 mt-0.5 leading-relaxed">
            {reasons.join(' · ')} — conditions are unsafe for outdoor work.
          </p>
        </div>
      </div>
      <div className="p-4 space-y-3">
        {isDrillingJob && reasons.some(r => /wind/i.test(r)) && (
          <div className="flex items-start gap-2 bg-white/70 rounded-lg px-3 py-2">
            <Wind className="w-3.5 h-3.5 text-rose-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-rose-900 leading-relaxed">
              <strong>Drilling should halt.</strong> High wind speeds make rig operations unsafe.
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={onLeaveSite}
          className="w-full flex items-center justify-center gap-2.5 px-4 py-3.5 bg-rose-600 text-white rounded-xl hover:bg-rose-700 active:scale-95 transition text-sm font-bold touch-manipulation shadow-lg shadow-rose-600/30"
        >
          <DoorOpen className="w-5 h-5" /> Leave Site Now (Weather)
        </button>
        <p className="text-[10px] text-rose-700 text-center flex items-center justify-center gap-1">
          <AlertTriangle className="w-3 h-3" /> This will record a weather-related departure and notify the office.
        </p>
      </div>
    </div>
  );
}