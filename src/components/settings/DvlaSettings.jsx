import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Search, Loader2, Save, Check, AlertTriangle, RefreshCw, Link2, Link2Off,
  Settings2, ExternalLink, KeyRound, FlaskConical, Car, FileText, BadgeCheck,
  Gauge, Fuel, Palette, Calendar, ShieldCheck, Receipt, History, Zap, Sparkles,
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

// What the VES API returns (current vehicle details)
const VES_CAPABILITIES = [
  { icon: Car, label: 'Make', color: 'text-violet-600 bg-violet-50' },
  { icon: Calendar, label: 'Year of Manufacture', color: 'text-blue-600 bg-blue-50' },
  { icon: Fuel, label: 'Fuel Type', color: 'text-amber-600 bg-amber-50' },
  { icon: Palette, label: 'Colour', color: 'text-pink-600 bg-pink-50' },
  { icon: ShieldCheck, label: 'MOT Status & Expiry', color: 'text-emerald-600 bg-emerald-50' },
  { icon: Receipt, label: 'Tax (VED) Status & Due Date', color: 'text-teal-600 bg-teal-50' },
  { icon: Gauge, label: 'Engine Capacity (cc)', color: 'text-indigo-600 bg-indigo-50' },
  { icon: Sparkles, label: 'CO₂ Emissions', color: 'text-cyan-600 bg-cyan-50' },
];

