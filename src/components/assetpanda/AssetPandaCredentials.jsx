import React, { useState } from 'react';
import { KeyRound, Eye, EyeOff, Save, RefreshCw, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 text-sm";

export default function AssetPandaCredentials({ form, setForm, config, onSave, saving }) {
  const { toast } = useToast();
  const [showSecrets, setShowSecrets] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { ok, message }

  const handleTest = async () => {
    // Persist the current form first so the backend reads the latest token.
    setTestResult(null);
    setTesting(true);
    try {
      if (form.api_token) {
        const payload = { key: 'global', ...form };
        if (config?.id) {
          await base44.entities.AssetPandaConfig.update(config.id, payload);
        } else {
          await base44.entities.AssetPandaConfig.create(payload);
        }
      }
      const res = await base44.functions.invoke('testAssetPandaConnection', {});
      const data = res?.data || res;
      setTestResult({ ok: !!data?.ok, message: data?.message || (data?.ok ? 'Connected' : 'Failed') });
      toast({
        title: data?.ok ? 'Connection verified' : 'Connection failed',
        description: data?.message,
        variant: data?.ok ? 'default' : 'destructive',
      });
    } catch (err) {
      setTestResult({ ok: false, message: err?.message || 'Test failed' });
      toast({ title: 'Test failed', description: err?.message, variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-blue-600" />
        <h3 className="text-sm font-semibold text-slate-900">API Connection</h3>
        <button type="button" onClick={() => setShowSecrets(s => !s)} className="ml-auto inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
          {showSecrets ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />} {showSecrets ? 'Hide' : 'Show'} token
        </button>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Base URL</label>
          <input value={form.base_url} onChange={e => setForm({ ...form, base_url: e.target.value })} className={inputCls} placeholder="https://api.assetpanda.com" />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">API Token <span className="text-red-500">*</span></label>
          <input type={showSecrets ? 'text' : 'password'} value={form.api_token} onChange={e => setForm({ ...form, api_token: e.target.value })} className={`${inputCls} font-mono`} placeholder="Paste your Asset Panda API token" />
          <p className="text-[11px] text-slate-400 mt-1">Get this from Asset Panda → Settings → API Configuration. This is the only credential needed — email/password is no longer required.</p>
        </div>

        {testResult && (
          <div className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs ${testResult.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {testResult.ok ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
            <span>{testResult.message}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <button onClick={onSave} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm font-semibold hover:bg-emerald-800 transition disabled:opacity-50">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save token
          </button>
          <button onClick={handleTest} disabled={testing || !form.api_token}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50 border border-slate-300 text-slate-700 hover:bg-slate-50">
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {testing ? 'Testing…' : 'Test Connection'}
          </button>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer border-t border-slate-100 pt-3">
          <input type="checkbox" checked={form.auto_deactivate} onChange={e => setForm({ ...form, auto_deactivate: e.target.checked })} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
          Auto-deactivate assets reported as out of stock or needing service
        </label>
      </div>
    </div>
  );
}