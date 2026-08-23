import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { FlaskConical, Truck, X, CheckCircle2, Loader2, MapPin, Package, User, Calendar, Link2, ArrowRight } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/**
 * Modal for scheduling a sample run — collecting samples from site and
 * delivering them to a laboratory.
 *
 * Auto-chains TWO linked DeliveryLog tasks so both legs are tracked
 * separately but connected:
 *   1. sample_collection  — driver picks up samples from site (→ depot/transfer)
 *   2. sample_delivery     — driver delivers samples to the lab (child, parent_delivery_id set)
 *
 * The sample_ids checklist is carried across both legs, so the driver must
 * tick "all samples accounted" at collection AND again at delivery sign-off.
 *
 * Props:
 *  - job: the Job record (used for pickup address + job_id)
 *  - samples: all Sample records for this job
 *  - allStaff: active staff list (for driver selection)
 *  - suppliers: supplier list (labs)
 *  - scheduledSampleIds: Set of sample_ids already scheduled (to dim them)
 *  - onClose: () => void
 */
export default function ScheduleSampleCollectionModal({ job, samples, allStaff, suppliers, scheduledSampleIds, onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  // Only samples still on site (collected status) and not already scheduled
  // for collection are eligible by default.
  const eligibleSamples = useMemo(
    () => samples.filter(s => s.status === 'collected' && !scheduledSampleIds?.has(s.sample_id)),
    [samples, scheduledSampleIds]
  );

  const [selectedIds, setSelectedIds] = useState(() => eligibleSamples.map(s => s.id));
  const [driverId, setDriverId] = useState('');
  const [collectionDate, setCollectionDate] = useState(new Date().toISOString().slice(0, 10));
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().slice(0, 10));
  const [labId, setLabId] = useState('');
  const [pickupAddress, setPickupAddress] = useState(job?.location || '');
  const [transferPoint, setTransferPoint] = useState('Ground Control Depot');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [notes, setNotes] = useState('');

  const drivers = allStaff.filter(s => s.is_active !== false);

  const toggleSample = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Auto-fill delivery address + contact when a lab is selected
  const handleLabChange = (id) => {
    setLabId(id);
    const lab = suppliers.find(s => s.id === id);
    if (lab) {
      setDeliveryAddress(lab.name ? `${lab.name}${lab.yard_address ? ', ' + lab.yard_address : ''}` : '');
      setContactName(lab.contact_name || '');
      setContactPhone(lab.contact_phone || '');
    }
  };

  const canSubmit = selectedIds.length > 0 && driverId && collectionDate && deliveryDate && pickupAddress && deliveryAddress;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const driver = drivers.find(s => s.id === driverId);
      const sampleIdList = selectedIds.join(',');
      const selectedSamples = samples.filter(s => selectedIds.includes(s.id));
      const itemsList = selectedSamples.map(s => `${s.sample_id}${s.borehole_ref ? ' (' + s.borehole_ref + ')' : ''}`).join(', ');
      const sharedItems = `Samples: ${itemsList}`;

      // Leg 1 — collect samples from site (→ transfer point / depot)
      const collectionTask = await base44.entities.DeliveryLog.create({
        job_id: job.id,
        job_name: job.name || '',
        driver_staff_id: driverId,
        driver_staff_name: driver?.name || '',
        delivery_type: 'sample_collection',
        status: 'pending',
        items: sharedItems,
        sample_ids: sampleIdList,
        samples_accounted: false,
        pickup_address: pickupAddress || '',
        delivery_address: transferPoint || 'Ground Control Depot',
        contact_name: '',
        contact_phone: '',
        scheduled_date: collectionDate,
        notes: notes || '',
        chargeable: false,
      });

      // Leg 2 — deliver samples to the lab (child, linked back to collection)
      await base44.entities.DeliveryLog.create({
        job_id: job.id,
        job_name: job.name || '',
        driver_staff_id: driverId,
        driver_staff_name: driver?.name || '',
        delivery_type: 'sample_delivery',
        status: 'pending',
        items: sharedItems,
        sample_ids: sampleIdList,
        samples_accounted: false,
        pickup_address: transferPoint || 'Ground Control Depot',
        delivery_address: deliveryAddress || '',
        contact_name: contactName || '',
        contact_phone: contactPhone || '',
        scheduled_date: deliveryDate,
        notes: notes || '',
        chargeable: false,
        parent_delivery_id: collectionTask.id,
        handover_from_staff_name: driver?.name || '',
      });

      toast({
        title: 'Sample run scheduled',
        description: `${selectedIds.length} sample${selectedIds.length === 1 ? '' : 's'} — collect ${formatShort(collectionDate)} → deliver to lab ${formatShort(deliveryDate)}. Both legs assigned to ${driver?.name || 'driver'}.`,
      });
      queryClient.invalidateQueries({ queryKey: ['sample-deliveries-for-job', job.id] });
      queryClient.invalidateQueries({ queryKey: ['samples-for-job', job.id] });
      queryClient.invalidateQueries({ queryKey: ['job-deliveries', job.id] });
      queryClient.invalidateQueries({ queryKey: ['admin-all-deliveries'] });
      onClose();
    } catch (e) {
      toast({ title: 'Error scheduling sample run', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-teal-600" />
            Schedule Sample Run
          </DialogTitle>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
            <Link2 className="w-3.5 h-3.5" /> Creates a linked collection <ArrowRight className="w-3 h-3" /> delivery — both legs tracked on the driver's day plan.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {eligibleSamples.length === 0 ? (
            <div className="text-center py-6">
              <FlaskConical className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No samples are ready for collection.</p>
              <p className="text-xs text-slate-400 mt-1">Only samples with "Collected" status can be scheduled for a run.</p>
            </div>
          ) : (
            <>
              {/* Sample selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Samples to include ({selectedIds.length} selected)
                </label>
                <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                  {eligibleSamples.map(s => (
                    <button key={s.id} type="button" onClick={() => toggleSample(s.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition ${selectedIds.includes(s.id) ? 'bg-teal-50' : 'bg-white hover:bg-slate-50'}`}>
                      <input type="checkbox" checked={selectedIds.includes(s.id)} readOnly
                        className="w-4 h-4 accent-teal-600" />
                      <div className="min-w-0 flex-1">
                        <span className="font-mono text-sm font-semibold text-slate-900">{s.sample_id}</span>
                        <span className="text-xs text-slate-500 ml-2">
                          {s.borehole_ref && `${s.borehole_ref} · `}
                          {s.depth_from != null && `${s.depth_from}–${s.depth_to}m`}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
                {samples.filter(s => s.status === 'collected' && scheduledSampleIds?.has(s.sample_id)).length > 0 && (
                  <div className="mt-2">
                    <p className="text-[10px] font-semibold text-slate-400 mb-1">Already scheduled for collection:</p>
                    <div className="flex flex-wrap gap-1">
                      {samples.filter(s => s.status === 'collected' && scheduledSampleIds?.has(s.sample_id)).map(s => (
                        <span key={s.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-teal-50 text-teal-600 border border-teal-200">
                          <CheckCircle2 className="w-2.5 h-2.5" />{s.sample_id}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Driver */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  <User className="w-3 h-3 inline mr-1" /> Driver (both legs)
                </label>
                <select value={driverId} onChange={e => setDriverId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-teal-600">
                  <option value="">Select driver…</option>
                  {drivers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              {/* Two-leg visual */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Leg 1 — Collection */}
                <div className="rounded-xl border-2 border-teal-200 bg-teal-50/40 p-3 space-y-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-teal-600 text-white text-[10px] font-bold flex items-center justify-center">1</span>
                    <Package className="w-3.5 h-3.5 text-teal-700" />
                    <span className="text-xs font-bold text-teal-800 uppercase tracking-wide">Collect from site</span>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Date</label>
                    <input type="date" value={collectionDate} onChange={e => setCollectionDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-teal-600" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5"><MapPin className="w-2.5 h-2.5 inline mr-0.5" />Pickup (site)</label>
                    <input value={pickupAddress} onChange={e => setPickupAddress(e.target.value)}
                      placeholder="Site address"
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-teal-600" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Drop to (transfer point)</label>
                    <input value={transferPoint} onChange={e => setTransferPoint(e.target.value)}
                      placeholder="Ground Control Depot"
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-teal-600" />
                  </div>
                </div>

                {/* Leg 2 — Delivery */}
                <div className="rounded-xl border-2 border-cyan-200 bg-cyan-50/40 p-3 space-y-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-cyan-600 text-white text-[10px] font-bold flex items-center justify-center">2</span>
                    <Truck className="w-3.5 h-3.5 text-cyan-700" />
                    <span className="text-xs font-bold text-cyan-800 uppercase tracking-wide">Deliver to lab</span>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Date</label>
                    <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)}
                      min={collectionDate}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-cyan-600" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5"><FlaskConical className="w-2.5 h-2.5 inline mr-0.5" />Laboratory</label>
                    <select value={labId} onChange={e => handleLabChange(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-cyan-600">
                      <option value="">Select lab…</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5"><MapPin className="w-2.5 h-2.5 inline mr-0.5" />Lab address</label>
                    <input value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)}
                      placeholder="Lab address"
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-cyan-600" />
                  </div>
                </div>
              </div>

              {/* Contact */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Lab contact name</label>
                  <input value={contactName} onChange={e => setContactName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-teal-600" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Lab contact phone</label>
                  <input value={contactPhone} onChange={e => setContactPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-teal-600" />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes (optional)</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows="2"
                  placeholder="Storage requirements, handling instructions, access notes…"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-teal-600" />
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={onClose}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancel</button>
                <button type="button" onClick={handleSubmit} disabled={!canSubmit || saving}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-700 text-white rounded-lg text-sm font-medium hover:bg-teal-800 disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Schedule Sample Run
                </button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatShort(d) {
  const date = new Date(d + 'T00:00:00');
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}