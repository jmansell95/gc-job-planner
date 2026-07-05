import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Mail, Save, Send, Loader2, Truck, UserCheck, Clock, Palette, RotateCcw, Eye, Sparkles, Type, Calendar } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const ALERT_META = {
  vehicle_maintenance: {
    title: 'Vehicle Maintenance Alert',
    desc: 'Emails admins about upcoming or overdue vehicle MOT and service dates.',
    schedule: 'Runs automatically every Monday at 7:00 AM',
    icon: Truck,
    showThreshold: true,
    showRecipients: true,
    tokens: ['{alert_count}', '{alert_list}'],
  },
  assignment_notification: {
    title: 'Job Assignment Notification',
    desc: 'Emails a staff member when they are assigned to a job on the rota.',
    schedule: 'Runs automatically when a rota assignment is created',
    icon: UserCheck,
    showThreshold: false,
    showRecipients: false,
    tokens: ['{staff_name}', '{job_name}', '{location}', '{date}', '{job_type}', '{notes}'],
  },
  staff_schedule: {
    title: 'Weekly Staff Schedule',
    desc: 'Emails each staff member their personal schedule when you submit the weekly rota.',
    schedule: 'Sent when you submit the rota from the Rota Builder',
    icon: Calendar,
    showThreshold: false,
    showRecipients: false,
    tokens: ['{staff_name}', '{week_start}', '{assignment_count}'],
  },
};

const ACCENT_PRESETS = [
  { name: 'Emerald', value: '#0e7a4f' },
  { name: 'Blue', value: '#1d4ed8' },
  { name: 'Amber', value: '#d97706' },
  { name: 'Rose', value: '#be123c' },
  { name: 'Slate', value: '#475569' },
];

const DEFAULT_STYLE = { accent_color: '#0e7a4f', banner_title: 'GC Job Planner', show_banner: true, footer_text: 'GC Job Planner' };

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildStyledHtml(bodyText, cfg) {
  const accent = cfg.accent_color || '#0e7a4f';
  const bannerTitle = cfg.banner_title || 'GC Job Planner';
  const showBanner = cfg.show_banner !== false;
  const footer = cfg.footer_text || 'GC Job Planner';
  const safe = escapeHtml(bodyText).replace(/\n/g, '<br>');
  const banner = showBanner
    ? '<tr><td style="background:' + accent + ';padding:18px 24px"><h1 style="margin:0;color:#ffffff;font-size:18px;font-family:Arial,Helvetica,sans-serif;letter-spacing:0.3px">' + escapeHtml(bannerTitle) + '</h1></td></tr>'
    : '';
  return '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">' +
    '<table align="center" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;margin:24px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 6px 24px rgba(15,42,31,0.08)">' +
    banner +
    '<tr><td style="padding:24px;color:#1e293b;font-size:14px;line-height:1.6">' + safe + '</td></tr>' +
    '<tr><td style="padding:14px 24px;background:#f8fafc;color:#64748b;font-size:12px;border-top:1px solid #e2e8f0;text-align:center">' + escapeHtml(footer) + '</td></tr>' +
    '</table></body></html>';
}

