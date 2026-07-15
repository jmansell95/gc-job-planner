import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Truck, Package, ClipboardList, X, Calendar, User, MapPin, Loader2, Navigation, Weight, AlertTriangle, PackageCheck } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

const typeOptions = [
  { value: 'site_delivery', label: 'Delivery', desc: 'Deliver to site', icon: Truck, color: 'emerald' },
  { value: 'supplier_collection', label: 'Collection', desc: 'Collect & return', icon: Package, color: 'blue' },
  { value: 'item_handover', label: 'Handover', desc: 'Internal transfer', icon: ClipboardList, color: 'purple' }
];

const colorMap = {
  emerald: { border: 'border-emerald-600', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  blue: { border: 'border-blue-600', bg: 'bg-blue-50', text: 'text-blue-700' },
  purple: { border: 'border-purple-600', bg: 'bg-purple-50', text: 'text-purple-700' },
};

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
  const [useJobAddress, setUseJobAddress] = useState(true);

  const jobLocation = job?.location || '';
  const jobContactName = job?.site_contact_name || '';
  const jobContactPhone = job?.site_contact_phone || '';
  const effectiveDeliveryAddress = useJobAddress ? jobLocation : deliveryAddress;
  const effectiveContactName = useJobAddress ? jobContactName : contactName;
  const effectiveContactPhone = useJobAddress ? jobContactPhone : contactPhone;

  const selectedVehicle = vehicles.find(v => v.id === vehicleId);
  const totalWeight = selectedItems.reduce((s, i) => s + (Number(i.weight_kg) || 0), 0);
  const totalVolume = selectedItems.reduce((s, i) => s + (Number(i.volume_m3) || 0), 0);
  const weightPct = selectedVehicle?.max_weight_kg ? Math.min((totalWeight / selectedVehicle.max_weight_kg) * 100, 100) : 0;
  const volumePct = selectedVehicle?.max_volume_m3 ? Math.min((totalVolume / selectedVehicle.max_volume_m3) * 100, 100) : 0;
  const overWeight = selectedVehicle?.max_weight_kg && totalWeight > selectedVehicle.max_weight_kg;
  const overVolume = selectedVehicle?.max_volume_m3 && totalVolume > selectedVehicle.max_volume_m3;

  const mapsLink = pickupAddress && effectiveDeliveryAddress
    ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(pickupAddress)}&destination=${encodeURIComponent(effectiveDeliveryAddress)}`
    : effectiveDeliveryAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(effectiveDeliveryAddress)}`
    : null;

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
        delivery_address: effectiveDeliveryAddress,
        contact_name: effectiveContactName,
        contact_phone: effectiveContactPhone,
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

        <div className="p-5 space-y-5">
          {/* Step 1: Type */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">1. What type of job?</p>
            <div className="grid grid-cols-3 gap-2">
              {typeOptions.map(o => {
                const Icon = o.icon;
                const colors = colorMap[o.color];
                const isActive = deliveryType === o.value;
                return (
                  <button key={o.value} type="button" onClick={() => setDeliveryType(o.value)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-center transition ${isActive ? `${colors.border} ${colors.bg}` : 'border-slate-200 hover:border-slate-300'}`}>
                    <Icon className={`w-5 h-5 ${isActive ? colors.text : 'text-slate-400'}`} />
                    <p className={`text-xs font-bold ${isActive ? colors.text : 'text-slate-600'}`}>{o.label}</p>
                    <p className="text-[9px] text-slate-400 leading-tight">{o.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Items */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">2. Items on this load</p>
            {selectedItems.length > 0 ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <PackageCheck className="w-3.5 h-3.5 text-emerald-700" />
                  <p className="text-xs font-bold text-emerald-700">{selectedItems.length} items selected</p>
                </div>
                {selectedItems.slice(0, 6).map(i => (
                  <p key={i.id} className="text-xs text-slate-600 truncate flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-emerald-400" />
                    {i.description}{i.quantity > 1 ? ` ×${i.quantity}` : ''}
                  </p>
                ))}
                {selectedItems.length > 6 && <p className="text-xs text-slate-400">+{selectedItems.length - 6} more</p>}
                {(totalWeight > 0 || totalVolume > 0) && (
                  <div className="flex gap-3 pt-1.5 mt-1 border-t border-emerald-200">
                    {totalWeight > 0 && <span className="text-[10px] text-slate-500 inline-flex items-center gap-1"><Weight className="w-2.5 h-2.5" /> {Math.round(totalWeight)} kg</span>}
                    {totalVolume > 0 && <span className="text-[10px] text-slate-500">{totalVolume.toFixed(1)} m³</span>}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-xs text-amber-700">No equipment selected. Select items from the list above, or describe them in the notes below.</p>
              </div>
            )}
            {selectedVehicle && (selectedVehicle.max_weight_kg || selectedVehicle.max_volume_m3) && (
              <div className="mt-2 space-y-1.5">
                {selectedVehicle.max_weight_kg && (
                  <div>
                    <div className="flex items-center justify-between text-[10px] mb-0.5">
                      <span className="text-slate-500 font-medium">Weight capacity</span>
                      <span className={overWeight ? 'text-red-600 font-bold' : 'text-slate-600'}>{Math.round(totalWeight)} / {Math.round(selectedVehicle.max_weight_kg)} kg</span>
                    </div>
                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${overWeight ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${weightPct}%` }} />
                    </div>
                  </div>
                )}
                {selectedVehicle.max_volume_m3 && (
                  <div>
                    <div className="flex items-center justify-between text-[10px] mb-0.5">
                      <span className="text-slate-500 font-medium">Volume capacity</span>
                      <span className={overVolume ? 'text-red-600 font-bold' : 'text-slate-600'}>{totalVolume.toFixed(1)} / {selectedVehicle.max_volume_m3.toFixed(1)} m³</span>
                    </div>
                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${overVolume ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${volumePct}%` }} />
                    </div>
                  </div>
                )}
                {(overWeight || overVolume) && (
                  <div className="flex items-center gap-1.5 text-[10px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0" /> Vehicle capacity exceeded — consider a larger vehicle or split the load.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 3: Driver & Vehicle */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">3. Driver & Vehicle</p>
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
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.registration_number}){v.max_weight_kg ? ` · ${v.max_weight_kg}kg` : ''}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Step 4: Route */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">4. Route & Contact</p>
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer select-none">
                <input type="checkbox" checked={useJobAddress} onChange={e => setUseJobAddress(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                Use job location & contact details
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1"><Navigation className="w-3 h-3" /> Pickup from</label>
                  <input type="text" value={pickupAddress} onChange={e => setPickupAddress(e.target.value)} placeholder="Depot, supplier yard…" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
                </div>
                <div>
                  <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1"><MapPin className="w-3 h-3" /> Deliver to</label>
                  <input type="text" value={effectiveDeliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} disabled={useJobAddress} placeholder="Site address" className={`w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 ${useJobAddress ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`} />
                </div>
              </div>
              {mapsLink && (
                <a href={mapsLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-emerald-700 hover:text-emerald-900 font-medium px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition">
                  <Navigation className="w-3.5 h-3.5" /> View route on Google Maps
                </a>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Contact name</label>
                  <input type="text" value={effectiveContactName} onChange={e => setContactName(e.target.value)} disabled={useJobAddress} className={`w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 ${useJobAddress ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Contact phone</label>
                  <input type="tel" value={effectiveContactPhone} onChange={e => setContactPhone(e.target.value)} disabled={useJobAddress} className={`w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 ${useJobAddress ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Access instructions, timing…" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 resize-none" />
              </div>
            </div>
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