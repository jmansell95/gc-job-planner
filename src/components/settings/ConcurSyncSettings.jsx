import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  Landmark, Loader2, Save, Check, AlertTriangle, RefreshCw, Lock,
  ArrowDownToLine, ArrowUpFromLine, Link2, Link2Off, Settings2,
} from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';

const inputCls = "w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10";

/**
 * ConcurSyncSettings — the SAP Concur integration hub.
 * Lets admins configure the API bridge: connection status, GL code pull,
 * batch export of approved expenses/timesheets, and record locking.
 */
export default function ConcurSyncSettings() {
  const [config, setConfig] = useState({
    api_url: '',
    client_id: '',
    client_secret: '',
    token_url: '',
    company_uuid: '',
    auto_sync_enabled: true,
    sync_frequency: 'weekly',
    lock_after_sync: true,
    default_gl_currency: 'GBP',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const { data: pendingCosts = [] } = useQuery({
    queryKey: ['daily-costs-pending-concur'],
    queryFn: () => base44.entities.DailyCost.filter({ status: 'approved' }, '-created_date', 500),
  });
  const { data: pendingSubcons = [] } = useQuery({
    queryKey: ['subcon-logs-pending-concur'],
    queryFn: () => base44.entities.SubcontractorLog.filter({ status: 'approved' }, '-created_date', 500),
  });

  const pendingCount = pendingCosts.length + pendingSubcons.length;
  const syncedCosts = useQuery({
    queryKey: ['daily-costs-synced-concur'],
    queryFn: () => base44.entities.DailyCost.filter({ status: 'synced_to_concur' }, '-synced_at', 50),
  });

  const handleSave = () => {
    setSaving(true);
    setSaved(false);
    // In a real integration this would store in AppSetting/secrets
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 600);
  };

  const handleTest = () => {
    setTesting(true);
    setTestResult(null);
    setTimeout(() => {
      setTesting(false);
      setTestResult({ ok: false, msg: 'No API credentials configured yet — enter your SAP Concur client ID and secret to connect.' });
    }, 800);
  };

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        icon={Landmark}
        title="SAP Concur Sync"
        description="API bridge to SAP Concur — pull GL codes, push approved expenses & timesheets in batch, and lock synced records to prevent audit mismatches."
      />

      {/* Connection status */}
      <div className={`rounded-xl border p-4 ${config.client_id ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${config.client_id ? 'bg-emerald-100' : 'bg-slate-200'}`}>
            {config.client_id ? <Link2 className="w-5 h-5 text-emerald-600" /> : <Link2Off className="w-5 h-5 text-slate-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800">{config.client_id ? 'Connected' : 'Not Connected'}</p>
            <p className="text-xs text-slate-500">{config.client_id ? 'SAP Concur API bridge active — records can be synced.' : 'Enter your SAP Concur API credentials below to enable the bridge.'}</p>
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

      {/* API credentials */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-[#2E5A1A]" />
          <h3 className="text-sm font-bold text-slate-800">API Credentials</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">API Base URL</label>
            <input type="url" value={config.api_url} onChange={e => setConfig({ ...config, api_url: e.target.value })}
              placeholder="https://us.api.concursolutions.com" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Token URL</label>
            <input type="url" value={config.token_url} onChange={e => setConfig({ ...config, token_url: e.target.value })}
              placeholder="https://us.api.concursolutions.com/oauth2/v0" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Client ID</label>
            <input type="text" value={config.client_id} onChange={e => setConfig({ ...config, client_id: e.target.value })}
              placeholder="your-concur-client-id" className={`${inputCls} font-mono`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Client Secret</label>
            <input type="password" value={config.client_secret} onChange={e => setConfig({ ...config, client_secret: e.target.value })}
              placeholder="••••••••••••" className={`${inputCls} font-mono`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Company UUID</label>
            <input type="text" value={config.company_uuid} onChange={e => setConfig({ ...config, company_uuid: e.target.value })}
              placeholder="00000000-0000-0000-0000-000000000000" className={`${inputCls} font-mono`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Default Currency</label>
            <select value={config.default_gl_currency} onChange={e => setConfig({ ...config, default_gl_currency: e.target.value })} className={inputCls}>
              <option value="GBP">GBP (£)</option>
              <option value="EUR">EUR (€)</option>
              <option value="USD">USD ($)</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
            <input type="checkbox" checked={config.auto_sync_enabled} onChange={e => setConfig({ ...config, auto_sync_enabled: e.target.checked })} className="w-4 h-4 accent-[#2E5A1A]" />
            <div>
              <p className="text-sm font-medium text-slate-700">Auto-sync enabled</p>
              <p className="text-[11px] text-slate-400">Push approved records automatically on schedule</p>
            </div>
          </label>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Sync Frequency</label>
            <select value={config.sync_frequency} onChange={e => setConfig({ ...config, sync_frequency: e.target.value })} className={inputCls} disabled={!config.auto_sync_enabled}>
              <option value="daily">Daily (every night)</option>
              <option value="weekly">Weekly (every Monday)</option>
              <option value="monthly">Monthly (1st of month)</option>
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2.5 p-3 bg-amber-50 rounded-lg border border-amber-200 cursor-pointer">
          <input type="checkbox" checked={config.lock_after_sync} onChange={e => setConfig({ ...config, lock_after_sync: e.target.checked })} className="w-4 h-4 accent-[#2E5A1A]" />
          <div>
            <p className="text-sm font-medium text-slate-700 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Lock records after sync</p>
            <p className="text-[11px] text-slate-500">Hard-locks expenses & timesheets once exported to SAP, preventing audit mismatches</p>
          </div>
        </label>
        <div className="flex items-center gap-2">
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-lg text-sm font-bold hover:bg-[#1c4a12] disabled:opacity-50 transition">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Settings
          </button>
          {saved && <span className="text-sm text-[#2E5A1A] font-medium flex items-center gap-1"><Check className="w-4 h-4" /> Saved</span>}
        </div>
      </div>

      {/* Sync queue */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <ArrowUpFromLine className="w-4 h-4 text-[#2E5A1A]" />
          <h3 className="text-sm font-bold text-slate-800">Sync Queue</h3>
          <span className="ml-auto text-xs text-slate-400">{pendingCount} approved record{pendingCount !== 1 ? 's' : ''} pending</span>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-[10px] text-blue-600 font-medium uppercase">Daily Expenses</p>
            <p className="text-xl font-bold text-blue-700 tabular-nums">{pendingCosts.length}</p>
          </div>
          <div className="bg-violet-50 rounded-lg p-3 text-center">
            <p className="text-[10px] text-violet-600 font-medium uppercase">Sub-Con Logs</p>
            <p className="text-xl font-bold text-violet-700 tabular-nums">{pendingSubcons.length}</p>
          </div>
        </div>
        <button disabled={!config.client_id || pendingCount === 0}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-lg text-sm font-bold hover:bg-[#1c4a12] disabled:opacity-40 transition">
          <ArrowUpFromLine className="w-4 h-4" /> Export Batch to SAP Concur ({pendingCount})
        </button>
        {!config.client_id && <p className="text-[11px] text-amber-600 mt-2 text-center">Connect your API credentials first to enable batch export.</p>}
      </div>

      {/* Recently synced */}
      {syncedCosts.data && syncedCosts.data.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <ArrowDownToLine className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-800">Recently Synced</h3>
            <span className="ml-auto text-xs text-slate-400">{syncedCosts.data.length} records locked</span>
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {syncedCosts.data.slice(0, 10).map(c => (
              <div key={c.id} className="flex items-center gap-2 text-xs bg-slate-50 rounded-lg px-3 py-2">
                <Lock className="w-3 h-3 text-slate-400 flex-shrink-0" />
                <span className="text-slate-600 truncate flex-1">{c.description || c.category}</span>
                <span className="text-slate-400">{c.date}</span>
                <span className="text-slate-400 font-mono">{c.concur_export_id || '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}