function renderSampleBody(key, cfg) {
  if (key === 'vehicle_maintenance') {
    const sampleList = 'Vehicle Maintenance Report\n\n2 vehicle(s) require maintenance attention:\n\nVan 01 (AB12 CDE):\n  - MOT: Due soon (due 2026-07-15)\n  - Service: OVERDUE (due 2026-06-30)\n';
    if (cfg.template) return cfg.template.replace(/\{alert_count\}/g, '2').replace(/\{alert_list\}/g, sampleList);
    const intro = cfg.intro_message ? cfg.intro_message + '\n\n' : '';
    return intro + sampleList + 'Please schedule maintenance as soon as possible.\n\nGC Job Planner';
  }
  if (key === 'staff_schedule') {
    if (cfg.template) {
      return cfg.template
        .replace(/\{staff_name\}/g, 'John Smith')
        .replace(/\{week_start\}/g, 'Mon 6 Jul – Sun 12 Jul 2026')
        .replace(/\{assignment_count\}/g, '5');
    }
    const intro = cfg.intro_message ? cfg.intro_message + '\n\n' : '';
    return intro + 'Hi John Smith, here is your schedule for the week of Mon 6 Jul – Sun 12 Jul 2026. You have 5 assignment(s).';
  }
  const tok = { staff_name: 'John Smith', job_name: 'Sample Job', location: 'Sample Site, London', date: 'Monday, 6 July 2026', job_type: 'groundworks', notes: 'Notes: Sample note' };
  if (cfg.template) {
    return cfg.template
      .replace(/\{staff_name\}/g, tok.staff_name).replace(/\{job_name\}/g, tok.job_name)
      .replace(/\{location\}/g, tok.location).replace(/\{date\}/g, tok.date)
      .replace(/\{job_type\}/g, tok.job_type).replace(/\{notes\}/g, tok.notes);
  }
  const intro = cfg.intro_message ? cfg.intro_message + '\n\n' : '';
  return intro + 'Hello John Smith,\n\nYou have been assigned to a new job:\n\nJob: Sample Job\nLocation: Sample Site, London\nDate: Monday, 6 July 2026\nJob Type: groundworks\nNotes: Sample note\n\nPlease check your schedule for full details.\n\nGC Job Planner';
}

