import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit2, HardHat } from 'lucide-react';
import PageHeader from '@/components/PageHeader';

export default function ContractorManager() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', contact_name: '', contact_email: '', contact_phone: '', notes: '' });

  const queryClient = useQueryClient();

  const { data: contractors = [] } = useQuery({
    queryKey: ['contractors'],
    queryFn: () => base44.entities.Contractor.list()
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingId) {
      await base44.entities.Contractor.update(editingId, formData);
    } else {
      await base44.entities.Contractor.create(formData);
    }
    queryClient.invalidateQueries({ queryKey: ['contractors'] });
    setFormData({ name: '', contact_name: '', contact_email: '', contact_phone: '', notes: '' });
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (c) => {
    setFormData(c);
    setEditingId(c.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Delete this contractor?')) {
      await base44.entities.Contractor.delete(id);
      queryClient.invalidateQueries({ queryKey: ['contractors'] });
    }
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
        <PageHeader title="Contractors" icon={HardHat} />
        <button
          onClick={() => { setShowForm(!showForm); setEditingId(null); setFormData({ name: '', contact_name: '', contact_email: '', contact_phone: '', notes: '' }); }}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition"
        >
          <Plus className="w-4 h-4" /> Add Contractor
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg p-4 md:p-6 border border-emerald-200 mb-6 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Contractor Name *</label>
              <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Contact Person</label>
              <input type="text" value={formData.contact_name} onChange={e => setFormData({ ...formData, contact_name: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
              <input type="email" value={formData.contact_email} onChange={e => setFormData({ ...formData, contact_email: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
              <input type="text" value={formData.contact_phone} onChange={e => setFormData({ ...formData, contact_phone: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600" />
            </div>
            <div className="col-span-1 sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
              <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} rows="2"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button type="submit" className="px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition font-medium">
              {editingId ? 'Update' : 'Add'} Contractor
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition font-medium">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-300 shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-emerald-700 border-b border-emerald-800">
              <th className="px-4 py-3 text-left font-semibold text-white">Name</th>
              <th className="px-4 py-3 text-left font-semibold text-white">Contact</th>
              <th className="px-4 py-3 text-left font-semibold text-white">Email</th>
              <th className="px-4 py-3 text-left font-semibold text-white">Phone</th>
              <th className="px-4 py-3 text-left font-semibold text-white">Actions</th>
            </tr>
          </thead>
          <tbody>
            {contractors.map(c => (
              <tr key={c.id} className="border-b border-slate-200 hover:bg-emerald-50 transition">
                <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                <td className="px-4 py-3 text-slate-600">{c.contact_name || '—'}</td>
                <td className="px-4 py-3 text-slate-600">{c.contact_email || '—'}</td>
                <td className="px-4 py-3 text-slate-600">{c.contact_phone || '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(c)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(c.id)} className="p-1.5 text-red-600 hover:bg-red-100 rounded transition"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {contractors.map(c => (
          <div key={c.id} className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-slate-900">{c.name}</h3>
                {c.contact_name && <p className="text-sm text-slate-600 mt-0.5">{c.contact_name}</p>}
                {c.contact_email && <p className="text-xs text-slate-500 mt-0.5">{c.contact_email}</p>}
                {c.contact_phone && <p className="text-xs text-slate-500">{c.contact_phone}</p>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => handleEdit(c)} className="p-2 text-blue-600 hover:bg-blue-50 rounded transition"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(c.id)} className="p-2 text-red-600 hover:bg-red-50 rounded transition"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}