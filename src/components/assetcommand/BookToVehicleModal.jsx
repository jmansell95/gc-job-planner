import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Truck, X, Package, Calendar, User, MapPin, Loader2, Weight,
  AlertTriangle, PackageCheck, CheckCircle2,
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

/**
 * Book to Vehicle — logistics booking flow launched from the Asset Lens
 * (single asset) or the bulk scanner (array of assets). Accepts either:
 *   asset   — a single SiteAsset (backward compatible)
 *   assets  — an array of SiteAsset records (bulk mode)
 * Sums weight/volume across all assets for the vehicle capacity check,
 * and creates a single DeliveryLog listing every item.
 *
 * onSuccess(result) is called after a successful booking (before onClose)
 * so callers can clear their basket.
 */
export default function BookToVehicleModal({ asset, assets: propAssets, onClose, onSuccess }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Normalise to array — accept either `assets` (array) or `asset` (single)
  const assets = useMemo(() => {
    if (propAssets && propAssets.length > 0) return propAssets;
    if (asset) return [asset];
    return [];
  }, [asset, propAssets]);

  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => base44.entities.Vehicle.list() });
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: jobs = [] } = useQuery({
    queryKey: ['active-jobs'],
    queryFn: async () => {
      const all = await base44.entities.Job.list();
      return all.filter(j => j.status === 'planning' || j.status === 'in_progress');
    },
  });

  const [jobId, setJobId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [driverStaffId, setDriverStaffId] = useState('');
  const [scheduledDate, setScheduledDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const selectedJob = jobs.find(j => j.id === jobId);
  const selectedVehicle = vehicles.find(v => v.id === vehicleId);

  // Auto-suggest driver from the vehicle's assigned staff
  const autoDriver = useMemo(() => {
    if (selectedVehicle?.assigned_staff_id) {
      return staff.find(s => s.id === selectedVehicle.assigned_staff_id);
    }
    return null;
  }, [selectedVehicle, staff]);

  const effectiveDriverId = driverStaffId || autoDriver?.id || '';
  const effectiveDriver = staff.find(s => s.id === effectiveDriverId);

  // Sum weight/volume across all assets in the basket
  const totalWeight = assets.reduce((sum, a) => sum + (Number(a.weight_kg) || 0), 0);
  const totalVolume = assets.reduce((sum, a) => sum + (Number(a.volume_m3) || 0), 0);
  const weightPct = selectedVehicle?.max_weight_kg ? Math.min((totalWeight / selectedVehicle.max_weight_kg) * 100, 100) : 0;
  const volumePct = selectedVehicle?.max_volume_m3 ? Math.min((totalVolume / selectedVehicle.max_volume_m3) * 100, 100) : 0;
  const overWeight = selectedVehicle?.max_weight_kg && totalWeight > selectedVehicle.max_weight_kg;
  const overVolume = selectedVehicle?.max_volume_m3 && totalVolume > selectedVehicle.max_volume_m3;

  const canSubmit = jobId && effectiveDriverId && vehicleId && !saving && assets.length > 0;

  const handleSubmit = async () => {
    if (!jobId) { toast({ title: 'Select a job to deliver to', variant: 'destructive' }); return; }
    if (!effectiveDriverId) { toast({ title: 'Select a driver', variant: 'destructive' }); return; }
    if (!vehicleId) { toast({ title: 'Select a vehicle', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const itemDesc = assets.map(a => `${a.name}${a.serial_number ? ` (${a.serial_number})` : ''}`).join(', ');
      const payload = {
        job_id: jobId,
        job_name: selectedJob?.name || '',
        driver_staff_id: effectiveDriverId,
        driver_staff_name: effectiveDriver?.name || '',
        delivery_type: 'site_delivery',
        items: itemDesc,
        pickup_address: '',
        delivery_address: selectedJob?.location || '',
        contact_name: selectedJob?.site_contact_name || '',
        contact_phone: selectedJob?.site_contact_phone || '',
        scheduled_date: scheduledDate,
        vehicle_id: vehicleId,
        weight_kg: totalWeight > 0 ? totalWeight : null,
        volume_m3: totalVolume > 0 ? totalVolume : null,
        notes: notes || `Loaded from scan: ${assets.length} item${assets.length !== 1 ? 's' : ''}`,
        status: 'pending',
        chargeable: true,
      };
      await base44.entities.DeliveryLog.create(payload);
      queryClient.invalidateQueries({ queryKey: ['job-deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      setConfirmed(true);
      if (onSuccess) onSuccess({ count: assets.length });
      setTimeout(() => { onClose(); }, 1500);
    } catch (err) {
      console.error('Booking error:', err);
      toast({ title: 'Error', description: 'Could not book the delivery.', variant: 'destructive' });
    }
    setSaving(false);
  };

  if (assets.length === 0) return null;
  const isBulk = assets.length > 1;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto overscroll-contain p-4 bg-slate-950/60 backdrop-blur-md" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-w-lg w-full max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-3.5 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Truck className="w-4 h-4 text-emerald-700" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">{isBulk ? `Book ${assets.length} Items to Vehicle` : 'Book to Vehicle'}</h3>
              <p className="text-[11px] text-slate-400">Load {isBulk ? 'these assets' : 'this asset'} and notify the driver</p>
            </div>
          </div>
          <button onClick={() => !saving && onClose()} className="p-1 text-slate-400 hover:text-slate-600 rounded"><X className="w-5 h-5" /></button>
        </div>

        {confirmed ? (
          <div className="p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            </div>
            <p className="font-bold text-slate-900 mb-1">Loaded & Booked!</p>
            <p className="text-sm text-slate-500">{effectiveDriver?.name || 'Driver'} will see this delivery on their schedule for {format(new Date(scheduledDate + 'T00:00:00'), 'dd MMM')}.</p>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Assets being booked */}
            <div className="space-y-1.5">
              {assets.map(a => (
                <div key={a.id} className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-2.5">
                  <div className="w-9 h-9 rounded-lg bg-white border border-emerald-200 flex items-center justify-center flex-shrink-0">
                    <Package className="w-4 h-4 text-emerald-700" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 truncate">{a.name}</p>
                    <p className="text-xs text-slate-500 font-mono truncate">{a.serial_number || 'No serial'}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${a.compliance_status === 'compliant' ? 'bg-emerald-100 text-emerald-700' : a.compliance_status === 'expired' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                    {(a.compliance_status || 'unknown').toUpperCase()}
                  </span>
                </div>
              ))}
            </div>

            {/* Job */}
            <div>
              <label className="flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5"><MapPin className="w-3 h-3" /> Deliver to Job *</label>
              <select value={jobId} onChange={e => setJobId(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 bg-white">
                <option value="">Select a job…</option>
                {jobs.map(j => <option key={j.id} value={j.id}>{j.name}{j.location ? ` · ${j.location}` : ''}</option>)}
              </select>
              {selectedJob?.location && (
                <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> {selectedJob.location}</p>
              )}
            </div>

            {/* Vehicle */}
            <div>
              <label className="flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5"><Truck className="w-3 h-3" /> Vehicle *</label>
              <select value={vehicleId} onChange={e => setVehicleId(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 bg-white">
                <option value="">Select a vehicle…</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.registration_number}){v.max_weight_kg ? ` · ${v.max_weight_kg}kg` : ''}{v.max_volume_m3 ? ` / ${v.max_volume_m3}m³` : ''}</option>)}
              </select>
            </div>

            {/* Capacity bars */}
            {selectedVehicle && (selectedVehicle.max_weight_kg || selectedVehicle.max_volume_m3) && (
              <div className="space-y-2.5 bg-slate-50 rounded-xl p-3 border border-slate-200">
                <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wide flex items-center gap-1"><Weight className="w-3 h-3" /> Vehicle Capacity Check</p>
                {selectedVehicle.max_weight_kg && (
                  <div>
                    <div className="flex items-center justify-between text-[10px] mb-0.5">
                      <span className="text-slate-500 font-medium">Weight</span>
                      <span className={overWeight ? 'text-red-600 font-bold' : 'text-slate-600'}>{Math.round(totalWeight)} / {Math.round(selectedVehicle.max_weight_kg)} kg</span>
                    </div>
                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${overWeight ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${weightPct}%` }} />
                    </div>
                  </div>
                )}
                {selectedVehicle.max_volume_m3 && (
                  <div>
                    <div className="flex items-center justify-between text-[10px] mb-0.5">
                      <span className="text-slate-500 font-medium">Volume</span>
                      <span className={overVolume ? 'text-red-600 font-bold' : 'text-slate-600'}>{totalVolume.toFixed(2)} / {selectedVehicle.max_volume_m3.toFixed(1)} m³</span>
                    </div>
                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${overVolume ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${volumePct}%` }} />
                    </div>
                  </div>
                )}
                {(overWeight || overVolume) && (
                  <div className="flex items-center gap-1.5 text-[10px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0" /> Capacity exceeded — consider a larger vehicle or split the load.
                  </div>
                )}
              </div>
            )}

            {/* Driver & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1"><User className="w-3 h-3" /> Driver {autoDriver && !driverStaffId && <span className="text-[10px] text-emerald-600">(auto: {autoDriver.name})</span>}</label>
                <select value={driverStaffId} onChange={e => setDriverStaffId(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 bg-white">
                  <option value="">{autoDriver ? `Auto: ${autoDriver.name}` : 'Select driver…'}</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1"><Calendar className="w-3 h-3" /> Date</label>
                <input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Notes (optional)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Access instructions, timing…" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 resize-none" />
            </div>
          </div>
        )}

        {!confirmed && (
          <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 py-3 flex gap-2">
            <button onClick={handleSubmit} disabled={!canSubmit}
              className="flex-1 py-3 bg-emerald-700 text-white rounded-xl font-semibold text-sm hover:bg-emerald-800 transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5 active:scale-95">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Booking…</> : <><PackageCheck className="w-4 h-4" /> Confirm Loaded</>}
            </button>
            <button onClick={() => !saving && onClose()} className="px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-200 transition">Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}