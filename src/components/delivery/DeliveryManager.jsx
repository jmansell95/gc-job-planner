import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Truck, Plus, X, Package, MapPin, User, Phone, Calendar, FileText, ClipboardList } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton, EmptyState } from '@/components/StateViews';

const typeOptions = [
  { value: 'site_delivery', label: 'Site Delivery', icon: Truck },
  { value: 'supplier_collection', label: 'Supplier Collection', icon: Package },
  { value: 'item_handover', label: 'Item Handover', icon: ClipboardList }
];

export default function DeliveryManager({ jobId, jobName }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingDeliveryId, setEditingDeliveryId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    delivery_type: 'site_delivery',
    driver_staff_id: '',
    items: '',
    pickup_address: '',
    delivery_address: '',
    contact_name: '',
    contact_phone: '',
    po_number: '',
    scheduled_date: format(new Date(), 'yyyy-MM-dd'),
    vehicle_id: '',
    notes: ''
  });

  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: ['job-deliveries', jobId],
    queryFn: async () => {
      const list = await base44.entities.DeliveryLog.filter({ job_id: jobId });
      return list.sort((a, b) => new Date(b.scheduled_date) - new Date(a.scheduled_date));
    },
    enabled: !!jobId
  });

  const { data: staff = [] } = useQuery({ queryKey: ['delivery-staff'], queryFn: () => base44.entities.Staff.filter({ is_active: true }) });
  const { data: vehicles = [] } = useQuery({ queryKey: ['delivery-vehicles-mgr'], queryFn: () => base44.entities.Vehicle.list() });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.driver_staff_id || !formData.scheduled_date) {
      toast({ title: 'Missing details', description: 'Please select a driver and date.' });
      return;
    }
    setSaving(true);
    try {
      const driver = staff.find(s => s.id === formData.driver_staff_id);
      const payload = {
        ...formData,
        job_id: jobId,
        job_name: jobName || '',
        driver_staff_name: driver?.name || ''
      };
      if (editingDeliveryId) {
        await base44.entities.DeliveryLog.update(editingDeliveryId, payload);
        toast({ title: 'Delivery task updated', description: `${driver?.name || 'Driver'} · ${format(new Date(formData.scheduled_date + 'T00:00:00'), 'dd MMM')}.` });
      } else {
        payload.status = 'pending';
        await base44.entities.DeliveryLog.create(payload);
        toast({ title: 'Delivery task created', description: `${driver?.name || 'Driver'} assigned for ${format(new Date(formData.scheduled_date + 'T00:00:00'), 'dd MMM')}.` });
      }
      queryClient.invalidateQueries({ queryKey: ['job-deliveries', jobId] });
      setFormData({
        delivery_type: 'site_delivery',
        driver_staff_id: '',
        items: '',
        pickup_address: '',
        delivery_address: '',
        contact_name: '',
        contact_phone: '',
        po_number: '',
        scheduled_date: format(new Date(), 'yyyy-MM-dd'),
        vehicle_id: '',
        notes: ''
      });
      setEditingDeliveryId(null);
      setShowForm(false);
    } catch (err) {
      console.error('Error creating delivery:', err);
      toast({ title: 'Error', description: 'Could not create delivery task.' });
    } finally {
      setSaving(false);
    }
  };

  const handleEditDelivery = (d) => {
    setFormData({
      delivery_type: d.delivery_type || 'site_delivery',
      driver_staff_id: d.driver_staff_id || '',
      items: d.items || '',
      pickup_address: d.pickup_address || '',
      delivery_address: d.delivery_address || '',
      contact_name: d.contact_name || '',
      contact_phone: d.contact_phone || '',
      po_number: d.po_number || '',
      scheduled_date: d.scheduled_date || format(new Date(), 'yyyy-MM-dd'),
      vehicle_id: d.vehicle_id || '',
      notes: d.notes || ''
    });
    setEditingDeliveryId(d.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this delivery task?')) return;
    try {
      await base44.entities.DeliveryLog.delete(id);
      queryClient.invalidateQueries({ queryKey: ['job-deliveries', jobId] });
      toast({ title: 'Delivery deleted' });
    } catch (e) {
      toast({ title: 'Error', description: 'Could not delete.' });
    }
  };

  const typeBadge = {
    site_delivery: 'bg-emerald-100 text-emerald-700',
    supplier_collection: 'bg-blue-100 text-blue-700',
    item_handover: 'bg-purple-100 text-purple-700'
  };

  const statusBadge = {
    pending: 'bg-slate-100 text-slate-600',
    in_progress: 'bg-blue-50 text-blue-700',
    completed: 'bg-emerald-50 text-emerald-700',
    failed: 'bg-red-50 text-red-700'
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck className="w-5 h-5 text-emerald-600" />
          <h3 className="font-bold text-slate-900">Deliveries & Collections</h3>
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700">{deliveries.length}</span>
        </div>
        <button
          onClick={() => { setEditingDeliveryId(null); setShowForm(s => !s); }}
          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm font-semibold transition active:scale-95"
        >
          {showForm ? <><X className="w-4 h-4" /> Cancel</> : <><Plus className="w-4 h-4" /> New Task</>}
        </button>
      </div>

      {/* New / edit delivery form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">{editingDeliveryId ? 'Editing delivery task' : 'New delivery task'}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Delivery Type</label>
              <select value={formData.delivery_type} onChange={e => setFormData(p => ({ ...p, delivery_type: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600">
                {typeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Driver</label>
              <select value={formData.driver_staff_id} onChange={e => setFormData(p => ({ ...p, driver_staff_id: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600">
                <option value="">Select driver…</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Scheduled Date</label>
              <input type="date" value={formData.scheduled_date} onChange={e => setFormData(p => ({ ...p, scheduled_date: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Vehicle</label>
              <select value={formData.vehicle_id} onChange={e => setFormData(p => ({ ...p, vehicle_id: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600">
                <option value="">No vehicle</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.registration_number})</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Items</label>
            <textarea value={formData.items} onChange={e => setFormData(p => ({ ...p, items: e.target.value }))} rows={2} placeholder="e.g. 2x Excavator, 1x Transformer, 50m Heras fencing"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 resize-none" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Pickup Address</label>
              <input type="text" value={formData.pickup_address} onChange={e => setFormData(p => ({ ...p, pickup_address: e.target.value }))} placeholder="Supplier yard, depot, etc."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Delivery Address</label>
              <input type="text" value={formData.delivery_address} onChange={e => setFormData(p => ({ ...p, delivery_address: e.target.value }))} placeholder="Site address"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Contact Name</label>
              <input type="text" value={formData.contact_name} onChange={e => setFormData(p => ({ ...p, contact_name: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Contact Phone</label>
              <input type="tel" value={formData.contact_phone} onChange={e => setFormData(p => ({ ...p, contact_phone: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">PO Number</label>
              <input type="text" value={formData.po_number} onChange={e => setFormData(p => ({ ...p, po_number: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Access instructions, timing, etc."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 resize-none" />
          </div>
          <button type="submit" disabled={saving}
            className="w-full py-2.5 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 transition active:scale-95 disabled:opacity-50">
            {saving ? 'Saving…' : editingDeliveryId ? 'Update Delivery Task' : 'Create Delivery Task'}
          </button>
        </form>
      )}

      {/* Delivery list */}
      {isLoading ? (
        <Skeleton className="h-24 w-full rounded-xl" />
      ) : deliveries.length === 0 ? (
        <div className="bg-slate-50 rounded-xl border border-slate-200">
          <EmptyState icon={Truck} title="No deliveries yet" message="Create a delivery task to assign it to a driver." />
        </div>
      ) : (
        <div className="space-y-2">
          {deliveries.map(d => (
            <div key={d.id} className="bg-white rounded-xl border border-slate-200 p-3.5 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${typeBadge[d.delivery_type] || typeBadge.site_delivery}`}>
                    {typeOptions.find(t => t.value === d.delivery_type)?.label || d.delivery_type}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${statusBadge[d.status] || statusBadge.pending}`}>
                    {d.status}
                  </span>
                  {d.synced_from_offline && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-amber-50 text-amber-600">offline</span>
                  )}
                </div>
                <p className="text-sm font-semibold text-slate-900 truncate">{d.items || 'No items listed'}</p>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-400">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(new Date(d.scheduled_date + 'T00:00:00'), 'dd MMM')}</span>
                  <span>·</span>
                  <span>{d.driver_staff_name || 'Unassigned'}</span>
                  {d.delivery_address && <><span>·</span><span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{d.delivery_address.substring(0, 30)}{d.delivery_address.length > 30 ? '…' : ''}</span></>}
                </div>
                {d.signed_by_name && d.status === 'completed' && (
                  <p className="text-xs text-emerald-600 mt-1">Signed by {d.signed_by_name} · {d.completed_at ? format(new Date(d.completed_at), 'dd MMM HH:mm') : ''}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5 items-end flex-shrink-0">
                <button onClick={() => handleEditDelivery(d)} className="text-xs text-blue-500 hover:text-blue-700 font-medium">
                  Edit
                </button>
                {d.status === 'pending' && (
                  <button onClick={() => handleDelete(d.id)} className="text-xs text-red-400 hover:text-red-600 font-medium">
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}