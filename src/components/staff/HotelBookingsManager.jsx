import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Trash2, Edit2, Hotel, X, MapPin, Calendar, Phone, FileText, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const emptyForm = {
  job_id: '',
  hotel_name: '',
  address: '',
  check_in_date: '',
  check_out_date: '',
  booking_reference: '',
  room_type: '',
  contact_phone: '',
  notes: ''
};

const inputClass = 'w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 bg-white focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-50 transition';
const labelClass = 'block text-xs font-medium text-slate-500 mb-1.5';

export default function HotelBookingsManager({ staffId, staffName, jobs = [] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: allBookings = [], isLoading } = useQuery({
    queryKey: ['hotel-bookings', staffId],
    queryFn: () => base44.entities.HotelBooking.filter({ staff_id: staffId }),
    enabled: !!staffId
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!form.hotel_name || !form.job_id) {
      toast({ title: 'Hotel name and job are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const job = jobs.find(j => j.id === form.job_id);
      const payload = {
        ...form,
        staff_id: staffId,
        staff_name: staffName,
        job_name: job?.name || ''
      };
      if (editingId) {
        await base44.entities.HotelBooking.update(editingId, payload);
        toast({ title: 'Hotel booking updated' });
      } else {
        await base44.entities.HotelBooking.create(payload);
        toast({ title: 'Hotel booking added' });
      }
      queryClient.invalidateQueries({ queryKey: ['hotel-bookings', staffId] });
      queryClient.invalidateQueries({ queryKey: ['all-hotel-bookings'] });
      setForm(emptyForm);
      setEditingId(null);
      setShowForm(false);
    } catch (err) {
      toast({ title: 'Could not save', description: err?.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleEdit = (item) => {
    setForm({ ...emptyForm, ...item });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleDelete = async (item) => {
    if (!confirm(`Delete hotel booking at ${item.hotel_name}?`)) return;
    try {
      await base44.entities.HotelBooking.delete(item.id);
      queryClient.invalidateQueries({ queryKey: ['hotel-bookings', staffId] });
      queryClient.invalidateQueries({ queryKey: ['all-hotel-bookings'] });
      toast({ title: 'Hotel booking deleted' });
    } catch (err) {
      toast({ title: 'Could not delete', description: err?.message, variant: 'destructive' });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <Hotel className="w-5 h-5 text-blue-700" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Hotel Bookings</h3>
            <p className="text-xs text-slate-500 mt-0.5">{staffName}</p>
          </div>
        </div>
        {!showForm && (
          <button onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); }}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-700 text-white rounded-xl hover:bg-blue-800 active:scale-95 transition text-xs font-semibold shadow-sm">
            <Plus className="w-4 h-4" /> Add Booking
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-5 mb-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <p className="text-sm font-bold text-slate-900">{editingId ? 'Edit Booking' : 'New Hotel Booking'}</p>
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }}
              className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition"><X className="w-4 h-4" /></button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelClass}>Job *</label>
              <select value={form.job_id} onChange={e => setForm({ ...form, job_id: e.target.value })} required className={inputClass}>
                <option value="">Select job</option>
                {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Hotel Name *</label>
              <input type="text" value={form.hotel_name} onChange={e => setForm({ ...form, hotel_name: e.target.value })} required
                className={inputClass} placeholder="e.g. Premier Inn, Travelodge" />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Address</label>
              <input type="text" value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })}
                className={inputClass} placeholder="Hotel address" />
            </div>
            <div>
              <label className={labelClass}>Check-in</label>
              <input type="date" value={form.check_in_date || ''} onChange={e => setForm({ ...form, check_in_date: e.target.value })}
                className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Check-out</label>
              <input type="date" value={form.check_out_date || ''} onChange={e => setForm({ ...form, check_out_date: e.target.value })}
                className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Booking Reference</label>
              <input type="text" value={form.booking_reference || ''} onChange={e => setForm({ ...form, booking_reference: e.target.value })}
                className={inputClass} placeholder="Confirmation #" />
            </div>
            <div>
              <label className={labelClass}>Room Type</label>
              <input type="text" value={form.room_type || ''} onChange={e => setForm({ ...form, room_type: e.target.value })}
                className={inputClass} placeholder="Single, Twin, Double" />
            </div>
            <div>
              <label className={labelClass}>Hotel Phone</label>
              <input type="tel" value={form.contact_phone || ''} onChange={e => setForm({ ...form, contact_phone: e.target.value })}
                className={inputClass} placeholder="Optional" />
            </div>
          </div>

          <div>
            <label className={labelClass}>Notes</label>
            <textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
              className={`${inputClass} resize-none`} placeholder="Parking, breakfast, special requests" />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2.5 bg-blue-700 text-white rounded-xl hover:bg-blue-800 active:scale-95 transition text-sm font-semibold disabled:opacity-50 shadow-sm">
              {saving ? 'Saving…' : editingId ? 'Update Booking' : 'Add Booking'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }}
              className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition text-sm font-semibold">Cancel</button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
        </div>
      ) : allBookings.length === 0 ? (
        <div className="text-center py-10">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <Hotel className="w-7 h-7 text-slate-300" />
          </div>
          <p className="text-sm font-semibold text-slate-700">No hotel bookings yet</p>
          <p className="text-xs text-slate-400 mt-1">Add accommodation details for jobs that require overnight stays.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {allBookings.map(item => {
            const job = jobs.find(j => j.id === item.job_id);
            return (
              <div key={item.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-blue-50">
                    <Hotel className="w-5 h-5 text-blue-700" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">{item.hotel_name}</p>
                    {job && <p className="text-xs text-slate-500 mt-0.5">{job.name}</p>}
                    {item.address && (
                      <p className="text-xs text-slate-500 mt-1 flex items-start gap-1.5">
                        <MapPin className="w-3 h-3 flex-shrink-0 mt-0.5" /> {item.address}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 flex-wrap">
                      {item.check_in_date && (
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {format(new Date(item.check_in_date + 'T00:00:00'), 'dd MMM')}{item.check_out_date ? ` – ${format(new Date(item.check_out_date + 'T00:00:00'), 'dd MMM')}` : ''}</span>
                      )}
                      {item.room_type && <span>· {item.room_type}</span>}
                      {item.booking_reference && <span className="flex items-center gap-1">· <FileText className="w-3 h-3" /> {item.booking_reference}</span>}
                      {item.contact_phone && (
                        <a href={`tel:${item.contact_phone}`} className="flex items-center gap-1 text-blue-700 font-medium hover:underline">
                          <Phone className="w-3 h-3" /> {item.contact_phone}
                        </a>
                      )}
                    </div>
                    {item.notes && <p className="text-xs text-slate-500 mt-2 leading-relaxed">{item.notes}</p>}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => handleEdit(item)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(item)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}