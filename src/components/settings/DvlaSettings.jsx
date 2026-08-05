import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Search, Loader2, Save, Check, AlertTriangle, RefreshCw, Link2, Link2Off,
  Settings2, ExternalLink, KeyRound, FlaskConical,
} from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import { useToast } from '@/components/ui/use-toast';

const inputCls = "w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10";

const DEFAULT_CONFIG = {
  api_key: '',
  use_test_environment: false,
  last_sync_at: null,
  last_sync_status: null,
  last_sync_summary: '',
};

export default function DvlaSettings() {
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
      const payload = { key: 'dvla_ves_config', label: 'DVLA Vehicle Enquiry Service Configuration', value: config };
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
      // Use a known DVLA test VRN if in test mode, otherwise test with the first vehicle's reg
      let testReg = 'TE57VRN';
      if (!config.use_test_environment) {
        const vehicles = await base44.entities.Vehicle.list('-created_date', 1);
        if (vehicles?.[0]?.registration_number) testReg = vehicles[0].registration_number;
      }
      const res = await base44.functions.invoke('syncVehicleSpecs', {
        vehicle_id: null,
        test_mode: config.use_test_environment,
        geotab_only: false,
        batch_size: 1,
      });
      const d = res.data || res;
      if (d.error && !d.ok) {
        setTestResult({ ok: false, msg: d.error });
      } else {
        const first = d.results?.[0];
        setTestResult({
          ok: true,
          msg: first?.notFound
            ? `Connection OK — test reg "${first.reg}" not found in DVLA (expected for test plates)`
            : `Connection OK — looked up "${first?.reg}": ${first?.make || 'unknown'} ${first?.updated?.length || 0} fields updated`,
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
    try {
      let offset = 0;
      let total = 0;
      let processed = 0;
      let failures = 0;
      let remaining = 1;
      while (remaining > 0) {
        const res = await base44.functions.invoke('syncVehicleSpecs', {
          offset,
          batch_size: 3,
          geotab_only: false,
          test_mode: config.use_test_environment,
        });
        const d = res.data || res;
        if (!d.ok) throw new Error(d.error || 'Sync failed');
        offset = d.offset;
        remaining = d.remaining;
        total = d.total;
        processed += d.processed;
        failures += d.results?.filter(r => !r.ok).length || 0;
      }
      const summary = `${total} vehicles processed from DVLA${failures > 0 ? ` (${failures} failed)` : ''}`;
      setSyncResult({
        ok: true,
        msg: failures > 0
          ? `DVLA sync complete — ${total} vehicles processed (${failures} failed)`
          : `DVLA sync complete — ${total} vehicles updated`,
        total, failures,
      });
      // Persist last sync status
      const updatedConfig = {
        ...config,
        last_sync_at: new Date().toISOString(),
        last_sync_status: failures > 0 ? 'partial' : 'success',
        last_sync_summary: summary,
      };
      setConfig(updatedConfig);
      const payload = { key: 'dvla_ves_config', label: 'DVLA Vehicle Enquiry Service Configuration', value: updatedConfig };
      if (configId) await base44.entities.AppSetting.update(configId, payload);
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['dvla-ves-config'] });
    } catch (e) {
      setSyncResult({ ok: false, msg: e.message || 'DVLA sync failed' });
    }
    setSyncing(false);
  };

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        icon={Search}
        title="DVLA Vehicle Enquiry Service"
        description="Official DVLA API — the authoritative UK source for vehicle make, fuel type, colour, year of manufacture and MOT expiry by registration plate. Replaces the unreliable AI-based lookup. Note: DVLA does not return model names — those are kept from Geotab or manual entry."
      />

      {/* Connection status */}
      <div className={`rounded-xl border p-4 ${connected ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${connected ? 'bg-emerald-100' : 'bg-slate-200'}`}>
            {connected ? <Link2 className="w-5 h-5 text-emerald-600" /> : <Link2Off className="w-5 h-5 text-slate-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800">{connected ? 'API Key Configured' : 'Not Connected'}</p>
            <p className="text-xs text-slate-500">{connected ? 'DVLA VES API key saved — test the connection or sync now.' : 'Enter your DVLA VES API key below to enable accurate vehicle spec lookups.'}</p>
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
          <h3 className="text-sm font-bold text-slate-800">DVLA VES API Key</h3>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-slate-600 space-y-1.5">
          <p className="font-semibold text-blue-800">How to get an API key:</p>
          <ol className="list-decimal list-inside space-y-0.5 text-slate-600">
            <li>Register at the <a href="https://developer-portal.driver-vehicle-licensing.api.gov.uk/" target="_blank" rel="noopener" className="text-blue-600 underline font-medium">DVLA Developer Portal</a> and request access to the Vehicle Enquiry Service</li>
            <li>DVLA will issue you a single API key (<code className="bg-slate-100 px-1 rounded">x-api-key</code>) — one per company</li>
            <li>Paste it below and save</li>
          </ol>
          <p className="pt-1">Full API docs: <a href="https://developer-portal.driver-vehicle-licensing.api.gov.uk/apis/vehicle-enquiry-service/vehicle-enquiry-service-description.html" target="_blank" rel="noopener" className="text-blue-600 underline font-medium">VES API Guide</a></p>
          <p className="pt-1 text-amber-700 bg-amber-50 rounded px-2 py-1">⚠ Note: DVLA is currently not accepting new VES API registrations while they upgrade their systems. If you already have a key, enter it below — the integration is ready for when registrations reopen.</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">DVLA VES API Key</label>
          <div className="relative">
            <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input type="password" value={config.api_key} onChange={e => setConfig({ ...config, api_key: e.target.value })}
              placeholder="Your DVLA-issued x-api-key" className={`${inputCls} pl-9 font-mono`} />
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Stored securely in the app settings. Only admins can view or change it.</p>
        </div>
        <label className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
          <input type="checkbox" checked={config.use_test_environment} onChange={e => setConfig({ ...config, use_test_environment: e.target.checked })} className="w-4 h-4 accent-[#2E5A1A]" />
          <div>
            <p className="text-sm font-medium text-slate-700 flex items-center gap-1.5"><FlaskConical className="w-3.5 h-3.5" /> Use DVLA test environment (UAT)</p>
            <p className="text-[11px] text-slate-400">Tick this only while testing with DVLA's predefined mock registration numbers.</p>
          </div>
        </label>
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
          <Search className="w-4 h-4 text-[#2E5A1A]" />
          <h3 className="text-sm font-bold text-slate-800">Sync All Vehicle Specs Now</h3>
          <span className="ml-auto text-xs text-slate-400">Look up every vehicle via the DVLA VES API</span>
        </div>
        <p className="text-xs text-slate-500 mb-3">Queries the official DVLA database for each vehicle's registration and updates make, fuel type, colour, year and MOT expiry with authoritative data. Vehicles not found in DVLA are skipped. Model names are preserved (DVLA doesn't provide them).</p>
        <button onClick={handleSync} disabled={!connected || syncing}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-lg text-sm font-bold hover:bg-[#1c4a12] disabled:opacity-40 transition">
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Sync Specs from DVLA
        </button>
        {!connected && <p className="text-[11px] text-amber-600 mt-2 text-center">Save your DVLA API key first to enable spec sync.</p>}
        {syncResult && (
          <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${syncResult.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            <p className="flex items-start gap-2"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {syncResult.msg}</p>
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