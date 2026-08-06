import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Search, Loader2, Save, Check, AlertTriangle, RefreshCw, Link2, Link2Off,
  Settings2, KeyRound, ShieldCheck, Receipt, History, Palette,
  Gauge, Database,
} from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import { useToast } from '@/components/ui/use-toast';

const inputCls = "w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-600/10";

const DEFAULT_CONFIG = {
  api_key: '',
  mot_history_api_key: '',
  use_test_environment: false,
  last_sync_at: null,
  last_sync_status: null,
  last_sync_summary: '',
};

// What DVLA provides (Geotab handles make, model, year, fuel type, vehicle type)
const DVLA_CAPABILITIES = [
  { icon: ShieldCheck, label: 'MOT Status & Expiry', color: 'text-emerald-600 bg-emerald-50' },
  { icon: Receipt, label: 'Tax (VED) Status & Due Date', color: 'text-teal-600 bg-teal-50' },
  { icon: Palette, label: 'Colour', color: 'text-pink-600 bg-pink-50' },
  { icon: Gauge, label: 'Engine Capacity & CO₂', color: 'text-indigo-600 bg-indigo-50' },
  { icon: History, label: 'MOT Test History', color: 'text-rose-600 bg-rose-50' },
];

export default function DvlaSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(null);
  const [syncResult, setSyncResult] = useState(null);
  const [showKey, setShowKey] = useState(false);

  const { data: settingsRec } = useQuery({
    queryKey: ['dvla-ves-config'],
    queryFn: () => base44.entities.AppSetting.filter({ key: 'dvla_ves_config' }, '-created_date', 5),
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
      const payload = { key: 'dvla_ves_config', label: 'DVLA Vehicle Data API Configuration', value: config };
      if (configId) await base44.entities.AppSetting.update(configId, payload);
      else await base44.entities.AppSetting.create(payload);
      queryClient.invalidateQueries({ queryKey: ['dvla-ves-config'] });
      queryClient.invalidateQueries({ queryKey: ['all-integration-configs'] });
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
      const res = await base44.functions.invoke('syncVehicleSpecs', {
        vehicle_id: null,
        geotab_only: false,
        batch_size: 1,
        include_mot_history: true,
      });
      const d = res.data || res;
      if (d.error && !d.ok) {
        setTestResult({ ok: false, msg: d.error });
      } else {
        const first = d.results?.[0] || d.result;
        setTestResult({
          ok: true,
          msg: first?.notFound
            ? `Connection OK — reg "${first.reg}" not found (expected for test plates)`
            : `Connection OK — looked up "${first?.reg}"${first?.motTests ? ` · ${first.motTests} MOT tests recorded` : ''}`,
        });
      }
    } catch (e) {
      setTestResult({ ok: false, msg: e.message || 'Connection test failed' });
    }
    setTesting(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    setSyncProgress(null);
    try {
      let offset = 0;
      let total = 0;
      let processed = 0;
      let failures = 0;
      let motTestsTotal = 0;
      let remaining = 1;
      while (remaining > 0) {
        const res = await base44.functions.invoke('syncVehicleSpecs', {
          offset,
          batch_size: 3,
          geotab_only: false,
          include_mot_history: true,
        });
        const d = res.data || res;
        if (!d.ok) throw new Error(d.error || 'Sync failed');
        offset = d.offset;
        remaining = d.remaining;
        total = d.total;
        processed += d.processed;
        failures += d.results?.filter(r => !r.ok).length || 0;
        motTestsTotal += d.results?.reduce((sum, r) => sum + (r.motTests || 0), 0) || 0;
        setSyncProgress({ processed, total, motTests: motTestsTotal });
      }
      const summary = `${total} vehicles processed · ${motTestsTotal} MOT tests recorded${failures > 0 ? ` · ${failures} failed` : ''}`;
      setSyncResult({
        ok: true,
        msg: `Sync complete — ${total} vehicles updated${motTestsTotal > 0 ? ` · ${motTestsTotal} MOT tests imported` : ''}${failures > 0 ? ` · ${failures} failed` : ''}`,
        total, failures, motTests: motTestsTotal,
      });
      const updatedConfig = {
        ...config,
        last_sync_at: new Date().toISOString(),
        last_sync_status: failures > 0 ? 'partial' : 'success',
        last_sync_summary: summary,
      };
      setConfig(updatedConfig);
      const payload = { key: 'dvla_ves_config', label: 'DVLA Vehicle Data API Configuration', value: updatedConfig };
      if (configId) await base44.entities.AppSetting.update(configId, payload);
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['dvla-ves-config'] });
    } catch (e) {
      setSyncResult({ ok: false, msg: e.message || 'Sync failed' });
    }
    setSyncing(false);
    setSyncProgress(null);
  };

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        icon={Search}
        title="DVLA Vehicle Data API"
        description="Pulls MOT status, tax status, colour, emissions and MOT test history by registration plate. Vehicle specs (make, model, year, fuel type) come from Geotab."
      />

      {/* Connection status — colourful hero banner */}
      <div className={`rounded-2xl border p-5 overflow-hidden relative ${connected ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200' : 'bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200'}`}>
        <div className="flex items-center gap-4 relative z-10">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md ${connected ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-slate-400 to-slate-500'}`}>
            {connected ? <Link2 className="w-7 h-7 text-white" /> : <Link2Off className="w-7 h-7 text-white" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-slate-900">
              {connected ? 'Connected & Ready' : 'Not Connected'}
            </p>
            <p className="text-sm text-slate-600 mt-0.5">
              {connected
                ? 'DVLA Vehicle Enquiry Service — MOT, tax and compliance data for every vehicle.'
                : 'Enter your DVLA VES API key below to enable MOT and tax lookups by registration plate.'}
            </p>
          </div>
          <button onClick={handleTest} disabled={testing || !connected}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50 shadow-sm flex-shrink-0">
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Test
          </button>
        </div>
        {testResult && (
          <div className={`mt-4 flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm ${testResult.ok ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'}`}>
            {testResult.ok ? <Check className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
            <p>{testResult.msg}</p>
          </div>
        )}
      </div>

      {/* What gets pulled — colourful capability cards */}
      <div className="bg-white border border-violet-200 rounded-2xl p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">What DVLA Syncs</h3>
            <p className="text-xs text-slate-500">MOT, tax and compliance data pulled live by registration plate</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {DVLA_CAPABILITIES.map(cap => {
            const Icon = cap.icon;
            return (
              <div key={cap.label} className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${cap.color}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-medium text-slate-700">{cap.label}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-100">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-emerald-100">
            <Database className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <p className="text-xs text-emerald-700">
            <strong>Make, model, year, fuel type and vehicle type</strong> are pulled from Geotab during the Geotab fleet sync — no API key needed for those.
          </p>
        </div>
      </div>

      {/* API credentials */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-5">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-violet-600" />
          <h3 className="text-sm font-bold text-slate-800">DVLA API Configuration</h3>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-700">
          ⚠ DVLA is currently not accepting new VES API registrations while they upgrade their systems. If you already have keys, enter them below.
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-violet-500" /> DVLA VES API Key
            {config.api_key && <Check className="w-3.5 h-3.5 text-emerald-500" />}
          </label>
          <div className="relative">
            <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input type={showKey ? 'text' : 'password'} value={config.api_key} onChange={e => setConfig({ ...config, api_key: e.target.value })}
              placeholder="Your DVLA-issued VES x-api-key" className={`${inputCls} pl-9 pr-16 font-mono`} />
            <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 rounded text-xs font-medium">
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> DVLA MOT History API Key <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <p className="text-[11px] text-slate-400 mb-2">Separate key for full MOT test history and first used dates. VES alone doesn't return MOT history.</p>
          <div className="relative">
            <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input type={showKey ? 'text' : 'password'} value={config.mot_history_api_key} onChange={e => setConfig({ ...config, mot_history_api_key: e.target.value })}
              placeholder="Your DVLA-issued MOT History x-api-key" className={`${inputCls} pl-9 font-mono`} />
          </div>
        </div>

        <label className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
          <input type="checkbox" checked={config.use_test_environment} onChange={e => setConfig({ ...config, use_test_environment: e.target.checked })} className="w-4 h-4 accent-violet-600" />
          <div>
            <p className="text-sm font-medium text-slate-700">Use DVLA test environment (UAT)</p>
            <p className="text-[11px] text-slate-400">Tick this only while testing with DVLA's predefined mock registration numbers.</p>
          </div>
        </label>

        <div className="flex items-center gap-2">
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl text-sm font-bold hover:from-violet-700 hover:to-purple-700 disabled:opacity-50 transition shadow-sm">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Settings
          </button>
          {saved && <span className="text-sm text-emerald-600 font-medium flex items-center gap-1"><Check className="w-4 h-4" /> Saved</span>}
        </div>
      </div>

      {/* Manual sync — colourful CTA */}
      <div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200 rounded-2xl p-5">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
            <Search className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Sync All Vehicles</h3>
            <p className="text-xs text-slate-500">Looks up every vehicle by registration plate and updates MOT, tax, colour and emissions</p>
          </div>
        </div>
        <p className="text-xs text-slate-600 mb-4">
          Queries the DVLA VES API for each vehicle's registration and updates MOT status, tax status, colour, engine capacity, CO₂ emissions and MOT test history. Vehicles not found are skipped.
        </p>
        <button onClick={handleSync} disabled={!connected || syncing}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl text-sm font-bold hover:from-violet-700 hover:to-purple-700 disabled:opacity-40 transition shadow-sm">
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {syncing ? (syncProgress ? `Syncing… ${syncProgress.processed}/${syncProgress.total}` : 'Syncing…') : 'Sync All Vehicles'}
        </button>
        {!connected && <p className="text-[11px] text-amber-600 mt-2 text-center font-medium">Save your DVLA API key first to enable sync.</p>}
        {syncing && syncProgress && (
          <div className="mt-3">
            <div className="h-2 bg-violet-100 rounded-full overflow-hidden">
              <div className="h-full bg-violet-500 rounded-full transition-all duration-300"
                style={{ width: syncProgress.total > 0 ? `${(syncProgress.processed / syncProgress.total) * 100}%` : '0%' }} />
            </div>
            {syncProgress.motTests > 0 && <p className="text-[11px] text-violet-600 mt-1.5 text-center font-medium">{syncProgress.motTests} MOT tests imported so far…</p>}
          </div>
        )}
        {syncResult && (
          <div className={`mt-3 rounded-xl px-4 py-3 text-sm ${syncResult.ok ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-rose-100 text-rose-800 border border-rose-200'}`}>
            <p className="flex items-start gap-2">{syncResult.ok ? <Check className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />} {syncResult.msg}</p>
          </div>
        )}
        {(config.last_sync_at || config.last_sync_status) && (
          <div className="bg-white/70 rounded-xl p-3.5 border border-violet-200 mt-3">
            <p className="text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1.5"><History className="w-3.5 h-3.5" /> Last sync</p>
            <p className="text-xs text-slate-600">{config.last_sync_summary || 'No summary'}</p>
            {config.last_sync_at && <p className="text-[11px] text-slate-400 mt-1">{new Date(config.last_sync_at).toLocaleString('en-GB')}</p>}
          </div>
        )}
      </div>
    </div>
  );
}