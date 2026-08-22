import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Save, Upload, Eye, Building2, HardHat, Phone, Mail, Palette, Type, Power } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const PORTALS = [
  { key: 'client_portal', label: 'Client Portal', icon: Building2, desc: 'Branded job progress portal shared with your clients via a private link.' },
  { key: 'subcontractor_onboarding', label: 'Subcontractor Onboarding', icon: HardHat, desc: 'Self-service compliance form subcontractors fill in to get approved.' },
];

export default function PortalBrandingEditor() {
  const { toast } = useToast();
  const [activePortal, setActivePortal] = useState('client_portal');
  const [branding, setBranding] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    setBranding(null);
    (async () => {
      try {
        const res = await base44.functions.invoke('getPortalBranding', { portal_type: activePortal });
        setBranding(res.data.branding);
      } catch (e) {
        toast({ title: 'Load failed', description: e.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    })();
  }, [activePortal]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.functions.invoke('getPortalBranding', { portal_type: activePortal, action: 'save', ...branding });
      toast({ title: 'Saved', description: 'Portal branding updated.' });
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      setBranding(b => ({ ...b, logo_url: res.file_url, logo_name: file.name, show_logo: true }));
    } catch (err) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    }
  };

  const set = (field, value) => setBranding(b => ({ ...b, [field]: value }));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Portal Branding Editor</h2>
        <p className="text-sm text-slate-500 mt-1">Customise the look, welcome message and contact details shown on your client and subcontractor portals. Changes appear instantly for anyone using a portal link.</p>
      </div>

      {/* Portal selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PORTALS.map(p => {
          const Icon = p.icon;
          const active = activePortal === p.key;
          return (
            <button key={p.key} onClick={() => setActivePortal(p.key)}
              className={`text-left p-4 rounded-xl border-2 transition ${active ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-5 h-5 ${active ? 'text-emerald-700' : 'text-slate-400'}`} />
                <span className={`font-semibold ${active ? 'text-emerald-900' : 'text-slate-700'}`}>{p.label}</span>
              </div>
              <p className="text-xs text-slate-500">{p.desc}</p>
            </button>
          );
        })}
      </div>

      {loading || !branding ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-emerald-600 animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Editor */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Palette className="w-4 h-4 text-emerald-600" />
              <h3 className="font-semibold text-slate-800">Appearance & Content</h3>
            </div>

            <ToggleRow icon={Power} label="Portal enabled" desc="Turn off to show a 'temporarily unavailable' message"
              checked={branding.enabled} onChange={v => set('enabled', v)} />

            <Field label="Welcome title" icon={Type}>
              <input type="text" value={branding.welcome_title || ''} onChange={e => set('welcome_title', e.target.value)}
                placeholder={activePortal === 'client_portal' ? '(uses job name)' : 'Subcontractor Onboarding'}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </Field>

            <Field label="Welcome subtitle">
              <input type="text" value={branding.welcome_subtitle || ''} onChange={e => set('welcome_subtitle', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </Field>

            <Field label="Intro message">
              <textarea value={branding.intro_message || ''} onChange={e => set('intro_message', e.target.value)} rows={3}
                placeholder="Shown beneath the heading — instructions or welcome note for visitors"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 resize-none" />
            </Field>

            <Field label="Accent colour">
              <div className="flex items-center gap-2">
                <input type="color" value={branding.accent_color || '#2E5A1A'} onChange={e => set('accent_color', e.target.value)}
                  className="w-10 h-10 rounded-lg border border-slate-300 cursor-pointer" />
                <input type="text" value={branding.accent_color || ''} onChange={e => set('accent_color', e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
              </div>
            </Field>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Logo</label>
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 cursor-pointer transition">
                  <Upload className="w-4 h-4" /> Upload
                  <input type="file" accept="image/*" onChange={handleLogo} className="hidden" />
                </label>
                {branding.logo_url && <img src={branding.logo_url} alt="logo" className="h-10 max-w-32 object-contain border border-slate-200 rounded" />}
                {branding.logo_name && <span className="text-xs text-slate-500 truncate">{branding.logo_name}</span>}
              </div>
              <ToggleRow icon={Eye} label="Show logo in header" checked={!!branding.show_logo} onChange={v => set('show_logo', v)} compact />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Support phone" icon={Phone}>
                <input type="tel" value={branding.support_phone || ''} onChange={e => set('support_phone', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
              </Field>
              <Field label="Support email" icon={Mail}>
                <input type="email" value={branding.support_email || ''} onChange={e => set('support_email', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
              </Field>
            </div>

            <Field label="Footer text">
              <input type="text" value={branding.footer_text || ''} onChange={e => set('footer_text', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </Field>

            <button onClick={handleSave} disabled={saving}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-700 text-white rounded-lg font-semibold hover:bg-emerald-800 disabled:opacity-50 transition">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Branding
            </button>
          </div>

          {/* Live preview */}
          <PortalPreview branding={branding} portalType={activePortal} />
        </div>
      )}
    </div>
  );
}

function PortalPreview({ branding, portalType }) {
  const accent = branding.accent_color || '#2E5A1A';
  const title = branding.welcome_title || (portalType === 'client_portal' ? 'Job Name' : 'Subcontractor Onboarding');
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Live Preview</p>
      <div className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-6 text-white relative" style={{ background: `linear-gradient(135deg, ${accent} 0%, ${shade(accent, -20)} 100%)` }}>
          <div className="flex items-center gap-2 mb-2">
            {branding.show_logo && branding.logo_url
              ? <img src={branding.logo_url} alt="logo" className="h-8 max-w-32 object-contain bg-white/10 rounded p-0.5" />
              : (portalType === 'client_portal' ? <Building2 className="w-5 h-5 text-white/80" /> : <HardHat className="w-5 h-5 text-white/80" />)}
            <span className="text-white/80 text-sm font-medium">{branding.welcome_subtitle || 'Portal'}</span>
          </div>
          <h1 className="text-xl font-bold">{title}</h1>
          {branding.intro_message && <p className="text-white/85 text-sm mt-2 max-w-md">{branding.intro_message}</p>}
        </div>
        <div className="bg-slate-50 p-5 space-y-2">
          <div className="bg-white rounded-lg border border-slate-200 p-3 text-xs text-slate-400">Sample content card — progress, team, documents…</div>
          <div className="bg-white rounded-lg border border-slate-200 p-3 text-xs text-slate-400">Sample content card…</div>
          {(branding.support_phone || branding.support_email) && (
            <div className="flex items-center gap-3 text-xs text-slate-500 pt-1">
              {branding.support_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{branding.support_phone}</span>}
              {branding.support_email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{branding.support_email}</span>}
            </div>
          )}
          <p className="text-center text-[10px] text-slate-400 pt-2">{branding.footer_text || 'Ground Control'}</p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, icon: Icon, children }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 text-slate-400" />}{label}
      </label>
      {children}
    </div>
  );
}

function ToggleRow({ icon: Icon, label, desc, checked, onChange, compact }) {
  return (
    <div className={`flex items-center justify-between ${compact ? 'py-1' : 'py-2'}`}>
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-slate-400" />
        <div>
          <p className="text-sm font-medium text-slate-700">{label}</p>
          {desc && <p className="text-xs text-slate-400">{desc}</p>}
        </div>
      </div>
      <button type="button" onClick={() => onChange(!checked)}
        className={`relative w-10 h-6 rounded-full transition ${checked ? 'bg-emerald-600' : 'bg-slate-300'}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition ${checked ? 'translate-x-4' : ''}`} />
      </button>
    </div>
  );
}

// Lighten/darken a hex colour by a percentage (-100..100)
function shade(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + Math.round(255 * percent / 100)));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * percent / 100)));
  const b = Math.max(0, Math.min(255, (num & 0xff) + Math.round(255 * percent / 100)));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}