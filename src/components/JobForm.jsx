import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Briefcase, CalendarDays, Users, PoundSterling, StickyNote, FileText, Upload, Eye, Download, RefreshCw, X, Ruler, UsersRound, Package } from 'lucide-react';
import { isDrillingJobType } from '@/utils/jobTeams';
import EquipmentListEditor from '@/components/EquipmentListEditor';

const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm";

function Section({ title, icon: Icon, children, className = '' }) {
  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-emerald-700" />
        </div>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function Field({ label, children, full, hint }) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}{hint && <span className="text-xs text-slate-400 font-normal ml-1">· {hint}</span>}</label>
      {children}
    </div>
  );
}

export default function JobForm({ formData, setFormData, onSubmit, onCancel, editingId, clients, contractors, onFileUpload, uploadingFile }) {
  const num = (key) => formData[key] === undefined || formData[key] === null ? '' : formData[key];
  const setNum = (key, v) => setFormData({ ...formData, [key]: v === '' ? '' : parseFloat(v) });
  const { data: teams = [] } = useQuery({ queryKey: ['teams'], queryFn: () => base44.entities.Team.list() });
  const { data: jobTypes = [] } = useQuery({ queryKey: ['job-types'], queryFn: () => base44.entities.JobType.list('-order') });

  const selectedTeamIds = Array.isArray(formData.required_team_ids) ? formData.required_team_ids : [];
  const selectedTeams = selectedTeamIds.map(id => teams.find(t => t.id === id)).filter(Boolean);
  const showMeterage = isDrillingJobType(formData.job_type, jobTypes) || selectedTeams.some(t => isDrillingJobType(t.job_type, jobTypes));

  const toggleTeam = (teamId) => {
    const current = selectedTeamIds;
    const next = current.includes(teamId) ? current.filter(id => id !== teamId) : [...current, teamId];
    setFormData({ ...formData, required_team_ids: next });
  };

  return (
    <form onSubmit={onSubmit} className="bg-white rounded-xl border border-emerald-200 shadow-sm p-5 md:p-6 mb-6 space-y-6">
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <h2 className="text-lg font-bold text-slate-900">{editingId ? 'Edit Job' : 'New Job'}</h2>
        <span className="text-xs text-slate-400">{editingId ? 'Update job details' : 'Create a new job record'}</span>
      </div>

      {/* Job Details */}
      <Section title="Job Details" icon={Briefcase}>
        <Field label="Job Name">
          <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required className={inputCls} />
        </Field>
        <Field label="Job Reference" hint="PO / quote no.">
          <input type="text" value={formData.job_reference || ''} onChange={(e) => setFormData({ ...formData, job_reference: e.target.value })} placeholder="e.g. PO-10245" className={inputCls} />
        </Field>
        <Field label="Job Type">
          <select value={formData.job_type || ''} onChange={(e) => setFormData({ ...formData, job_type: e.target.value })} className={inputCls}>
            <option value="">Select Type</option>
            {jobTypes.map(jt => <option key={jt.id} value={jt.key}>{jt.label}</option>)}
          </select>
        </Field>
        <Field label="Location" full>
          <input type="text" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} required className={inputCls} />
        </Field>
        <Field label="Required Teams" hint="Staff from these teams can be assigned" full>
          {teams.length === 0 ? (
            <p className="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">No teams set up yet. Add teams in Settings first.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {teams.map(t => {
                const selected = selectedTeamIds.includes(t.id);
                return (
                  <button type="button" key={t.id} onClick={() => toggleTeam(t.id)}
                    className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition font-medium ${selected ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-400 hover:text-emerald-700'}`}>
                    <UsersRound className="w-3 h-3" />
                    {t.name}
                  </button>
                );
              })}
            </div>
          )}
          {selectedTeamIds.length === 0 && teams.length > 0 && (
            <p className="text-[11px] text-amber-600 mt-1.5">Select at least one team — staff outside these teams can still be assigned but managers will see a warning.</p>
          )}
        </Field>

      </Section>

      {/* Schedule */}
      <Section title="Schedule" icon={CalendarDays}>
        <Field label="Start Date">
          <input type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} required className={inputCls} />
        </Field>
        <Field label="End Date">
          <input type="date" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} required className={inputCls} />
        </Field>
      </Section>

      {/* Clients & Contacts */}
      <Section title="Clients & Contacts" icon={Users}>
        <Field label="Client">
          <select value={formData.client_id} onChange={(e) => setFormData({ ...formData, client_id: e.target.value })} className={inputCls}>
            <option value="">Select Client (Optional)</option>
            {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
          </select>
        </Field>
        <Field label="Contractor">
          <select value={formData.contractor_id} onChange={(e) => setFormData({ ...formData, contractor_id: e.target.value })} className={inputCls}>
            <option value="">Select Contractor (Optional)</option>
            {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Project Manager">
          <input type="text" value={formData.project_manager || ''} onChange={(e) => setFormData({ ...formData, project_manager: e.target.value })} placeholder="Person responsible" className={inputCls} />
        </Field>
        <Field label="Site Contact Name">
          <input type="text" value={formData.site_contact_name || ''} onChange={(e) => setFormData({ ...formData, site_contact_name: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Site Contact Phone">
          <input type="tel" value={formData.site_contact_phone || ''} onChange={(e) => setFormData({ ...formData, site_contact_phone: e.target.value })} placeholder="On-site contact number" className={inputCls} />
        </Field>
      </Section>

      {/* Costing (internal) */}
      <Section title="Costing (Internal)" icon={PoundSterling}>
        <Field label="Budget (GBP)" hint="Agreed job value">
          <input type="number" min="0" step="0.01" value={num('budget_amount')} onChange={(e) => setNum('budget_amount', e.target.value)} placeholder="0.00" className={inputCls} />
        </Field>
        <Field label="Actual Cost (GBP)" hint="Manual override">
          <input type="number" min="0" step="0.01" value={num('actual_cost')} onChange={(e) => setNum('actual_cost', e.target.value)} placeholder="Leave blank to auto-calculate" className={inputCls} />
        </Field>
        {showMeterage && (
          <Field label="Total Meterage (m)" hint="Overrides shift meterage for costing">
            <div className="relative">
              <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
              <input type="number" min="0" step="0.1" value={num('meterage')} onChange={(e) => setNum('meterage', e.target.value)} placeholder="Leave blank to sum from shifts" className={`${inputCls} pl-9`} />
            </div>
          </Field>
        )}
      </Section>

      {/* Notes */}
      <Section title="Notes" icon={StickyNote} className="border-t pt-5 border-slate-100">
        <Field label="Job Notes" full>
          <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows="3" className={inputCls} />
        </Field>
      </Section>

      {/* Equipment List — only for new jobs */}
      {!editingId && (
        <Section title="Equipment List" icon={Package} className="border-t pt-5 border-slate-100">
          <Field label="Items to track" full hint="Auto-starts at depot — ready for delivery to site">
            <EquipmentListEditor items={formData.equipment_items || []} setItems={(items) => setFormData({ ...formData, equipment_items: items })} />
          </Field>
        </Section>
      )}

      {/* Requisition */}
      <div className="border-t pt-5 border-slate-100">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <FileText className="w-4 h-4 text-emerald-700" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">Requisition List</h3>
        </div>
        {formData.requisition_list_url ? (
          <div className="border border-emerald-200 rounded-lg overflow-hidden">
            <div className="flex items-center gap-3 p-3 bg-emerald-50">
              <FileText className="w-5 h-5 text-emerald-700 flex-shrink-0" />
              <span className="text-sm text-emerald-800 font-medium flex-1 truncate">{formData.requisition_list_name || 'Requisition List'}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-white border-t border-emerald-100">
              <a href={formData.requisition_list_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition"><Eye className="w-3.5 h-3.5" /> View</a>
              <a href={formData.requisition_list_url} download={formData.requisition_list_name || 'requisition-list'} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition"><Download className="w-3.5 h-3.5" /> Download</a>
              <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-md transition cursor-pointer">
                {uploadingFile ? <span>Uploading...</span> : <><RefreshCw className="w-3.5 h-3.5" /> Replace</>}
                <input type="file" className="hidden" onChange={onFileUpload} disabled={uploadingFile} />
              </label>
              <button type="button" onClick={() => setFormData(prev => ({ ...prev, requisition_list_url: '', requisition_list_name: '' }))} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition ml-auto"><X className="w-3.5 h-3.5" /> Remove</button>
            </div>
          </div>
        ) : (
          <label className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-emerald-400 transition">
            {uploadingFile ? <span className="text-sm text-slate-500">Uploading...</span> : (<><Upload className="w-5 h-5 text-slate-400" /><span className="text-sm text-slate-500">Click to upload requisition list (PDF, Excel, Word, etc.)</span></>)}
            <input type="file" className="hidden" onChange={onFileUpload} disabled={uploadingFile} />
          </label>
        )}
      </div>

      <div className="flex gap-3 pt-2 border-t border-slate-100">
        <button type="submit" className="px-5 py-2.5 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition font-medium text-sm">{editingId ? 'Update Job' : 'Add Job'}</button>
        <button type="button" onClick={onCancel} className="px-5 py-2.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition font-medium text-sm">Cancel</button>
      </div>
    </form>
  );
}