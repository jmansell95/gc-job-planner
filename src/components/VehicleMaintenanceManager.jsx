import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Wrench, Phone, MapPin, Calendar, Clock, Trash2, Edit2, CheckCircle2, X, Truck, User, ArrowLeft } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton, EmptyState } from '@/components/StateViews';

const BOOKING_TYPES = [
  { value: 'mot', label: 'MOT' },
  { value: 'service', label: 'Service' },
  { value: 'windscreen', label: 'Windscreen Repair' },
  { value: 'repair', label: 'Repair' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'other', label: 'Other' },
];

const STATUS_CONFIG = {
  requested: { label: 'Requested', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  booked: { label: 'Booked', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  in_progress: { label: 'In Progress', color: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500' },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  cancelled: { label: 'Cancelled', color: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' },
};

const emptyForm = {
  vehicle_id: '', booking_type: 'mot', status: 'requested',
  booking_date: format(new Date(), 'yyyy-MM-dd'), booking_time: '08:00',
  supplier_name: 'Holman', supplier_phone: '', location: '',
  assigned_staff_id: '', cost: '', notes: ''
};

export default function VehicleMaintenanceManager() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: bookings = [], isLoading } = useQuery({ queryKey: ['maintenance-bookings'], queryFn: () => base44.entities.VehicleMaintenanceBooking.list('-booking_date', 200) });
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => base44.entities.Vehicle.list() });
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const vehicle = vehicles.find(v => v.id === formData.vehicle_id);
      const assignedStaff = staff.find(s => s.id === formData.assigned_staff_id);
      const payload = {
        ...formData,
        cost: formData.cost ? parseFloat(formData.cost) : null,
        vehicle_name: vehicle ? `${vehicle.name} (${vehicle.registration_number})` : '',
        assigned_staff_name: assignedStaff?.name || ''
      };
      let result;
      if (editingId) {
        await base44.entities.VehicleMaintenanceBooking.update(editingId, payload);
        result = { id: editingId };
      } else {
        result = await base44.entities.VehicleMaintenanceBooking.create(payload);
      }
      // Notify assigned staff
      if (formData.assigned_staff_id) {
        try { await base44.functions.invoke('notifyMaintenanceBooking', { booking_id: result.id }); } catch (_) {}
      }
      queryClient.invalidateQueries({ queryKey: ['maintenance-bookings'] });
      toast({ title: editingId ? 'Booking updated' : 'Booking created', description: formData.assigned_staff_id ? 'Assigned staff has been notified by email.' : 'No staff assigned — no email sent.' });
      setFormData(emptyForm); setShowForm(false); setEditingId(null);
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleEdit = (b) => {
    setFormData({ ...emptyForm, ...b, cost: b.cost || '' });
    setEditingId(b.id); setShowForm(true);
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      const update = { status: newStatus };
      if (newStatus === 'completed') update.completed_at = new Date().toISOString();
      await base44.entities.VehicleMaintenanceBooking.update(id, update);
      queryClient.invalidateQueries({ queryKey: ['maintenance-bookings'] });
      toast({ title: 'Status updated', description: `Marked as ${STATUS_CONFIG[newStatus].label}.` });
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this maintenance booking?')) return;
    await base44.entities.VehicleMaintenanceBooking.delete(id);
    queryClient.invalidateQueries({ queryKey: ['maintenance-bookings'] });
    toast({ title: 'Booking deleted' });
  };

  const filteredBookings = selectedVehicleId ? bookings.filter(b => b.vehicle_id === selectedVehicleId) : bookings;
  const upcoming = filteredBookings.filter(b => ['requested', 'booked', 'in_progress'].includes(b.status));
  const past = filteredBookings.filter(b => ['completed', 'cancelled'].includes(b.status));

  const renderBookingCard = (b) => {
    const vehicle = vehicles.find(v => v.id === b.vehicle_id);
    const assignedStaff = staff.find(s => s.id === b.assigned_staff_id);
    const st = STATUS_CONFIG[b.status] || STATUS_CONFIG.requested;
    const typeLabel = BOOKING_TYPES.find(t => t.value === b.booking_type)?.label || b.booking_type;
    return (
      <div key={b.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
              <Wrench className="w-5 h-5 text-amber-600" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-slate-900">{typeLabel}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
              </div>
              <button onClick={() => b.vehicle_id && setSelectedVehicleId(b.vehicle_id)} disabled={!b.vehicle_id}
                className="text-sm text-slate-600 mt-0.5 block text-left hover:text-emerald-700 hover:underline disabled:hover:text-slate-600 disabled:hover:no-underline transition">
                {vehicle ? `${vehicle.name} (${vehicle.registration_number})` : b.vehicle_name || 'Vehicle not specified'}
              </button>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-slate-500">
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{b.booking_date ? format(new Date(b.booking_date + 'T00:00:00'), 'dd MMM yyyy') : 'TBC'}</span>
                {b.booking_time && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{b.booking_time}</span>}
                {b.supplier_name && <span className="flex items-center gap-1"><Wrench className="w-3 h-3" />{b.supplier_name}</span>}
                {b.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{b.location}</span>}
                {assignedStaff && <span className="flex items-center gap-1"><User className="w-3 h-3" />{assignedStaff.name}</span>}
              </div>
              {b.supplier_phone && (
                <a href={`tel:${b.supplier_phone}`} className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium mt-1.5 hover:underline">
                  <Phone className="w-3 h-3" />{b.supplier_phone}
                </a>
              )}
              {b.notes && <p className="text-xs text-slate-400 mt-1.5 italic">{b.notes}</p>}
            </div>
          </div>
          <div className="flex flex-col gap-1 flex-shrink-0">
            <button onClick={() => handleEdit(b)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"><Edit2 className="w-4 h-4" /></button>
            <button onClick={() => handleDelete(b.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>
        {['requested', 'booked'].includes(b.status) && (
          <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
            {b.status === 'requested' && (
              <button onClick={() => handleStatusChange(b.id, 'booked')} className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition">Mark as Booked</button>
            )}
            <button onClick={() => handleStatusChange(b.id, 'completed')} className="flex-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition">Mark Completed</button>
            <button onClick={() => handleStatusChange(b.id, 'cancelled')} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-200 transition">Cancel</button>
          </div>
        )}
        {b.status === 'in_progress' && (
          <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
            <button onClick={() => handleStatusChange(b.id, 'completed')} className="flex-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition">Mark Completed</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Maintenance Bookings</h2>
          <p className="text-sm text-slate-500">Book MOTs, services and repairs with Holman or other suppliers</p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setEditingId(null); setFormData({ ...emptyForm, vehicle_id: selectedVehicleId || '' }); }}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-sm font-medium">
          <Plus className="w-4 h-4" /> Book Maintenance
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-5 border border-emerald-200 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">{editingId ? 'Edit Booking' : 'New Maintenance Booking'}</h3>
            <button type="button" onClick={() => setShowForm(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Vehicle *</label>
              <select value={formData.vehicle_id} onChange={e => setFormData({ ...formData, vehicle_id: e.target.value })} required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm bg-white">
                <option value="">Select Vehicle</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.registration_number})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Booking Type *</label>
              <select value={formData.booking_type} onChange={e => setFormData({ ...formData, booking_type: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm bg-white">
                {BOOKING_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Booking Date *</label>
              <input type="date" value={formData.booking_date} onChange={e => setFormData({ ...formData, booking_date: e.target.value })} required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Booking Time</label>
              <input type="time" value={formData.booking_time} onChange={e => setFormData({ ...formData, booking_time: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Supplier / Garage</label>
              <input type="text" value={formData.supplier_name} onChange={e => setFormData({ ...formData, supplier_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Supplier Phone</label>
              <input type="text" value={formData.supplier_phone} onChange={e => setFormData({ ...formData, supplier_phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Location / Address</label>
              <input type="text" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Assign Driver / Staff</label>
              <select value={formData.assigned_staff_id} onChange={e => setFormData({ ...formData, assigned_staff_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm bg-white">
                <option value="">Unassigned</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Cost (£)</label>
              <input type="number" step="0.01" value={formData.cost} onChange={e => setFormData({ ...formData, cost: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
              <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm resize-none" />
            </div>
          </div>
          <div className="flex gap-2 mt-5">
            <button type="submit" disabled={saving} className="px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition font-medium text-sm disabled:opacity-50">
              {saving ? 'Saving…' : editingId ? 'Update' : 'Create'} Booking
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-medium text-sm">Cancel</button>
          </div>
        </form>
      )}

      {selectedVehicleId && (() => {
        const v = vehicles.find(vh => vh.id === selectedVehicleId);
        if (!v) return null;
        const issues = [];
        const today = new Date();
        if (v.mot_expiry) {
          const days = differenceInDays(new Date(v.mot_expiry + 'T00:00:00'), today);
          if (days < 0) issues.push({ label: 'MOT Expired', color: 'bg-red-50 text-red-700' });
          else if (days <= 30) issues.push({ label: `MOT due in ${days}d`, color: 'bg-amber-50 text-amber-700' });
        }
        if (v.service_due_date) {
          const days = differenceInDays(new Date(v.service_due_date + 'T00:00:00'), today);
          if (days < 0) issues.push({ label: 'Service Overdue', color: 'bg-red-50 text-red-700' });
          else if (days <= 30) issues.push({ label: `Service due in ${days}d`, color: 'bg-amber-50 text-amber-700' });
        }
        return (
          <div className="mb-5 bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <button onClick={() => setSelectedVehicleId(null)} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-3 transition">
              <ArrowLeft className="w-4 h-4" /> All Bookings
            </button>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                <Truck className="w-5 h-5 text-amber-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-mono font-bold text-slate-900 text-lg">{v.registration_number}</p>
                <p className="text-sm text-slate-500">{v.name}</p>
              </div>
              {issues.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {issues.map((issue, i) => (
                    <span key={i} className={`text-xs px-2 py-1 rounded-full font-medium ${issue.color}`}>{issue.label}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}</div>
      ) : filteredBookings.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200">
          <EmptyState icon={Wrench} title={selectedVehicleId ? "No bookings for this vehicle" : "No maintenance bookings yet"} message={selectedVehicleId ? "Book MOTs, services and repairs for this vehicle using the button above." : "Book MOTs, services and repairs here. Staff will be notified by email when assigned."} />
        </div>
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">Upcoming ({upcoming.length})</h3>
              <div className="space-y-3">{upcoming.map(renderBookingCard)}</div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-3">History ({past.length})</h3>
              <div className="space-y-3 opacity-70">{past.map(renderBookingCard)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}