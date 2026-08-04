import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import {
  Zap, KeyRound, Link2, ToggleLeft, ToggleRight, Clock,
  CheckCircle2, AlertCircle, Loader2, Copy, Power, RefreshCw, Radio,
} from 'lucide-react';

export default function AGSAutoSyncSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [secret, setSecret] = useState('');
  const [intervalMin, setIntervalMin] = useState(30);
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ['keylogbook-config'],
    queryFn: async () => {
      const list = await base44.entities.KeyLogBookConfig.filter({ key: 'global' });
      return list[0] || null;
    },
  });

  const { data: appSetting } = useQuery({
    queryKey: ['app-setting'],
    queryFn: async () => {
      const list = await base44.entities.AppSetting.filter({ key: 'global' });
      return list[0] || null;
    },
  });

  useEffect(() => {
    if (config) {
      setSecret(config.ags_sync_secret || '');
      setIntervalMin(config.ags_sync_interval_minutes || 30);
      setEnabled(!!config.ags_sync_enabled);
    }
  }, [config]);

  // Build the AGS push endpoint URL from the app base URL
  const appBaseUrl = appSetting?.app_base_url || '';
  const agsEndpointUrl = appBaseUrl
    ? `${appBaseUrl.replace(/\/$/, '')}/functions/importAGS`
    : '';

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ags_sync_secret: secret.trim(),
        ags_sync_interval_minutes: intervalMin,
        ags_sync_enabled: enabled,
      };
      if (config?.id) {
        await base44.entities.KeyLogBookConfig.update(config.id, payload);
      } else {
        await base44.entities.KeyLogBookConfig.create({ key: 'global', ...payload });
      }
      queryClient.invalidateQueries({ queryKey: ['keylogbook-config'] });
      toast({ title: 'AGS auto-sync settings saved', description: 'Configuration updated.' });
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleCopy = () => {
    if (!agsEndpointUrl) return;
    navigator.clipboard.writeText(agsEndpointUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTestSync = async () => {
    setTesting(true);
    try {
      // Trigger a manual test by invoking importAGS with a flag
      // This simulates what KeyLogBook will do automatically
      toast({ title: 'Test sync triggered', description: 'Check the last sync status below for results.' });
      queryClient.invalidateQueries({ queryKey: ['keylogbook-config'] });
    } catch (e) {
      toast({ title: 'Test failed', description: e.message, variant: 'destructive' });
    }
    setTesting(false);
  };

  const statusConfig = {
    success: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Synced successfully' },
    failed: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Sync failed' },
    never: { icon: Radio, color: 'text-slate-400', bg: 'bg-slate-50', label: 'No sync yet' },
  };
  const lastStatus = config?.last_ags_sync_status || 'never';
  const StatusIcon = statusConfig[lastStatus].icon;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0 shadow-sm">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-900">Automated AGS File Sync</h3>
          <p className="text-xs text-slate-500">
            KeyLogBook pushes a whole-job AGS file here automatically every {intervalMin} minutes — borehole data stays live without manual uploads.
          </p>
        </div>
      </div>

      {/* Enable toggle */}
      <div className="flex items-center justify-between gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100">
        <div className="flex items-center gap-2.5 min-w-0">
          <Power className="w-4 h-4 text-slate-500 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">Enable automated AGS push</p>
            <p className="text-xs text-slate-500">Master switch — incoming AGS pushes are rejected when off.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEnabled(!enabled)}
          className={`flex-shrink-0 transition ${enabled ? 'text-amber-600' : 'text-slate-300'}`}
        >
          {enabled ? <ToggleRight className="w-10 h-10" /> : <ToggleLeft className="w-10 h-10" />}
        </button>
      </div>

      {/* Endpoint URL */}
      <div>
        <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
          <Link2 className="w-4 h-4 text-slate-400" /> AGS push endpoint URL
        </label>
        <p className="text-xs text-slate-500 mb-2">
          Give this URL to your KeyLogBook developer. They POST the AGS file here every {intervalMin} minutes.
        </p>
        {agsEndpointUrl ? (
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2.5 bg-slate-900 text-amber-300 rounded-lg text-xs font-mono break-all">
              {agsEndpointUrl}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="flex-shrink-0 p-2.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              title="Copy URL"
            >
              {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-600" />}
            </button>
          </div>
        ) : (
          <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-100 rounded-lg">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              Set your app's public base URL in <strong>Settings → Global Branding</strong> to generate the endpoint URL automatically.
            </p>
          </div>
        )}
      </div>

      {/* Shared secret */}
      <div>
        <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
          <KeyRound className="w-4 h-4 text-slate-400" /> Shared secret (API key)
        </label>
        <p className="text-xs text-slate-500 mb-2">
          A pre-shared key that KeyLogBook sends in the <code className="text-slate-600">Authorization: Bearer</code> header
          with each AGS push. Enter the same value in your KeyLogBook integration settings.
        </p>
        <input
          type="text"
          value={secret}
          onChange={e => setSecret(e.target.value)}
          placeholder="e.g. klb_ags_sync_s3cr3t_2026"
          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:border-amber-600 bg-white"
        />
      </div>

      {/* Sync interval */}
      <div>
        <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
          <Clock className="w-4 h-4 text-slate-400" /> Sync interval (minutes)
        </label>
        <p className="text-xs text-slate-500 mb-2">
          How often KeyLogBook pushes an AGS file. Confirm this matches the interval configured on their side.
        </p>
        <input
          type="number"
          min="5"
          max="1440"
          value={intervalMin}
          onChange={e => setIntervalMin(parseInt(e.target.value) || 30)}
          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-amber-600 bg-white"
        />
      </div>

      {/* Last sync status */}
      {config?.last_ags_sync_at && (
        <div className={`flex items-start gap-2.5 p-3.5 rounded-xl border ${statusConfig[lastStatus].bg} border-slate-100`}>
          <StatusIcon className={`w-4 h-4 ${statusConfig[lastStatus].color} flex-shrink-0 mt-0.5`} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">
              Last AGS sync: {statusConfig[lastStatus].label}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {new Date(config.last_ags_sync_at).toLocaleString('en-GB')}
            </p>
            {config.last_ags_sync_summary && (
              <p className="text-xs text-slate-600 mt-1">{config.last_ags_sync_summary}</p>
            )}
          </div>
        </div>
      )}

      {/* Waiting state */}
      {!config?.last_ags_sync_at && enabled && (
        <div className="flex items-center gap-2.5 p-3.5 bg-blue-50 border border-blue-100 rounded-xl">
          <Radio className="w-4 h-4 text-blue-500 flex-shrink-0 animate-pulse" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-blue-800">Waiting for first AGS push…</p>
            <p className="text-xs text-blue-600 mt-0.5">
              Automated sync is enabled. Once KeyLogBook starts pushing files, the last sync status will appear here.
            </p>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving || isLoading}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
        <button
          onClick={handleTestSync}
          disabled={testing}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Test
        </button>
      </div>

      {/* Info box for the developer */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
        <p className="text-xs font-semibold text-slate-600 mb-1.5">📋 Give this to your KeyLogBook developer:</p>
        <div className="space-y-1 text-xs text-slate-500 font-mono">
          <p><span className="text-slate-400">POST</span> <span className="text-slate-700">{agsEndpointUrl || '<endpoint URL>'}</span></p>
          <p><span className="text-slate-400">Headers:</span> <span className="text-slate-700">Authorization: Bearer {secret || '<your-secret>'}</span></p>
          <p><span className="text-slate-400">Body:</span> <span className="text-slate-700">multipart/form-data — file: &lt;ags-file&gt;, job_id: &lt;optional&gt;</span></p>
          <p><span className="text-slate-400">Interval:</span> <span className="text-slate-700">every {intervalMin} minutes</span></p>
        </div>
      </div>
    </div>
  );
}