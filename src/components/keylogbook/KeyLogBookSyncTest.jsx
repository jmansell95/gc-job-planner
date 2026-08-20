import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CANONICAL_APP_BASE_URL } from '@/utils/appBaseUrl';
import { useToast } from '@/components/ui/use-toast';
import {
  Send, CheckCircle2, AlertCircle, Loader2, Activity, ShieldCheck,
} from 'lucide-react';

/**
 * Test-sync button for the KeyLogBook AGS webhook.
 * Fires a realistic test payload (event_type: hole_updated with a minimal
 * AGS file) to the importAGS endpoint using the configured Bearer token and
 * optional HMAC-SHA256 signing. Reports a detailed success/error breakdown
 * so admins can see at a glance whether the webhook credentials are valid
 * and the pipeline is healthy.
 *
 * Uses event_type 'hole_updated' (not hole_created) and a tiny read-only AGS
 * payload with a fake project reference, so the test never creates a real job
 * or borehole records — it only validates auth and parsing.
 */
export default function KeyLogBookSyncTest({ config }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);

  const webhookUrl = CANONICAL_APP_BASE_URL
    ? `${CANONICAL_APP_BASE_URL.replace(/\/$/, '')}/functions/importAGS`
    : '';

  // Compute HMAC-SHA256 signature in the browser (Web Crypto API)
  const computeSignature = async (secret, message) => {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
    return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const runTest = async () => {
    if (!webhookUrl) {
      setResult({ ok: false, title: 'No webhook URL', detail: 'Set the app public base URL in Settings → Global Branding first.' });
      return;
    }
    if (!config?.ags_sync_enabled) {
      setResult({ ok: false, title: 'Sync is disabled', detail: 'Turn on the "Enable AGS webhook sync" master switch and save before testing.' });
      return;
    }
    if (!config?.ags_sync_secret) {
      setResult({ ok: false, title: 'No Bearer token', detail: 'Generate and save a Bearer token before testing.' });
      return;
    }

    setSyncing(true);
    setResult(null);
    try {
      // Minimal AGS file — a PROJ group with a fake test project, no LOCA/borehole rows.
      // This validates auth + parsing without creating real borehole records.
      const fakeAgs = [
        '"PROJ""PROJ_ID""PROJ_NAME""PROJ_NUM"',
        '"DATA""TEST_SYNC_PING""Test Sync Ping""TESTSYNC-000"',
      ].join('\n');
      const agsBase64 = btoa(fakeAgs);

      const body = {
        event_type: 'hole_updated',
        hole_id: 'TEST_SYNC_PING',
        project_name: 'Test Sync Ping',
        project_number: 'TESTSYNC-000',
        ags_file: agsBase64,
      };
      const bodyStr = JSON.stringify(body);

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.ags_sync_secret}`,
      };

      // If HMAC signing is enabled, compute and attach the signature
      if (config.ags_webhook_signing_enabled && config.ags_webhook_signing_secret) {
        const sig = await computeSignature(config.ags_webhook_signing_secret, bodyStr);
        headers['X-Hole-Signature'] = `sha256=${sig}`;
      }

      const res = await fetch(webhookUrl, { method: 'POST', headers, body: bodyStr });
      const json = await res.json().catch(() => ({}));

      if (res.ok && (json.status === 'success' || json.inserted != null)) {
        setResult({
          ok: true,
          title: 'Sync pipeline healthy',
          detail: json.summary || `Webhook authenticated and processed successfully. ${json.inserted || 0} log entries handled.`,
          raw: json,
        });
        toast({ title: 'KeyLogBook sync OK', description: json.summary || 'Webhook is working.' });
      } else if (res.status === 401) {
        setResult({
          ok: false,
          title: 'Invalid credentials',
          detail: json.error || 'The Bearer token (or HMAC signature) was rejected. Make sure the token saved here matches exactly what KeyLogBook sends.',
          raw: json,
        });
        toast({ title: 'Sync test failed — bad credentials', description: json.error || 'Invalid token', variant: 'destructive' });
      } else if (res.status === 403) {
        setResult({
          ok: false,
          title: 'Sync is disabled',
          detail: json.error || 'The webhook receiver has sync disabled. Turn on the master switch and save.',
          raw: json,
        });
        toast({ title: 'Sync test failed — disabled', description: json.error || 'Sync disabled', variant: 'destructive' });
      } else if (res.status === 422) {
        // Auth passed, but job matching failed — credentials are fine
        setResult({
          ok: true,
          title: 'Credentials valid — no test job matched',
          detail: `${json.error || 'Job not found'} — this is expected for a test ping. The Bearer token${config.ags_webhook_signing_enabled ? ' and HMAC signing' : ''} are working correctly. Real KeyLogBook payloads with a valid project reference will process fully.`,
          raw: json,
        });
        toast({ title: 'Credentials valid', description: 'Auth OK. Test project not matched (expected).' });
      } else {
        setResult({
          ok: false,
          title: json.error || `HTTP ${res.status}`,
          detail: json.details || json.error || 'The webhook rejected the test payload. Check the settings and try again.',
          raw: json,
        });
        toast({ title: 'Sync test failed', description: json.error || `HTTP ${res.status}`, variant: 'destructive' });
      }
    } catch (e) {
      setResult({
        ok: false,
        title: 'Network error',
        detail: `Could not reach the webhook endpoint: ${e.message}. The app may not be published yet, or the base URL is wrong.`,
      });
      toast({ title: 'Sync test failed', description: e.message, variant: 'destructive' });
    } finally {
      setSyncing(false);
      queryClient.invalidateQueries({ queryKey: ['keylogbook-config'] });
    }
  };

  const checks = [
    { label: 'Endpoint URL', ok: !!webhookUrl },
    { label: 'Sync enabled', ok: !!config?.ags_sync_enabled },
    { label: 'Bearer token', ok: !!config?.ags_sync_secret },
    { label: 'HMAC signing', ok: !config?.ags_webhook_signing_enabled || !!config?.ags_webhook_signing_secret },
  ];

  return (
    <div className="space-y-3">
      {/* Pre-flight checklist */}
      <div className="flex flex-wrap gap-2">
        {checks.map((c) => (
          <span
            key={c.label}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold ${
              c.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}
          >
            {c.ok ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
            {c.label}
          </span>
        ))}
      </div>

      {/* Button */}
      <button
        onClick={runTest}
        disabled={syncing}
        className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-white border-2 border-amber-600 text-amber-700 rounded-lg text-sm font-semibold hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {syncing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Testing sync…
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            Test Sync Now
          </>
        )}
      </button>

      {/* Result panel */}
      {result && (
        <div
          className={`flex items-start gap-3 p-4 rounded-xl border ${
            result.ok ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
          } animate-slide-up`}
        >
          {result.ok ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          )}
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-bold ${result.ok ? 'text-emerald-900' : 'text-red-900'}`}>
              {result.title}
            </p>
            <p className={`text-xs mt-1 ${result.ok ? 'text-emerald-700' : 'text-red-700'}`}>
              {result.detail}
            </p>
            {result.raw && (
              <details className="mt-2">
                <summary className="text-xs font-medium text-slate-500 cursor-pointer hover:text-slate-700">
                  Raw response
                </summary>
                <pre className="mt-1.5 p-2 bg-slate-900 text-slate-200 rounded-lg text-[10px] font-mono overflow-x-auto max-h-40">
                  {JSON.stringify(result.raw, null, 2)}
                </pre>
              </details>
            )}
          </div>
        </div>
      )}

      {/* Help text */}
      <div className="flex items-start gap-2 text-xs text-slate-500">
        <Activity className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <span>
          Sends a test <code className="text-slate-600">hole_updated</code> event to your webhook
          with the saved Bearer token{config?.ags_webhook_signing_enabled ? ' and HMAC signature' : ''}.
          Verifies the endpoint is reachable, credentials are accepted, and the AGS parser runs —
          without creating real borehole records.
        </span>
      </div>
    </div>
  );
}