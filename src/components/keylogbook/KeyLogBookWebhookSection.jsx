import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { CANONICAL_APP_BASE_URL } from '@/utils/appBaseUrl';
import { useToast } from '@/components/ui/use-toast';
import {
  Webhook, KeyRound, Link2, ToggleLeft, ToggleRight, Activity,
  CheckCircle2, AlertCircle, Loader2, Copy, RefreshCw, Power, ServerCog,
} from 'lucide-react';
import KeyLogBookSyncButton from './KeyLogBookSyncButton';

export default function KeyLogBookWebhookSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [secret, setSecret] = useState('');
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [autoTs, setAutoTs] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
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
      setSecret(config.webhook_secret || '');
      setApiBaseUrl(config.api_base_url || '');
      setApiKey(config.api_key || '');
      setAutoTs(config.auto_generate_timesheets !== false);
      setEnabled(!!config.enabled);
    }
  }, [config]);

  // Build the webhook URL from the app base URL
  const appBaseUrl = CANONICAL_APP_BASE_URL;
  const webhookUrl = appBaseUrl
    ? `${appBaseUrl.replace(/\/$/, '')}/functions/receiveKeyLogBookData`
    : '';

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        webhook_secret: secret.trim(),
        api_base_url: apiBaseUrl.trim(),
        api_key: apiKey.trim(),
        auto_generate_timesheets: autoTs,
        enabled,
      };
      if (config?.id) {
        await base44.entities.KeyLogBookConfig.update(config.id, payload);
      } else {
        await base44.entities.KeyLogBookConfig.create({ key: 'global', ...payload });
      }
      queryClient.invalidateQueries({ queryKey: ['keylogbook-config'] });
      toast({ title: 'KeyLogBook settings saved', description: 'Webhook configuration updated.' });
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleCopy = () => {
    if (!webhookUrl) return;
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusConfig = {
    success: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Success' },
    failed: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Failed' },
    never: { icon: Activity, color: 'text-slate-400', bg: 'bg-slate-50', label: 'No webhooks yet' },
  };
  const lastStatus = config?.last_webhook_status || 'never';
  const StatusIcon = statusConfig[lastStatus].icon;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0">
          <Webhook className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-900">Real-Time Sync (Webhook)</h3>
          <p className="text-xs text-slate-500">
            KeyLogBook pushes completed borehole logs here automatically — no manual file uploads needed.
          </p>
        </div>
      </div>

      {/* Enable toggle */}
      <div className="flex items-center justify-between gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100">
        <div className="flex items-center gap-2.5 min-w-0">
          <Power className="w-4 h-4 text-slate-500 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">Enable real-time sync</p>
            <p className="text-xs text-slate-500">Master switch — incoming webhooks are rejected when off.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEnabled(!enabled)}
          className={`flex-shrink-0 transition ${enabled ? 'text-[#2E5A1A]' : 'text-slate-300'}`}
        >
          {enabled ? <ToggleRight className="w-10 h-10" /> : <ToggleLeft className="w-10 h-10" />}
        </button>
      </div>

      {/* Webhook URL */}
      <div>
        <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
          <Link2 className="w-4 h-4 text-slate-400" /> Webhook endpoint URL
        </label>
        <p className="text-xs text-slate-500 mb-2">
          Paste this URL into your KeyLogBook webhook configuration. It receives POST requests with your borehole log data.
        </p>
        {webhookUrl ? (
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2.5 bg-slate-900 text-emerald-300 rounded-lg text-xs font-mono break-all">
              {webhookUrl}
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
              Set your app's public base URL in <strong>Settings → Global Branding</strong> to generate the webhook URL automatically.
              You can also find this endpoint URL in the dashboard under Code → Functions → <code>receiveKeyLogBookData</code>.
            </p>
          </div>
        )}
      </div>

      {/* Webhook secret */}
      <div>
        <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
          <KeyRound className="w-4 h-4 text-slate-400" /> Webhook secret
        </label>
        <p className="text-xs text-slate-500 mb-2">
          A shared secret that KeyLogBook sends with each payload to authenticate it. Enter the same value in your KeyLogBook webhook settings
          (sent as the <code className="text-slate-600">x-klb-signature</code> header or <code className="text-slate-600">?secret=</code> query param).
        </p>
        <input
          type="text"
          value={secret}
          onChange={e => setSecret(e.target.value)}
          placeholder="e.g. klb_webhook_s3cr3t_2026"
          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:border-emerald-600 bg-white"
        />
      </div>

      {/* Auto-generate timesheets toggle */}
      <div className="flex items-center justify-between gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100">
        <div className="flex items-center gap-2.5 min-w-0">
          <ServerCog className="w-4 h-4 text-slate-500 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">Auto-generate crew timesheets</p>
            <p className="text-xs text-slate-500">
              Creates draft timesheets for the lead driller &amp; second man from the day's rota. They review and submit at end of shift.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setAutoTs(!autoTs)}
          className={`flex-shrink-0 transition ${autoTs ? 'text-[#2E5A1A]' : 'text-slate-300'}`}
        >
          {autoTs ? <ToggleRight className="w-10 h-10" /> : <ToggleLeft className="w-10 h-10" />}
        </button>
      </div>

      {/* API details (future pull sync) */}
      <details className="group">
        <summary className="text-sm font-semibold text-slate-700 cursor-pointer hover:text-slate-900 flex items-center gap-1.5 select-none">
          <RefreshCw className="w-4 h-4 text-slate-400 group-open:rotate-180 transition" />
          KeyLogBook API details (optional — for future pull sync)
        </summary>
        <div className="mt-3 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">API base URL</label>
            <input
              type="text"
              value={apiBaseUrl}
              onChange={e => setApiBaseUrl(e.target.value)}
              placeholder="https://api.keylogbook.com/v1"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-600 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">API key / bearer token</label>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="klb_api_key_..."
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:border-emerald-600 bg-white"
            />
          </div>
          <p className="text-xs text-slate-400">
            These are stored for future pull-based synchronisation. The webhook flow works without them.
          </p>
        </div>
      </details>

      {/* Last sync status */}
      {config?.last_webhook_at && (
        <div className={`flex items-start gap-2.5 p-3.5 rounded-xl border ${statusConfig[lastStatus].bg} border-slate-100`}>
          <StatusIcon className={`w-4 h-4 ${statusConfig[lastStatus].color} flex-shrink-0 mt-0.5`} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">
              Last webhook: {statusConfig[lastStatus].label}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {new Date(config.last_webhook_at).toLocaleString('en-GB')}
            </p>
            {config.last_webhook_summary && (
              <p className="text-xs text-slate-600 mt-1">{config.last_webhook_summary}</p>
            )}
          </div>
        </div>
      )}

      {/* Manual test sync */}
      <div className="border-t border-slate-100 pt-4">
        <div className="flex items-center gap-2 mb-3">
          <RefreshCw className="w-4 h-4 text-[#2E5A1A]" />
          <h4 className="text-sm font-bold text-slate-900">Test Sync</h4>
        </div>
        <KeyLogBookSyncButton config={config} />
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving || isLoading}
        className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-[#2E5A1A] text-white rounded-lg text-sm font-semibold hover:bg-[#1c4a12] disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
        {saving ? 'Saving…' : 'Save KeyLogBook Settings'}
      </button>
    </div>
  );
}