// What the MOT History API returns (full test history + model)
const MOT_CAPABILITIES = [
  { icon: Car, label: 'Model Name', color: 'text-violet-600 bg-violet-50' },
  { icon: History, label: 'Full MOT Test History', color: 'text-emerald-600 bg-emerald-50' },
  { icon: BadgeCheck, label: 'Pass / Fail / PRS Results', color: 'text-blue-600 bg-blue-50' },
  { icon: Gauge, label: 'Odometer Readings (miles)', color: 'text-amber-600 bg-amber-50' },
  { icon: FileText, label: 'Advisory & Failure Notes', color: 'text-rose-600 bg-rose-50' },
  { icon: Calendar, label: 'First Used Date', color: 'text-indigo-600 bg-indigo-50' },
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
  const [showVesKey, setShowVesKey] = useState(false);
  const [showMotKey, setShowMotKey] = useState(false);

  const { data: settingsRec } = useQuery({
    queryKey: ['dvla-ves-config'],
    queryFn: () => base44.entities.AppSetting.filter({ key: 'dvla_ves_config' }, '-created_date', 5),
  });

  useEffect(() => {
    if (settingsRec?.[0]?.value) setConfig({ ...DEFAULT_CONFIG, ...settingsRec[0].value });
  }, [settingsRec]);

  const configId = settingsRec?.[0]?.id;
  const vesConnected = !!config.api_key;
  const motConnected = !!config.mot_history_api_key;
  const fullyConnected = vesConnected && motConnected;

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const payload = { key: 'dvla_ves_config', label: 'DVLA Vehicle Enquiry & MOT History Configuration', value: config };
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
        test_mode: config.use_test_environment,
        geotab_only: false,
        batch_size: 1,
        include_mot_history: motConnected,
      });
      const d = res.data || res;
      if (d.error && !d.ok) {
        setTestResult({ ok: false, msg: d.error });
      } else {
        const first = d.results?.[0] || d.result;
        setTestResult({
          ok: true,
          msg: first?.notFound
            ? `Connection OK — reg "${first.reg}" not found in DVLA (expected for test plates)`
            : `Connection OK — looked up "${first?.reg}": ${first?.make || 'unknown'}${first?.model ? ' ' + first.model : ''}${first?.motTests ? ` · ${first.motTests} MOT tests recorded` : ''}`,
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
          test_mode: config.use_test_environment,
          include_mot_history: motConnected,
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
        msg: `DVLA sync complete — ${total} vehicles updated${motTestsTotal > 0 ? ` · ${motTestsTotal} MOT tests imported` : ''}${failures > 0 ? ` · ${failures} failed` : ''}`,
        total, failures, motTests: motTestsTotal,
      });
      const updatedConfig = {
        ...config,
        last_sync_at: new Date().toISOString(),
        last_sync_status: failures > 0 ? 'partial' : 'success',
        last_sync_summary: summary,
      };
      setConfig(updatedConfig);
      const payload = { key: 'dvla_ves_config', label: 'DVLA Vehicle Enquiry & MOT History Configuration', value: updatedConfig };
      if (configId) await base44.entities.AppSetting.update(configId, payload);
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['dvla-ves-config'] });
    } catch (e) {
      setSyncResult({ ok: false, msg: e.message || 'DVLA sync failed' });
    }
    setSyncing(false);
    setSyncProgress(null);
  };

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        icon={Search}
        title="DVLA Vehicle Enquiry & MOT History"
        description="Official DVLA APIs — the authoritative UK source. Enter any vehicle's registration number and the system pulls its full profile: make, model, year, fuel type, colour, MOT status + full test history (pass/fail/advisories), tax status, and emissions."
      />

      {/* Connection status — colourful hero banner */}
      <div className={`rounded-2xl border p-5 overflow-hidden relative ${fullyConnected ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200' : vesConnected ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200' : 'bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200'}`}>
        <div className="flex items-center gap-4 relative z-10">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md ${fullyConnected ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : vesConnected ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-gradient-to-br from-slate-400 to-slate-500'}`}>
            {fullyConnected ? <Link2 className="w-7 h-7 text-white" /> : <Link2Off className="w-7 h-7 text-white" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-slate-900">
              {fullyConnected ? 'Fully Connected' : vesConnected ? 'VES Connected · MOT History Missing' : 'Not Connected'}
            </p>
            <p className="text-sm text-slate-600 mt-0.5">
              {fullyConnected
                ? 'Both DVLA APIs are configured — every vehicle can be fully profiled by registration number.'
                : vesConnected
                  ? 'Vehicle specs are syncing. Add the MOT History API key to also pull full test history and model names.'
                  : 'Enter your DVLA API keys below to enable accurate vehicle lookups by registration plate.'}
            </p>
          </div>
          <button onClick={handleTest} disabled={testing || !vesConnected}
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* VES capabilities */}
        <div className="bg-white border border-violet-200 rounded-2xl p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Vehicle Enquiry Service (VES)</h3>
              <p className="text-xs text-slate-500">Current vehicle details — pulled live by reg plate</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {VES_CAPABILITIES.map(cap => {
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
        </div>

        {/* MOT History capabilities */}
        <div className="bg-white border border-emerald-200 rounded-2xl p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
              <History className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">MOT History Service</h3>
              <p className="text-xs text-slate-500">Full test history + model name — by reg plate</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {MOT_CAPABILITIES.map(cap => {
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
        </div>
      </div>

      {/* API credentials */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-5">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-violet-600" />
          <h3 className="text-sm font-bold text-slate-800">DVLA API Keys</h3>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 text-xs text-slate-600 space-y-1.5">
          <p className="font-semibold text-blue-800 flex items-center gap-1.5"><ExternalLink className="w-3.5 h-3.5" /> How to get your API keys:</p>
          <ol className="list-decimal list-inside space-y-0.5 text-slate-600 ml-1">
            <li>Register at the <a href="https://developer-portal.driver-vehicle-licensing.api.gov.uk/" target="_blank" rel="noopener" className="text-blue-600 underline font-medium">DVLA Developer Portal</a></li>
            <li>Request access to the <strong>Vehicle Enquiry Service</strong> — DVLA issues one <code className="bg-slate-100 px-1 rounded">x-api-key</code></li>
            <li>Request access to the <strong>MOT History Service</strong> — a separate API key is issued for this service</li>
            <li>Paste both keys below and save</li>
          </ol>
          <p className="pt-1.5">Full docs: <a href="https://developer-portal.driver-vehicle-licensing.api.gov.uk/apis/vehicle-enquiry-service/vehicle-enquiry-service-description.html" target="_blank" rel="noopener" className="text-blue-600 underline font-medium">VES Guide</a> · <a href="https://developer-portal.driver-vehicle-licensing.api.gov.uk/apis/mot-history-service/mot-history-service-description.html" target="_blank" rel="noopener" className="text-blue-600 underline font-medium">MOT History Guide</a></p>
          <p className="pt-1 text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5 border border-amber-100">⚠ Note: DVLA is currently not accepting new VES API registrations while they upgrade their systems. If you already have keys, enter them below — the integration is ready for when registrations reopen.</p>
        </div>

        {/* VES API key */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-violet-500" /> DVLA VES API Key
            {vesConnected && <BadgeCheck className="w-3.5 h-3.5 text-emerald-500" />}
          </label>
          <p className="text-[11px] text-slate-400 mb-2">Used for vehicle specs, MOT status, and tax status lookups.</p>
          <div className="relative">
            <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input type={showVesKey ? 'text' : 'password'} value={config.api_key} onChange={e => setConfig({ ...config, api_key: e.target.value })}
              placeholder="Your DVLA-issued VES x-api-key" className={`${inputCls} pl-9 pr-16 font-mono`} />
            <button type="button" onClick={() => setShowVesKey(!showVesKey)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 rounded text-xs font-medium">
              {showVesKey ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {/* MOT History API key */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> DVLA MOT History API Key
            {motConnected && <BadgeCheck className="w-3.5 h-3.5 text-emerald-500" />}
          </label>
          <p className="text-[11px] text-slate-400 mb-2">Used for full MOT test history (pass/fail/advisories) and the model name. Optional but recommended — VES alone doesn't return the model.</p>
          <div className="relative">
            <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input type={showMotKey ? 'text' : 'password'} value={config.mot_history_api_key} onChange={e => setConfig({ ...config, mot_history_api_key: e.target.value })}
              placeholder="Your DVLA-issued MOT History x-api-key" className={`${inputCls} pl-9 pr-16 font-mono`} />
            <button type="button" onClick={() => setShowMotKey(!showMotKey)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 rounded text-xs font-medium">
              {showMotKey ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <label className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
          <input type="checkbox" checked={config.use_test_environment} onChange={e => setConfig({ ...config, use_test_environment: e.target.checked })} className="w-4 h-4 accent-violet-600" />
          <div>
            <p className="text-sm font-medium text-slate-700 flex items-center gap-1.5"><FlaskConical className="w-3.5 h-3.5" /> Use DVLA test environment (UAT)</p>
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
            <h3 className="text-sm font-bold text-slate-900">Sync All Vehicles from DVLA</h3>
            <p className="text-xs text-slate-500">Looks up every vehicle by registration plate and updates its full profile</p>
          </div>
        </div>
        <p className="text-xs text-slate-600 mb-4">
          Queries the official DVLA database for each vehicle's registration and updates make, model, year, fuel type, colour, MOT status + full test history, tax status, and emissions with authoritative data. Vehicles not found in DVLA are skipped.
        </p>
        <button onClick={handleSync} disabled={!vesConnected || syncing}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl text-sm font-bold hover:from-violet-700 hover:to-purple-700 disabled:opacity-40 transition shadow-sm">
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {syncing ? (syncProgress ? `Syncing… ${syncProgress.processed}/${syncProgress.total}` : 'Syncing…') : 'Sync All Vehicles from DVLA'}
        </button>
        {!vesConnected && <p className="text-[11px] text-amber-600 mt-2 text-center font-medium">Save your DVLA VES API key first to enable spec sync.</p>}
        {!motConnected && vesConnected && <p className="text-[11px] text-slate-500 mt-2 text-center">Tip: add the MOT History API key to also pull full test history and model names.</p>}
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