import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ShieldAlert, Loader2, Save, ExternalLink, CheckCircle2, XCircle, FileWarning } from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';

const ACCENT = '#2E5A1A';

function ScoreBadge({ pct, passFail }) {
  const pass = passFail === 'pass';
  const fail = passFail === 'fail';
  const cls = pass
    ? 'bg-emerald-100 text-emerald-700'
    : fail
      ? 'bg-rose-100 text-rose-700'
      : 'bg-slate-100 text-slate-600';
  return (
    <span className={'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ' + cls}>
      {pass ? <CheckCircle2 className="w-3 h-3" /> : fail ? <XCircle className="w-3 h-3" /> : <FileWarning className="w-3 h-3" />}
      {pct != null ? pct + '%' : passFail || 'pending'}
    </span>
  );
}

export default function SafetyCultureSettings() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ['safetyculture-config'],
    queryFn: async () => {
      const list = await base44.entities.SafetyCultureConfig.filter({ key: 'global' });
      if (list && list[0]) return list[0];
      // Create the singleton if it doesn't exist yet
      const created = await base44.entities.SafetyCultureConfig.create({
        key: 'global', enabled: false, auto_link_to_jobs: true,
        webhook_secret: '', api_token: '', last_webhook_status: 'never',
      });
      return created;
    },
    // Initialise the editable form once the config loads
    onSuccess: (c) => setForm({
      webhook_secret: c.webhook_secret || '',
      api_token: c.api_token || '',
      enabled: !!c.enabled,
      auto_link_to_jobs: c.auto_link_to_jobs !== false,
    }),
  });

  const { data: reports = [] } = useQuery({
    queryKey: ['safety-reports'],
    queryFn: () => base44.entities.SafetyReport.list('-created_date', 50),
  });

  const webhookUrl = (typeof window !== 'undefined' ? window.location.origin : '') + '/api/functions/receiveSafetyCultureData?webhook_secret=' + (form?.webhook_secret ? 'YOUR_SECRET' : 'YOUR_SECRET');

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await base44.entities.SafetyCultureConfig.update(config.id, {
        webhook_secret: form.webhook_secret,
        api_token: form.api_token,
        enabled: form.enabled,
        auto_link_to_jobs: form.auto_link_to_jobs,
      });
      queryClient.invalidateQueries({ queryKey: ['safetyculture-config'] });
    } catch (e) {
      alert('Failed to save: ' + (e.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !form) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  const openReports = reports.filter((r) => r.status === 'open').length;

  return (
    <div className="space-y-6">
      <SettingsSectionHeader
        icon={ShieldAlert}
        title="SafetyCulture (iAuditor) Integration"
        description="Sync site safety audits & inspection forms from SafetyCulture — every audit auto-links to its job and sub-contractor"
      />

      {/* Status banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">Status</p>
          <p className={'text-sm font-bold ' + (form.enabled ? 'text-emerald-600' : 'text-slate-400')}>{form.enabled ? 'Active' : 'Disabled'}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">Audits Stored</p>
          <p className="text-sm font-bold text-slate-800">{reports.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">Open Actions</p>
          <p className="text-sm font-bold text-amber-600">{openReports}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">Last Webhook</p>
          <p className="text-xs font-medium text-slate-600 truncate" title={config?.last_webhook_summary}>
            {config?.last_webhook_status === 'success' ? 'Success' : config?.last_webhook_status === 'failed' ? 'Failed' : 'Never'}
          </p>
        </div>
      </div>

      {/* Config form */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="font-semibold text-slate-900 mb-4">Webhook Configuration</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <input id="sc-enabled" type="checkbox" checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              className="w-4 h-4 rounded accent-emerald-600" />
            <label htmlFor="sc-enabled" className="text-sm font-medium text-slate-700">
              Enable SafetyCulture webhook receiver
            </label>
          </div>
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <input id="sc-autolink" type="checkbox" checked={form.auto_link_to_jobs}
              onChange={(e) => setForm({ ...form, auto_link_to_jobs: e.target.checked })}
              className="w-4 h-4 rounded accent-emerald-600" />
            <label htmlFor="sc-autolink" className="text-sm font-medium text-slate-700">
              Auto-link audits to jobs by site name
            </label>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Webhook Secret *</label>
            <input type="text" value={form.webhook_secret}
              onChange={(e) => setForm({ ...form, webhook_secret: e.target.value })}
              placeholder="Enter a strong secret — set the same in SafetyCulture"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            <p className="text-[11px] text-slate-400 mt-1">SafetyCulture must send this secret as the <code className="px-1 bg-slate-100 rounded">webhook_secret</code> query param or <code className="px-1 bg-slate-100 rounded">x-webhook-secret</code> header.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">API Token (optional)</label>
            <input type="text" value={form.api_token}
              onChange={(e) => setForm({ ...form, api_token: e.target.value })}
              placeholder="For future pull-based sync"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Webhook Endpoint URL</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 break-all">
                {typeof window !== 'undefined' ? window.location.origin : ''}/api/functions/receiveSafetyCultureData
              </code>
              <button onClick={() => {
                navigator.clipboard?.writeText((typeof window !== 'undefined' ? window.location.origin : '') + '/api/functions/receiveSafetyCultureData');
              }} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition" title="Copy URL">
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Add this URL in SafetyCulture → Integrations → Webhooks, and append <code className="px-1 bg-slate-100 rounded">?webhook_secret=YOUR_SECRET</code>.</p>
          </div>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
            style={{ background: ACCENT }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Configuration
          </button>
        </div>
      </div>

      {/* Recent reports */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Recent Safety Audits</h3>
        </div>
        {reports.length === 0 ? (
          <div className="px-5 py-10 text-center text-slate-400 text-sm">
            <ShieldAlert className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            No audits received yet. Configure the webhook in SafetyCulture to start syncing.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-xs">Audit</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs">Auditor</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs">Job / Site</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs">Result</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs">Actions</th>
                  <th className="text-right px-4 py-2.5 font-medium text-xs">Report</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800 text-xs">{r.audit_title || r.audit_template_name || 'Untitled audit'}</p>
                      <p className="text-[10px] text-slate-400">{r.audit_template_name}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{r.auditor_name || '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {r.job_name ? <span className="font-medium text-slate-800">{r.job_name}</span> : r.site_name || '—'}
                    </td>
                    <td className="px-4 py-3"><ScoreBadge pct={r.score_percentage} passFail={r.pass_fail} /></td>
                    <td className="px-4 py-3">
                      {r.action_items && r.action_items.length > 0 ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">{r.action_items.length} open</span>
                      ) : <span className="text-[10px] text-slate-400">None</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.audit_report_url ? (
                        <a href={r.audit_report_url} target="_blank" rel="noreferrer" className="text-emerald-700 hover:underline text-xs">Open PDF</a>
                      ) : <span className="text-[10px] text-slate-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}