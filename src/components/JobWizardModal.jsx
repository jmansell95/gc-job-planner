import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  X, ChevronLeft, ChevronRight, Check, Briefcase, CalendarDays, Users, MapPin,
  FileText, Sparkles, Loader2, FolderOpen, PoundSterling, Target, AlertTriangle,
  HardHat, Receipt, Percent, Building2, Phone, Ruler, FileCheck2, ArrowRightLeft,
} from 'lucide-react';
import ProjectSelect from '@/components/ProjectSelect';
import SubcontractorAssignments from '@/components/SubcontractorAssignments';
import { getJobTypeColor, getJobTypeLabel, isDrillingJobType } from '@/utils/jobTeams';

const inputCls = "w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10 text-sm transition";

const STEPS = [
  { id: 1, label: 'Identity', icon: Briefcase },
  { id: 2, label: 'Schedule & Contacts', icon: CalendarDays },
  { id: 3, label: 'Billing', icon: Receipt },
  { id: 4, label: 'Sub-Contractors', icon: Building2 },
  { id: 5, label: 'Review', icon: Check },
];

const REVENUE_METHODS = [
  { val: 'none', label: 'Markup on Cost', desc: 'Internal cost + markup %', icon: Percent, hint: 'Revenue = total cost × (1 + markup%). Use when you don\'t have a fixed rate — the engine costs everything and adds your margin.' },
  { val: 'meterage_rate', label: 'Meterage Rate', desc: '£ per metre drilled', icon: Ruler, hint: 'Revenue = total metres × £/m rate. For drilling jobs billed by the metre. Set the rate below or leave blank to auto-match from the rate card.' },
  { val: 'day_rate', label: 'Day Rate', desc: 'Crew day rates × days', icon: Users, hint: 'Revenue = sum of assigned crew day rates × working days. For jobs billed at daily crew rates from the schedule of rates.' },
  { val: 'unit_rate', label: 'Unit Rate', desc: '£ per unit completed', icon: FileCheck2, hint: 'Revenue = units completed × £/unit. For groundworks (trial pits, EV chargers, core runs). Set the unit price below.' },
  { val: 'flat_fee', label: 'Flat Fee', desc: 'Single agreed project fee', icon: PoundSterling, hint: 'Revenue = fixed agreed amount. For lump-sum projects. Set the fee below.' },
];

const DRILLING_METHODS = [
  { val: 'cp', label: 'CP', desc: 'Cable Percussion' },
  { val: 'rotary', label: 'Rotary', desc: 'Rotary Core' },
  { val: 'mixed', label: 'Mixed', desc: 'Both CP + Rotary' },
  { val: 'not_applicable', label: 'N/A', desc: 'Non-drilling' },
];

const emptyForm = {
  name: '', job_reference: '', job_type: '', location: '', required_team_ids: [],
  status: 'planning', start_date: '', end_date: '', client_id: '', contractor_id: '',
  project_id: '', project_manager: '', site_contact_name: '', site_contact_phone: '',
  notes: '', budget_amount: '',
  // Billing & financials
  revenue_method: 'none', drilling_method: 'not_applicable',
  meterage: '', meterage_rate: '', meterage_target: '',
  unit_price: '', markup_percentage: '', vat_rate: 20,
  client_charge: '', client_charge_description: '',
};

