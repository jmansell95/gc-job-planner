import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit2, Check, Tag } from 'lucide-react';
import { JOB_TYPE_COLORS } from '@/utils/jobTeams';

const COLOR_OPTIONS = Object.keys(JOB_TYPE_COLORS);

const emptyForm = { key: '', label: '', color: 'slate', is_drilling: false, order: 0 };

function slugify(s) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export default function JobTypeManager() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const queryClient = useQueryClient();

  const { data: jobTypes = [], isLoading } = useQuery({
    queryKey: ['job-types'],
    queryFn: () => base44.entities.JobType.list('-order'),
  });

  const handleAdd = () => {
    setFormData(emptyForm);
    setEditingId(null);
    setShowForm(true);
  };

  const handleEdit = (jt) => {
    setFormData({ key: jt.key, label: jt.label, color: jt.color || 'slate', is_drilling: !!jt.is_drilling, order: jt.order || 0 });
    setEditingId(jt.id);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...formData,
      key: formData.key || slugify(formData.label),
      is_drilling: !!formData.is_drilling,
      order: Number(formData.order) || 0,
    };
    if (editingId) {
      await base44.entities.JobType.update(editingId, payload);
    } else {
      await base44.entities.JobType.create(payload);
    }
    queryClient.invalidateQueries({ queryKey: ['job-types'] });
    setShowForm(false);
    setEditingId(null);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this job type? Jobs using it will show "General" instead.')) return;
    await base44.entities.JobType.delete(id);
    queryClient.invalidateQueries({ queryKey: ['job-types'] });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">Manage the job types available when creating jobs. Each type has a colour and optional drilling flag.</p>
        <button onClick={handleAdd} className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-sm font-medium flex-shrink-0">
          <Plus className="w-4 h-4" /> Add Type
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-emerald-200 shadow-sm p-5 mb-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Label</label>
              <input type="text" value={formData.label} onChange={(e) => setFormData({ ...formData, label: e.target.value, key: editingId ? formData.key : slugify(e.target.value) })} required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" placeholder="e.g. Piling" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Key <span className="text-xs text-slate-400">· auto-generated slug</span></label>
              <input type="text" value={formData.key} onChange={(e) => setFormData({ ...formData, key: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm font-mono" placeholder="piling" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Colour</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map(c => {
                const colors = JOB_TYPE_COLORS[c];
                const selected = formData.color === c;
                return (
                  <button type="button" key={c} onClick={() => setFormData({ ...formData, color: c })}
                    className={`w-9 h-9 rounded-full ${colors.dot} flex items-center justify-center transition ${selected ? 'ring-2 ring-offset-2 ring-slate-700' : 'opacity-60 hover:opacity-100'}`}>
                    {selected && <Check className="w-4 h-4 text-white" />}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={formData.is_drilling} onChange={(e) => setFormData({ ...formData, is_drilling: e.target.checked })} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
              <span className="text-sm text-slate-700">Drilling type <span className="text-xs text-slate-400">· shows meterage fields on jobs</span></span>
            </label>
          </div>
          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <button type="submit" className="px-5 py-2.5 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition font-medium text-sm">{editingId ? 'Update' : 'Add'} Type</button>
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="px-5 py-2.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition font-medium text-sm">Cancel</button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : jobTypes.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <Tag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">No job types yet</p>
          <p className="text-xs text-slate-400 mt-1">Add job types to classify your work.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-100">
            {jobTypes.map(jt => {
              const colors = JOB_TYPE_COLORS[jt.color] || JOB_TYPE_COLORS.slate;
              return (
                <div key={jt.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-3 h-3 rounded-full ${colors.dot} flex-shrink-0`} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{jt.label}</p>
                      <p className="text-xs text-slate-400 font-mono">{jt.key}{jt.is_drilling && ' · drilling'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => handleEdit(jt)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(jt.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}