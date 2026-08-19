import React, { useState } from 'react';
import { KeyRound, Eye, EyeOff, Save, RefreshCw } from 'lucide-react';

const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 text-sm";

export default function AssetPandaCredentials({ form, setForm, config, onSave, saving }) {
  const [showSecrets, setShowSecrets] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-blue-600" />
        <h3 className="text-sm font-semibold text-slate-900">API Connection</h3>
        <button type="button" onClick={() => setShowSecrets(s => !s)} className="ml-auto inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
          {showSecrets ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />} {showSecrets ? 'Hide' : 'Show'} secrets
        </button>
      </div>
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Base URL</label>
            <input value={form.base_url} onChange={e => setForm({ ...form, base_url: e.target.value })} className={inputCls} placeholder="https://api.assetpanda.com" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Group ID <span className="text-red-500">*</span></label>
            <input value={form.group_id} onChange={e => setForm({ ...form, group_id: e.target.value })} className={inputCls} placeholder="e.g. 63d775cd232fd50067104c9a" />
            <p className="text-[11px] text-slate-400 mt-1">The Asset Panda group (entity) whose objects are your inventory. Found in Asset Panda under the group's settings.</p>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-3">
          <p className="text-xs font-semibold text-slate-700 mb-2">Authentication — use one of:</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">API Token (recommended)</label>
              <input type={showSecrets ? 'text' : 'password'} value={form.api_token} onChange={e => setForm({ ...form, api_token: e.target.value })} className={`${inputCls} font-mono`} placeholder="Paste your Asset Panda bearer token" />
              <p className="text-[11px] text-slate-400 mt-1">Get this from Asset Panda → Settings → API Configuration.</p>
            </div>
            <div className="text-center text-[11px] text-slate-400">— or —</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inputCls} placeholder="service@yourcompany.com" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
                <input type={showSecrets ? 'text' : 'password'} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className={inputCls} placeholder="Account password" />
              </div>
            </div>
          </div>
        </div>

        {/* Field mapping is now configured visually below — see the Field Mapping section. */}

        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer border-t border-slate-100 pt-3">
          <input type="checkbox" checked={form.auto_deactivate} onChange={e => setForm({ ...form, auto_deactivate: e.target.checked })} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
          Auto-deactivate assets reported as out of stock or needing service
        </label>

        <button onClick={onSave} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm font-semibold hover:bg-emerald-800 transition disabled:opacity-50">
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save credentials
        </button>
      </div>
    </div>
  );
}