export default function JobWizardModal({ open, onClose, onCreated, editingJob }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [subAssignments, setSubAssignments] = useState([]);
  const [originalSubIds, setOriginalSubIds] = useState([]);
  const queryClient = useQueryClient();

  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list(), enabled: open });
  const { data: contractors = [] } = useQuery({ queryKey: ['contractors'], queryFn: () => base44.entities.Contractor.list(), enabled: open });
  const { data: teams = [] } = useQuery({ queryKey: ['teams'], queryFn: () => base44.entities.Team.list(), enabled: open });
  const { data: jobTypes = [] } = useQuery({ queryKey: ['job-types'], queryFn: () => base44.entities.JobType.list('-order'), enabled: open });
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => base44.entities.Project.list('-created_date', 200), enabled: open });

  useEffect(() => {
    if (open) {
      setStep(1);
      setError('');
      setSubAssignments([]);
      setOriginalSubIds([]);
      setForm(editingJob ? { ...emptyForm, ...editingJob } : emptyForm);
      if (editingJob?.id) {
        base44.entities.SubcontractorLog.filter({ job_id: editingJob.id }, '-date', 200).then(logs => {
          const mapped = logs.map(l => ({
            id: l.id,
            subcontractor_id: l.subcontractor_id || '',
            work_type: l.work_type || 'drilling',
            description: l.description || '',
            borehole_ref: l.borehole_ref || '',
            purchase_rate_basis: l.purchase_rate_basis || 'day_rate',
            purchase_rate: l.purchase_rate != null ? String(l.purchase_rate) : '',
            hours_worked: l.hours_worked != null ? String(l.hours_worked) : '',
            metres_drilled: l.metres_drilled != null ? String(l.metres_drilled) : '',
            units_completed: l.units_completed != null ? String(l.units_completed) : '',
            units_label: l.units_label || '',
            markup_percentage: l.markup_percentage != null ? l.markup_percentage : 15,
            po_number: l.po_number || '',
            _date: l.date || new Date().toISOString().slice(0, 10),
          }));
          setSubAssignments(mapped);
          setOriginalSubIds(logs.map(l => l.id));
        }).catch(() => {});
      }
    }
  }, [open, editingJob]);

  if (!open) return null;

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const selectedTeamIds = Array.isArray(form.required_team_ids) ? form.required_team_ids : [];
  const toggleTeam = (id) => set('required_team_ids', selectedTeamIds.includes(id) ? selectedTeamIds.filter(t => t !== id) : [...selectedTeamIds, id]);

  const isDrilling = isDrillingJobType(form.job_type, jobTypes) || form.drilling_method !== 'not_applicable' || teams.some(t => selectedTeamIds.includes(t.id) && isDrillingJobType(t.job_type, jobTypes));

  const stepValid = () => {
    if (step === 1) return !!form.name?.trim() && !!form.location?.trim();
    if (step === 2) return !!form.start_date && !!form.end_date && new Date(form.end_date) >= new Date(form.start_date);
    if (step === 3) {
      // Validate billing-specific required fields
      if (form.revenue_method === 'flat_fee' && !form.client_charge) return false;
      if (form.revenue_method === 'unit_rate' && !form.unit_price) return false;
      return true;
    }
    // Step 4 (Sub-Contractors) is always valid — optional
    return true;
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError('');
    try {
      const clean = { ...form };
      // Convert empty numeric strings to undefined so the schema uses defaults
      ['budget_amount', 'meterage', 'meterage_rate', 'meterage_target', 'unit_price', 'markup_percentage', 'vat_rate', 'client_charge'].forEach(k => {
        if (clean[k] === '' || clean[k] === undefined) delete clean[k];
        else if (k !== 'vat_rate') clean[k] = parseFloat(clean[k]);
      });
      // vat_rate defaults to 20 — keep it
      if (form.vat_rate) clean.vat_rate = parseFloat(form.vat_rate);
      let saved;
      if (editingJob?.id) {
        saved = await base44.entities.Job.update(editingJob.id, clean);
      } else {
        saved = await base44.entities.Job.create(clean);
      }
      const jobId = saved.id || editingJob?.id;

      // Save sub-contractor assignments
      const keptIds = new Set();
      for (const a of subAssignments) {
        if (!a.subcontractor_id) continue;
        const sub = contractors.find(c => c.id === a.subcontractor_id);
        const vatRate = 20;
        const rate = parseFloat(a.purchase_rate) || 0;
        let purchaseCost = 0;
        if (a.purchase_rate_basis === 'flat_fee' || a.purchase_rate_basis === 'item_cost') purchaseCost = rate;
        else if (a.purchase_rate_basis === 'day_rate') purchaseCost = rate * 1;
        else if (a.purchase_rate_basis === 'hourly_rate') purchaseCost = rate * (parseFloat(a.hours_worked) || 0);
        else if (a.purchase_rate_basis === 'per_metre') purchaseCost = rate * (parseFloat(a.metres_drilled) || 0);
        else if (a.purchase_rate_basis === 'per_unit') purchaseCost = rate * (parseFloat(a.units_completed) || 0);
        const markup = parseFloat(a.markup_percentage) || 0;
        const clientCharge = purchaseCost * (1 + markup / 100);
        const marginNet = clientCharge - purchaseCost;
        const marginPct = clientCharge > 0 ? (marginNet / clientCharge) * 100 : 0;
        const weekStart = new Date(a._date);
        weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
        const payload = {
          job_id: jobId,
          subcontractor_id: a.subcontractor_id,
          subcontractor_name: sub?.name || '',
          date: a._date,
          week_start: weekStart.toISOString().slice(0, 10),
          work_type: a.work_type,
          description: a.description,
          borehole_ref: a.borehole_ref || undefined,
          metres_drilled: parseFloat(a.metres_drilled) || undefined,
          units_completed: parseFloat(a.units_completed) || undefined,
          units_label: a.units_label || undefined,
          hours_worked: parseFloat(a.hours_worked) || undefined,
          purchase_cost_net: Math.round(purchaseCost * 100) / 100,
          purchase_cost_vat: Math.round(purchaseCost * vatRate / 100 * 100) / 100,
          purchase_cost_gross: Math.round((purchaseCost + purchaseCost * vatRate / 100) * 100) / 100,
          purchase_rate_basis: a.purchase_rate_basis,
          purchase_rate: rate,
          markup_percentage: markup,
          client_charge_net: Math.round(clientCharge * 100) / 100,
          client_charge_vat: Math.round(clientCharge * vatRate / 100 * 100) / 100,
          client_charge_gross: Math.round((clientCharge + clientCharge * vatRate / 100) * 100) / 100,
          sell_rate_basis: 'markup_on_cost',
          margin_net: Math.round(marginNet * 100) / 100,
          margin_pct: Math.round(marginPct * 10) / 10,
          po_number: a.po_number || undefined,
          status: 'pending',
        };
        if (a.id) {
          await base44.entities.SubcontractorLog.update(a.id, payload);
          keptIds.add(a.id);
        } else {
          const created = await base44.entities.SubcontractorLog.create(payload);
          keptIds.add(created.id);
        }
      }
      // Delete removed assignments
      for (const oldId of originalSubIds) {
        if (!keptIds.has(oldId)) {
          await base44.entities.SubcontractorLog.delete(oldId);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['auto-job-financials', jobId] });
      queryClient.invalidateQueries({ queryKey: ['subcon-logs', jobId] });
      onCreated?.(saved);
    } catch (e) {
      setError(e?.message || 'Could not save the job. Check all required fields.');
      setStep(1);
    } finally {
      setSaving(false);
    }
  };

  const fmtDate = (d) => { try { return d ? new Date(d + 'T00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; } catch { return d || '—'; } };
  const methodLabel = REVENUE_METHODS.find(m => m.val === form.revenue_method)?.label || 'Markup on Cost';

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-4xl sm:rounded-2xl shadow-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden rounded-t-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-[#2E5A1A]/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#2E5A1A] flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{editingJob?.id ? 'Edit Job' : 'New Job'}</h2>
              <p className="text-xs text-slate-400">{editingJob?.id ? 'Update the details below' : 'Set up the job with full billing details'}</p>
            </div>
          </div>
          <button onClick={onClose} type="button" className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper */}
        <div className="px-5 py-3 border-b border-slate-50 bg-slate-50/50">
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => {
              const active = s.id === step;
              const done = s.id < step;
              const Icon = s.icon;
              return (
                <React.Fragment key={s.id}>
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition ${active ? 'bg-[#2E5A1A] text-white' : done ? 'bg-[#2E5A1A]/10 text-[#2E5A1A]' : 'bg-white text-slate-400 border border-slate-200'}`}>
                    {done ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">{s.label}</span>
                  </div>
                  {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 rounded ${done ? 'bg-[#2E5A1A]/40' : 'bg-slate-200'}`} />}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid lg:grid-cols-[1fr_280px]">
            <div className="p-5 space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>
              )}

              {/* STEP 1 — Identity */}
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Job Name <span className="text-red-500">*</span></label>
                    <input autoFocus type="text" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Riverside Site Investigation" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Location <span className="text-red-500">*</span></label>
                    <input type="text" value={form.location} onChange={e => set('location', e.target.value)} placeholder="Site address" className={inputCls} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Job Type</label>
                      <select value={form.job_type || ''} onChange={e => set('job_type', e.target.value)} className={inputCls}>
                        <option value="">Select Type</option>
                        {jobTypes.map(jt => <option key={jt.id} value={jt.key}>{jt.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Reference</label>
                      <input type="text" value={form.job_reference || ''} onChange={e => set('job_reference', e.target.value)} placeholder="PO / quote no." className={inputCls} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Client</label>
                    <select value={form.client_id || ''} onChange={e => set('client_id', e.target.value)} className={inputCls}>
                      <option value="">No client</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Project <span className="text-xs text-slate-400 font-normal">· group jobs together</span></label>
                    <ProjectSelect
                      value={form.project_id || ''}
                      onChange={(pid) => set('project_id', pid)}
                      onClientInherit={(cid) => set('client_id', form.client_id || cid)}
                    />
                  </div>
                </div>
              )}

              {/* STEP 2 — Schedule & Contacts */}
              {step === 2 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Start Date <span className="text-red-500">*</span></label>
                      <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">End Date <span className="text-red-500">*</span></label>
                      <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} className={inputCls} />
                    </div>
                  </div>
                  {form.start_date && form.end_date && new Date(form.end_date) < new Date(form.start_date) && (
                    <p className="text-xs text-red-600">End date is before start date.</p>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Required Teams <span className="text-xs text-slate-400 font-normal">· who can be assigned</span></label>
                    {teams.length === 0 ? (
                      <p className="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">No teams yet — add them in Settings.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {teams.map(t => {
                          const selected = selectedTeamIds.includes(t.id);
                          return (
                            <button type="button" key={t.id} onClick={() => toggleTeam(t.id)}
                              className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition font-medium ${selected ? 'bg-[#2E5A1A] text-white border-[#2E5A1A]' : 'bg-white border-slate-200 text-slate-600 hover:border-[#2E5A1A]/40'}`}>
                              <Users className="w-3 h-3" />{t.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Project Manager</label>
                      <input type="text" value={form.project_manager || ''} onChange={e => set('project_manager', e.target.value)} placeholder="Responsible person" className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Budget (GBP)</label>
                      <div className="relative">
                        <PoundSterling className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input type="number" min="0" step="0.01" value={form.budget_amount || ''} onChange={e => set('budget_amount', e.target.value)} placeholder="0.00" className={`${inputCls} pl-9`} />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Site Contact Name</label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input type="text" value={form.site_contact_name || ''} onChange={e => set('site_contact_name', e.target.value)} placeholder="On-site contact" className={`${inputCls} pl-9`} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Site Contact Phone</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input type="tel" value={form.site_contact_phone || ''} onChange={e => set('site_contact_phone', e.target.value)} placeholder="On-site number" className={`${inputCls} pl-9`} />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
                    <textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} rows="2" placeholder="Scope, access, special requirements..." className={inputCls} />
                  </div>
                </div>
              )}

              {/* STEP 3 — Billing & Financials */}
              {step === 3 && (
                <div className="space-y-4">
                  {/* Revenue method selector — the key field */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-1.5">How is this job billed? <span className="text-red-500">*</span></label>
                    <p className="text-xs text-slate-400 mb-3">This determines how revenue is calculated. You can't forget to set it — pick one now.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {REVENUE_METHODS.map(m => {
                        const Icon = m.icon;
                        const selected = form.revenue_method === m.val;
                        return (
                          <button type="button" key={m.val} onClick={() => set('revenue_method', m.val)}
                            className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition ${selected ? 'bg-[#2E5A1A]/5 border-[#2E5A1A] ring-1 ring-[#2E5A1A]/20' : 'bg-white border-slate-200 hover:border-[#2E5A1A]/40'}`}>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${selected ? 'bg-[#2E5A1A] text-white' : 'bg-slate-100 text-slate-500'}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className={`text-sm font-bold ${selected ? 'text-[#2E5A1A]' : 'text-slate-800'}`}>{m.label}</p>
                              <p className="text-[11px] text-slate-500">{m.desc}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Method hint */}
                  <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] text-blue-700">{REVENUE_METHODS.find(m => m.val === form.revenue_method)?.hint}</p>
                  </div>

                  {/* Drilling method (shown for meterage or if job type is drilling) */}
                  {(isDrilling || form.revenue_method === 'meterage_rate') && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <HardHat className="w-4 h-4 text-[#2E5A1A]" />
                        <span className="text-sm font-semibold text-slate-800">Drilling Details</span>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1.5">Drilling Method</label>
                        <div className="grid grid-cols-4 gap-2">
                          {DRILLING_METHODS.map(m => (
                            <button type="button" key={m.val} onClick={() => set('drilling_method', m.val)}
                              className={`px-2 py-2 rounded-lg border text-center transition ${form.drilling_method === m.val ? 'bg-[#2E5A1A] text-white border-[#2E5A1A]' : 'bg-white border-slate-200 text-slate-600 hover:border-[#2E5A1A]/40'}`}>
                              <span className="block text-xs font-bold">{m.label}</span>
                              <span className="block text-[9px] opacity-70">{m.desc}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Total Meterage (m)</label>
                          <div className="relative">
                            <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input type="number" min="0" step="0.1" value={form.meterage || ''} onChange={e => set('meterage', e.target.value)} placeholder="Auto from logs" className={`${inputCls} pl-9`} />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Metre Rate (£/m)</label>
                          <div className="relative">
                            <PoundSterling className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input type="number" min="0" step="0.01" value={form.meterage_rate || ''} onChange={e => set('meterage_rate', e.target.value)} placeholder="Auto from rate card" className={`${inputCls} pl-9`} />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Target (m)</label>
                          <div className="relative">
                            <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input type="number" min="0" step="0.1" value={form.meterage_target || ''} onChange={e => set('meterage_target', e.target.value)} placeholder="0" className={`${inputCls} pl-9`} />
                          </div>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-400">Leave metre rate blank to auto-price from the project rate card's depth-banded rates. Set a rate to bill a fixed £/m for all metres.</p>
                    </div>
                  )}

                  {/* Unit rate fields */}
                  {form.revenue_method === 'unit_rate' && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <FileCheck2 className="w-4 h-4 text-[#2E5A1A]" />
                        <span className="text-sm font-semibold text-slate-800">Unit Rate Pricing</span>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Unit Price (£ per unit) <span className="text-red-500">*</span></label>
                        <div className="relative">
                          <PoundSterling className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                          <input type="number" min="0" step="0.01" value={form.unit_price || ''} onChange={e => set('unit_price', e.target.value)} placeholder="e.g. 85.00 per trial pit" className={`${inputCls} pl-9`} />
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">Revenue = units completed (from site logs) × this price. Units are counted from InvestigationLog entries with units_completed set.</p>
                      </div>
                    </div>
                  )}

                  {/* Flat fee fields */}
                  {form.revenue_method === 'flat_fee' && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <PoundSterling className="w-4 h-4 text-[#2E5A1A]" />
                        <span className="text-sm font-semibold text-slate-800">Flat Fee</span>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Agreed Fee (GBP) <span className="text-red-500">*</span></label>
                        <div className="relative">
                          <PoundSterling className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                          <input type="number" min="0" step="0.01" value={form.client_charge || ''} onChange={e => set('client_charge', e.target.value)} placeholder="e.g. 15000.00" className={`${inputCls} pl-9`} />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Fee Label <span className="text-xs text-slate-400 font-normal">· shown on the client portal</span></label>
                        <input type="text" value={form.client_charge_description || ''} onChange={e => set('client_charge_description', e.target.value)} placeholder="e.g. Agreed quote, Project Investment" className={inputCls} />
                      </div>
                    </div>
                  )}

                  {/* Markup fields (for 'none' method) */}
                  {form.revenue_method === 'none' && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Percent className="w-4 h-4 text-[#2E5A1A]" />
                        <span className="text-sm font-semibold text-slate-800">Markup on Cost</span>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Markup Percentage (%)</label>
                        <div className="relative">
                          <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                          <input type="number" min="0" step="0.1" value={form.markup_percentage || ''} onChange={e => set('markup_percentage', e.target.value)} placeholder="0" className={`${inputCls} pl-9`} />
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">Revenue = total internal cost × (1 + markup%). Example: 15% markup on £10,000 cost = £11,500 revenue. Leave as 0 if you'll set the client charge manually.</p>
                      </div>
                    </div>
                  )}

                  {/* VAT rate (always shown) */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">VAT Rate (%)</label>
                      <div className="relative">
                        <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input type="number" min="0" step="0.1" value={form.vat_rate || ''} onChange={e => set('vat_rate', e.target.value)} placeholder="20" className={`${inputCls} pl-9`} />
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">UK standard rate is 20%.</p>
                    </div>
                  </div>

                  {/* Rate card warnings */}
                  {!form.project_id && (
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-[11px] text-amber-700">No project assigned — this job will bill against the <strong>Global Master Price List</strong> only. Assign a project to use project-specific rate cards (e.g. EWR schedule of rates).</p>
                    </div>
                  )}
                  {form.project_id && form.drilling_method !== 'not_applicable' && (
                    <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                      <HardHat className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <p className="text-[11px] text-emerald-700">Per-metre rates will auto-match from the project rate card's <strong>{form.drilling_method === 'cp' ? 'CP Drilling' : form.drilling_method === 'rotary' ? 'Rotary Drilling' : 'CP + Rotary'}</strong> section.</p>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 4 — Sub-Contractors */}
              {step === 4 && (
                <SubcontractorAssignments
                  assignments={subAssignments}
                  onChange={setSubAssignments}
                  contractors={contractors}
                />
              )}

              {/* STEP 5 — Review */}
              {step === 5 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-[#2E5A1A]">
                    <Sparkles className="w-4 h-4" />
                    <p className="text-sm font-semibold">Ready to {editingJob?.id ? 'update' : 'create'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <ReviewRow label="Name" value={form.name} />
                    <ReviewRow label="Location" value={form.location} />
                    <ReviewRow label="Type" value={getJobTypeLabel(form.job_type, jobTypes) || form.job_type} />
                    <ReviewRow label="Client" value={clients.find(c => c.id === form.client_id)?.name} />
                    <ReviewRow label="Project" value={projects.find(p => p.id === form.project_id)?.name} />
                    <ReviewRow label="Schedule" value={form.start_date && form.end_date ? `${fmtDate(form.start_date)} → ${fmtDate(form.end_date)}` : ''} />
                    <ReviewRow label="Teams" value={selectedTeamIds.map(id => teams.find(t => t.id === id)?.name).filter(Boolean).join(', ')} />
                    <ReviewRow label="Billing Method" value={methodLabel} highlight />
                    <ReviewRow label="Drilling Method" value={{ cp: 'Cable Percussion', rotary: 'Rotary', mixed: 'Mixed', not_applicable: 'N/A' }[form.drilling_method] || 'N/A'} />
                    {form.revenue_method === 'meterage_rate' && <ReviewRow label="Metre Rate" value={form.meterage_rate ? `£${form.meterage_rate}/m` : 'Auto from rate card'} />}
                    {form.revenue_method === 'meterage_rate' && <ReviewRow label="Target" value={form.meterage_target ? `${form.meterage_target}m` : '—'} />}
                    {form.revenue_method === 'unit_rate' && <ReviewRow label="Unit Price" value={form.unit_price ? `£${form.unit_price}/unit` : '—'} />}
                    {form.revenue_method === 'flat_fee' && <ReviewRow label="Flat Fee" value={form.client_charge ? `£${form.client_charge}` : '—'} />}
                    {form.revenue_method === 'none' && <ReviewRow label="Markup" value={form.markup_percentage ? `${form.markup_percentage}%` : '0%'} />}
                    <ReviewRow label="VAT Rate" value={`${form.vat_rate || 20}%`} />
                    <ReviewRow label="Budget" value={form.budget_amount ? `£${form.budget_amount}` : '—'} />
                  </div>
                  {/* Sub-contractor summary */}
                  {subAssignments.filter(a => a.subcontractor_id).length > 0 && (
                    <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <ArrowRightLeft className="w-4 h-4 text-[#2E5A1A]" />
                        <p className="text-sm font-semibold text-slate-800">Sub-Contractors ({subAssignments.filter(a => a.subcontractor_id).length})</p>
                      </div>
                      {subAssignments.filter(a => a.subcontractor_id).map((a, i) => {
                        const sub = contractors.find(c => c.id === a.subcontractor_id);
                        const rate = parseFloat(a.purchase_rate) || 0;
                        let buy = 0;
                        if (a.purchase_rate_basis === 'flat_fee' || a.purchase_rate_basis === 'item_cost') buy = rate;
                        else if (a.purchase_rate_basis === 'day_rate') buy = rate;
                        else if (a.purchase_rate_basis === 'hourly_rate') buy = rate * (parseFloat(a.hours_worked) || 0);
                        else if (a.purchase_rate_basis === 'per_metre') buy = rate * (parseFloat(a.metres_drilled) || 0);
                        else if (a.purchase_rate_basis === 'per_unit') buy = rate * (parseFloat(a.units_completed) || 0);
                        const sell = buy * (1 + (parseFloat(a.markup_percentage) || 0) / 100);
                        return (
                          <div key={i} className="flex items-center gap-2 text-xs bg-white rounded-lg px-2.5 py-1.5 border border-slate-100">
                            <span className="font-semibold text-slate-700">{sub?.name || 'Unknown'}</span>
                            <span className="text-slate-400">·</span>
                            <span className="text-slate-500 capitalize">{a.work_type.replace(/_/g, ' ')}</span>
                            {a.borehole_ref && <span className="text-slate-400">· {a.borehole_ref}</span>}
                            <span className="ml-auto text-slate-500">Buy: <strong className="text-slate-700">£{buy.toFixed(2)}</strong> · Sell: <strong className="text-emerald-700">£{sell.toFixed(2)}</strong></span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <p className="text-xs text-slate-400">Equipment, documents and the full rota can be added from the job page after creation.</p>
                </div>
              )}
            </div>

            {/* Live snapshot */}
            <div className="hidden lg:block border-l border-slate-100 bg-slate-50/50 p-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Live Snapshot
              </p>
              <JobSnapshotCard form={form} clients={clients} teams={teams} jobTypes={jobTypes} projects={projects} fmtDate={fmtDate} methodLabel={methodLabel} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-5 py-4 border-t border-slate-100 bg-white">
          {step > 1 && (
            <button type="button" onClick={() => setStep(step - 1)} className="px-4 py-2.5 bg-white text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-100 transition border border-slate-200 flex items-center gap-1.5">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          )}
          {step < 5 ? (
            <button type="button" onClick={() => stepValid() && setStep(step + 1)} disabled={!stepValid()} className="flex-1 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-lg text-sm font-semibold hover:bg-[#1c4a12] transition disabled:opacity-40 flex items-center justify-center gap-1.5">
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={saving} className="flex-1 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-lg text-sm font-semibold hover:bg-[#1c4a12] transition disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Check className="w-4 h-4" /> {editingJob?.id ? 'Update Job' : 'Create Job'}</>}
            </button>
          )}
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-slate-500 hover:text-slate-700 text-sm font-medium transition">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function ReviewRow({ label, value, highlight }) {
  return (
    <div className={`flex items-start gap-2 px-3 py-2 rounded-lg ${highlight ? 'bg-[#2E5A1A]/5 border border-[#2E5A1A]/15' : 'bg-slate-50'}`}>
      <span className="text-xs text-slate-400 font-medium min-w-[75px]">{label}</span>
      <span className={`text-sm flex-1 break-words ${highlight ? 'text-[#2E5A1A] font-bold' : 'text-slate-800 font-medium'}`}>{value || '—'}</span>
    </div>
  );
}

function JobSnapshotCard({ form, clients, teams, jobTypes, projects, fmtDate, methodLabel }) {
  const client = clients.find(c => c.id === form.client_id);
  const project = projects.find(p => p.id === form.project_id);
  const color = getJobTypeColor(form.job_type, jobTypes);
  const selectedTeamIds = Array.isArray(form.required_team_ids) ? form.required_team_ids : [];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className={`h-1.5 ${color?.bar || 'bg-slate-300'}`} />
      <div className="p-4 space-y-2">
        <h3 className="font-bold text-slate-900 text-sm break-words">{form.name || 'Untitled job'}</h3>
        {project && (
          <div className="flex items-center gap-1">
            <FolderOpen className="w-3 h-3 text-indigo-500" />
            <span className="text-[11px] text-indigo-600 truncate">{project.name}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-slate-500 text-xs">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{form.location || 'No location'}</span>
        </div>
        {client && <p className="text-[11px] text-slate-400 truncate">{client.name}</p>}
        <div className="flex items-start gap-1.5 text-slate-400 text-[11px]">
          <CalendarDays className="w-3 h-3 flex-shrink-0 mt-0.5" />
          <span>{form.start_date ? `${fmtDate(form.start_date)} → ${fmtDate(form.end_date)}` : 'No dates'}</span>
        </div>
        {/* Billing summary */}
        <div className="pt-2 border-t border-slate-100 space-y-1">
          <div className="flex items-center gap-1.5">
            <Receipt className="w-3 h-3 text-[#2E5A1A]" />
            <span className="text-[10px] font-bold text-[#2E5A1A] uppercase tracking-wide">Billing</span>
          </div>
          <p className="text-[11px] text-slate-600 font-medium">{methodLabel}</p>
          {form.revenue_method === 'meterage_rate' && form.meterage_rate && <p className="text-[10px] text-slate-400">{`£${form.meterage_rate}/m${form.meterage_target ? ` · target ${form.meterage_target}m` : ''}`}</p>}
          {form.revenue_method === 'unit_rate' && form.unit_price && <p className="text-[10px] text-slate-400">{`£${form.unit_price}/unit`}</p>}
          {form.revenue_method === 'flat_fee' && form.client_charge && <p className="text-[10px] text-slate-400">{`£${form.client_charge} flat fee`}</p>}
          {form.revenue_method === 'none' && form.markup_percentage && <p className="text-[10px] text-slate-400">{`${form.markup_percentage}% markup`}</p>}
        </div>
        {selectedTeamIds.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {selectedTeamIds.slice(0, 4).map(id => {
              const t = teams.find(t => t.id === id);
              return t ? <span key={id} className="text-[10px] bg-[#2E5A1A]/10 text-[#2E5A1A] px-1.5 py-0.5 rounded-full font-medium">{t.name}</span> : null;
            })}
          </div>
        )}
      </div>
    </div>
  );
}