import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  HardHat, Loader2, AlertCircle, CheckCircle2, ShieldCheck, FileText,
  Building2, Mail, Phone, Calendar, PoundSterling, Upload, Send,
  CheckCircle, XCircle, Clock, Award,
} from 'lucide-react';

const SERVICE_OPTIONS = [
  { key: 'drilling', label: 'Drilling' },
  { key: 'groundworks', label: 'Groundworks' },
  { key: 'coring', label: 'Coring' },
  { key: 'trial_pit', label: 'Trial Pit' },
  { key: 'enabling', label: 'Enabling Works' },
  { key: 'depot', label: 'Depot' },
];

const ACCREDITATION_OPTIONS = [
  { key: 'chas', label: 'CHAS' },
  { key: 'constructionline', label: 'Constructionline' },
  { key: 'smas', label: 'SMAS' },
  { key: 'safecontractor', label: 'SafeContractor' },
  { key: 'iso9001', label: 'ISO 9001' },
  { key: 'iso14001', label: 'ISO 14001' },
  { key: 'iso45001', label: 'ISO 45001' },
  { key: 'achilles', label: 'Achilles' },
  { key: 'other', label: 'Other' },
];

const STATUS_DISPLAY = {
  pending: { icon: Clock, label: 'Pending', color: 'text-slate-600 bg-slate-100' },
  documents_requested: { icon: Clock, label: 'Documents Requested', color: 'text-blue-600 bg-blue-100' },
  under_review: { icon: Clock, label: 'Under Review', color: 'text-amber-600 bg-amber-100' },
  approved: { icon: CheckCircle2, label: 'Approved', color: 'text-emerald-600 bg-emerald-100' },
  rejected: { icon: XCircle, label: 'Rejected', color: 'text-rose-600 bg-rose-100' },
  suspended: { icon: XCircle, label: 'Suspended', color: 'text-rose-600 bg-rose-100' },
};

