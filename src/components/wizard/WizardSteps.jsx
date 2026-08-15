import React from 'react';
import {
  Building2, Layers, Plug, Check, Palette, Mountain, Leaf, Map, Building,
  Sun, Briefcase, Sparkles,
} from 'lucide-react';
import {
  DIVISION_TYPES, ALL_HUBS, HUB_LABELS, HUB_DESCRIPTIONS, INTEGRATIONS, COLOR_SWATCHES,
} from './divisionWizardData';

const TYPE_ICONS = { Mountain, Leaf, Map, Building, Sun, Briefcase };

const inputCls = 'mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10 outline-none text-sm font-medium';
const labelCls = 'text-xs font-bold text-slate-500 uppercase tracking-wide';

/* ───────────────────────── Step 1: Identity ───────────────────────── */
export function StepIdentity({ form, setForm }) {
  return (
    <div className="space-y-4">
      <div>
        <label className={labelCls}>Division Name</label>
        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Geotechnical Site Investigation"
          className={inputCls} autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Short Code</label>
          <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="GEO" maxLength={6}
            className={inputCls + ' uppercase font-mono'} />
        </div>
        <div>
          <label className={labelCls}>Tagline</label>
          <input value={form.tagline} onChange={e => setForm({ ...form, tagline: e.target.value })} placeholder="Ground Investigation Specialists"
            className={inputCls} />
        </div>
      </div>

      <div>
        <label className={labelCls + ' mb-1.5 block'}>Choose a Division Type</label>
        <p className="text-[11px] text-slate-400 mb-2">This pre-selects smart defaults for hubs, navigation and integrations.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {DIVISION_TYPES.map(t => {
            const Icon = TYPE_ICONS[t.icon] || Briefcase;
            const active = form.division_type === t.value;
            return (
              <button key={t.value} type="button" onClick={() => setForm({ ...form, division_type: t.value, color: t.color })}
                className={'relative flex flex-col items-start gap-1 p-3 rounded-xl border-2 text-left transition ' + (active ? 'border-[#2E5A1A] bg-emerald-50 shadow-md' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50')}>
                {active && <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#2E5A1A] flex items-center justify-center"><Check className="w-3 h-3 text-white" /></span>}
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, ' + t.color + ', ' + t.color + 'cc)' }}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <p className="text-sm font-bold text-slate-800 mt-1">{t.label}</p>
                <p className="text-[10px] text-slate-400 leading-tight">{t.blurb}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className={labelCls + ' flex items-center gap-1.5 mb-1.5'}><Palette className="w-3.5 h-3.5" /> Brand Colour</label>
        <div className="flex items-center gap-2 flex-wrap">
          {COLOR_SWATCHES.map(c => (
            <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
              className={'w-9 h-9 rounded-xl transition ' + (form.color === c ? 'ring-2 ring-offset-2 ring-slate-800 scale-110' : 'hover:scale-105')}
              style={{ background: c }} />
          ))}
          <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })}
            className="w-9 h-9 rounded-xl border border-slate-200 cursor-pointer" />
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Step 2: Hubs ───────────────────────── */
export function StepHubs({ form, setForm }) {
  const toggleHub = (h) => setForm(f => {
    const hubs = f.enabled_hubs.includes(h) ? f.enabled_hubs.filter(x => x !== h) : [...f.enabled_hubs, h];
    return { ...f, enabled_hubs: hubs };
  });
  return (
    <div className="space-y-3">
      <label className={labelCls + ' flex items-center gap-1.5'}><Layers className="w-3.5 h-3.5" /> Choose Operational Hubs</label>
      <p className="text-[11px] text-slate-400">Each hub is a module in this division's workspace. Tap to enable or disable.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {ALL_HUBS.map(h => {
          const enabled = form.enabled_hubs.includes(h);
          return (
            <button key={h} type="button" onClick={() => toggleHub(h)}
              className={'relative flex flex-col items-start gap-1 p-3 rounded-xl border-2 text-left transition ' + (enabled ? 'border-[#2E5A1A] bg-emerald-50' : 'border-slate-200 hover:bg-slate-50')}>
              <div className="flex items-center justify-between w-full">
                <span className="text-sm font-bold text-slate-800">{HUB_LABELS[h] || h}</span>
                <span className={'w-5 h-5 rounded-md flex items-center justify-center transition ' + (enabled ? 'bg-[#2E5A1A]' : 'bg-slate-200')}>
                  {enabled && <Check className="w-3 h-3 text-white" />}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">{HUB_DESCRIPTIONS[h] || h}</p>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-slate-500 pt-1">{form.enabled_hubs.length} of {ALL_HUBS.length} hubs enabled</p>
    </div>
  );
}

/* ───────────────────────── Step 3: Integrations ───────────────────────── */
export function StepIntegrations({ form, setForm }) {
  const isGeotech = form.division_type === 'geotechnical';
  const toggle = (key) => setForm(f => ({ ...f, settings: { ...f.settings, [key]: !f.settings[key] } }));
  return (
    <div className="space-y-3">
      <label className={labelCls + ' flex items-center gap-1.5'}><Plug className="w-3.5 h-3.5" /> Connect Integrations</label>
      <p className="text-[11px] text-slate-400">Toggle the services this division uses. You can connect credentials later in Settings.</p>
      <div className="space-y-2">
        {INTEGRATIONS.map(i => {
          const locked = i.geotechOnly && !isGeotech;
          const value = locked ? false : !!form.settings[i.key];
          return (
            <div key={i.key} className={'flex items-center justify-between gap-3 p-3 rounded-xl border transition ' + (locked ? 'border-slate-100 bg-slate-50 opacity-60' : 'border-slate-200 bg-white')}>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  {i.label}
                  {i.geotechOnly && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 uppercase">Geotech</span>}
                </p>
                <p className="text-[11px] text-slate-400">{i.desc}</p>
              </div>
              <button type="button" disabled={locked} onClick={() => toggle(i.key)}
                className={'relative w-11 h-6 rounded-full transition flex-shrink-0 ' + (value ? 'bg-[#2E5A1A]' : 'bg-slate-300')}>
                <span className={'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition ' + (value ? 'translate-x-5' : '')} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────────────────── Step 4: Review ───────────────────────── */
export function StepReview({ form }) {
  const typeLabel = (DIVISION_TYPES.find(t => t.value === form.division_type) || {}).label || form.division_type;
  const activeIntegrations = INTEGRATIONS.filter(i => form.settings[i.key]).map(i => i.label);
  return (
    <div className="space-y-3">
      <label className={labelCls + ' flex items-center gap-1.5'}><Sparkles className="w-3.5 h-3.5" /> Ready to Launch</label>
      <p className="text-[11px] text-slate-400">Review your workspace configuration below.</p>
      <div className="insight-card rounded-2xl p-4 space-y-3">
        <ReviewRow icon={Building2} label="Name" value={form.name || '—'} />
        <ReviewRow label="Type" value={typeLabel} />
        <ReviewRow label="Code" value={form.code || '—'} />
        <ReviewRow label="Brand Colour">
          <span className="inline-flex items-center gap-1.5"><span className="w-4 h-4 rounded" style={{ background: form.color }} /> {form.color}</span>
        </ReviewRow>
        <ReviewRow label="Hubs" value={(form.enabled_hubs || []).length + ' enabled'} />
        <ReviewRow label="Integrations" value={activeIntegrations.length ? activeIntegrations.join(', ') : 'None'} />
      </div>
    </div>
  );
}

function ReviewRow({ icon: Icon, label, value, children }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">{Icon && <Icon className="w-3.5 h-3.5" />}{label}</span>
      <span className="text-sm font-semibold text-slate-800 text-right truncate">{children || value}</span>
    </div>
  );
}