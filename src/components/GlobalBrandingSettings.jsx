import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Palette, Save, Loader2, Sparkles, Type, Link2, Building2, Globe, Info } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';

const ACCENT_PRESETS = [
  { name: 'Emerald', value: '#0e7a4f' },
  { name: 'Blue', value: '#1d4ed8' },
  { name: 'Amber', value: '#d97706' },
  { name: 'Rose', value: '#be123c' },
  { name: 'Slate', value: '#475569' },
];

const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600";

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildPreviewHtml(cfg) {
  const accent = cfg.default_accent_color || '#0e7a4f';
  const bannerTitle = cfg.default_banner_title || 'GC Mission Control';
  const showBanner = cfg.default_show_banner !== false;
  const footer = cfg.default_footer_text || 'GC Mission Control';
  const sampleBody = 'Hello John Smith,\n\nYou have been assigned to a new job:\n\nJob: Sample Job\nLocation: Sample Site, London\nDate: Monday, 15 July 2026\n\nPlease check your schedule for full details.';
  const safe = escapeHtml(sampleBody).replace(/\n/g, '<br>');
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

export default function GlobalBrandingSettings() {
  const { toast } = useToast();
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('manageEmailAlerts', { action: 'get_global' });
      setDraft(res.data?.settings || {});
    } catch (e) {
      toast({ title: 'Error loading settings', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.functions.invoke('manageEmailAlerts', { action: 'save_global', ...draft });
      toast({ title: 'Global branding saved', description: 'Defaults applied to all email alerts. Individual alerts can still be customised.' });
      await load();
    } catch (e) {
      toast({ title: 'Error saving', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-emerald-600 animate-spin" /></div>;
  }

  const cfg = draft || {};

  return (
    <div className="space-y-6">
      <SettingsSectionHeader icon={Palette} title="Global Email Branding" description="Set default colours, banner and footer for every automated email in one place" />

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-2">
        <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700">
          Saving here updates the branding on <strong>all</strong> email alerts at once. You can still customise individual alerts in the Email Alerts tab afterwards.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-0 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 space-y-4 lg:border-r border-slate-100">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              <span className="inline-flex items-center gap-1"><Building2 className="w-3.5 h-3.5 text-slate-400" /> Company name</span>
            </label>
            <input type="text" value={cfg.company_name || ''} onChange={(e) => setDraft({ ...cfg, company_name: e.target.value })}
              placeholder="GC Mission Control" className={inputCls} />
            <p className="text-xs text-slate-400 mt-1">Used as the default banner title and footer across all emails.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              <span className="inline-flex items-center gap-1"><Globe className="w-3.5 h-3.5 text-slate-400" /> App base URL</span>
            </label>
            <input type="text" value={cfg.app_base_url || ''} onChange={(e) => setDraft({ ...cfg, app_base_url: e.target.value })}
              placeholder="https://gc-mission-control.base44.app" className={inputCls} />
            <p className="text-xs text-slate-400 mt-1">Public URL used to build links inside email alerts (e.g. "View your schedule").</p>
          </div>

          <div className="pt-3 border-t border-slate-100 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Sparkles className="w-4 h-4 text-emerald-600" /> Email appearance defaults
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Sparkles className="w-4 h-4 text-slate-400" /> Show banner
              </div>
              <button type="button" onClick={() => setDraft({ ...cfg, default_show_banner: cfg.default_show_banner !== false ? false : true })}
                className="relative inline-flex items-center cursor-pointer flex-shrink-0" aria-label="Toggle banner">
                <input type="checkbox" checked={cfg.default_show_banner !== false} readOnly className="sr-only peer" />
                <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-emerald-600 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-transform peer-checked:after:translate-x-5" />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Default banner title</label>
              <input type="text" value={cfg.default_banner_title || ''} onChange={(e) => setDraft({ ...cfg, default_banner_title: e.target.value })}
                placeholder="GC Mission Control" className={inputCls} />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Default accent colour</label>
              <div className="flex items-center gap-2 flex-wrap">
                {ACCENT_PRESETS.map((p) => (
                  <button key={p.value} type="button" onClick={() => setDraft({ ...cfg, default_accent_color: p.value })}
                    className={`w-8 h-8 rounded-full ring-2 transition cursor-pointer ${cfg.default_accent_color === p.value ? 'ring-slate-900' : 'ring-transparent hover:ring-slate-300'}`}
                    style={{ background: p.value }} aria-label={p.name} title={p.name} />
                ))}
                <input type="color" value={cfg.default_accent_color || '#0e7a4f'} onChange={(e) => setDraft({ ...cfg, default_accent_color: e.target.value })}
                  className="w-8 h-8 rounded-full border border-slate-200 cursor-pointer p-0 bg-transparent" aria-label="Custom colour" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                <span className="inline-flex items-center gap-1"><Type className="w-3.5 h-3.5 text-slate-400" /> Default footer text</span>
              </label>
              <input type="text" value={cfg.default_footer_text || ''} onChange={(e) => setDraft({ ...cfg, default_footer_text: e.target.value })}
                placeholder="GC Mission Control" className={inputCls} />
            </div>
          </div>

          <div className="pt-2">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 disabled:opacity-50 transition text-sm font-medium">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save & apply to all emails
            </button>
          </div>
        </div>

        <div className="bg-slate-50 p-5">
          <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-slate-600">
            <Link2 className="w-4 h-4 text-emerald-600" /> Live preview
          </div>
          <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-white">
            <iframe title="Branding preview" srcDoc={buildPreviewHtml(cfg)} className="w-full h-[520px] border-0 bg-white" />
          </div>
          <p className="text-xs text-slate-400 mt-2">Preview shows how emails will look with these default branding settings.</p>
        </div>
      </div>
    </div>
  );
}