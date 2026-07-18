import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit2, Building2, Mail, Phone, User } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import SearchFilterBar from '@/components/SearchFilterBar';

export default function ClientManager() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', contact_name: '', contact_email: '', contact_phone: '' });
  const [searchQuery, setSearchQuery] = useState('');

  const queryClient = useQueryClient();
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list() });

  const filteredClients = clients.filter(c => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (c.name?.toLowerCase().includes(q) || c.contact_name?.toLowerCase().includes(q) || c.contact_email?.toLowerCase().includes(q));
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingId) { await base44.entities.Client.update(editingId, formData); }
    else { await base44.entities.Client.create(formData); }
    queryClient.invalidateQueries({ queryKey: ['clients'] });
    setFormData({ name: '', contact_name: '', contact_email: '', contact_phone: '' });
    setShowForm(false); setEditingId(null);
  };

  const handleEdit = (c) => { setFormData(c); setEditingId(c.id); setShowForm(true); };
  const handleDelete = async (id) => {
    if (confirm('Delete this client?')) {
      await base44.entities.Client.delete(id);
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <PageHeader title="Manage Clients" icon={Building2} />
        <button onClick={() => { setShowForm(!showForm); setEditingId(null); setFormData({ name: '', contact_name: '', contact_email: '', contact_phone: '' }); }}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-sm font-medium w-full sm:w-auto">
          <Plus className="w-4 h-4" /> Add Client
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-5 border border-emerald-200 mb-6 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4">{editingId ? 'Edit Client' : 'New Client'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Company Name *</label>
              <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Contact Name</label>
              <input type="text" value={formData.contact_name} onChange={e => setFormData({ ...formData, contact_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Contact Email</label>
              <input type="email" value={formData.contact_email} onChange={e => setFormData({ ...formData, contact_email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Contact Phone</label>
              <input type="tel" value={formData.contact_phone} onChange={e => setFormData({ ...formData, contact_phone: e.target.value })}
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

      {clients.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400 text-sm">No clients yet. Add your first client above.</div>
      ) : (
        <div className="space-y-5">
          <SearchFilterBar
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search by name, contact or email..."
            showCount
            totalCount={filteredClients.length}
          />
          {filteredClients.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400 text-sm">No clients match your search.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredClients.map(c => (
                <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-5 h-5 text-emerald-700" />
                      </div>
                      <h3 className="font-bold text-slate-900 truncate">{c.name}</h3>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => handleEdit(c)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(c.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    {c.contact_name && (
                      <div className="flex items-center gap-2 text-slate-600"><User className="w-3.5 h-3.5 text-slate-400" /><span>{c.contact_name}</span></div>
                    )}
                    {c.contact_email && (
                      <div className="flex items-center gap-2 text-slate-500 text-xs"><Mail className="w-3.5 h-3.5 text-slate-400" /><span className="truncate">{c.contact_email}</span></div>
                    )}
                    {c.contact_phone && (
                      <div className="flex items-center gap-2 text-slate-500 text-xs"><Phone className="w-3.5 h-3.5 text-slate-400" /><span>{c.contact_phone}</span></div>
                    )}
                    {!c.contact_name && !c.contact_email && !c.contact_phone && (
                      <p className="text-xs text-slate-400">No contact details</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}