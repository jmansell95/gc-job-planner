import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { FlaskConical, Truck, X, CheckCircle2, Loader2, MapPin, Package, User, Calendar } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/**
 * Modal for scheduling a sample collection or sample delivery task.
 * Creates a DeliveryLog with linked sample_ids so the driver sees a sample
 * checklist in their sign-off modal and must tick "all samples accounted for".
 *
 * Props:
 *  - job: the Job record (used for pickup address + job_id)
 *  - samples: all Sample records for this job
 *  - allStaff: active staff list (for driver selection)
 *  - suppliers: supplier list (labs)
 *  - onClose: () => void
 */
export default function ScheduleSampleCollectionModal({ job, samples, allStaff, suppliers, scheduledSampleIds, onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  // Only samples still on site (collected status) and not already scheduled
  // for collection are eligible by default. Already-scheduled samples can still
  // be toggled on manually if the admin wants to re-schedule.
  const eligibleSamples = useMemo(
    () => samples.filter(s => s.status === 'collected' && !scheduledSampleIds?.has(s.sample_id)),
    [samples, scheduledSampleIds]
  );

  const [selectedIds, setSelectedIds] = useState(() => eligibleSamples.map(s => s.id));
  const [deliveryType, setDeliveryType] = useState('sample_collection');
  const [driverId, setDriverId] = useState('');
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().slice(0, 10));
  const [labId, setLabId] = useState('');
  const [pickupAddress, setPickupAddress] = useState(job?.location || '');
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

  const canSubmit = selectedIds.length > 0 && driverId && scheduledDate && (deliveryType === 'sample_collection' ? pickupAddress : deliveryAddress);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const driver = drivers.find(s => s.id === driverId);
      const sampleIdList = selectedIds.join(',');
      // Build a human-readable items list from the selected samples
      const selectedSamples = samples.filter(s => selectedIds.includes(s.id));
      const itemsList = selectedSamples.map(s => `${s.sample_id}${s.borehole_ref ? ' (' + s.borehole_ref + ')' : ''}`).join(', ');

      await base44.entities.DeliveryLog.create({
        job_id: job.id,
        job_name: job.name || '',
        driver_staff_id: driverId,
        driver_staff_name: driver?.name || '',
        delivery_type: deliveryType,
        status: 'pending',
        items: `Samples: ${itemsList}`,
        sample_ids: sampleIdList,
        samples_accounted: false,
        pickup_address: pickupAddress || '',
        delivery_address: deliveryAddress || '',
        contact_name: contactName || '',
        contact_phone: contactPhone || '',
        scheduled_date: scheduledDate,
        notes: notes || '',
        chargeable: false,
      });

      toast({
        title: 'Sample run scheduled',
        description: `${selectedIds.length} sample${selectedIds.length === 1 ? '' : 's'} assigned to ${driver?.name || 'driver'}. They'll see a checklist on their delivery dashboard.`,
      });
      queryClient.invalidateQueries({ queryKey: ['sample-deliveries-for-job', job.id] });
      queryClient.invalidateQueries({ queryKey: ['samples-for-job', job.id] });
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
            Schedule Sample Collection
          </DialogTitle>
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
                  {eligibleSamples.length === 0 && (
                    <p className="px-3 py-3 text-xs text-slate-400">No uncollected samples — all collected samples are already scheduled.</p>
                  )}
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

              {/* Run type */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Run type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setDeliveryType('sample_collection')}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 transition text-left ${deliveryType === 'sample_collection' ? 'border-teal-500 bg-teal-50' : 'border-slate-200 hover:border-teal-300'}`}>
                    <Package className="w-4 h-4 text-teal-600" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Collect from site</p>
                      <p className="text-[10px] text-slate-500">Driver picks up samples</p>
                    </div>
                  </button>
                  <button type="button" onClick={() => setDeliveryType('sample_delivery')}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 transition text-left ${deliveryType === 'sample_delivery' ? 'border-cyan-500 bg-cyan-50' : 'border-slate-200 hover:border-cyan-300'}`}>
                    <Truck className="w-4 h-4 text-cyan-600" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Deliver to lab</p>
                      <p className="text-[10px] text-slate-500">Driver drops at laboratory</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Driver + date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    <User className="w-3 h-3 inline mr-1" /> Driver
                  </label>
                  <select value={driverId} onChange={e => setDriverId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-teal-600">
                    <option value="">Select driver…</option>
                    {drivers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    <Calendar className="w-3 h-3 inline mr-1" /> Date
                  </label>
                  <input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-teal-600" />
                </div>
              </div>

              {/* Lab selection (for sample_delivery) */}
              {deliveryType === 'sample_delivery' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    <FlaskConical className="w-3 h-3 inline mr-1" /> Laboratory
                  </label>
                  <select value={labId} onChange={e => handleLabChange(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-teal-600">
                    <option value="">Select lab…</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}

              {/* Addresses */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    <Package className="w-3 h-3 inline mr-1" /> Pickup address
                  </label>
                  <input value={pickupAddress} onChange={e => setPickupAddress(e.target.value)}
                    placeholder="Site address"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-teal-600" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    <MapPin className="w-3 h-3 inline mr-1" /> Delivery address
                  </label>
                  <input value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)}
                    placeholder={deliveryType === 'sample_delivery' ? 'Lab address' : 'Depot / transfer point'}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-teal-600" />
                </div>
              </div>

              {/* Contact */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Contact name</label>
                  <input value={contactName} onChange={e => setContactName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-teal-600" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Contact phone</label>
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
                  Schedule Run
                </button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}