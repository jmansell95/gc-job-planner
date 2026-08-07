import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Building2, Plus, Trash2, Star, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';

// Multi-Company / White-Label Support — manage multiple trading
// entities with separate branding, logos, and color schemes.

export default function MultiCompanySettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const { data: entities = [], isLoading } = useQuery({
    queryKey: ['trading-entities'],
    queryFn: async () => { const r = await base44.entities.TradingEntity.list('-created_date', 50); return r.data || r || []; },
  });

  const createMutation = useMutation({
    mutationFn: async (data) => base44.entities.TradingEntity.create(data),
    onSuccess: () => { toast({ title: '✓ Trading entity created' }); queryClient.invalidateQueries({ queryKey: ['trading-entities'] }); setShowForm(false); },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => base44.entities.TradingEntity.update(id, data),
    onSuccess: () => { toast({ title: '✓ Trading entity updated' }); queryClient.invalidateQueries({ queryKey: ['trading-entities'] }); setEditingId(null); },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => base44.entities.TradingEntity.delete(id),
    onSuccess: () => { toast({ title: '✓ Trading entity deleted' }); queryClient.invalidateQueries({ queryKey: ['trading-entities'] }); },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const setDefault = async (entity) => {
    // Unset any existing default
    for (const e of entities) {
      if (e.is_default && e.id !== entity.id) {
        await base44.entities.TradingEntity.update(e.id, { is_default: false });
      }
    }
    updateMutation.mutate({ id: entity.id, data: { is_default: true } });
  };

  return (
    <div>
      <SettingsSectionHeader
        icon={Building2}
        title="Multi-Company & White-Label"
        description="Manage multiple trading entities with separate branding, logos, and color schemes for client-facing output."
        actions={
          <Button onClick={() => { setShowForm(true); setEditingId(null); }} className="bg-emerald-700 hover:bg-emerald-800 text-white gap-1">
            <Plus className="w-4 h-4" /> Add Entity
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-[#2E5A1A] animate-spin" /></div>
      ) : entities.length === 0 ? (
        <div className="insight-card rounded-2xl p-8 text-center">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-600">No trading entities yet</p>
          <p className="text-xs text-slate-400 mt-1">Add a trading entity to enable multi-company branding.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {entities.map(e => (
            <div key={e.id} className="insight-card rounded-2xl p-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1" style={{ background: `linear-gradient(90deg, ${e.primary_color || '#2E5A1A'}, ${e.accent_color || '#8DC63F'})` }} />
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  {e.logo_url ? (
                    <img src={e.logo_url} alt={e.name} className="w-12 h-12 rounded-lg object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: e.primary_color || '#2E5A1A' }}>
                      <Building2 className="w-6 h-6 text-white" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-slate-800">{e.name}</h3>
                    {e.legal_name && <p className="text-xs text-slate-500">{e.legal_name}</p>}
                  </div>
                </div>
                {e.is_default && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full ring-1 ring-amber-200">
                    <Star className="w-3 h-3 fill-amber-500 text-amber-500" /> Default
                  </span>
                )}
              </div>
              <div className="space-y-1 text-xs text-slate-500">
                {e.company_registration_number && <p>CRN: {e.company_registration_number}</p>}
                {e.vat_number && <p>VAT: {e.vat_number}</p>}
                {e.address && <p className="truncate">{e.address}</p>}
                {e.contact_email && <p>{e.contact_email}</p>}
              </div>
              <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100">
                <Button onClick={() => { setEditingId(e.id); setShowForm(true); }} variant="outline" className="text-xs h-8">Edit</Button>
                {!e.is_default && <Button onClick={() => setDefault(e)} variant="outline" className="text-xs h-8">Set Default</Button>}
                {!e.is_default && <button onClick={() => deleteMutation.mutate(e.id)} className="ml-auto p-1.5 rounded hover:bg-rose-50"><Trash2 className="w-4 h-4 text-rose-500" /></button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <EntityForm
          entity={editingId ? entities.find(e => e.id === editingId) : null}
          onSave={(data) => editingId ? updateMutation.mutate({ id: editingId, data }) : createMutation.mutate(data)}
          saving={createMutation.isPending || updateMutation.isPending}
          onCancel={() => { setShowForm(false); setEditingId(null); }}
        />
      )}
    </div>
  );
}

function EntityForm({ entity, onSave, saving, onCancel }) {
  const [form, setForm] = useState({
    name: entity?.name || '',
    legal_name: entity?.legal_name || '',
    company_registration_number: entity?.company_registration_number || '',
    vat_number: entity?.vat_number || '',
    address: entity?.address || '',
    contact_email: entity?.contact_email || '',
    contact_phone: entity?.contact_phone || '',
    logo_url: entity?.logo_url || '',
    primary_color: entity?.primary_color || '#2E5A1A',
    accent_color: entity?.accent_color || '#8DC63F',
    is_active: entity?.is_active ?? true,
  });

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm({ ...form, logo_url: file_url });
    } catch (err) {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onCancel}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-slate-800 mb-4">{entity ? 'Edit' : 'Add'} Trading Entity</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Trading Name *</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Ground Control Ltd" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Legal Name</label>
            <input value={form.legal_name} onChange={e => setForm({ ...form, legal_name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Ground Control Geotechnical Limited" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">CRN</label>
              <input value={form.company_registration_number} onChange={e => setForm({ ...form, company_registration_number: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">VAT Number</label>
              <input value={form.vat_number} onChange={e => setForm({ ...form, vat_number: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Address</label>
            <textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Contact Email</label>
              <input type="email" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Contact Phone</label>
              <input value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Logo</label>
            <div className="flex items-center gap-2">
              {form.logo_url && <img src={form.logo_url} alt="Logo" className="w-10 h-10 rounded-lg object-cover" />}
              <label className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm cursor-pointer hover:bg-slate-50">
                <Upload className="w-4 h-4" /> Upload
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              </label>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Primary Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.primary_color} onChange={e => setForm({ ...form, primary_color: e.target.value })} className="w-10 h-10 rounded cursor-pointer" />
                <input value={form.primary_color} onChange={e => setForm({ ...form, primary_color: e.target.value })} className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Accent Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.accent_color} onChange={e => setForm({ ...form, accent_color: e.target.value })} className="w-10 h-10 rounded cursor-pointer" />
                <input value={form.accent_color} onChange={e => setForm({ ...form, accent_color: e.target.value })} className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={() => onSave(form)} disabled={saving || !form.name} className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : entity ? 'Update' : 'Create'}
            </Button>
            <Button onClick={onCancel} variant="outline" className="flex-1">Cancel</Button>
          </div>
        </div>
      </div>
    </div>
  );
}