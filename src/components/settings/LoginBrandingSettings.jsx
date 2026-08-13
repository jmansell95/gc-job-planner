import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Palette, Save, Loader2, Upload, Eye, Trash2, Image as ImageIcon, Type, Layout, Monitor } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';

const COLOR_PRESETS = [
  { name: 'Ground Control', primary: '#2E5A1A', secondary: '#1c4a12' },
  { name: 'Ocean Blue', primary: '#1d4ed8', secondary: '#1e3a8a' },
  { name: 'Sunset Amber', primary: '#d97706', secondary: '#92400e' },
  { name: 'Royal Purple', primary: '#7c3aed', secondary: '#5b21b6' },
  { name: 'Slate Pro', primary: '#475569', secondary: '#1e293b' },
  { name: 'Crimson', primary: '#be123c', secondary: '#881337' },
];

const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600";

function LoginPreview({ cfg }) {
  const bgStyle = cfg.background_type === 'image' && cfg.background_image_url
    ? { backgroundImage: `url(${cfg.background_image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : cfg.background_type === 'solid'
      ? { background: cfg.primary_color || '#2E5A1A' }
      : { background: `linear-gradient(135deg, ${cfg.primary_color || '#2E5A1A'} 0%, ${cfg.secondary_color || '#1c4a12'} 100%)` };

  const overlay = cfg.background_type === 'image' && cfg.background_image_url
    ? { background: `rgba(0,0,0,${cfg.overlay_opacity ?? 0.75})` }
    : {};

  const cardCls = cfg.card_style === 'glass'
    ? 'bg-white/80 backdrop-blur-xl border border-white/40 shadow-2xl'
    : cfg.card_style === 'bordered'
      ? 'bg-white border-2 border-slate-200 shadow-sm'
      : 'bg-white border border-slate-200 shadow-xl';

  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm" style={{ minHeight: '420px', ...bgStyle }}>
      <div className="flex items-center justify-center min-h-[420px] p-6" style={overlay}>
        <div className="w-full max-w-xs">
          <div className="text-center mb-6">
            {cfg.show_logo && cfg.logo_url ? (
              <img src={cfg.logo_url} alt="Logo" className="mx-auto h-14 w-auto mb-3 object-contain" />
            ) : (
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-3" style={{ background: cfg.primary_color || '#2E5A1A' }}>
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-6 6m6-6a6 6 0 00-6-6m6 6H9m6 6v3a3 3 0 01-3 3H6a3 3 0 01-3-3v-1m6-6h12" />
                </svg>
              </div>
            )}
            <h3 className="text-lg font-bold text-white drop-shadow-sm">{cfg.welcome_title || 'Welcome back'}</h3>
            <p className="text-xs text-white/80 mt-0.5">{cfg.welcome_subtitle || 'Log in to your account'}</p>
          </div>
          <div className={`rounded-2xl p-5 ${cardCls}`}>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-medium text-slate-500 mb-1">Email</label>
                <div className="px-3 py-2 rounded-lg bg-slate-100 text-xs text-slate-400">you@example.com</div>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-slate-500 mb-1">Password</label>
                <div className="px-3 py-2 rounded-lg bg-slate-100 text-xs text-slate-400">••••••••</div>
              </div>
              <button className="w-full py-2.5 rounded-lg text-white text-sm font-semibold" style={{ background: cfg.primary_color || '#2E5A1A' }}>
                Log in
              </button>
            </div>
          </div>
          {cfg.footer_text && (
            <p className="text-center text-[10px] text-white/70 mt-3">{cfg.footer_text}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginBrandingSettings() {
  const { toast } = useToast();
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const records = await base44.entities.LoginBranding.list('-updated_date', 1);
      setDraft(records[0] || {
        background_type: 'gradient',
        primary_color: '#2E5A1A',
        secondary_color: '#1c4a12',
        card_style: 'solid',
        welcome_title: 'Welcome back',
        welcome_subtitle: 'Log in to your account',
        show_logo: false,
        overlay_opacity: 0.75,
      });
    } catch (e) {
      toast({ title: 'Error loading branding', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { id, created_date, updated_date, created_by_id, ...payload } = draft;
      if (draft.id) {
        await base44.entities.LoginBranding.update(draft.id, payload);
      } else {
        await base44.entities.LoginBranding.create(payload);
      }
      toast({ title: 'Login branding saved', description: 'Staff will see the new design on their next visit to the login page.' });
      await load();
    } catch (e) {
      toast({ title: 'Error saving', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleUploadBg = async (file) => {
    if (!file) return;
    setUploadingBg(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setDraft({ ...draft, background_image_url: file_url, background_image_name: file.name, background_type: 'image' });
      toast({ title: 'Background uploaded' });
    } catch (e) {
      toast({ title: 'Upload failed', description: e.message, variant: 'destructive' });
    } finally {
      setUploadingBg(false);
    }
  };

  const handleUploadLogo = async (file) => {
    if (!file) return;
    setUploadingLogo(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setDraft({ ...draft, logo_url: file_url, logo_name: file.name, show_logo: true });
      toast({ title: 'Logo uploaded' });
    } catch (e) {
      toast({ title: 'Upload failed', description: e.message, variant: 'destructive' });
    } finally {
      setUploadingLogo(false);
    }
  };

  if (loading || !draft) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-emerald-600 animate-spin" /></div>;
  }

  const cfg = draft;

  return (
    <div className="space-y-6">
      <SettingsSectionHeader icon={Palette} title="Login Page Customiser" description="Customise the background, colours, logo and text on the staff login, register and password reset pages" />

      <div className="grid lg:grid-cols-2 gap-0 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Left: Controls */}
        <div className="p-5 space-y-5 lg:border-r border-slate-100">
          {/* Background type */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              <span className="inline-flex items-center gap-1.5"><Layout className="w-4 h-4 text-slate-400" /> Background style</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { v: 'gradient', label: 'Gradient' },
                { v: 'image', label: 'Image' },
                { v: 'solid', label: 'Solid' },
              ].map(opt => (
                <button key={opt.v} type="button" onClick={() => setDraft({ ...cfg, background_type: opt.v })}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${cfg.background_type === opt.v ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Colour presets */}
          {cfg.background_type !== 'image' && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Colour presets</label>
              <div className="flex items-center gap-2 flex-wrap">
                {COLOR_PRESETS.map(p => (
                  <button key={p.name} type="button" onClick={() => setDraft({ ...cfg, primary_color: p.primary, secondary_color: p.secondary })}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${cfg.primary_color === p.primary ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200 hover:border-slate-300'}`}
                    title={p.name}>
                    <span className="w-4 h-4 rounded-full" style={{ background: `linear-gradient(135deg, ${p.primary}, ${p.secondary})` }} />
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Custom colours */}
          {cfg.background_type !== 'image' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Primary colour</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={cfg.primary_color || '#2E5A1A'} onChange={e => setDraft({ ...cfg, primary_color: e.target.value })}
                    className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer p-0.5" />
                  <input type="text" value={cfg.primary_color || ''} onChange={e => setDraft({ ...cfg, primary_color: e.target.value })}
                    placeholder="#2E5A1A" className={inputCls} />
                </div>
              </div>
              {cfg.background_type === 'gradient' && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Secondary colour</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={cfg.secondary_color || '#1c4a12'} onChange={e => setDraft({ ...cfg, secondary_color: e.target.value })}
                      className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer p-0.5" />
                    <input type="text" value={cfg.secondary_color || ''} onChange={e => setDraft({ ...cfg, secondary_color: e.target.value })}
                      placeholder="#1c4a12" className={inputCls} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Image upload */}
          {cfg.background_type === 'image' && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                <span className="inline-flex items-center gap-1.5"><ImageIcon className="w-4 h-4 text-slate-400" /> Background image</span>
              </label>
              <div className="flex items-center gap-2">
                <label className="flex-1 cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={e => handleUploadBg(e.target.files[0])} />
                  <div className="flex items-center justify-center gap-2 px-3 py-2.5 border-2 border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-emerald-400 hover:text-emerald-600 transition">
                    {uploadingBg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {cfg.background_image_name || 'Upload image'}
                  </div>
                </label>
                {cfg.background_image_url && (
                  <button type="button" onClick={() => setDraft({ ...cfg, background_image_url: '', background_image_name: '', background_type: 'gradient' })}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              {cfg.background_image_url && (
                <div className="mt-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Overlay opacity: {Math.round((cfg.overlay_opacity ?? 0.75) * 100)}%</label>
                  <input type="range" min="0" max="1" step="0.05" value={cfg.overlay_opacity ?? 0.75} onChange={e => setDraft({ ...cfg, overlay_opacity: parseFloat(e.target.value) })}
                    className="w-full accent-emerald-600" />
                </div>
              )}
            </div>
          )}

          {/* Card style */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              <span className="inline-flex items-center gap-1.5"><Monitor className="w-4 h-4 text-slate-400" /> Card style</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { v: 'solid', label: 'Solid' },
                { v: 'glass', label: 'Glass' },
                { v: 'bordered', label: 'Minimal' },
              ].map(opt => (
                <button key={opt.v} type="button" onClick={() => setDraft({ ...cfg, card_style: opt.v })}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${cfg.card_style === opt.v ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Logo */}
          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between gap-3 mb-2">
              <label className="text-sm font-semibold text-slate-700">Company logo</label>
              <button type="button" onClick={() => setDraft({ ...cfg, show_logo: !cfg.show_logo })}
                className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input type="checkbox" checked={cfg.show_logo} readOnly className="sr-only peer" />
                <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-emerald-600 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-transform peer-checked:after:translate-x-5" />
              </button>
            </div>
            {cfg.show_logo && (
              <div className="flex items-center gap-2">
                <label className="flex-1 cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={e => handleUploadLogo(e.target.files[0])} />
                  <div className="flex items-center justify-center gap-2 px-3 py-2.5 border-2 border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-emerald-400 hover:text-emerald-600 transition">
                    {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {cfg.logo_name || 'Upload logo'}
                  </div>
                </label>
                {cfg.logo_url && (
                  <button type="button" onClick={() => setDraft({ ...cfg, logo_url: '', logo_name: '', show_logo: false })}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Text customisation */}
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                <span className="inline-flex items-center gap-1"><Type className="w-3.5 h-3.5 text-slate-400" /> Welcome title</span>
              </label>
              <input type="text" value={cfg.welcome_title || ''} onChange={e => setDraft({ ...cfg, welcome_title: e.target.value })}
                placeholder="Welcome back" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                <span className="inline-flex items-center gap-1"><Type className="w-3.5 h-3.5 text-slate-400" /> Welcome subtitle</span>
              </label>
              <input type="text" value={cfg.welcome_subtitle || ''} onChange={e => setDraft({ ...cfg, welcome_subtitle: e.target.value })}
                placeholder="Log in to your account" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Footer text (optional)</label>
              <input type="text" value={cfg.footer_text || ''} onChange={e => setDraft({ ...cfg, footer_text: e.target.value })}
                placeholder="e.g. Ground Control Geotechnical" className={inputCls} />
            </div>
          </div>

          {/* Save */}
          <div className="pt-2">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 disabled:opacity-50 transition text-sm font-medium">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save branding
            </button>
          </div>
        </div>

        {/* Right: Live preview */}
        <div className="bg-slate-50 p-5">
          <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-slate-600">
            <Eye className="w-4 h-4 text-emerald-600" /> Live preview
          </div>
          <LoginPreview cfg={cfg} />
          <p className="text-xs text-slate-400 mt-2">This is how the login page will look for your staff. Changes apply after you click Save.</p>
        </div>
      </div>
    </div>
  );
}