import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Wrench, Phone, MapPin, Calendar, Clock, Trash2, Edit2, CheckCircle2,
  X, Truck, User, ArrowLeft, PhoneCall, CalendarClock, PoundSterling, AlertTriangle,
  Check, ChevronRight, Activity, History, Sparkles,
} from 'lucide-react';
import UsefulNumbersModal from '@/components/UsefulNumbersModal';
import MaintenanceBookingModal from '@/components/vehicles/MaintenanceBookingModal';
import { format, differenceInDays, isToday, isTomorrow, isThisWeek } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton, EmptyState } from '@/components/StateViews';

const BOOKING_TYPES = [
  { value: 'breakdown', label: 'Breakdown', icon: AlertTriangle, color: 'rose' },
  { value: 'mot', label: 'MOT', icon: CheckCircle2, color: 'emerald' },
  { value: 'service', label: 'Service', icon: Wrench, color: 'blue' },
  { value: 'windscreen', label: 'Windscreen', icon: AlertTriangle, color: 'amber' },
  { value: 'repair', label: 'Repair', icon: Wrench, color: 'violet' },
  { value: 'fuel_card', label: 'Fuel Card', icon: PoundSterling, color: 'cyan' },
  { value: 'inspection', label: 'Inspection', icon: Check, color: 'teal' },
  { value: 'other', label: 'Other', icon: Wrench, color: 'slate' },
];

