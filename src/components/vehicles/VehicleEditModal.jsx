import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';

const emptyForm = {
  name: '', registration_number: '', assigned_staff_id: '', team_id: '',
  mot_expiry: '', service_due_date: '', last_service_date: '',
  max_weight_kg: '', max_volume_m3: '', vin: '',
};

const inputCls = "w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10";

export default function VehicleEditModal({ vehicle, staff, teams, onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const editingId = vehicle?.id || null;

  useEffect(() => {
    if (vehicle) setForm({ ...emptyForm, ...vehicle });
  }, [vehicle]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.registration_number) return;
    setSaving(true);
    try {
      if (editingId) {
        await base44.entities.Vehicle.update(editingId, form);
        toast({ title: 'Vehicle updated' });
      } else {
        await base44.entities.Vehicle.create(form);
        toast({ title: 'Vehicle added' });
      }
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      onClose();
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 pt-8 sm:pt-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white rounded-t-2xl z-10 border-b border-slate-200 px-5 py-4 flex items-center justify-between gap-3">
          <h3 className="font-bold text-slate-900">{editingId ? 'Edit Vehicle' : 'Add Vehicle'}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Vehicle Description *</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required
                placeholder="e.g. Ford Transit Tipper" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Registration *</label>
              <input type="text" value={form.registration_number} onChange={e => setForm({ ...form, registration_number: e.target.value.toUpperCase() })} required
                className={`${inputCls} font-mono uppercase`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">VIN</label>
              <input type="text" value={form.vin || ''} onChange={e => setForm({ ...form, vin: e.target.value })}
                placeholder="Vehicle Identification No." className={`${inputCls} font-mono`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Team</label>
              <select value={form.team_id || ''} onChange={e => setForm({ ...form, team_id: e.target.value })} className={inputCls}>
                <option value="">Select Team (Optional)</option>
                {teams?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Assign to Staff</label>
              <select value={form.assigned_staff_id || ''} onChange={e => setForm({ ...form, assigned_staff_id: e.target.value })} className={inputCls}>
                <option value="">Unassigned (Optional)</option>
                {staff?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">MOT Expiry</label>
              <input type="date" value={form.mot_expiry || ''} onChange={e => setForm({ ...form, mot_expiry: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Service Due</label>
              <input type="date" value={form.service_due_date || ''} onChange={e => setForm({ ...form, service_due_date: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Last Service</label>
              <input type="date" value={form.last_service_date || ''} onChange={e => setForm({ ...form, last_service_date: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Max Weight (kg)</label>
              <input type="number" min="0" value={form.max_weight_kg || ''} onChange={e => setForm({ ...form, max_weight_kg: e.target.value === '' ? '' : Number(e.target.value) })}
                placeholder="e.g. 3500" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Max Volume (m³)</label>
              <input type="number" min="0" step="0.1" value={form.max_volume_m3 || ''} onChange={e => setForm({ ...form, max_volume_m3: e.target.value === '' ? '' : Number(e.target.value) })}
                placeholder="e.g. 12.5" className={inputCls} />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-lg text-sm font-bold hover:bg-[#1c4a12] disabled:opacity-50 transition">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} {editingId ? 'Update' : 'Add'} Vehicle
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition text-sm font-medium">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}