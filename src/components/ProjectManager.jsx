import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FolderOpen, Plus, Edit2, Trash2, ChevronDown, ChevronRight, Briefcase,
  MapPin, Calendar, Users, PoundSterling, X, Check, Layers
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { format, parseISO } from 'date-fns';
import { getJobPrimaryType, getJobTypeColor, getJobTypeLabel } from '@/utils/jobTeams';
import { useScopedEntity } from '@/hooks/useScopedEntity';
import { useDivision } from '@/contexts/DivisionContext';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 });
const fmtDate = (d) => { try { return d ? format(parseISO(d), 'dd MMM yyyy') : '—'; } catch { return d || '—'; } };

const statusBadge = {
  active: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200',
  completed: 'bg-teal-100 text-teal-700 ring-1 ring-teal-200',
  on_hold: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200',
};
const jobStatusBadge = {
  planning: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-emerald-100 text-emerald-700',
  decommissioning: 'bg-orange-100 text-orange-700',
  completed: 'bg-teal-100 text-teal-700',
  on_hold: 'bg-amber-100 text-amber-700',
  cancelled: 'bg-red-100 text-red-700',
};
const jobStatusLabels = { planning: 'Planning', in_progress: 'In Progress', decommissioning: 'Decommissioning', completed: 'Completed', on_hold: 'On Hold', cancelled: 'Cancelled' };
const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm";

const blankProject = { name: '', reference: '', client_id: '', status: 'active', notes: '' };