export default function SubcontractorOnboarding() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [contractor, setContractor] = useState(null);
  const [branding, setBranding] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({});

  useEffect(() => {
    (async () => {
      try {
        // Load portal branding in parallel with contractor data
        const [res, brandRes] = await Promise.all([
          base44.functions.invoke('getContractorByToken', { onboarding_token: token }),
          base44.functions.invoke('getPortalBranding', { portal_type: 'subcontractor_onboarding' }),
        ]);
        if (brandRes.data?.branding) setBranding(brandRes.data.branding);
        if (res.error) { setError(res.error); setLoading(false); return; }
        setContractor(res.data.contractor);
        setForm({
          contact_name: res.data.contractor.contact_name || '',
          contact_email: res.data.contractor.contact_email || '',
          contact_phone: res.data.contractor.contact_phone || '',
          services_offered: res.data.contractor.services_offered || [],
          company_reg_number: res.data.contractor.company_reg_number || '',
          vat_number: res.data.contractor.vat_number || '',
          hse_registration: res.data.contractor.hse_registration || '',
          accreditations: res.data.contractor.accreditations || [],
          insurance_provider: res.data.contractor.insurance_provider || '',
          insurance_policy_number: res.data.contractor.insurance_policy_number || '',
          insurance_expiry: res.data.contractor.insurance_expiry || '',
          public_liability_limit: res.data.contractor.public_liability_limit || '',
          employers_liability_limit: res.data.contractor.employers_liability_limit || '',
          professional_indemnity_limit: res.data.contractor.professional_indemnity_limit || '',
          utr: res.data.contractor.utr || '',
          nino: res.data.contractor.nino || '',
        });
      } catch (e) {
        setError(e.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const toggleArray = (field, value) => {
    setForm(f => {
      const arr = f[field] || [];
      return { ...f, [field]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const res = await base44.functions.invoke('getContractorByToken', {
        onboarding_token: token,
        action: 'submit',
        ...form,
      });
      if (res.error) { setError(res.error); return; }
      setSaved(true);
      // Refresh status — include CIS verification result if auto-verification ran
      const cisVer = res.data?.cis_verification;
      setContractor(prev => ({
        ...prev,
        onboarding_status: res.data.onboarding_status,
        onboarding_completed_at: new Date().toISOString(),
        cis_status: cisVer?.cis_status || prev.cis_status,
        cis_verified_at: cisVer ? new Date().toISOString() : prev.cis_verified_at,
        cis_tax_rate: cisVer?.tax_rate ?? prev.cis_tax_rate,
      }));
    } catch (e) {
      setError(e.message || 'Failed to submit');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-rose-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Link not found</h1>
          <p className="text-sm text-slate-500">{error}</p>
          <p className="text-xs text-slate-400 mt-3">If you believe this is an error, please contact Ground Control directly.</p>
        </div>
      </div>
    );
  }

  const status = STATUS_DISPLAY[contractor.onboarding_status] || STATUS_DISPLAY.pending;
  const StatusIcon = status.icon;
  const isApproved = contractor.onboarding_status === 'approved';
  const isRejected = contractor.onboarding_status === 'rejected';
  const isReadOnly = isApproved || isRejected;

  // Portal branding — falls back to defaults if not loaded yet
  const accent = branding?.accent_color || '#2E5A1A';
  const welcomeTitle = branding?.welcome_title || 'Sub-contractor Onboarding';
  const welcomeSubtitle = branding?.welcome_subtitle || '';
  const showLogo = branding?.show_logo && branding?.logo_url;
  const portalDisabled = branding && branding.enabled === false;

  if (portalDisabled) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-amber-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Portal temporarily unavailable</h1>
          <p className="text-sm text-slate-500">This onboarding portal is currently turned off. Please contact Ground Control to complete your onboarding.</p>
          {branding?.support_phone && <p className="text-sm text-slate-600 mt-3">📞 {branding.support_phone}</p>}
          {branding?.support_email && <p className="text-sm text-slate-600">✉️ {branding.support_email}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* Header — uses portal branding accent colour */}
      <div className="px-4 py-6 sm:py-8 text-white relative" style={{ background: `linear-gradient(135deg, ${accent} 0%, ${shadeHex(accent, -22)} 100%)` }}>
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-11 h-11 rounded-xl bg-white/15 ring-1 ring-white/25 flex items-center justify-center backdrop-blur-sm">
              {showLogo
                ? <img src={branding.logo_url} alt="logo" className="h-7 max-w-28 object-contain" />
                : <HardHat className="w-6 h-6 text-white" />}
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white">{welcomeTitle}</h1>
              <p className="text-white/80 text-sm">{welcomeSubtitle || contractor.name}</p>
            </div>
          </div>
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${status.color}`}>
            <StatusIcon className="w-3.5 h-3.5" />
            {status.label}
          </div>
          {branding?.intro_message && (
            <p className="text-white/85 text-sm mt-3 max-w-2xl">{branding.intro_message}</p>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 -mt-4 pb-12">
        {/* Status banner */}
        {isApproved && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 mb-4 flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-emerald-900">You're approved to work on our sites</p>
              <p className="text-sm text-emerald-700 mt-0.5">Your onboarding is complete. No further action is needed. Contact us if your details change.</p>
            </div>
          </div>
        )}
        {isRejected && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 mb-4 flex items-start gap-3">
            <XCircle className="w-6 h-6 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-900">Onboarding not approved</p>
              <p className="text-sm text-rose-700 mt-0.5">{contractor.rejection_reason || 'Please contact Ground Control to discuss.'}</p>
            </div>
          </div>
        )}
        {saved && !isReadOnly && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <p className="text-sm font-medium text-emerald-800">Details submitted. Our team will review and confirm your approval shortly.</p>
          </div>
        )}
        {saved && contractor.cis_status && contractor.cis_status !== 'pending' && (
          <div className={`rounded-2xl p-4 mb-4 flex items-start gap-3 ${
            contractor.cis_status === 'verified_gross' ? 'bg-emerald-50 border border-emerald-200' :
            contractor.cis_status === 'verified_net' ? 'bg-amber-50 border border-amber-200' :
            contractor.cis_status === 'unknown' || contractor.cis_status === 'failed' ? 'bg-rose-50 border border-rose-200' :
            'bg-slate-50 border border-slate-200'
          }`}>
            {contractor.cis_status === 'verified_gross' ? <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" /> :
             contractor.cis_status === 'verified_net' ? <ShieldCheck className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" /> :
             <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />}
            <div>
              <p className="text-sm font-semibold text-slate-900">CIS Verification Complete</p>
              <p className="text-sm text-slate-600 mt-0.5">
                {contractor.cis_status === 'verified_gross' && `Your CIS status has been verified with HMRC — you will be paid gross (${contractor.cis_tax_rate === 0 ? '0% deduction' : '20% higher rate'}).`}
                {contractor.cis_status === 'verified_net' && `Your CIS status has been verified with HMRC — 30% deduction applies to payments.`}
                {contractor.cis_status === 'unknown' && `HMRC could not match your details. Please check your UTR and National Insurance number are correct.`}
                {contractor.cis_status === 'failed' && `CIS verification failed. Our team will contact you to resolve this.`}
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Contact details */}
          <Section icon={Mail} title="Contact Details">
            <Field label="Contact name">
              <input type="text" value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} disabled={isReadOnly}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 disabled:bg-slate-50" />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Email">
                <input type="email" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} disabled={isReadOnly}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 disabled:bg-slate-50" />
              </Field>
              <Field label="Phone">
                <input type="tel" value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} disabled={isReadOnly}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 disabled:bg-slate-50" />
              </Field>
            </div>
          </Section>

          {/* Company details */}
          <Section icon={Building2} title="Company Details">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Companies House reg. number">
                <input type="text" value={form.company_reg_number} onChange={e => setForm(f => ({ ...f, company_reg_number: e.target.value }))} disabled={isReadOnly}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 disabled:bg-slate-50" />
              </Field>
              <Field label="VAT number">
                <input type="text" value={form.vat_number} onChange={e => setForm(f => ({ ...f, vat_number: e.target.value }))} disabled={isReadOnly}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 disabled:bg-slate-50" />
              </Field>
            </div>
            <Field label="HSE / UKAS registration">
              <input type="text" value={form.hse_registration} onChange={e => setForm(f => ({ ...f, hse_registration: e.target.value }))} disabled={isReadOnly}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 disabled:bg-slate-50" />
            </Field>
          </Section>

          {/* Services offered */}
          <Section icon={HardHat} title="Services Offerered">
            <div className="flex flex-wrap gap-2">
              {SERVICE_OPTIONS.map(s => {
                const active = (form.services_offered || []).includes(s.key);
                return (
                  <button key={s.key} type="button" onClick={() => !isReadOnly && toggleArray('services_offered', s.key)} disabled={isReadOnly}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'} ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}>
                    {active && <CheckCircle className="w-3.5 h-3.5 inline mr-1" />}
                    {s.label}
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Accreditations */}
          <Section icon={Award} title="Accreditations">
            <div className="flex flex-wrap gap-2">
              {ACCREDITATION_OPTIONS.map(a => {
                const active = (form.accreditations || []).includes(a.key);
                return (
                  <button key={a.key} type="button" onClick={() => !isReadOnly && toggleArray('accreditations', a.key)} disabled={isReadOnly}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'} ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}>
                    {active && <CheckCircle className="w-3.5 h-3.5 inline mr-1" />}
                    {a.label}
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Insurance */}
          <Section icon={ShieldCheck} title="Insurance Cover">
            <Field label="Insurance provider">
              <input type="text" value={form.insurance_provider} onChange={e => setForm(f => ({ ...f, insurance_provider: e.target.value }))} disabled={isReadOnly}
                placeholder="e.g. AXA, Allianz"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 disabled:bg-slate-50" />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Policy number">
                <input type="text" value={form.insurance_policy_number} onChange={e => setForm(f => ({ ...f, insurance_policy_number: e.target.value }))} disabled={isReadOnly}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 disabled:bg-slate-50" />
              </Field>
              <Field label="Expiry date">
                <input type="date" value={form.insurance_expiry} onChange={e => setForm(f => ({ ...f, insurance_expiry: e.target.value }))} disabled={isReadOnly}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 disabled:bg-slate-50" />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Public liability (£)">
                <input type="number" value={form.public_liability_limit} onChange={e => setForm(f => ({ ...f, public_liability_limit: e.target.value }))} disabled={isReadOnly}
                  placeholder="e.g. 5000000"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 disabled:bg-slate-50" />
              </Field>
              <Field label="Employers liability (£)">
                <input type="number" value={form.employers_liability_limit} onChange={e => setForm(f => ({ ...f, employers_liability_limit: e.target.value }))} disabled={isReadOnly}
                  placeholder="e.g. 10000000"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 disabled:bg-slate-50" />
              </Field>
              <Field label="Prof. indemnity (£)">
                <input type="number" value={form.professional_indemnity_limit} onChange={e => setForm(f => ({ ...f, professional_indemnity_limit: e.target.value }))} disabled={isReadOnly}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 disabled:bg-slate-50" />
              </Field>
            </div>
          </Section>

          {/* CIS details */}
          <Section icon={FileText} title="CIS Tax Details">
            <p className="text-xs text-slate-500 mb-3">Required for HMRC CIS verification. We'll verify your tax status with HMRC once submitted.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="UTR (10-digit tax reference)">
                <input type="text" value={form.utr} onChange={e => setForm(f => ({ ...f, utr: e.target.value }))} disabled={isReadOnly}
                  placeholder="e.g. 1234567890"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 disabled:bg-slate-50" />
              </Field>
              <Field label="National Insurance No. (individuals only)">
                <input type="text" value={form.nino} onChange={e => setForm(f => ({ ...f, nino: e.target.value }))} disabled={isReadOnly}
                  placeholder="e.g. AB123456C"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 disabled:bg-slate-50" />
              </Field>
            </div>
            {contractor.cis_status && contractor.cis_status !== 'pending' && (
              <div className="mt-2 text-xs text-slate-500">
                CIS status: <span className="font-semibold">{contractor.cis_status.replace(/_/g, ' ')}</span>
                {contractor.cis_verified_at && ` · verified ${new Date(contractor.cis_verified_at).toLocaleDateString()}`}
              </div>
            )}
          </Section>

          {/* Submit */}
          {!isReadOnly && (
            <button type="submit" disabled={saving}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-emerald-700 text-white rounded-xl font-semibold hover:bg-emerald-800 disabled:opacity-50 transition shadow-sm">
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              {saving ? 'Submitting…' : 'Submit Onboarding Details'}
            </button>
          )}
        </form>

        <p className="text-center text-xs text-slate-400 mt-6">
          {branding?.footer_text || 'Ground Control'} · Sub-contractor Onboarding Portal
          {branding?.support_phone && <span className="block mt-1">📞 {branding.support_phone}</span>}
          {branding?.support_email && <span className="block">✉️ {branding.support_email}</span>}
        </p>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
          <Icon className="w-4 h-4 text-emerald-600" />
        </div>
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

// Lighten/darken a hex colour by a percentage (-100..100)
function shadeHex(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + Math.round(255 * percent / 100)));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * percent / 100)));
  const b = Math.max(0, Math.min(255, (num & 0xff) + Math.round(255 * percent / 100)));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}