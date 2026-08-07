import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Trash2, Settings2, ToggleLeft, ToggleRight, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';

// Custom Field Builder — lets admins add custom fields to Jobs, Staff,
// SiteAssets, Vehicles, Clients, Suppliers, and Contractors without code
// changes. Fields appear on create/edit forms and can be shown in list views.

const ENTITY_OPTIONS = [
  { value: 'Job', label: 'Jobs' },
  { value: 'Staff', label: 'Staff' },
  { value: 'SiteAsset', label: 'Site Assets / Equipment' },
  { value: 'Vehicle', label: 'Vehicles' },
  { value: 'Client', label: 'Clients' },
  { value: 'Supplier', label: 'Suppliers' },
  { value: 'Contractor', label: 'Sub-contractors' },
];

const TYPE_OPTIONS = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Yes / No' },
  { value: 'select', label: 'Dropdown' },
  { value: 'textarea', label: 'Long Text' },
];

export default function CustomFieldBuilder() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [filterEntity, setFilterEntity] = useState('all');
  const [form, setForm] = useState({
    entity_type: 'Job',
    field_key: '',
    field_label: '',
    field_type: 'text',
    options: '',
    default_value: '',
    is_required: false,
    show_in_list: false,
    section: '',
  });

  const { data: fields = [], isLoading } = useQuery({
    queryKey: ['custom-fields'],
    queryFn: async () => {
      const res = await base44.entities.CustomField.list('sort_order', 200);
      return res.data || res || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const payload = {
        ...data,
        field_key: data.field_key.toLowerCase().replace(/\s+/g, '_'),
        options: data.field_type === 'select' && data.options
          ? data.options.split(',').map(s => s.trim()).filter(Boolean)
          : [],
        is_active: true,
        sort_order: 0,
      };
      return await base44.entities.CustomField.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-fields'] });
      toast({ title: '✓ Custom field created', description: 'It will appear on the entity form.' });
      setShowForm(false);
      setForm({ entity_type: 'Job', field_key: '', field_label: '', field_type: 'text', options: '', default_value: '', is_required: false, show_in_list: false, section: '' });
    },
    onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }) => base44.entities.CustomField.update(id, { is_active: !is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['custom-fields'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => base44.entities.CustomField.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-fields'] });
      toast({ title: 'Field deleted' });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.field_key || !form.field_label) {
      toast({ title: 'Field key and label are required', variant: 'destructive' });
      return;
    }
    createMutation.mutate(form);
  };

  const filtered = filterEntity === 'all' ? fields : fields.filter(f => f.entity_type === filterEntity);
  const entityLabel = (t) => ENTITY_OPTIONS.find(e => e.value === t)?.label || t;

  return (
    <div>
      <SettingsSectionHeader
        icon={Settings2}
        title="Custom Field Builder"
        description="Add custom fields to jobs, staff, assets, vehicles, clients, suppliers and contractors — no code needed."
        actions={
          <Button onClick={() => setShowForm(!showForm)} className="bg-emerald-700 hover:bg-emerald-800 text-white">
            <Plus className="w-4 h-4 mr-1" /> {showForm ? 'Cancel' : 'Add Field'}
          </Button>
        }
      />

      {/* Entity filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setFilterEntity('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filterEntity === 'all' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>
          All ({fields.length})
        </button>
        {ENTITY_OPTIONS.map(e => (
          <button key={e.value} onClick={() => setFilterEntity(e.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filterEntity === e.value ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>
            {e.label} ({fields.filter(f => f.entity_type === e.value).length})
          </button>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="insight-card rounded-2xl p-5 mb-5 space-y-4 animate-slide-up">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Entity</label>
              <select value={form.entity_type} onChange={e => setForm({ ...form, entity_type: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white">
                {ENTITY_OPTIONS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Field Type</label>
              <select value={form.field_type} onChange={e => setForm({ ...form, field_type: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white">
                {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Field Key (snake_case)</label>
              <input type="text" value={form.field_key} onChange={e => setForm({ ...form, field_key: e.target.value })}
                placeholder="e.g. site_reference_code"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Display Label</label>
              <input type="text" value={form.field_label} onChange={e => setForm({ ...form, field_label: e.target.value })}
                placeholder="e.g. Site Reference Code"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white" required />
            </div>
            {form.field_type === 'select' && (
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Dropdown Options (comma-separated)</label>
                <input type="text" value={form.options} onChange={e => setForm({ ...form, options: e.target.value })}
                  placeholder="Option 1, Option 2, Option 3"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white" />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Section (optional group heading)</label>
              <input type="text" value={form.section} onChange={e => setForm({ ...form, section: e.target.value })}
                placeholder="e.g. Site Specifics"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Default Value (optional)</label>
              <input type="text" value={form.default_value} onChange={e => setForm({ ...form, default_value: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input type="checkbox" checked={form.is_required} onChange={e => setForm({ ...form, is_required: e.target.checked })}
                className="w-4 h-4 rounded" />
              Required field
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input type="checkbox" checked={form.show_in_list} onChange={e => setForm({ ...form, show_in_list: e.target.checked })}
                className="w-4 h-4 rounded" />
              Show in list views
            </label>
          </div>
          <Button type="submit" disabled={createMutation.isPending} className="bg-emerald-700 hover:bg-emerald-800 text-white">
            {createMutation.isPending ? 'Creating…' : 'Create Custom Field'}
          </Button>
        </form>
      )}

      {/* List */}
      {isLoading ? (
        <div className="text-center py-8 text-slate-400 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="insight-card rounded-2xl p-8 text-center">
          <Layers className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-600">No custom fields yet</p>
          <p className="text-xs text-slate-400 mt-1">Add a custom field to extend any entity with your own data points.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(f => (
            <div key={f.id} className={`insight-card rounded-xl p-3.5 flex items-center gap-3 ${!f.is_active ? 'opacity-50' : ''}`}>
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-bold text-slate-500 uppercase">{f.field_type.slice(0, 4)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-slate-800">{f.field_label}</p>
                  <code className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{f.field_key}</code>
                  <span className="text-[10px] font-medium bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{entityLabel(f.entity_type)}</span>
                  {f.is_required && <span className="text-[10px] font-bold bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full">Required</span>}
                  {f.show_in_list && <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full">In List</span>}
                </div>
                {f.section && <p className="text-xs text-slate-400 mt-0.5">Section: {f.section}</p>}
                {f.options?.length > 0 && <p className="text-xs text-slate-400 mt-0.5">Options: {f.options.join(', ')}</p>}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => toggleMutation.mutate({ id: f.id, is_active: f.is_active })}
                  className="p-1.5 rounded-lg hover:bg-slate-100 transition" title={f.is_active ? 'Deactivate' : 'Activate'}>
                  {f.is_active ? <ToggleRight className="w-5 h-5 text-emerald-600" /> : <ToggleLeft className="w-5 h-5 text-slate-400" />}
                </button>
                <button onClick={() => deleteMutation.mutate(f.id)}
                  className="p-1.5 rounded-lg hover:bg-rose-50 transition" title="Delete">
                  <Trash2 className="w-4 h-4 text-rose-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}