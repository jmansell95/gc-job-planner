import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useJobWeather } from '@/hooks/useJobWeather';
import { WEATHER_CODE_MAP, LEVEL_STYLES, assessConditions } from '@/utils/siteWeather';
import { Cloud, Wind, Droplets, Thermometer, ChevronDown } from 'lucide-react';

/**
 * WeatherBadge — a compact, tappable weather chip for job cards.
 * Shows current condition icon, temperature, and severity colour.
 * Tapping opens a small forecast popover (portal-rendered so it's never
 * clipped by overflow-hidden card containers).
 *
 * Reused across the admin Job Manager grid and the admin dashboard live-site
 * cards for visual consistency.
 */
export default function WeatherBadge({ lat, lng, size = 'sm', showForecast = true, className = '' }) {
  const [showPopover, setShowPopover] = useState(false);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  const popoverRef = useRef(null);
  const badgeRef = useRef(null);
  const { data: w, isLoading } = useJobWeather(lat, lng);

  // Close popover on outside click
  useEffect(() => {
    if (!showPopover) return;
    const handler = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target) &&
          badgeRef.current && !badgeRef.current.contains(e.target)) {
        setShowPopover(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [showPopover]);

  if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return null;
  if (isLoading || !w?.current) return null;

  const code = w.current.weather_code;
  const wInfo = WEATHER_CODE_MAP[code] || WEATHER_CODE_MAP[3];
  const Icon = wInfo.icon;
  const temp = Math.round(w.current.temperature_2m);
  const assessment = assessConditions(w.current, w.daily?.[0]);
  const lvl = LEVEL_STYLES[assessment.level];

  const sizeCls = size === 'md' ? 'text-xs px-2.5 py-1' : 'text-[11px] px-2 py-0.5';
  const iconSize = size === 'md' ? 'w-3.5 h-3.5' : 'w-3 h-3';

  const handleBadgeClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!showForecast) return;
    if (showPopover) {
      setShowPopover(false);
      return;
    }
    const rect = badgeRef.current.getBoundingClientRect();
    const popoverWidth = 280; // w-64 = 16rem = 256px, plus padding margin
    const left = Math.min(rect.left, window.innerWidth - popoverWidth - 8);
    const top = rect.bottom + 6;
    setPopoverPos({ top, left });
    setShowPopover(true);
  };

  return (
    <>
      <button
        ref={badgeRef}
        type="button"
        onClick={handleBadgeClick}
        className={`inline-flex items-center gap-1 ${sizeCls} font-semibold rounded-full ${lvl.bg} border ${lvl.border} ${lvl.text} transition hover:shadow-sm ${className}`}
        title={`${wInfo.label} · ${assessment.level === 'good' ? 'Good conditions' : lvl.label}`}
      >
        <Icon className={iconSize} />
        <span className="tabular-nums">{temp}°</span>
        {assessment.level !== 'good' && (
          <span className="opacity-80 hidden sm:inline">· {lvl.label}</span>
        )}
        {showForecast && <ChevronDown className={`${iconSize} opacity-50`} />}
      </button>

      {showPopover && showForecast && createPortal(
        <div
          ref={popoverRef}
          onClick={(e) => e.stopPropagation()}
          style={{ position: 'fixed', top: popoverPos.top, left: popoverPos.left, zIndex: 9999 }}
          className="w-64 bg-white rounded-xl shadow-2xl border border-slate-200 p-3.5 animate-pop-in"
        >
          {/* Current conditions header */}
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${lvl.bg} border ${lvl.border}`}>
              <Icon className={`w-6 h-6 ${lvl.text}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-slate-900 tabular-nums">{temp}°C</span>
                <span className="text-xs text-slate-500 font-medium">{wInfo.label}</span>
              </div>
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${lvl.bg} ${lvl.text} mt-0.5`}>
                <lvl.icon className="w-2.5 h-2.5" /> {lvl.label}
              </span>
            </div>
          </div>

          {/* Metrics row */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="text-center bg-slate-50 rounded-lg py-1.5">
              <Thermometer className="w-3 h-3 text-slate-400 mx-auto mb-0.5" />
              <p className="text-[9px] text-slate-400 uppercase">Feels</p>
              <p className="text-xs font-bold text-slate-700 tabular-nums">{Math.round(w.current.apparent_temperature)}°</p>
            </div>
            <div className="text-center bg-slate-50 rounded-lg py-1.5">
              <Wind className="w-3 h-3 text-slate-400 mx-auto mb-0.5" />
              <p className="text-[9px] text-slate-400 uppercase">Wind</p>
              <p className="text-xs font-bold text-slate-700 tabular-nums">{assessment.windMph}mph</p>
            </div>
            <div className="text-center bg-slate-50 rounded-lg py-1.5">
              <Droplets className="w-3 h-3 text-slate-400 mx-auto mb-0.5" />
              <p className="text-[9px] text-slate-400 uppercase">Rain</p>
              <p className="text-xs font-bold text-slate-700 tabular-nums">{w.daily?.[0]?.precipitation_probability_max ?? '—'}%</p>
            </div>
          </div>

          {/* High / Low */}
          {w.daily?.[0] && (
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2.5 pb-2.5 border-b border-slate-100">
              <span>Today's range</span>
              <span className="font-semibold">
                <span className="text-red-500">↑{Math.round(w.daily[0].temperature_2m_max)}°</span>
                {' '}
                <span className="text-blue-500">↓{Math.round(w.daily[0].temperature_2m_min)}°</span>
              </span>
            </div>
          )}

          {/* Active alert */}
          {assessment.reasons.length > 0 && (
            <div className={`flex items-start gap-2 rounded-lg px-2.5 py-2 ${lvl.bg} border ${lvl.border}`}>
              <lvl.icon className={`w-3.5 h-3.5 ${lvl.text} flex-shrink-0 mt-0.5`} />
              <div className="min-w-0">
                <p className={`text-[10px] font-bold ${lvl.text} uppercase tracking-wide`}>Active Alert</p>
                <p className={`text-xs ${lvl.text}`}>{assessment.reasons.join(' · ')}</p>
              </div>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}