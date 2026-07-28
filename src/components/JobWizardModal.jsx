import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, ChevronLeft, ChevronRight, Check, Briefcase, CalendarDays, Users, MapPin, FileText, Sparkles, Loader2, FolderOpen, PoundSterling, Target, AlertTriangle, HardHat } from 'lucide-react';
import ProjectSelect from '@/components/ProjectSelect';
import { getJobTypeColor, getJobTypeLabel } from '@/utils/jobTeams';

const inputCls = "w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10 text-sm transition";

const STEPS = [
  { id: 1, label: 'Identity', icon: Briefcase },
  { id: 2, label: 'Schedule & Crew', icon: CalendarDays },
  { id: 3, label: 'Review', icon: Check },
];

const emptyForm = {
  name: '', job_reference: '', job_type: '', location: '', required_team_ids: [],
  status: 'planning', start_date: '', end_date: '', client_id: '', contractor_id: '',
  project_id: '', project_manager: '', site_contact_name: '', site_contact_phone: '',
  notes: '', budget_amount: '',
  meterage_rate: '', meterage_target: '', drilling_method: 'not_applicable',
};

export default function JobWizardModal({ open, onClose, onCreated, editingJob }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
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
      setForm(editingJob ? { ...emptyForm, ...editingJob } : emptyForm);
    }
  }, [open, editingJob]);

  if (!open) return null;

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const selectedTeamIds = Array.isArray(form.required_team_ids) ? form.required_team_ids : [];
  const toggleTeam = (id) => set('required_team_ids', selectedTeamIds.includes(id) ? selectedTeamIds.filter(t => t !== id) : [...selectedTeamIds, id]);

  const stepValid = () => {
    if (step === 1) return !!form.name?.trim() && !!form.location?.trim();
    if (step === 2) return !!form.start_date && !!form.end_date && new Date(form.end_date) >= new Date(form.start_date);
    return true;
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError('');
    try {
      const clean = { ...form };
      ['budget_amount', 'meterage_rate', 'meterage_target'].forEach(k => { if (clean[k] === '' || clean[k] === undefined) delete clean[k]; });
      let saved;
      if (editingJob?.id) {
        saved = await base44.entities.Job.update(editingJob.id, clean);
      } else {
        saved = await base44.entities.Job.create(clean);
      }
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      onCreated?.(saved);
    } catch (e) {
      setError(e?.message || 'Could not save the job. Check all required fields.');
      setStep(1);
    } finally {
      setSaving(false);
    }
  };

  const fmtDate = (d) => { try { return d ? new Date(d + 'T00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; } catch { return d || '—'; } };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white w-full sm:max-w-4xl sm:rounded-2xl shadow-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-[#2E5A1A]/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#2E5A1A] flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{editingJob ? 'Edit Job' : 'New Job'}</h2>
              <p className="text-xs text-slate-400">{editingJob ? 'Update the details below' : 'Quick setup — you can flesh it out later'}</p>
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
                    {s.label}
                  </div>
                  {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 rounded ${done ? 'bg-[#2E5A1A]/40' : 'bg-slate-200'}`} />}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Body: form + live snapshot */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid lg:grid-cols-[1fr_320px]">
            {/* Form side */}
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

              {/* STEP 2 — Schedule & Crew */}
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
                  {/* Billing Setup */}
                  <div className="bg-[#2E5A1A]/5 border border-[#2E5A1A]/15 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <PoundSterling className="w-4 h-4 text-[#2E5A1A]" />
                      <span className="text-sm font-semibold text-slate-800">Billing Setup</span>
                      <span className="text-xs text-slate-400">· drilling method & per-metre rates</span>
                    </div>
                    {/* Drilling method selector */}
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">Drilling Method</label>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { val: 'cp', label: 'CP', desc: 'Cable Percussion' },
                          { val: 'rotary', label: 'Rotary', desc: 'Rotary Core' },
                          { val: 'mixed', label: 'Mixed', desc: 'Both CP + Rotary' },
                          { val: 'not_applicable', label: 'N/A', desc: 'Non-drilling' },
                        ].map(m => (
                          <button type="button" key={m.val} onClick={() => set('drilling_method', m.val)}
                            className={`px-2 py-2 rounded-lg border text-center transition ${form.drilling_method === m.val ? 'bg-[#2E5A1A] text-white border-[#2E5A1A]' : 'bg-white border-slate-200 text-slate-600 hover:border-[#2E5A1A]/40'}`}>
                            <span className="block text-xs font-bold">{m.label}</span>
                            <span className="block text-[9px] opacity-70">{m.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Metre Rate (£/m)</label>
                        <div className="relative">
                          <PoundSterling className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                          <input type="number" min="0" step="0.01" value={form.meterage_rate || ''} onChange={e => set('meterage_rate', e.target.value)} placeholder="Auto from rate card" className={`${inputCls} pl-9`} />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Target Meterage (m)</label>
                        <div className="relative">
                          <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                          <input type="number" min="0" step="0.1" value={form.meterage_target || ''} onChange={e => set('meterage_target', e.target.value)} placeholder="0" className={`${inputCls} pl-9`} />
                        </div>
                      </div>
                    </div>
                    {/* Rate card warning */}
                    {!form.project_id && (
                      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-[11px] text-amber-700">No project assigned — this job will bill against the <strong>Global Master Price List</strong> only. Assign a project to use project-specific rate cards (e.g. EWR schedule of rates).</p>
                      </div>
                    )}
                    {form.project_id && form.drilling_method !== 'not_applicable' && (
                      <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                        <HardHat className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                        <p className="text-[11px] text-emerald-700">Per-metre rates will auto-match from the project rate card's <strong>{form.drilling_method === 'cp' ? 'CP Drilling' : form.drilling_method === 'rotary' ? 'Rotary Drilling' : 'CP + Rotary'}</strong> section. Leave metre rate blank for auto-pricing.</p>
                      </div>
                    )}
                    <p className="text-[11px] text-slate-400">Leave metre rate blank to auto-price from the project rate card. Set a rate to bill a fixed £/m for all metres drilled.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Project Manager</label>
                      <input type="text" value={form.project_manager || ''} onChange={e => set('project_manager', e.target.value)} placeholder="Responsible person" className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Budget (GBP)</label>
                      <input type="number" min="0" step="0.01" value={form.budget_amount || ''} onChange={e => set('budget_amount', e.target.value)} placeholder="0.00" className={inputCls} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
                    <textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} rows="2" placeholder="Scope, access, special requirements..." className={inputCls} />
                  </div>
                </div>
              )}

              {/* STEP 3 — Review */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-[#2E5A1A]">
                    <Sparkles className="w-4 h-4" />
                    <p className="text-sm font-semibold">Ready to create</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <ReviewRow label="Name" value={form.name} />
                    <ReviewRow label="Location" value={form.location} />
                    <ReviewRow label="Type" value={getJobTypeLabel(form.job_type, jobTypes) || form.job_type} />
                    <ReviewRow label="Client" value={clients.find(c => c.id === form.client_id)?.name} />
                    <ReviewRow label="Schedule" value={form.start_date && form.end_date ? `${fmtDate(form.start_date)} → ${fmtDate(form.end_date)}` : ''} />
                    <ReviewRow label="Project" value={projects.find(p => p.id === form.project_id)?.name} />
                    <ReviewRow label="Teams" value={selectedTeamIds.map(id => teams.find(t => t.id === id)?.name).filter(Boolean).join(', ')} />
                    <ReviewRow label="Budget" value={form.budget_amount ? `£${form.budget_amount}` : ''} />
                    <ReviewRow label="Drilling Method" value={{ cp: 'Cable Percussion', rotary: 'Rotary', mixed: 'Mixed', not_applicable: 'N/A' }[form.drilling_method] || 'N/A'} />
                    <ReviewRow label="Metre Rate" value={form.meterage_rate ? `£${form.meterage_rate}/m` : 'Auto from rate card'} />
                    <ReviewRow label="Target" value={form.meterage_target ? `${form.meterage_target}m` : ''} />
                  </div>
                  <p className="text-xs text-slate-400">Equipment, documents and the full rota can be added from the job page after creation.</p>
                </div>
              )}
            </div>

            {/* Live snapshot side */}
            <div className="hidden lg:block border-l border-slate-100 bg-slate-50/50 p-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Live Snapshot
              </p>
              <JobSnapshotCard form={form} clients={clients} teams={teams} jobTypes={jobTypes} projects={projects} fmtDate={fmtDate} />
            </div>
          </div>
        </div>

        {/* Footer / nav */}
        <div className="flex items-center gap-3 px-5 py-4 border-t border-slate-100 bg-white">
          {step > 1 && (
            <button type="button" onClick={() => setStep(step - 1)} className="px-4 py-2.5 bg-white text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-100 transition border border-slate-200 flex items-center gap-1.5">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          )}
          {step < 3 ? (
            <button type="button" onClick={() => stepValid() && setStep(step + 1)} disabled={!stepValid()} className="flex-1 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-lg text-sm font-semibold hover:bg-[#1c4a12] transition disabled:opacity-40 flex items-center justify-center gap-1.5">
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={saving} className="flex-1 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-lg text-sm font-semibold hover:bg-[#1c4a12] transition disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : <><Check className="w-4 h-4" /> {editingJob ? 'Update Job' : 'Create Job'}</>}
            </button>
          )}
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-slate-500 hover:text-slate-700 text-sm font-medium transition">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function ReviewRow({ label, value }) {
  return (
    <div className="flex items-start gap-2 px-3 py-2 bg-slate-50 rounded-lg">
      <span className="text-xs text-slate-400 font-medium min-w-[70px]">{label}</span>
      <span className="text-sm text-slate-800 font-medium flex-1 break-words">{value || '—'}</span>
    </div>
  );
}

function JobSnapshotCard({ form, clients, teams, jobTypes, projects, fmtDate }) {
  const client = clients.find(c => c.id === form.client_id);
  const project = projects.find(p => p.id === form.project_id);
  const color = getJobTypeColor(form.job_type, jobTypes);
  const selectedTeamIds = Array.isArray(form.required_team_ids) ? form.required_team_ids : [];
  const statusLabels = { planning: 'Planning', in_progress: 'In Progress', completed: 'Completed' };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className={`h-1.5 ${color?.bar || 'bg-slate-300'}`} />
      <div className="p-4">
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${color?.badge || 'bg-slate-100 text-slate-500'}`}>{getJobTypeLabel(form.job_type, jobTypes) || 'No type'}</span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{statusLabels[form.status] || 'Planning'}</span>
        </div>
        <h3 className="font-bold text-slate-900 text-sm mb-1 break-words">{form.name || 'Untitled job'}</h3>
        {project && (
          <div className="flex items-center gap-1 mb-1">
            <FolderOpen className="w-3 h-3 text-indigo-500" />
            <span className="text-[11px] text-indigo-600 truncate">{project.name}</span>
          </div>
        )}
        {client && <p className="text-[11px] text-slate-400 mb-1.5 truncate">{client.name}</p>}
        <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1.5">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{form.location || 'No location'}</span>
        </div>
        <div className="flex items-start gap-1.5 text-slate-400 text-[11px] mb-2">
          <CalendarDays className="w-3 h-3 flex-shrink-0 mt-0.5" />
          <span className="break-words">{form.start_date ? `${fmtDate(form.start_date)} → ${fmtDate(form.end_date)}` : 'No dates'}</span>
        </div>
        {selectedTeamIds.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-2 border-t border-slate-100">
            {selectedTeamIds.slice(0, 4).map(id => {
              const t = teams.find(t => t.id === id);
              return t ? <span key={id} className="text-[10px] bg-[#2E5A1A]/10 text-[#2E5A1A] px-1.5 py-0.5 rounded-full font-medium">{t.name}</span> : null;
            })}
          </div>
        )}
        {form.notes && (
          <p className="text-[11px] text-slate-400 mt-2 line-clamp-2 italic">"{form.notes}"</p>
        )}
      </div>
    </div>
  );
}