import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Package, Plus, Edit2, Trash2, Check, X, Mail, Phone, User, Search } from 'lucide-react';
import PageHeader from '@/components/PageHeader';

const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm";

const blank = { name: '', contact_name: '', contact_email: '', contact_phone: '', notes: '' };

export default function SupplierManager() {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: () => base44.entities.Supplier.list() });

  const filtered = suppliers.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.contact_name?.toLowerCase().includes(search.toLowerCase())
  );

  const startAdd = () => { setForm(blank); setEditingId(null); setAdding(true); };
  const startEdit = (s) => { setForm({ name: s.name, contact_name: s.contact_name || '', contact_email: s.contact_email || '', contact_phone: s.contact_phone || '', notes: s.notes || '' }); setEditingId(s.id); setAdding(true); };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await base44.entities.Supplier.update(editingId, form);
      } else {
        await base44.entities.Supplier.create(form);
      }
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setAdding(false); setEditingId(null); setForm(blank);
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const remove = async (id) => {
    if (!confirm('Delete this supplier?')) return;
    await base44.entities.Supplier.delete(id);
    queryClient.invalidateQueries({ queryKey: ['suppliers'] });
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <PageHeader title="Suppliers" icon={Package} />
        <button onClick={startAdd} className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm font-medium hover:bg-emerald-800 transition self-start sm:self-auto">
          <Plus className="w-4 h-4" /> Add Supplier
        </button>
      </div>

      {adding && (
        <form onSubmit={submit} className="bg-white rounded-xl border border-emerald-200 shadow-sm p-5 mb-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Company Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Contact Name</label>
              <input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
              <input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows="2" className={inputCls} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm font-medium hover:bg-emerald-800 transition disabled:opacity-50">{editingId ? 'Update' : 'Add'} Supplier</button>
            <button type="button" onClick={() => { setAdding(false); setEditingId(null); }} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300 transition">Cancel</button>
          </div>
        </form>
      )}

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search suppliers..." className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm bg-white" />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
          <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">No suppliers yet. Add your first hire supplier to speed up job costing entry.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(s => (
            <div key={s.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <Package className="w-4 h-4 text-emerald-700" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{s.name}</p>
                    {s.contact_name && <p className="text-xs text-slate-500 truncate">{s.contact_name}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => startEdit(s)} className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => remove(s.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="space-y-1 text-xs text-slate-500">
                {s.contact_email && <div className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {s.contact_email}</div>}
                {s.contact_phone && <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {s.contact_phone}</div>}
                {s.notes && <p className="text-slate-400 pt-1">{s.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}