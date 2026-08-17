import React from 'react';
import {
  Building2, Layers, Plug, Check, Palette, Sparkles,
} from 'lucide-react';
import {
  DIVISION_TYPE_LABELS, ALL_HUBS, HUB_LABELS, HUB_DESCRIPTIONS, INTEGRATIONS, COLOR_SWATCHES,
} from './divisionWizardData';
import TemplatePicker from './TemplatePicker';

const labelCls = 'text-xs font-bold text-slate-500 uppercase tracking-wide';
const requiredMark = <span className="text-rose-500"> *</span>;

function inputClass(hasError) {
  return 'mt-1 w-full px-3 py-2.5 rounded-xl border outline-none text-sm font-medium transition ' +
    (hasError
      ? 'border-rose-300 ring-1 ring-rose-200 focus:border-rose-400 focus:ring-2 focus:ring-rose-100'
      : 'border-slate-200 focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10');
}

/* ───────────────────────── Step 1: Identity ───────────────────────── */
export function StepIdentity({ form, setForm, divisions, divisionsLoading, applyTemplate, selectedTemplateId }) {
  return (
    <div className="space-y-4">
      <div>
        <label className={labelCls}>Division Name{requiredMark}</label>
        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Geotechnical Site Investigation"
          className={inputClass(!form.name.trim())} autoFocus />
        {!form.name.trim() && <p className="text-[11px] text-rose-500 mt-1 font-semibold">Division name is required</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Short Code{requiredMark}</label>
          <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="GEO" maxLength={6}
            className={inputClass(!form.code.trim()) + ' uppercase font-mono'} />
          {!form.code.trim() && <p className="text-[11px] text-rose-500 mt-1 font-semibold">Code is required</p>}
        </div>
        <div>
          <label className={labelCls}>Tagline</label>
          <input value={form.tagline} onChange={e => setForm({ ...form, tagline: e.target.value })} placeholder="Ground Investigation Specialists"
            className={inputClass(false)} />
        </div>
      </div>

      <div>
        <label className={labelCls + ' mb-1.5 block'}>Copy from an Existing Division</label>
        <p className="text-[11px] text-slate-400 mb-2">Pick a division to copy its hubs, navigation, integrations and settings. You can tweak everything afterwards.</p>
        <TemplatePicker divisions={divisions} selectedId={selectedTemplateId} onSelect={applyTemplate} isLoading={divisionsLoading} />
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

/* ───────────────────────── Step 3: Integrations (info-only) ───────────────────────── */
export function StepIntegrations({ form, setForm }) {
  return (
    <div className="space-y-3">
      <label className={labelCls + ' flex items-center gap-1.5'}><Plug className="w-3.5 h-3.5" /> Integrations</label>
      <div className="insight-card rounded-2xl p-5 text-center space-y-3">
        <div className="w-14 h-14 rounded-2xl command-gradient flex items-center justify-center shadow-md mx-auto">
          <Plug className="w-7 h-7 text-white" />
        </div>
        <div>
          <p className="text-sm font-extrabold text-slate-900">Managed Centrally</p>
          <p className="text-[12px] text-slate-500 mt-1.5 leading-relaxed">
            All integrations (Geotab, SafetyCulture, Asset Panda, OpenGround, KeyLogBook, and more) are configured
            once at the enterprise level and apply to every division automatically.
          </p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
          <p className="text-[11px] font-semibold text-emerald-700">
            After launching this division, go to Enterprise Settings → Integrations to connect your services.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Step 4: Review ───────────────────────── */
export function StepReview({ form }) {
  const typeLabel = DIVISION_TYPE_LABELS[form.division_type] || form.division_type;
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
        <ReviewRow label="Integrations" value="Managed centrally" />
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