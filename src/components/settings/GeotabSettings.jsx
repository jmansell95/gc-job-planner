import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  MapPin, Loader2, Save, Check, AlertTriangle, RefreshCw, Link2, Link2Off,
  Settings2, Satellite,
} from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import { useToast } from '@/components/ui/use-toast';

const inputCls = "w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10";

const DEFAULT_CONFIG = {
  server: 'my.geotab.com',
  username: '',
  password: '',
  database: '',
  auto_sync_enabled: false,
  sync_frequency: '5min',
  last_sync_at: null,
  last_sync_status: null,
  last_sync_summary: '',
};

export default function GeotabSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const { data: settingsRec } = useQuery({
    queryKey: ['geotab-config'],
    queryFn: () => base44.entities.AppSetting.filter({ key: 'geotab_config' }, '-created_date', 5),
  });

  useEffect(() => {
    if (settingsRec?.[0]?.value) setConfig({ ...DEFAULT_CONFIG, ...settingsRec[0].value });
  }, [settingsRec]);

  const configId = settingsRec?.[0]?.id;
  const connected = !!(config.username && config.password && config.database);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const payload = { key: 'geotab_config', label: 'Geotab GPS Sync Configuration', value: config };
      if (configId) await base44.entities.AppSetting.update(configId, payload);
      else await base44.entities.AppSetting.create(payload);
      queryClient.invalidateQueries({ queryKey: ['geotab-config'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      toast({ title: 'Save failed', description: e.message || 'Please try again.', variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await base44.functions.invoke('syncGeotabFleet', { action: 'test' });
      const d = res.data || res;
      setTestResult({ ok: !!d.ok, msg: d.message || d.error || 'Unknown response' });
    } catch (e) {
      setTestResult({ ok: false, msg: e.message || 'Connection test failed' });
    }
    setTesting(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await base44.functions.invoke('syncGeotabFleet', { action: 'sync' });
      const d = res.data || res;
      setSyncResult({
        ok: !!d.ok,
        msg: d.message || d.error || 'Sync complete',
        synced: d.synced || 0,
        unmatched: d.unmatched || 0,
        total: d.total_statuses || 0,
      });
      queryClient.invalidateQueries({ queryKey: ['geotab-config'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-location-logs'] });
    } catch (e) {
      setSyncResult({ ok: false, msg: e.message || 'Sync failed' });
    }
    setSyncing(false);
  };

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        icon={Satellite}
        title="Geotab GPS Sync"
        description="Connect Geotab fleet GPS tracking to see where your vehicles and staff are in real time. Pulls live locations by registration number and powers the live map on the Vehicles page. Configure API credentials and set up the webhook receiver for pushed location events."
      />

      {/* Connection status */}
      <div className={`rounded-xl border p-4 ${connected ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${connected ? 'bg-emerald-100' : 'bg-slate-200'}`}>
            {connected ? <Link2 className="w-5 h-5 text-emerald-600" /> : <Link2Off className="w-5 h-5 text-slate-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800">{connected ? 'Configured' : 'Not Connected'}</p>
            <p className="text-xs text-slate-500">{connected ? 'Geotab API credentials saved — test the connection or sync now.' : 'Enter your Geotab API credentials below to enable live fleet tracking.'}</p>
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
          <h3 className="text-sm font-bold text-slate-800">Geotab API Credentials</h3>
        </div>
        <p className="text-xs text-slate-500">Find these in your Geotab MyAdmin portal. The server is your Geotab server URL (e.g. <code className="bg-slate-100 px-1 rounded">my.geotab.com</code> or <code className="bg-slate-100 px-1 rounded">eu1.geotab.com</code>).</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Geotab Server</label>
            <input type="text" value={config.server} onChange={e => setConfig({ ...config, server: e.target.value })}
              placeholder="my.geotab.com" className={`${inputCls} font-mono`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Database / Company Name</label>
            <input type="text" value={config.database} onChange={e => setConfig({ ...config, database: e.target.value })}
              placeholder="Your Geotab database name" className={`${inputCls} font-mono`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Username</label>
            <input type="text" value={config.username} onChange={e => setConfig({ ...config, username: e.target.value })}
              placeholder="your@email.com" className={`${inputCls} font-mono`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
            <input type="password" value={config.password} onChange={e => setConfig({ ...config, password: e.target.value })}
              placeholder="••••••••••••" className={`${inputCls} font-mono`} />
          </div>
        </div>
        <label className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
          <input type="checkbox" checked={config.auto_sync_enabled} onChange={e => setConfig({ ...config, auto_sync_enabled: e.target.checked })} className="w-4 h-4 accent-[#2E5A1A]" />
          <div>
            <p className="text-sm font-medium text-slate-700">Auto-sync enabled</p>
            <p className="text-[11px] text-slate-400">Pull live locations from Geotab on a schedule</p>
          </div>
        </label>
        {config.auto_sync_enabled && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Sync Frequency</label>
            <select value={config.sync_frequency} onChange={e => setConfig({ ...config, sync_frequency: e.target.value })} className={inputCls}>
              <option value="5min">Every 5 minutes</option>
              <option value="15min">Every 15 minutes</option>
              <option value="30min">Every 30 minutes</option>
              <option value="hourly">Hourly</option>
              <option value="daily">Daily (every night)</option>
            </select>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-lg text-sm font-bold hover:bg-[#1c4a12] disabled:opacity-50 transition">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Settings
          </button>
          {saved && <span className="text-sm text-[#2E5A1A] font-medium flex items-center gap-1"><Check className="w-4 h-4" /> Saved</span>}
        </div>
      </div>

      {/* Manual sync */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <MapPin className="w-4 h-4 text-[#2E5A1A]" />
          <h3 className="text-sm font-bold text-slate-800">Pull Live Locations Now</h3>
          <span className="ml-auto text-xs text-slate-400">Fetch current GPS positions from all vehicles</span>
        </div>
        <p className="text-xs text-slate-500 mb-3">Fetches the current location, speed, ignition status and odometer for every vehicle in your Geotab account and stores them as location logs. Vehicles are matched to your local records by registration number. View the results on the Vehicles page → Live Map.</p>
        <button onClick={handleSync} disabled={!connected || syncing}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-lg text-sm font-bold hover:bg-[#1c4a12] disabled:opacity-40 transition">
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Satellite className="w-4 h-4" />} Sync Locations Now
        </button>
        {!connected && <p className="text-[11px] text-amber-600 mt-2 text-center">Save your Geotab credentials first to enable location sync.</p>}
        {syncResult && (
          <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${syncResult.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            <p className="flex items-start gap-2"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {syncResult.msg}</p>
            {syncResult.ok && syncResult.total > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                <div className="bg-white/60 rounded p-1.5"><p className="text-[9px] uppercase text-slate-500">Total</p><p className="font-bold text-slate-700 tabular-nums">{syncResult.total}</p></div>
                <div className="bg-white/60 rounded p-1.5"><p className="text-[9px] uppercase text-slate-500">Synced</p><p className="font-bold text-emerald-700 tabular-nums">{syncResult.synced}</p></div>
                <div className="bg-white/60 rounded p-1.5"><p className="text-[9px] uppercase text-slate-500">Unmatched</p><p className="font-bold text-amber-700 tabular-nums">{syncResult.unmatched}</p></div>
              </div>
            )}
          </div>
        )}
        {(config.last_sync_at || config.last_sync_status) && (
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 mt-3">
            <p className="text-xs font-semibold text-slate-600 mb-1">Last sync</p>
            <p className="text-xs text-slate-500">{config.last_sync_summary || 'No summary'}</p>
            {config.last_sync_at && <p className="text-[11px] text-slate-400 mt-1">{new Date(config.last_sync_at).toLocaleString('en-GB')}</p>}
          </div>
        )}
      </div>
    </div>
  );
}