export default function ProjectManager({ jobs = [], teams = [], jobTypes = [], clients = [], onSelectJob, onAddJob }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(null);
  const [editing, setEditing] = useState(null); // project being created/edited
  const [showForm, setShowForm] = useState(false);

  const { activeDivisionId } = useDivision();
  const { data: projects = [] } = useScopedEntity('Project', { queryKey: ['projects'], sort: '-created_date', limit: 200 });

  // Jobs grouped by project
  const jobsByProject = {};
  const standaloneJobs = [];
  jobs.forEach(j => {
    if (j.project_id) {
      if (!jobsByProject[j.project_id]) jobsByProject[j.project_id] = [];
      jobsByProject[j.project_id].push(j);
    } else {
      standaloneJobs.push(j);
    }
  });

  const projectStats = (p) => {
    const pjobs = jobsByProject[p.id] || [];
    const totalBudget = pjobs.reduce((s, j) => s + (Number(j.budget_amount) || 0), 0);
    const active = pjobs.filter(j => (j.status || 'planning') === 'in_progress').length;
    return { count: pjobs.length, totalBudget, active };
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!editing.name?.trim()) return;
    try {
      if (editing.id) {
        await base44.entities.Project.update(editing.id, { name: editing.name, reference: editing.reference, client_id: editing.client_id, status: editing.status, notes: editing.notes });
        toast({ title: 'Project updated' });
      } else {
        await base44.entities.Project.create({ name: editing.name.trim(), reference: editing.reference, client_id: editing.client_id, status: editing.status || 'active', notes: editing.notes, division_id: activeDivisionId });
        toast({ title: 'Project created' });
      }
      queryClient.invalidateQueries({ queryKey: ['scoped', 'Project'] });
      setShowForm(false); setEditing(null);
    } catch (err) { toast({ title: 'Could not save project', description: err?.message, variant: 'destructive' }); }
  };

  const handleDelete = async (p) => {
    const count = (jobsByProject[p.id] || []).length;
    if (!confirm(`Delete project "${p.name}"?${count > 0 ? `\n\n${count} job(s) will become standalone (not deleted).` : ''}`)) return;
    try {
      await base44.entities.Project.delete(p.id);
      queryClient.invalidateQueries({ queryKey: ['scoped', 'Project'] });
      toast({ title: 'Project deleted' });
    } catch (err) { toast({ title: 'Could not delete', description: err?.message, variant: 'destructive' }); }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-bold text-slate-900">Projects</h2>
          <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">{projects.length}</span>
        </div>
        <button onClick={() => { setEditing({ ...blankProject }); setShowForm(true); }} className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-semibold shadow-sm">
          <Plus className="w-4 h-4" /> New Project
        </button>
      </div>

      {projects.length === 0 && standaloneJobs.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl">
          <FolderOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-600">No projects yet</p>
          <p className="text-xs text-slate-400 mt-1">Create a project to group multiple jobs together — ideal for multi-site investigations.</p>
        </div>
      ) : (
        <>
          {/* Project cards */}
          <div className="space-y-3">
            {projects.map(p => {
              const stats = projectStats(p);
              const client = clients.find(c => c.id === p.client_id);
              const pjobs = jobsByProject[p.id] || [];
              const isOpen = expanded === p.id;
              return (
                <div key={p.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  {/* Project header row */}
                  <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50/50 transition">
                    <button onClick={() => setExpanded(isOpen ? null : p.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                      <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                        <FolderOpen className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-slate-900 truncate">{p.name}</h3>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusBadge[p.status] || statusBadge.active}`}>{(p.status || 'active').replace('_', ' ')}</span>
                          {p.reference && <span className="text-[10px] text-slate-500 font-mono">{p.reference}</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                          {client && <span className="truncate">{client.name}</span>}
                          <span className="inline-flex items-center gap-0.5"><Briefcase className="w-3 h-3" /> {stats.count} job{stats.count !== 1 ? 's' : ''}</span>
                          {stats.totalBudget > 0 && <span className="inline-flex items-center gap-0.5 text-slate-600 font-medium"><PoundSterling className="w-3 h-3" />{fmt(stats.totalBudget)}</span>}
                        </div>
                      </div>
                      {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                    </button>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => onAddJob(p)} title="Add job to project" className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900 font-semibold px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition">
                        <Plus className="w-3.5 h-3.5" /> Add Job
                      </button>
                      <button onClick={() => { setEditing({ ...blankProject, ...p, id: p.id }); setShowForm(true); }} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(p)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>

                  {/* Expanded jobs list */}
                  {isOpen && (
                    <div className="border-t border-slate-100 bg-slate-50/40">
                      {pjobs.length === 0 ? (
                        <div className="px-4 py-4 text-center">
                          <p className="text-xs text-slate-400 mb-2">No jobs in this project yet.</p>
                          <button onClick={() => onAddJob(p)} className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-semibold px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition">
                            <Plus className="w-3.5 h-3.5" /> Add the first job
                          </button>
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100">
                          {pjobs.map(j => {
                            const primaryType = getJobPrimaryType(j, teams);
                            const colors = getJobTypeColor(primaryType, jobTypes);
                            const client = clients.find(c => c.id === j.client_id);
                            return (
                              <button key={j.id} onClick={() => onSelectJob(j)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white transition text-left">
                                <div className={`w-1.5 h-10 rounded-full ${colors.bar}`} />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-slate-900 truncate">{j.name}</p>
                                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
                                    <span className="inline-flex items-center gap-0.5"><MapPin className="w-3 h-3" />{j.location}</span>
                                    <span className="inline-flex items-center gap-0.5"><Calendar className="w-3 h-3" />{fmtDate(j.start_date)}</span>
                                    {client && <span>· {client.name}</span>}
                                  </div>
                                </div>
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${colors.badge}`}>{getJobTypeLabel(primaryType, jobTypes)}</span>
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${jobStatusBadge[j.status || 'planning']}`}>{jobStatusLabels[j.status || 'planning']}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {p.notes && <p className="px-4 py-2.5 text-xs text-slate-500 border-t border-slate-100 italic">{p.notes}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Standalone jobs */}
          {standaloneJobs.length > 0 && (
            <div className="pt-2">
              <div className="flex items-center gap-2 mb-3">
                <Layers className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-bold text-slate-600">Standalone Jobs</h3>
                <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">{standaloneJobs.length}</span>
                <span className="text-xs text-slate-400">— not linked to a project</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {standaloneJobs.map(j => {
                  const primaryType = getJobPrimaryType(j, teams);
                  const colors = getJobTypeColor(primaryType, jobTypes);
                  return (
                    <button key={j.id} onClick={() => onSelectJob(j)} className="text-left bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:shadow-md hover:border-slate-300 transition">
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${colors.badge}`}>{getJobTypeLabel(primaryType, jobTypes)}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${jobStatusBadge[j.status || 'planning']}`}>{jobStatusLabels[j.status || 'planning']}</span>
                      </div>
                      <p className="font-semibold text-slate-900 text-sm truncate">{j.name}</p>
                      <p className="text-xs text-slate-500 truncate mt-0.5 inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{j.location}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Project create/edit dialog */}
      {showForm && editing && (
        <Dialog open onOpenChange={(open) => { if (!open) { setShowForm(false); setEditing(null); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-indigo-600" />
                {editing.id ? 'Edit Project' : 'New Project'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Project Name *</label>
                <input autoFocus value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required className={inputCls} placeholder="e.g. Riverside Phase 2 Investigation" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Reference / Quote No.</label>
                <input value={editing.reference || ''} onChange={(e) => setEditing({ ...editing, reference: e.target.value })} className={inputCls} placeholder="e.g. PRJ-2026-014" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Client</label>
                <select value={editing.client_id || ''} onChange={(e) => setEditing({ ...editing, client_id: e.target.value })} className={inputCls}>
                  <option value="">No client</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                <select value={editing.status || 'active'} onChange={(e) => setEditing({ ...editing, status: e.target.value })} className={inputCls}>
                  <option value="active">Active</option>
                  <option value="on_hold">On Hold</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                <textarea value={editing.notes || ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} rows="3" className={inputCls} placeholder="Project scope, contract terms, shared requirements…" />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition">
                  <Check className="w-4 h-4" /> {editing.id ? 'Save changes' : 'Create project'}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition">Cancel</button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}