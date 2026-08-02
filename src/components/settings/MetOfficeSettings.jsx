import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Cloud, Loader2, Save, Check, AlertTriangle, RefreshCw, Link2, Link2Off,
  Settings2, MapPin,
} from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import { useToast } from '@/components/ui/use-toast';

const inputCls = "w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10";

const DEFAULT_CONFIG = {
  api_key: '',
  api_url: 'http://datapoint.metoffice.gov.uk/public/data-val/wxfcs/all/json',
  daily_sync_enabled: true,
  sync_time: '06:00',
  last_sync_at: null,
  last_sync_status: null,
  last_sync_summary: '',
};

export default function MetOfficeSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const { data: settingsRec } = useQuery({
    queryKey: ['met-office-config'],
    queryFn: () => base44.entities.AppSetting.filter({ key: 'met_office_config' }, '-created_date', 5),
  });

  useEffect(() => {
    if (settingsRec?.[0]?.value) setConfig({ ...DEFAULT_CONFIG, ...settingsRec[0].value });
  }, [settingsRec]);

  const configId = settingsRec?.[0]?.id;
  const connected = !!config.api_key;

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const payload = { key: 'met_office_config', label: 'Met Office Weather API Configuration', value: config };
      if (configId) await base44.entities.AppSetting.update(configId, payload);
      else await base44.entities.AppSetting.create(payload);
      queryClient.invalidateQueries({ queryKey: ['met-office-config'] });
      queryClient.invalidateQueries({ queryKey: ['all-integration-configs'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      // Simple validation — check if the API key fetches a valid response
      const testUrl = `${config.api_url}/val/wxfcs/all/json/350852?res=3hourly&key=${config.api_key}`;
      const res = await fetch(testUrl);
      if (res.ok) {
        setTestResult({ ok: true, msg: 'Connection successful — Met Office API key is valid.' });
      } else {
        setTestResult({ ok: false, msg: `API returned ${res.status} — check your API key.` });
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
        title="Met Office Weather API"
        description="Connect the Met Office DataPoint API to pull daily weather forecasts per site postcode. The system uses this to flag weather-impacted days on the rota and suggest schedule adjustments. Get a free API key from the Met Office DataPoint service."
      />

      {/* Connection status */}
      <div className={`rounded-xl border p-4 ${connected ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${connected ? 'bg-emerald-100' : 'bg-slate-200'}`}>
            {connected ? <Link2 className="w-5 h-5 text-emerald-600" /> : <Link2Off className="w-5 h-5 text-slate-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800">{connected ? 'Configured' : 'Not Connected'}</p>
            <p className="text-xs text-slate-500">{connected ? 'Met Office API key saved — weather data can be pulled.' : 'Enter your Met Office DataPoint API key below.'}</p>
          </div>
          <button onClick={handleTest} disabled={testing || !connected}
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

      {/* API credentials */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-[#2E5A1A]" />
          <h3 className="text-sm font-bold text-slate-800">API Credentials</h3>
        </div>
        <p className="text-xs text-slate-500">Register at <code className="bg-slate-100 px-1 rounded">datapoint.metoffice.gov.uk</code> to get a free API key. The key allows 5,000 calls per day.</p>
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">API Key</label>
            <input type="password" value={config.api_key} onChange={e => setConfig({ ...config, api_key: e.target.value })}
              placeholder="Your Met Office DataPoint API key" className={`${inputCls} font-mono`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">API Base URL</label>
            <input type="text" value={config.api_url} onChange={e => setConfig({ ...config, api_url: e.target.value })}
              placeholder="http://datapoint.metoffice.gov.uk/public/data-val/wxfcs/all/json" className={`${inputCls} font-mono`} />
          </div>
        </div>
        <label className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
          <input type="checkbox" checked={config.daily_sync_enabled} onChange={e => setConfig({ ...config, daily_sync_enabled: e.target.checked })} className="w-4 h-4 accent-[#2E5A1A]" />
          <div>
            <p className="text-sm font-medium text-slate-700">Daily auto-sync enabled</p>
            <p className="text-[11px] text-slate-400">Pull weather forecasts automatically each morning for all active job sites</p>
          </div>
        </label>
        {config.daily_sync_enabled && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Sync Time</label>
            <input type="time" value={config.sync_time} onChange={e => setConfig({ ...config, sync_time: e.target.value })} className={inputCls} />
          </div>
        )}
        <div className="flex items-center gap-2">
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-lg text-sm font-bold hover:bg-[#1c4a12] disabled:opacity-50 transition">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Settings
          </button>
          {saved && <span className="text-sm text-[#2E5A1A] font-medium flex items-center gap-1"><Check className="w-4 h-4" /> Saved</span>}
        </div>
      </div>

      {config.last_sync_at && (
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
          <p className="text-xs font-semibold text-slate-600 mb-1">Last sync</p>
          <p className="text-xs text-slate-500">{config.last_sync_summary || 'No summary'}</p>
          <p className="text-[11px] text-slate-400 mt-1">{new Date(config.last_sync_at).toLocaleString('en-GB')}</p>
        </div>
      )}
    </div>
  );
}