const STATUS_CONFIG = {
  requested: { label: 'Requested', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500', step: 0 },
  booked: { label: 'Booked', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500', step: 1 },
  in_progress: { label: 'In Progress', color: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500', step: 2 },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', step: 3 },
  cancelled: { label: 'Cancelled', color: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400', step: -1 },
};

const TYPE_COLOR_MAP = {
  rose: 'bg-rose-50 text-rose-600 border-rose-200',
  emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  blue: 'bg-blue-50 text-blue-600 border-blue-200',
  amber: 'bg-amber-50 text-amber-600 border-amber-200',
  violet: 'bg-violet-50 text-violet-600 border-violet-200',
  cyan: 'bg-cyan-50 text-cyan-600 border-cyan-200',
  teal: 'bg-teal-50 text-teal-600 border-teal-200',
  slate: 'bg-slate-50 text-slate-600 border-slate-200',
};

const emptyForm = {
  vehicle_id: '', booking_type: 'mot', status: 'requested',
  booking_date: format(new Date(), 'yyyy-MM-dd'), booking_time: '08:00',
  supplier_name: 'Holman', supplier_phone: '0344 800 5626', location: '',
  assigned_staff_id: '', cost: '', notes: '',
  reported_by_staff_id: '', phone_booking: false
};

// ── Status workflow stepper ──
function StatusWorkflow({ currentStatus, onStatusChange, bookingId }) {
  const steps = ['requested', 'booked', 'in_progress', 'completed'];
  const currentStep = STATUS_CONFIG[currentStatus]?.step ?? 0;

  if (currentStatus === 'cancelled') {
    return (
      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-slate-100">
        <span className="text-xs text-slate-500 italic">Booking cancelled</span>
        <button onClick={() => onStatusChange(bookingId, 'requested')}
          className="ml-auto px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-200 transition">
          Reactivate
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <div className="flex items-center gap-1">
        {steps.map((step, i) => {
          const cfg = STATUS_CONFIG[step];
          const isDone = i < currentStep;
          const isCurrent = i === currentStep;
          const isFuture = i > currentStep;
          return (
            <React.Fragment key={step}>
              <button
                onClick={() => onStatusChange(bookingId, step)}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition ${
                  isCurrent ? `${cfg.color} ring-1 ring-offset-1 ring-current` :
                  isDone ? 'bg-emerald-50 text-emerald-600' :
                  'bg-slate-50 text-slate-400 hover:bg-slate-100'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isCurrent || isDone ? cfg.dot : 'bg-slate-300'}`} />
                {cfg.label}
              </button>
              {i < steps.length - 1 && (
                <ChevronRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
              )}
            </React.Fragment>
          );
        })}
        <button
          onClick={() => onStatusChange(bookingId, 'cancelled')}
          className="ml-auto px-2 py-1 rounded-lg text-[10px] font-medium text-slate-400 hover:bg-red-50 hover:text-red-500 transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Stats summary bar ──
function StatsBar({ bookings }) {
  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    let requested = 0, booked = 0, inProgress = 0, overdue = 0, completed = 0;
    let totalCost = 0;
    bookings.forEach(b => {
      if (b.status === 'requested') requested++;
      else if (b.status === 'booked') booked++;
      else if (b.status === 'in_progress') inProgress++;
      else if (b.status === 'completed') completed++;
      if (['requested', 'booked'].includes(b.status) && b.booking_date && b.booking_date < today) overdue++;
      if (b.cost) totalCost += Number(b.cost) || 0;
    });
    return { requested, booked, inProgress, overdue, completed, totalCost, active: requested + booked + inProgress };
  }, [bookings]);

  const items = [
    { label: 'Active', value: stats.active, icon: Activity, color: 'text-blue-600 bg-blue-50' },
    { label: 'Requested', value: stats.requested, icon: Clock, color: 'text-amber-600 bg-amber-50' },
    { label: 'Booked', value: stats.booked, icon: Calendar, color: 'text-violet-600 bg-violet-50' },
    { label: 'Overdue', value: stats.overdue, icon: AlertTriangle, color: 'text-rose-600 bg-rose-50' },
    { label: 'Completed', value: stats.completed, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Total Cost', value: `£${stats.totalCost.toLocaleString()}`, icon: PoundSterling, color: 'text-slate-600 bg-slate-100' },
  ];

  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-5">
      {items.map(item => (
        <div key={item.label} className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
          <div className="flex items-center gap-1.5 mb-1">
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${item.color}`}>
              <item.icon className="w-3.5 h-3.5" />
            </div>
            <span className="text-[10px] uppercase font-semibold text-slate-400">{item.label}</span>
          </div>
          <p className="text-lg font-bold text-slate-800 tabular-nums">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

// ── Date label helper ──
function dateLabel(dateStr) {
  if (!dateStr) return 'TBC';
  const d = new Date(dateStr + 'T00:00:00');
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  if (isThisWeek(d)) return format(d, 'EEEE');
  return format(d, 'dd MMM yyyy');
}

export default function VehicleMaintenanceManager() {
  const [showModal, setShowModal] = useState(false);
  const [editingBooking, setEditingBooking] = useState(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [showNumbers, setShowNumbers] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [autoRunning, setAutoRunning] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['maintenance-bookings'],
    queryFn: () => base44.entities.VehicleMaintenanceBooking.list('-booking_date', 500),
  });
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => base44.entities.Vehicle.list() });
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });

  const handleEdit = (b) => {
    setEditingBooking(b);
    setShowModal(true);
  };

  const handleRunAutoBook = async () => {
    setAutoRunning(true);
    try {
      const res = await base44.functions.invoke('autoBookMaintenance', {});
      const data = res?.data || res;
      toast({
        title: 'Auto-booking complete',
        description: `Checked ${data.checked || 0} vehicles · ${data.autoBooked || 0} booking${data.autoBooked === 1 ? '' : 's'} auto-created.`,
      });
      queryClient.invalidateQueries({ queryKey: ['maintenance-bookings'] });
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setAutoRunning(false);
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      const update = { status: newStatus };
      if (newStatus === 'completed') update.completed_at = new Date().toISOString();
      await base44.entities.VehicleMaintenanceBooking.update(id, update);
      queryClient.invalidateQueries({ queryKey: ['maintenance-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-maintenance-bookings'] });
      toast({ title: 'Status updated', description: `Marked as ${STATUS_CONFIG[newStatus].label}.` });
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleQuickReschedule = async (id, days) => {
    try {
      const booking = bookings.find(b => b.id === id);
      if (!booking || !booking.booking_date) return;
      const newDate = new Date(booking.booking_date + 'T00:00:00');
      newDate.setDate(newDate.getDate() + days);
      await base44.entities.VehicleMaintenanceBooking.update(id, { booking_date: format(newDate, 'yyyy-MM-dd') });
      queryClient.invalidateQueries({ queryKey: ['maintenance-bookings'] });
      toast({ title: 'Rescheduled', description: `${days > 0 ? 'Postponed' : 'Moved up'} by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}.` });
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

  // Filter by vehicle + status
  const vehicleFiltered = selectedVehicleId ? bookings.filter(b => b.vehicle_id === selectedVehicleId) : bookings;
  const statusFiltered = statusFilter === 'all' ? vehicleFiltered
    : statusFilter === 'overdue' ? vehicleFiltered.filter(b => ['requested', 'booked'].includes(b.status) && b.booking_date && b.booking_date < new Date().toISOString().slice(0, 10))
    : vehicleFiltered.filter(b => b.status === statusFilter);

  const upcoming = statusFiltered.filter(b => ['requested', 'booked', 'in_progress'].includes(b.status));
  const past = statusFiltered.filter(b => ['completed', 'cancelled'].includes(b.status));

  // Sort upcoming by date ascending (soonest first)
  const upcomingSorted = [...upcoming].sort((a, b) => (a.booking_date || '9999').localeCompare(b.booking_date || '9999'));
  // Sort past by date descending (most recent first)
  const pastSorted = [...past].sort((a, b) => (b.booking_date || '').localeCompare(a.booking_date || ''));

  const renderBookingCard = (b) => {
    const vehicle = vehicles.find(v => v.id === b.vehicle_id);
    const assignedStaff = staff.find(s => s.id === b.assigned_staff_id);
    const st = STATUS_CONFIG[b.status] || STATUS_CONFIG.requested;
    const typeCfg = BOOKING_TYPES.find(t => t.value === b.booking_type) || BOOKING_TYPES[BOOKING_TYPES.length - 1];
    const typeLabel = typeCfg.label;
    const TypeIcon = typeCfg.icon;
    const typeColor = TYPE_COLOR_MAP[typeCfg.color] || TYPE_COLOR_MAP.slate;
    const isOverdue = ['requested', 'booked'].includes(b.status) && b.booking_date && b.booking_date < new Date().toISOString().slice(0, 10);
    const dLabel = dateLabel(b.booking_date);

    return (
      <div key={b.id} className={`bg-white border rounded-xl p-4 shadow-sm transition hover:shadow-md ${isOverdue ? 'border-rose-300 ring-1 ring-rose-100' : 'border-slate-200'}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 border ${typeColor}`}>
              <TypeIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-slate-900">{typeLabel}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                {isOverdue && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-rose-100 text-rose-700 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Overdue
                  </span>
                )}
              </div>
              <button onClick={() => b.vehicle_id && setSelectedVehicleId(b.vehicle_id)} disabled={!b.vehicle_id}
                className="text-sm text-slate-600 mt-0.5 block text-left hover:text-emerald-700 hover:underline disabled:hover:text-slate-600 disabled:hover:no-underline transition">
                {vehicle ? `${vehicle.name} (${vehicle.registration_number})` : b.vehicle_name || 'Vehicle not specified'}
              </button>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-slate-500">
                <span className={`flex items-center gap-1 font-semibold ${isOverdue ? 'text-rose-600' : ''}`}>
                  <Calendar className="w-3 h-3" />{dLabel}
                </span>
                {b.booking_time && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{b.booking_time}</span>}
                {b.supplier_name && <span className="flex items-center gap-1"><Wrench className="w-3 h-3" />{b.supplier_name}</span>}
                {b.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{b.location}</span>}
                {assignedStaff && <span className="flex items-center gap-1"><User className="w-3 h-3" />{assignedStaff.name}</span>}
                {b.cost && <span className="flex items-center gap-1 font-semibold text-slate-700"><PoundSterling className="w-3 h-3" />{Number(b.cost).toLocaleString()}</span>}
              </div>
              {(b.reported_by_staff_name || b.reported_at) && (
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[11px]">
                  {b.reported_by_staff_name && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                      <PhoneCall className="w-3 h-3" /> Reported by {b.reported_by_staff_name}
                    </span>
                  )}
                  {b.reported_at && (
                    <span className="text-slate-400">
                      {format(new Date(b.reported_at), 'dd MMM yyyy HH:mm')}
                    </span>
                  )}
                  {b.report_source === 'phone_call' && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium text-[10px]">
                      Phone call
                    </span>
                  )}
                  {b.logged_by_name && (
                    <span className="text-slate-400">· logged by {b.logged_by_name}</span>
                  )}
                </div>
              )}
              {b.supplier_phone && (
                <a href={`tel:${b.supplier_phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium mt-1.5 hover:underline">
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

        {/* Quick reschedule buttons for upcoming bookings */}
        {['requested', 'booked'].includes(b.status) && b.booking_date && (
          <div className="flex items-center gap-1.5 mt-2 text-[10px]">
            <span className="text-slate-400">Reschedule:</span>
            <button onClick={() => handleQuickReschedule(b.id, -1)} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 transition font-medium">-1d</button>
            <button onClick={() => handleQuickReschedule(b.id, 1)} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 transition font-medium">+1d</button>
            <button onClick={() => handleQuickReschedule(b.id, 7)} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 transition font-medium">+1wk</button>
            <button onClick={() => handleQuickReschedule(b.id, 14)} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 transition font-medium">+2wk</button>
          </div>
        )}

        {/* Status workflow stepper */}
        <StatusWorkflow currentStatus={b.status} onStatusChange={handleStatusChange} bookingId={b.id} />
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Maintenance Bookings</h2>
          <p className="text-sm text-slate-500">Book MOTs, services and repairs with Holman or other suppliers · manage dates and history</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleRunAutoBook} disabled={autoRunning}
            className="flex items-center gap-2 px-3 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition text-sm font-medium shadow-sm disabled:opacity-50">
            <Sparkles className="w-4 h-4" /> {autoRunning ? 'Scanning…' : 'Auto-Book'}
          </button>
          <button onClick={() => setShowNumbers(true)}
            className="flex items-center gap-2 px-3 py-2 bg-[#2E5A1A] text-white rounded-lg hover:brightness-110 transition text-sm font-medium shadow-sm">
            <PhoneCall className="w-4 h-4" /> Call Holman
          </button>
          <button onClick={() => { setEditingBooking(null); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-sm font-medium">
            <Plus className="w-4 h-4" /> Book Maintenance
          </button>
        </div>
      </div>

      {/* Stats summary */}
      <StatsBar bookings={bookings} />

      {/* Status filter pills */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {[
          { val: 'all', label: 'All' },
          { val: 'overdue', label: 'Overdue' },
          { val: 'requested', label: 'Requested' },
          { val: 'booked', label: 'Booked' },
          { val: 'in_progress', label: 'In Progress' },
          { val: 'completed', label: 'Completed' },
        ].map(opt => (
          <button key={opt.val} onClick={() => setStatusFilter(opt.val)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${statusFilter === opt.val ? 'bg-[#2E5A1A] text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* Selected vehicle context bar */}
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
                <p className="text-sm text-slate-500">{[v.make, v.model].filter(Boolean).join(' ') || v.name}</p>
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

      {/* Bookings list */}
      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}</div>
      ) : statusFiltered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200">
          <EmptyState icon={Wrench} title={selectedVehicleId ? "No bookings for this vehicle" : "No maintenance bookings yet"} message={selectedVehicleId ? "Book MOTs, services and repairs for this vehicle using the button above." : "Book MOTs, services and repairs here. Staff will be notified by email when assigned."} />
        </div>
      ) : (
        <div className="space-y-6">
          {upcomingSorted.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-violet-600" /> Upcoming ({upcomingSorted.length})
              </h3>
              <div className="space-y-3">{upcomingSorted.map(renderBookingCard)}</div>
            </div>
          )}
          {pastSorted.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                <History className="w-4 h-4" /> History ({pastSorted.length})
              </h3>
              <div className="space-y-3 opacity-80">{pastSorted.map(renderBookingCard)}</div>
            </div>
          )}
        </div>
      )}

      <UsefulNumbersModal open={showNumbers} onClose={() => setShowNumbers(false)}
        onLogBooking={() => { setEditingBooking(null); setShowModal(true); }} />
      <MaintenanceBookingModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditingBooking(null); }}
        preselectVehicleId={selectedVehicleId}
        editingBooking={editingBooking}
      />
    </div>
  );
}