export default function EmailAlertsSettings() {
  const { toast } = useToast();
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [testing, setTesting] = useState(null);
  const [openKey, setOpenKey] = useState(null);
  const textareaRefs = useRef({});

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('manageEmailAlerts', { action: 'get' });
      const list = res.data?.settings || [];
      const d = {};
      list.forEach((s) => { d[s.alert_key] = { ...s }; });
      setDrafts(d);
      setOpenKey(Object.keys(ALERT_META)[0]);
    } catch (e) {
      toast({ title: 'Error loading alerts', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const updateDraft = (key, field, value) => {
    setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const insertToken = (key, token) => {
    const ta = textareaRefs.current[key];
    if (!ta) {
      updateDraft(key, 'template', (drafts[key]?.template || '') + token);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const cur = drafts[key]?.template || '';
    const next = cur.slice(0, start) + token + cur.slice(end);
    updateDraft(key, 'template', next);
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + token.length; });
  };

  const handleSave = async (key) => {
    setSaving(key);
    try {
      await base44.functions.invoke('manageEmailAlerts', { action: 'save', ...drafts[key] });
      toast({ title: 'Alert saved', description: 'Changes apply to the next automated run.' });
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

  const handleReset = (key) => {
    setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], subject: '', template: '', intro_message: '', ...DEFAULT_STYLE } }));
    toast({ title: 'Template reset', description: 'Click Save to apply the defaults.' });
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
      {/* Page hero */}
      <div className="relative overflow-hidden rounded-2xl hero-gradient p-5 md:p-6">
        <div className="absolute -top-10 -right-8 w-40 h-40 rounded-full bg-emerald-300/20 blur-3xl pointer-events-none" />
        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/15 ring-1 ring-white/25 flex items-center justify-center flex-shrink-0">
            <Mail className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-bold text-white">Automated Email Alerts</h2>
            <p className="text-emerald-100 text-sm">Control recipients, timing, wording, colours and banner for each automated email.</p>
          </div>
        </div>
      </div>

      {/* Alert selector tabs */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(ALERT_META).map(([key, meta]) => {
          const Icon = meta.icon;
          const isActive = openKey === key;
          const isEnabled = drafts[key]?.enabled !== false;
          return (
            <button key={key} type="button" onClick={() => setOpenKey(key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition cursor-pointer touch-manipulation select-none ${
                isActive ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
              }`}>
              <Icon className="w-4 h-4" />
              {meta.title}
              <span className={`w-2 h-2 rounded-full ${isEnabled ? 'bg-emerald-400' : 'bg-slate-400'}`} />
            </button>
          );
        })}
      </div>

      {openKey && (() => {
        const key = openKey;
        const meta = ALERT_META[key];
        const draft = drafts[key] || { alert_key: key, enabled: true, ...DEFAULT_STYLE };
        const Icon = meta.icon;
        const isEnabled = draft.enabled !== false;
        const previewHtml = buildStyledHtml(renderSampleBody(key, draft), draft);
        return (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Card header */}
            <div className="p-5 border-b border-slate-100 bg-slate-50/60">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-2.5 rounded-lg flex-shrink-0" style={{ background: (draft.accent_color || '#0e7a4f') + '22' }}>
                    <Icon className="w-5 h-5" style={{ color: draft.accent_color || '#0e7a4f' }} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900">{meta.title}</h3>
                    <p className="text-sm text-slate-500 mt-0.5">{meta.desc}</p>
                  </div>
                </div>
                <button type="button" onClick={() => updateDraft(key, 'enabled', !isEnabled)}
                  className="relative inline-flex items-center cursor-pointer flex-shrink-0" aria-label="Toggle alert">
                  <input type="checkbox" checked={isEnabled} readOnly className="sr-only peer" />
                  <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-emerald-600 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-transform peer-checked:after:translate-x-5" />
                </button>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
                <Clock className="w-3.5 h-3.5" />{meta.schedule}
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-0">
              {/* Settings column */}
              <div className="p-5 space-y-4 lg:border-r border-slate-100">
                {meta.showRecipients && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Recipient emails</label>
                    <input type="text" value={draft.recipient_emails || ''} onChange={(e) => updateDraft(key, 'recipient_emails', e.target.value)}
                      placeholder="Leave blank to email all admins"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
                    <p className="text-xs text-slate-400 mt-1">Comma-separated. Leave blank to notify all admin users.</p>
                  </div>
                )}

                {meta.showThreshold && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Days before due to warn</label>
                    <input type="number" min="1" max="365" value={draft.days_before_warning ?? 30}
                      onChange={(e) => updateDraft(key, 'days_before_warning', e.target.value ? parseInt(e.target.value) : null)}
                      className="w-32 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
                    <p className="text-xs text-slate-400 mt-1">Alerts when MOT or service is due within this many days (or overdue).</p>
                  </div>
                )}

                {/* Subject */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Email subject <span className="text-slate-400 font-normal">(optional)</span></label>
                  <input type="text" value={draft.subject || ''} onChange={(e) => updateDraft(key, 'subject', e.target.value)}
                    placeholder={key === 'vehicle_maintenance' ? 'Vehicle Maintenance Alert' : key === 'staff_schedule' ? "John's Weekly Schedule" : 'New Job Assignment'}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
                  {key === 'assignment_notification' && <p className="text-xs text-slate-400 mt-1">Use {'{job_name}'} to insert the job name.</p>}
                  {key === 'staff_schedule' && <p className="text-xs text-slate-400 mt-1">Use {'{staff_name}'} or {'{week_start}'} in the subject.</p>}
                </div>

                {/* Template editor */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-medium text-slate-700">Email body template <span className="text-slate-400 font-normal">(optional)</span></label>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {meta.tokens.map((t) => (
                      <button key={t} type="button" onClick={() => insertToken(key, t)}
                        className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-mono border border-emerald-200 hover:bg-emerald-100 transition cursor-pointer">
                        {t}
                      </button>
                    ))}
                  </div>
                  <textarea ref={(el) => (textareaRefs.current[key] = el)}
                    value={draft.template || ''} onChange={(e) => updateDraft(key, 'template', e.target.value)} rows="7"
                    placeholder={key === 'vehicle_maintenance'
                      ? `Vehicle Maintenance Report\n\n{alert_list}\n\nPlease schedule maintenance as soon as possible.\n\nGC Job Planner`
                      : key === 'staff_schedule'
                        ? `Hi {staff_name}, here is your schedule for the week of {week_start}. You have {assignment_count} assignment(s).`
                        : `Hello {staff_name},\n\nYou have been assigned to a new job:\n\nJob: {job_name}\nLocation: {location}\nDate: {date}\nJob Type: {job_type}\n{notes}\n\nPlease check your schedule for full details.\n\nGC Job Planner`}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 font-mono" />
                  <p className="text-xs text-slate-400 mt-1">Click a token to insert it. Leave blank to use the default template.</p>
                </div>

                {/* Intro */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Intro message <span className="text-slate-400 font-normal">(optional)</span></label>
                  <textarea value={draft.intro_message || ''} onChange={(e) => updateDraft(key, 'intro_message', e.target.value)} rows="2"
                    placeholder="Custom message shown at the top of the email (used when no full template is set)"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
                </div>

                {/* Style controls */}
                <div className="pt-3 border-t border-slate-100 space-y-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <Palette className="w-4 h-4 text-emerald-600" /> Email appearance
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Sparkles className="w-4 h-4 text-slate-400" /> Show banner
                    </div>
                    <button type="button" onClick={() => updateDraft(key, 'show_banner', draft.show_banner !== false ? false : true)}
                      className="relative inline-flex items-center cursor-pointer flex-shrink-0" aria-label="Toggle banner">
                      <input type="checkbox" checked={draft.show_banner !== false} readOnly className="sr-only peer" />
                      <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-emerald-600 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-transform peer-checked:after:translate-x-5" />
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Banner title</label>
                    <input type="text" value={draft.banner_title || ''} onChange={(e) => updateDraft(key, 'banner_title', e.target.value)}
                      placeholder="GC Job Planner"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Accent colour</label>
                    <div className="flex items-center gap-2 flex-wrap">
                      {ACCENT_PRESETS.map((p) => (
                        <button key={p.value} type="button" onClick={() => updateDraft(key, 'accent_color', p.value)}
                          className={`w-8 h-8 rounded-full ring-2 transition cursor-pointer ${draft.accent_color === p.value ? 'ring-slate-900' : 'ring-transparent hover:ring-slate-300'}`}
                          style={{ background: p.value }} aria-label={p.name} title={p.name} />
                      ))}
                      <input type="color" value={draft.accent_color || '#0e7a4f'} onChange={(e) => updateDraft(key, 'accent_color', e.target.value)}
                        className="w-8 h-8 rounded-full border border-slate-200 cursor-pointer p-0 bg-transparent" aria-label="Custom colour" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      <span className="inline-flex items-center gap-1"><Type className="w-3.5 h-3.5 text-slate-400" /> Footer text</span>
                    </label>
                    <input type="text" value={draft.footer_text || ''} onChange={(e) => updateDraft(key, 'footer_text', e.target.value)}
                      placeholder="GC Job Planner"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-2">
                  <button onClick={() => handleSave(key)} disabled={saving === key}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 disabled:opacity-50 transition text-sm font-medium">
                    {saving === key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
                  </button>
                  <button onClick={() => handleTest(key)} disabled={testing === key || !isEnabled}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition text-sm font-medium">
                    {testing === key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send test email
                  </button>
                  <button onClick={() => handleReset(key)}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-500 rounded-lg hover:bg-slate-50 transition text-sm font-medium">
                    <RotateCcw className="w-4 h-4" /> Reset template
                  </button>
                </div>
              </div>

              {/* Preview column */}
              <div className="bg-slate-50 p-5">
                <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-slate-600">
                  <Eye className="w-4 h-4 text-emerald-600" /> Live preview
                </div>
                <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-white">
                  <iframe title="Email preview" srcDoc={previewHtml} className="w-full h-[520px] border-0 bg-white" />
                </div>
                <p className="text-xs text-slate-400 mt-2">Preview uses sample data. The accent colour and banner update instantly.</p>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}