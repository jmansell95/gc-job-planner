import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit2, HardHat, Mail, Phone } from 'lucide-react';
import PageHeader from '@/components/PageHeader';

export default function ContractorManager() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', contact_name: '', contact_email: '', contact_phone: '', notes: '' });

  const queryClient = useQueryClient();
  const { data: contractors = [] } = useQuery({ queryKey: ['contractors'], queryFn: () => base44.entities.Contractor.list() });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingId) { await base44.entities.Contractor.update(editingId, formData); }
    else { await base44.entities.Contractor.create(formData); }
    queryClient.invalidateQueries({ queryKey: ['contractors'] });
    setFormData({ name: '', contact_name: '', contact_email: '', contact_phone: '', notes: '' });
    setShowForm(false); setEditingId(null);
  };

  const handleEdit = (c) => { setFormData(c); setEditingId(c.id); setShowForm(true); };
  const handleDelete = async (id) => {
    if (confirm('Delete this client?')) {
      await base44.entities.Contractor.delete(id);
      queryClient.invalidateQueries({ queryKey: ['contractors'] });
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <PageHeader title="Clients" icon={HardHat} />
        <button onClick={() => { setShowForm(!showForm); setEditingId(null); setFormData({ name: '', contact_name: '', contact_email: '', contact_phone: '', notes: '' }); }}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-sm font-medium">
          <Plus className="w-4 h-4" /> Add Client
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-5 border border-emerald-200 mb-6 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4">{editingId ? 'Edit Client' : 'New Client'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Client Name *</label>
              <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Contact Person</label>
              <input type="text" value={formData.contact_name} onChange={e => setFormData({ ...formData, contact_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
              <input type="email" value={formData.contact_email} onChange={e => setFormData({ ...formData, contact_email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
              <input type="text" value={formData.contact_phone} onChange={e => setFormData({ ...formData, contact_phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
              <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} rows="2"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>
          </div>
          <div className="flex gap-2 mt-5">
            <button type="submit" className="px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition font-medium text-sm">
              {editingId ? 'Update' : 'Add'} Client
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-medium text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      {contractors.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400 text-sm">No clients yet. Add your first client above.</div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden lg:block rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-emerald-800 text-white">
                  <th className="px-4 py-3 text-left font-semibold">Company</th>
                  <th className="px-4 py-3 text-left font-semibold">Contact</th>
                  <th className="px-4 py-3 text-left font-semibold">Email</th>
                  <th className="px-4 py-3 text-left font-semibold">Phone</th>
                  <th className="px-4 py-3 text-left font-semibold w-20">Actions</th>
                </tr>
              </thead>
              <tbody>
                {contractors.map((c, idx) => (
                  <tr key={c.id} className={`border-b border-slate-100 hover:bg-emerald-50 transition ${idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}`}>
                    <td className="px-4 py-3 font-semibold text-slate-900">{c.name}</td>
                    <td className="px-4 py-3 text-slate-600">{c.contact_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{c.contact_email || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{c.contact_phone || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => handleEdit(c)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(c.id)} className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile/tablet cards */}
          <div className="lg:hidden space-y-3">
            {contractors.map(c => (
              <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">{c.name}</p>
                    {c.contact_name && <p className="text-sm text-slate-600 mt-0.5">{c.contact_name}</p>}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => handleEdit(c)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(c.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="mt-3 space-y-1">
                  {c.contact_email && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{c.contact_email}</span>
                    </div>
                  )}
                  {c.contact_phone && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{c.contact_phone}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}