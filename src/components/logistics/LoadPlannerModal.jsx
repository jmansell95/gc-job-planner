import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Truck, Package, ClipboardList, X, Calendar, User, MapPin, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

const typeOptions = [
  { value: 'site_delivery', label: 'Site Delivery', icon: Truck },
  { value: 'supplier_collection', label: 'Collection', icon: Package },
  { value: 'item_handover', label: 'Handover', icon: ClipboardList }
];

export default function LoadPlannerModal({ selectedItems = [], staff = [], vehicles = [], job, onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [driverStaffId, setDriverStaffId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [scheduledDate, setScheduledDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [deliveryType, setDeliveryType] = useState('site_delivery');
  const [pickupAddress, setPickupAddress] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState(job?.location || '');
  const [contactName, setContactName] = useState(job?.site_contact_name || '');
  const [contactPhone, setContactPhone] = useState(job?.site_contact_phone || '');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!driverStaffId) { toast({ title: 'Select a driver first' }); return; }
    setSaving(true);
    try {
      const driver = staff.find(s => s.id === driverStaffId);
      const itemIds = selectedItems.map(i => i.id);
      const itemsText = selectedItems.length > 0
        ? selectedItems.map(i => `${i.quantity > 1 ? `${i.quantity}× ` : ''}${i.description}`).join(', ')
        : (notes || 'Items to be confirmed');
      const payload = {
        job_id: job.id,
        job_name: job.name || '',
        driver_staff_id: driverStaffId,
        driver_staff_name: driver?.name || '',
        delivery_type: deliveryType,
        items: itemsText,
        linked_cost_item_ids: itemIds.length > 0 ? itemIds.join(',') : '',
        pickup_address: pickupAddress,
        delivery_address: deliveryAddress,
        contact_name: contactName,
        contact_phone: contactPhone,
        scheduled_date: scheduledDate,
        vehicle_id: vehicleId,
        notes,
        status: 'pending',
        chargeable: deliveryType !== 'item_handover'
      };
      const created = await base44.entities.DeliveryLog.create(payload);
      try {
        const res = await base44.functions.invoke('calculateCharge', { entity_type: 'delivery', chargeable: payload.chargeable });
        if (res.data && created.id) {
          await base44.entities.DeliveryLog.update(created.id, {
            charge_amount: res.data.charge_amount || 0,
            charge_breakdown: JSON.stringify(res.data.breakdown || {}),
            billing_status: res.data.billing_status || 'auto'
          });
        }
      } catch (e) { console.error('Charge calc error:', e); }
      if (itemIds.length > 0) {
        await base44.entities.JobCostItem.bulkUpdate(
          itemIds.map(id => ({ id, current_location: 'in_transit', location_updated_at: new Date().toISOString() }))
        );
        queryClient.invalidateQueries({ queryKey: ['job-cost-items', job.id] });
        queryClient.invalidateQueries({ queryKey: ['job-cost-items-manifest', job.id] });
      }
      queryClient.invalidateQueries({ queryKey: ['job-deliveries', job.id] });
      toast({ title: 'Load planned', description: `${selectedItems.length > 0 ? `${selectedItems.length} items assigned to` : 'Delivery created for'} ${driver?.name || 'driver'} for ${format(new Date(scheduledDate + 'T00:00:00'), 'dd MMM')}.` });
      onClose();
    } catch (err) {
      console.error('Load planning error:', err);
      toast({ title: 'Error', description: 'Could not plan load.' });
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-emerald-700" />
            <h3 className="font-bold text-slate-900">Plan a Load</h3>
          </div>
          <button onClick={() => !saving && onClose()} className="p-1 text-slate-400 hover:text-slate-600 rounded"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {selectedItems.length > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1.5">{selectedItems.length} items selected</p>
              <div className="space-y-0.5">
                {selectedItems.slice(0, 5).map(i => (
                  <p key={i.id} className="text-xs text-slate-600 truncate">• {i.description}{i.quantity > 1 ? ` ×${i.quantity}` : ''}</p>
                ))}
                {selectedItems.length > 5 && <p className="text-xs text-slate-400">+{selectedItems.length - 5} more</p>}
              </div>
            </div>
          )}
          {selectedItems.length === 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-700">No equipment items selected — use the notes field below to describe what's being delivered, or select equipment items from the list above first.</p>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            {typeOptions.map(o => {
              const Icon = o.icon;
              return (
                <button key={o.value} type="button" onClick={() => setDeliveryType(o.value)} className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border text-xs font-medium transition ${deliveryType === o.value ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                  <Icon className="w-4 h-4" /> {o.label}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1"><User className="w-3 h-3" /> Driver *</label>
              <select value={driverStaffId} onChange={e => setDriverStaffId(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600">
                <option value="">Select driver…</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1"><Calendar className="w-3 h-3" /> Date *</label>
              <input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Vehicle</label>
              <select value={vehicleId} onChange={e => setVehicleId(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600">
                <option value="">No vehicle</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.registration_number})</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1"><MapPin className="w-3 h-3" /> Pickup from</label>
              <input type="text" value={pickupAddress} onChange={e => setPickupAddress(e.target.value)} placeholder="Depot, supplier yard…" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1"><MapPin className="w-3 h-3" /> Deliver to</label>
              <input type="text" value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} placeholder="Site address" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Contact name</label>
              <input type="text" value={contactName} onChange={e => setContactName(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Contact phone</label>
              <input type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Access instructions, timing…" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 resize-none" />
          </div>
        </div>
        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 py-3 flex gap-2">
          <button onClick={handleSubmit} disabled={saving || !driverStaffId} className="flex-1 py-2.5 bg-emerald-700 text-white rounded-xl font-semibold text-sm hover:bg-emerald-800 transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Planning…</> : <><Truck className="w-4 h-4" /> {selectedItems.length > 0 ? `Plan Load (${selectedItems.length} items)` : 'Create Delivery'}</>}
          </button>
          <button onClick={() => !saving && onClose()} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-200 transition">Cancel</button>
        </div>
      </div>
    </div>
  );
}