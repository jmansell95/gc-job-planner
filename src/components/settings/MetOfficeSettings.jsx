import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Cloud, Loader2, Check, AlertTriangle, RefreshCw, Link2, Download, Globe,
} from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import { useToast } from '@/components/ui/use-toast';

const DEFAULT_CONFIG = {
  last_sync_at: null,
  last_sync_status: null,
  last_sync_summary: '',
};

export default function MetOfficeSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const { data: settingsRec } = useQuery({
    queryKey: ['met-office-config'],
    queryFn: () => base44.entities.AppSetting.filter({ key: 'met_office_config' }, '-created_date', 5),
  });

  useEffect(() => {
    if (settingsRec?.[0]?.value) setConfig({ ...DEFAULT_CONFIG, ...settingsRec[0].value });
  }, [settingsRec]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await base44.functions.invoke('syncMetOfficeWeather', {});
      const d = res.data || res;
      setSyncResult({ ok: !!d.ok, msg: d.message || d.error || 'Sync complete', synced: d.synced || 0, errors: d.errors || 0 });
      queryClient.invalidateQueries({ queryKey: ['met-office-config'] });
    } catch (e) {
      setSyncResult({ ok: false, msg: e.message || 'Sync failed' });
    }
    setSyncing(false);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=51.5&longitude=-0.1&daily=weather_code,temperature_2m_max&timezone=auto&forecast_days=1');
      if (res.ok) {
        const data = await res.json();
        setTestResult({ ok: true, msg: `Connection successful — Open-Meteo is live. Current London forecast: ${data?.daily?.temperature_2m_max?.[0] ?? '—'}°C` });
      } else {
        setTestResult({ ok: false, msg: `API returned ${res.status}` });
      }
    } catch (e) {
      setTestResult({ ok: false, msg: e.message || 'Connection test failed' });
    }
    setTesting(false);
  };

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        icon={Cloud}
        title="Open-Meteo Weather API"
        description="Free, no-API-key weather data from Open-Meteo — pulls daily forecasts for all active job sites across every division. Data is sourced from multiple NWP models (ECMWF, GFS, ICON) for high accuracy."
      />

      {/* Connection status — always connected (free, no key) */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <Link2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              Always Connected <Globe className="w-3.5 h-3.5 text-emerald-600" />
            </p>
            <p className="text-xs text-slate-500">Open-Meteo is free and requires no API key — weather data is available immediately for all divisions.</p>
          </div>
          <button onClick={handleTest} disabled={testing}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50">
            {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Test Connection
          </button>
        </div>
        {testResult && (
          <div className={`mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${testResult.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <p>{testResult.msg}</p>
          </div>
        )}
      </div>

      {/* Info panel */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-[#2E5A1A]" />
          <h3 className="text-sm font-bold text-slate-800">About Open-Meteo</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
          <div className="flex items-start gap-2 p-3 rounded-lg bg-slate-50">
            <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-700">No API Key Required</p>
              <p className="text-slate-500 mt-0.5">Free for non-commercial use — no registration needed.</p>
            </div>
          </div>
          <div className="flex items-start gap-2 p-3 rounded-lg bg-slate-50">
            <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-700">Multi-Model Accuracy</p>
              <p className="text-slate-500 mt-0.5">Aggregates ECMWF, GFS, ICON and 30+ other models.</p>
            </div>
          </div>
          <div className="flex items-start gap-2 p-3 rounded-lg bg-slate-50">
            <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-700">All Divisions Covered</p>
              <p className="text-slate-500 mt-0.5">Every active job site across every division gets weather data.</p>
            </div>
          </div>
          <div className="flex items-start gap-2 p-3 rounded-lg bg-slate-50">
            <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-700">Drilling-Specific Alerts</p>
              <p className="text-slate-500 mt-0.5">Auto-flags stop-work and caution conditions for drilling crews.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Manual sync */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Download className="w-4 h-4 text-[#2E5A1A]" />
          <h3 className="text-sm font-bold text-slate-800">Sync Now</h3>
        </div>
        <p className="text-xs text-slate-500 mb-3">Pulls today's weather forecast for all active job sites and stores it as a WeatherLog record. A scheduled automation also runs this daily at 06:00.</p>
        <button onClick={handleSync} disabled={syncing}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-lg text-sm font-bold hover:bg-[#1c4a12] disabled:opacity-50 transition">
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Pull Weather Forecasts Now
        </button>
        {syncResult && (
          <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${syncResult.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            <p className="flex items-start gap-2"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {syncResult.msg}</p>
          </div>
        )}
        {config.last_sync_at && (
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 mt-3">
            <p className="text-xs font-semibold text-slate-600 mb-1">Last sync</p>
            <p className="text-xs text-slate-500">{config.last_sync_summary || 'No summary'}</p>
            <p className="text-[11px] text-slate-400 mt-1">{new Date(config.last_sync_at).toLocaleString('en-GB')}</p>
          </div>
        )}
      </div>
    </div>
  );
}