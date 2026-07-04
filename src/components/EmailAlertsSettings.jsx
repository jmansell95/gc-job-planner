import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Mail, Save, Send, Loader2, Truck, UserCheck, Clock } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const ALERT_META = {
  vehicle_maintenance: {
    title: 'Vehicle Maintenance Alert',
    desc: 'Emails admins about upcoming or overdue vehicle MOT and service dates.',
    schedule: 'Runs automatically every Monday at 7:00 AM',
    icon: Truck,
    showThreshold: true,
    showRecipients: true,
  },
  assignment_notification: {
    title: 'Job Assignment Notification',
    desc: 'Emails a staff member when they are assigned to a job on the rota.',
    schedule: 'Runs automatically when a rota assignment is created',
    icon: UserCheck,
    showThreshold: false,
    showRecipients: false,
  },
};

export default function EmailAlertsSettings() {
  const { toast } = useToast();
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [testing, setTesting] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('manageEmailAlerts', { action: 'get' });
      const list = res.data?.settings || [];
      const d = {};
      list.forEach((s) => { d[s.alert_key] = { ...s }; });
      setDrafts(d);
    } catch (e) {
      toast({ title: 'Error loading alerts', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const updateDraft = (key, field, value) => {
    setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const handleSave = async (key) => {
    setSaving(key);
    try {
      await base44.functions.invoke('manageEmailAlerts', { action: 'save', ...drafts[key] });
      toast({ title: 'Alert saved' });
      await load();
    } catch (e) {
      toast({ title: 'Error saving', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  const handleTest = async (key) => {
    setTesting(key);
    try {
      const res = await base44.functions.invoke('manageEmailAlerts', { action: 'test', alert_key: key });
      const count = res.data?.recipients?.length || 0;
      toast({ title: 'Test email sent', description: `Sent to ${count} recipient${count === 1 ? '' : 's'}.` });
    } catch (e) {
      toast({ title: 'Error sending test', description: e.message, variant: 'destructive' });
    } finally {
      setTesting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
        <Mail className="w-5 h-5 text-emerald-700 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-emerald-900">Automated email alerts</p>
          <p className="text-xs text-emerald-700 mt-0.5">Control who gets notified, when, and what the emails say. Changes apply to the next automated run.</p>
        </div>
      </div>

      {Object.entries(ALERT_META).map(([key, meta]) => {
        const draft = drafts[key] || { alert_key: key, enabled: true };
        const Icon = meta.icon;
        const isEnabled = draft.enabled !== false;
        return (
          <div key={key} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-2.5 bg-emerald-50 rounded-lg flex-shrink-0">
                    <Icon className="w-5 h-5 text-emerald-700" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900">{meta.title}</h3>
                    <p className="text-sm text-slate-500 mt-0.5">{meta.desc}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => updateDraft(key, 'enabled', !isEnabled)}
                  className="relative inline-flex items-center cursor-pointer flex-shrink-0"
                  aria-label="Toggle alert"
                >
                  <input type="checkbox" checked={isEnabled} readOnly className="sr-only peer" />
                  <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-emerald-600 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-transform peer-checked:after:translate-x-5" />
                </button>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
                <Clock className="w-3.5 h-3.5" />{meta.schedule}
              </div>
            </div>

            <div className="p-5 space-y-4">
              {meta.showRecipients && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Recipient emails</label>
                  <input
                    type="text"
                    value={draft.recipient_emails || ''}
                    onChange={(e) => updateDraft(key, 'recipient_emails', e.target.value)}
                    placeholder="Leave blank to email all admins"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600"
                  />
                  <p className="text-xs text-slate-400 mt-1">Comma-separated. Leave blank to notify all admin users.</p>
                </div>
              )}

              {meta.showThreshold && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Days before due to warn</label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={draft.days_before_warning ?? 30}
                    onChange={(e) => updateDraft(key, 'days_before_warning', e.target.value ? parseInt(e.target.value) : null)}
                    className="w-32 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600"
                  />
                  <p className="text-xs text-slate-400 mt-1">Alerts when MOT or service is due within this many days (or overdue).</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Email subject <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={draft.subject || ''}
                  onChange={(e) => updateDraft(key, 'subject', e.target.value)}
                  placeholder={key === 'vehicle_maintenance' ? 'Vehicle Maintenance Alert' : 'New Job Assignment'}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600"
                />
                {key === 'assignment_notification' && (
                  <p className="text-xs text-slate-400 mt-1">Use {'{job_name}'} to insert the job name.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Intro message <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={draft.intro_message || ''}
                  onChange={(e) => updateDraft(key, 'intro_message', e.target.value)}
                  rows="2"
                  placeholder="Custom message shown at the top of the email"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  onClick={() => handleSave(key)}
                  disabled={saving === key}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 disabled:opacity-50 transition text-sm font-medium"
                >
                  {saving === key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
                </button>
                <button
                  onClick={() => handleTest(key)}
                  disabled={testing === key || !isEnabled}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition text-sm font-medium"
                >
                  {testing === key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send test email
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}