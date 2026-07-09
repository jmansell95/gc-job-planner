import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import {
  Hotel, Plus, MapPin, Calendar, Phone, FileText, Trash2, Edit2,
  X, Users, Home, BedDouble, Wand2, Check, Loader2, Navigation
} from 'lucide-react';
import { format } from 'date-fns';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm";

const STAFF_AVATAR_COLORS = ['bg-emerald-100 text-emerald-700', 'bg-blue-100 text-blue-700', 'bg-amber-100 text-amber-700', 'bg-purple-100 text-purple-700', 'bg-rose-100 text-rose-700', 'bg-cyan-100 text-cyan-700'];

function StaffChip({ name, color, onClick }) {
  const colorClass = STAFF_AVATAR_COLORS[color % STAFF_AVATAR_COLORS.length];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {name.split(' ')[0]}
      {onClick && <button onClick={onClick} className="hover:bg-black/10 rounded-full p-0.5"><X className="w-2.5 h-2.5" /></button>}
    </span>
  );
}

function HotelCard({ booking, staffCount, onEdit, onDelete, onUnassign, staffMap }) {
  const assignedNames = booking.assigned_staff_names || [];
  const assignedIds = booking.assigned_staff_ids || [];
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition">
      <div className="bg-gradient-to-r from-blue-500 to-blue-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Hotel className="w-5 h-5 text-white flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">{booking.hotel_name}</p>
            {booking.check_in_date && (
              <p className="text-xs text-blue-100">{format(new Date(booking.check_in_date + 'T00:00:00'), 'dd MMM')}{booking.check_out_date ? ` – ${format(new Date(booking.check_out_date + 'T00:00:00'), 'dd MMM')}` : ''}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-xs text-blue-50 bg-white/15 rounded-full px-2 py-0.5 font-semibold flex items-center gap-1"><Users className="w-3 h-3" /> {staffCount}</span>
          <button onClick={() => onEdit(booking)} className="p-1.5 rounded-lg hover:bg-white/20 text-white transition"><Edit2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      <div className="p-4 space-y-2">
        {booking.address && (
          <a href={`https://maps.google.com/?q=${encodeURIComponent(booking.address + ' ' + booking.hotel_name)}`} target="_blank" rel="noopener noreferrer"
            className="flex items-start gap-1.5 text-xs text-slate-600 hover:text-blue-700 transition">
            <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" /> {booking.address} <Navigation className="w-3 h-3 inline text-blue-500" />
          </a>
        )}
        <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
          {booking.room_type && <span className="flex items-center gap-1"><BedDouble className="w-3 h-3" /> {booking.room_type}</span>}
          {booking.booking_reference && <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> {booking.booking_reference}</span>}
          {booking.contact_phone && (
            <a href={`tel:${booking.contact_phone}`} className="flex items-center gap-1 text-blue-700 font-medium hover:underline"><Phone className="w-3 h-3" /> {booking.contact_phone}</a>
          )}
        </div>
        <div className="flex flex-wrap gap-1 pt-1">
          {assignedNames.map((name, i) => (
            <StaffChip key={assignedIds[i] || i} name={name} color={i} onClick={() => onUnassign(booking, assignedIds[i])} />
          ))}
        </div>
        <button onClick={() => onDelete(booking)} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 pt-1"><Trash2 className="w-3 h-3" /> Remove booking</button>
      </div>
    </div>
  );
}

function HotelEditor({ open, onClose, booking, job, assignedStaff, onSave, allStaff }) {
  const [form, setForm] = useState(booking || {});
  const [selectedStaffIds, setSelectedStaffIds] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(booking || { hotel_name: '', address: '', check_in_date: job?.start_date || '', check_out_date: job?.end_date || '', room_type: '', booking_reference: '', contact_phone: '', notes: '' });
    setSelectedStaffIds(booking?.assigned_staff_ids || []);
  }, [booking, job, open]);

  const toggleStaff = (id) => {
    setSelectedStaffIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!form.hotel_name?.trim()) return;
    setSaving(true);
    const staffNames = selectedStaffIds.map(id => allStaff.find(s => s.id === id)?.name).filter(Boolean);
    const payload = {
      ...form,
      job_id: job.id,
      job_name: job.name,
      assigned_staff_ids: selectedStaffIds,
      assigned_staff_names: staffNames
    };
    try {
      if (booking?.id) {
        await base44.entities.HotelBooking.update(booking.id, payload);
      } else {
        await base44.entities.HotelBooking.create(payload);
      }
      onSave();
      onClose();
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            <Hotel className="w-5 h-5 text-blue-600" />
            {booking?.id ? 'Edit Hotel Booking' : 'New Hotel Booking'}
          </SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Hotel Name *</label>
            <input type="text" required value={form.hotel_name || ''} onChange={e => setForm({ ...form, hotel_name: e.target.value })} className={inputCls} placeholder="e.g. Premier Inn" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Address</label>
            <input type="text" value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} className={inputCls} placeholder="Street, City, Postcode" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Check-in</label>
              <input type="date" value={form.check_in_date || ''} onChange={e => setForm({ ...form, check_in_date: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Check-out</label>
              <input type="date" value={form.check_out_date || ''} onChange={e => setForm({ ...form, check_out_date: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Room Type</label>
              <input type="text" value={form.room_type || ''} onChange={e => setForm({ ...form, room_type: e.target.value })} className={inputCls} placeholder="Single, Twin..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Booking Ref</label>
              <input type="text" value={form.booking_reference || ''} onChange={e => setForm({ ...form, booking_reference: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Contact Phone</label>
            <input type="tel" value={form.contact_phone || ''} onChange={e => setForm({ ...form, contact_phone: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className={inputCls + " resize-none"} placeholder="Parking, breakfast, etc." />
          </div>

          {/* Staff assignment grid */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-xs font-medium text-slate-600 mb-2">Assigned Crew ({selectedStaffIds.length})</label>
            {assignedStaff.length === 0 ? (
              <p className="text-xs text-slate-400">No staff assigned to this job yet.</p>
            ) : (
              <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto">
                {assignedStaff.map((member, i) => {
                  const selected = selectedStaffIds.includes(member.id);
                  return (
                    <button key={member.id} type="button" onClick={() => toggleStaff(member.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition text-left ${selected ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
                      <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${selected ? 'bg-blue-600' : 'bg-white border border-slate-300'}`}>
                        {selected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      {member.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition text-sm font-semibold">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {booking?.id ? 'Update' : 'Create'}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition text-sm font-medium">Cancel</button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export default function JobHotelBookings({ job, assignedStaff, allStaff }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState(null);

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['job-hotel-bookings', job.id],
    queryFn: () => base44.entities.HotelBooking.filter({ job_id: job.id })
  });

  const assignedToAnyBooking = new Set(bookings.flatMap(b => b.assigned_staff_ids || []));
  const unassignedStaff = assignedStaff.filter(s => !assignedToAnyBooking.has(s.id));

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['job-hotel-bookings', job.id] });
    queryClient.invalidateQueries({ queryKey: ['all-hotel-bookings'] });
  };

  const handleAdd = () => {
    setEditingBooking(null);
    setEditorOpen(true);
  };

  const handleEdit = (booking) => {
    setEditingBooking(booking);
    setEditorOpen(true);
  };

  const handleDelete = async (booking) => {
    if (!confirm(`Delete the ${booking.hotel_name} booking?`)) return;
    try {
      await base44.entities.HotelBooking.delete(booking.id);
      invalidate();
      toast({ title: 'Booking deleted' });
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleUnassign = async (booking, staffId) => {
    const newIds = (booking.assigned_staff_ids || []).filter(id => id !== staffId);
    const newNames = (booking.assigned_staff_names || []).filter((_, i) => (booking.assigned_staff_ids || [])[i] !== staffId);
    try {
      await base44.entities.HotelBooking.update(booking.id, { assigned_staff_ids: newIds, assigned_staff_names: newNames });
      invalidate();
    } catch (err) {
      console.error('Unassign error:', err);
    }
  };

  const handleFillRemaining = async (booking) => {
    if (unassignedStaff.length === 0) {
      toast({ title: 'All staff are already assigned', description: 'No unassigned crew to fill.' });
      return;
    }
    const newIds = [...(booking.assigned_staff_ids || []), ...unassignedStaff.map(s => s.id)];
    const newNames = [...(booking.assigned_staff_names || []), ...unassignedStaff.map(s => s.name)];
    try {
      await base44.entities.HotelBooking.update(booking.id, { assigned_staff_ids: newIds, assigned_staff_names: newNames });
      invalidate();
      toast({ title: `${unassignedStaff.length} crew added`, description: `All remaining crew assigned to ${booking.hotel_name}.` });
    } catch (err) {
      console.error('Fill error:', err);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <Hotel className="w-5 h-5 text-blue-600" />
        <h2 className="font-semibold text-slate-900">Accommodations</h2>
        <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{bookings.length}</span>
        <button onClick={handleAdd} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-xs font-semibold ml-2">
          <Plus className="w-3.5 h-3.5" /> Add Hotel
        </button>
      </div>

      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <Hotel className="w-6 h-6 text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-600">No hotels booked yet</p>
            <p className="text-xs text-slate-400 mt-1">Add a hotel and assign crew members who need accommodation.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              {bookings.map(b => (
                <div key={b.id}>
                  <HotelCard booking={b} staffCount={(b.assigned_staff_ids || []).length} onEdit={handleEdit} onDelete={handleDelete} onUnassign={handleUnassign} />
                  {unassignedStaff.length > 0 && (
                    <button onClick={() => handleFillRemaining(b)} className="w-full mt-1.5 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold transition">
                      <Wand2 className="w-3.5 h-3.5" /> Fill {unassignedStaff.length} remaining
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Unassigned / Local bucket */}
            <div className="bg-slate-50 rounded-xl border border-dashed border-slate-300 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Home className="w-4 h-4 text-slate-400" />
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Local / No Hotel Required</p>
                <span className="ml-auto text-xs text-slate-400">{unassignedStaff.length}</span>
              </div>
              {unassignedStaff.length === 0 ? (
                <p className="text-xs text-slate-400">All crew are assigned to a hotel.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {unassignedStaff.map((s, i) => <StaffChip key={s.id} name={s.name} color={i} />)}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <HotelEditor open={editorOpen} onClose={() => setEditorOpen(false)} booking={editingBooking} job={job} assignedStaff={assignedStaff} allStaff={allStaff} onSave={invalidate} />
    </div>
  );
}