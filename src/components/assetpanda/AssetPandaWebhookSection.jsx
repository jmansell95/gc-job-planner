import React, { useState } from 'react';
import { Webhook, Copy, RefreshCw, KeyRound, Check, ExternalLink } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { buildWebhookUrl } from '@/utils/appBaseUrl';

export default function AssetPandaWebhookSection({ form, setForm, config, onSave, saving }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState('');

  const secret = form.webhook_secret || '';
  const webhookUrl = secret ? `${buildWebhookUrl('/functions/assetPandaWebhook')}?secret=${secret}` : '';

  const generateSecret = () => {
    const s =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    setForm({ ...form, webhook_secret: s });
    toast({ title: 'New webhook secret generated', description: 'Click Save to keep it.' });
  };

  const copy = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 1500);
    toast({ title: `${label} copied` });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <Webhook className="w-4 h-4 text-blue-600" />
        <h3 className="text-sm font-semibold text-slate-900">Flow Webhook</h3>
        <span className="text-[11px] text-slate-400 hidden sm:inline">— trigger actions here from Asset Panda flows</span>
      </div>

      <div className="p-4 space-y-4">
        <p className="text-xs text-slate-500">
          Asset Panda flows can fire webhooks when an asset's status changes. Paste the URL below into your Asset Panda
          flow's webhook action — this system will automatically update the matching asset (stock level, compliance,
          activation) and log an audit entry visible on the Assets Hub.
        </p>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Webhook Secret</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono bg-slate-50 truncate">
              {secret || <span className="text-slate-400 not-italic">No secret set — generate one below</span>}
            </div>
            <button
              onClick={generateSecret}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200 transition flex-shrink-0"
            >
              <KeyRound className="w-4 h-4" /> Generate
            </button>
            {secret && (
              <button
                onClick={() => copy(secret, 'Secret')}
                className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition flex-shrink-0"
                aria-label="Copy secret"
              >
                {copied === 'Secret' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Webhook URL (paste into Asset Panda flow)</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono bg-slate-50 truncate">
              {webhookUrl || <span className="text-slate-400 not-italic">Generate a secret first</span>}
            </div>
            {webhookUrl && (
              <button
                onClick={() => copy(webhookUrl, 'URL')}
                className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition flex-shrink-0"
                aria-label="Copy webhook URL"
              >
                {copied === 'URL' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>

        <button
          onClick={onSave}
          disabled={saving || !secret}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm font-semibold hover:bg-emerald-800 transition disabled:opacity-50"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save
        </button>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 space-y-1">
          <p className="font-semibold flex items-center gap-1.5">
            <ExternalLink className="w-3.5 h-3.5" /> Setup in Asset Panda
          </p>
          <p>1. In Asset Panda, open your group and create or edit a Flow.</p>
          <p>2. Add a <strong>Webhook</strong> action step to the flow.</p>
          <p>3. Paste the Webhook URL above into the URL field.</p>
          <p>4. Save and activate the flow. When it fires, the matching asset here updates automatically.</p>
        </div>
      </div>
    </div>
  );
}