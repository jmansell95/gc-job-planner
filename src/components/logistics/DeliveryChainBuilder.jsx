import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Package, Truck, ArrowRightLeft, MapPin, Plus, Trash2, Save,
  ChevronRight, Link2, Clock, CheckCircle2, AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/StateViews';

const LEG_TYPES = [
  { value: 'collect', label: 'Collect', icon: Package, badge: 'bg-blue-100 text-blue-700 ring-blue-200' },
  { value: 'transfer', label: 'Transfer', icon: ArrowRightLeft, badge: 'bg-amber-100 text-amber-700 ring-amber-200' },
  { value: 'deliver', label: 'Deliver', icon: Truck, badge: 'bg-emerald-100 text-emerald-700 ring-emerald-200' },
];

const LOCATION_TYPES = [
  { value: 'supplier', label: 'Supplier' },
  { value: 'depot', label: 'Depot / Yard' },
  { value: 'site', label: 'Site' },
  { value: 'layby', label: 'Layby / Transfer Point' },
  { value: 'other', label: 'Other' },
];

const STATUS_BADGE = {
  pending: { cls: 'bg-slate-100 text-slate-600', label: 'Pending' },
  in_transit: { cls: 'bg-amber-100 text-amber-700', label: 'In Transit' },
  complete: { cls: 'bg-emerald-100 text-emerald-700', label: 'Complete' },
};

export default function DeliveryChainBuilder() {
  const [selectedJobId, setSelectedJobId] = useState('');
  const [legs, setLegs] = useState([]);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: staff = [] } = useQuery({ queryKey: ['staff-active-chain'], queryFn: () => base44.entities.Staff.filter({ is_active: true }) });
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles-chain'], queryFn: () => base44.entities.Vehicle.list() });

  const { data: existingLegs = [], isLoading: legsLoading } = useQuery({
    queryKey: ['delivery-legs-job', selectedJobId],
    queryFn: () => base44.entities.DeliveryLeg.filter({ job_id: selectedJobId }),
    enabled: !!selectedJobId,
  });

  const selectedJob = jobs.find(j => j.id === selectedJobId);
  const sortedExisting = [...(existingLegs || [])].sort((a, b) => (a.leg_sequence || 0) - (b.leg_sequence || 0));

  const addLeg = () => {
    const nextSeq = legs.length + 1;
    // Auto-suggest type: first leg = collect, last leg = deliver, middle = transfer
    const defaultType = nextSeq === 1 ? 'collect' : 'transfer';
    setLegs([...legs, {
      leg_type: defaultType,
      leg_sequence: nextSeq,
      from_location: '',
      to_location: '',
      from_location_type: nextSeq === 1 ? 'supplier' : 'depot',
      to_location_type: 'site',
      driver_id: '',
      vehicle_id: '',
      scheduled_date: format(new Date(), 'yyyy-MM-dd'),
      scheduled_time: '',
      handover_to_driver_id: '',
      notes: '',
    }]);
  };

  const updateLeg = (idx, field, value) => {
    const updated = [...legs];
    updated[idx] = { ...updated[idx], [field]: value };
    setLegs(updated);
  };

  const removeLeg = (idx) => {
    setLegs(legs.filter((_, i) => i !== idx).map((l, i) => ({ ...l, leg_sequence: i + 1 })));
  };

  const saveChain = async () => {
    if (!selectedJobId) { toast({ title: 'Select a job first', variant: 'destructive' }); return; }
    if (legs.length === 0) { toast({ title: 'Add at least one leg', variant: 'destructive' }); return; }
    const invalid = legs.find(l => !l.driver_id || !l.from_location.trim() || !l.to_location.trim());
    if (invalid) { toast({ title: 'Each leg needs a driver, from, and to location', variant: 'destructive' }); return; }

    setSaving(true);
    try {
      const payloads = legs.map((l, i) => {
        const driver = staff.find(s => s.id === l.driver_id);
        const vehicle = l.vehicle_id ? vehicles.find(v => v.id === l.vehicle_id) : null;
        const handoverDriver = l.handover_to_driver_id ? staff.find(s => s.id === l.handover_to_driver_id) : null;
        return {
          job_id: selectedJobId,
          job_name: selectedJob?.name || '',
          leg_type: l.leg_type,
          leg_sequence: i + 1,
          from_location: l.from_location,
          to_location: l.to_location,
          from_location_type: l.from_location_type,
          to_location_type: l.to_location_type,
          driver_id: l.driver_id,
          driver_name: driver?.name || '',
          vehicle_id: l.vehicle_id || '',
          vehicle_name: vehicle?.name || '',
          status: 'pending',
          scheduled_date: l.scheduled_date,
          scheduled_time: l.scheduled_time || '',
          handover_to_driver_id: l.handover_to_driver_id || '',
          handover_to_driver_name: handoverDriver?.name || '',
          notes: l.notes || '',
        };
      });
      await base44.entities.DeliveryLeg.bulkCreate(payloads);
      toast({ title: 'Delivery chain created', description: `${payloads.length} leg${payloads.length !== 1 ? 's' : ''} saved for ${selectedJob?.name}` });
      setLegs([]);
      queryClient.invalidateQueries({ queryKey: ['delivery-legs-job'] });
    } catch (e) {
      toast({ title: 'Could not save chain', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Job selector */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">Select Job</label>
        <select
          value={selectedJobId}
          onChange={e => { setSelectedJobId(e.target.value); setLegs([]); }}
          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        >
          <option value="">— Choose a job —</option>
          {jobs.filter(j => j.status === 'in_progress' || j.status === 'planning').map(j => (
            <option key={j.id} value={j.id}>{j.name}{j.location ? ` — ${j.location}` : ''}</option>
          ))}
        </select>
      </div>

      {/* Existing chains for this job */}
      {selectedJobId && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Link2 className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-bold text-slate-700">Existing Delivery Chains</h3>
            {sortedExisting.length > 0 && (
              <span className="text-xs font-bold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">{sortedExisting.length}</span>
            )}
          </div>
          {legsLoading ? (
            <Skeleton className="h-20 rounded-xl" />
          ) : sortedExisting.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No delivery chains created for this job yet.</p>
          ) : (
            <div className="space-y-2">
              {sortedExisting.map(leg => {
                const cfg = LEG_TYPES.find(t => t.value === leg.leg_type) || LEG_TYPES[0];
                const st = STATUS_BADGE[leg.status] || STATUS_BADGE.pending;
                const Icon = cfg.icon;
                return (
                  <div key={leg.id} className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2">
                    <span className="text-xs font-bold text-slate-400 w-5">{leg.leg_sequence}</span>
                    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold ring-1 ${cfg.badge}`}>
                      <Icon className="w-3 h-3" />{cfg.label}
                    </span>
                    <div className="flex-1 min-w-0 text-xs text-slate-600 truncate">
                      <span className="font-medium">{leg.from_location || '—'}</span>
                      <ChevronRight className="w-3 h-3 inline mx-1 text-slate-300" />
                      <span className="font-medium">{leg.to_location || '—'}</span>
                    </div>
                    <span className="text-xs text-slate-500 hidden sm:block">{leg.driver_name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${st.cls}`}>{st.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Chain builder */}
      {selectedJobId && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-700">Build New Chain</h3>
            {legs.length > 0 && (
              <button onClick={() => setLegs([])} className="text-xs text-slate-400 hover:text-slate-600">Clear all</button>
            )}
          </div>

          {legs.length === 0 ? (
            <div className="text-center py-6">
              <Truck className="w-10 h-10 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400 mb-3">No legs yet — add the first leg to start building a delivery chain</p>
              <button onClick={addLeg} className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition">
                <Plus className="w-4 h-4" /> Add First Leg
              </button>
            </div>
          ) : (
            <>
              {/* Visual chain flow */}
              <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-2">
                {legs.map((l, i) => {
                  const cfg = LEG_TYPES.find(t => t.value === l.leg_type) || LEG_TYPES[0];
                  const Icon = cfg.icon;
                  return (
                    <React.Fragment key={i}>
                      {i > 0 && <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />}
                      <div className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full font-semibold ring-1 flex-shrink-0 ${cfg.badge}`}>
                        <Icon className="w-3 h-3" />{i + 1}. {cfg.label}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Leg cards */}
              <div className="space-y-3">
                {legs.map((leg, idx) => {
                  const cfg = LEG_TYPES.find(t => t.value === leg.leg_type) || LEG_TYPES[0];
                  const Icon = cfg.icon;
                  return (
                    <div key={idx} className="bg-slate-50 rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-slate-700 text-white flex items-center justify-center text-xs font-bold">{idx + 1}</span>
                          <select
                            value={leg.leg_type}
                            onChange={e => updateLeg(idx, 'leg_type', e.target.value)}
                            className="text-xs font-semibold border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-emerald-500"
                          >
                            {LEG_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                        </div>
                        <button onClick={() => removeLeg(idx)} className="text-slate-400 hover:text-rose-500 transition">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* From → To */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase">From</label>
                          <input
                            value={leg.from_location}
                            onChange={e => updateLeg(idx, 'from_location', e.target.value)}
                            placeholder="e.g. Smith Hire Yard"
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
                          />
                          <select
                            value={leg.from_location_type}
                            onChange={e => updateLeg(idx, 'from_location_type', e.target.value)}
                            className="w-full mt-1 px-2 py-1 border border-slate-200 rounded-lg text-xs text-slate-500 bg-white focus:outline-none"
                          >
                            {LOCATION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase">To</label>
                          <input
                            value={leg.to_location}
                            onChange={e => updateLeg(idx, 'to_location', e.target.value)}
                            placeholder="e.g. EWR Site"
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
                          />
                          <select
                            value={leg.to_location_type}
                            onChange={e => updateLeg(idx, 'to_location_type', e.target.value)}
                            className="w-full mt-1 px-2 py-1 border border-slate-200 rounded-lg text-xs text-slate-500 bg-white focus:outline-none"
                          >
                            {LOCATION_TYPES.filter(t => t.value !== 'supplier').map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                        </div>
                      </div>

                      {/* Driver + Vehicle + Date */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Driver</label>
                          <select
                            value={leg.driver_id}
                            onChange={e => updateLeg(idx, 'driver_id', e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-emerald-500"
                          >
                            <option value="">— Select —</option>
                            {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Vehicle</label>
                          <select
                            value={leg.vehicle_id}
                            onChange={e => updateLeg(idx, 'vehicle_id', e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-emerald-500"
                          >
                            <option value="">— None —</option>
                            {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.registration_number})</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Date</label>
                          <input
                            type="date"
                            value={leg.scheduled_date}
                            onChange={e => updateLeg(idx, 'scheduled_date', e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>

                      {/* Transfer: handover driver */}
                      {leg.leg_type === 'transfer' && (
                        <div className="mb-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Handover To (next driver)</label>
                          <select
                            value={leg.handover_to_driver_id}
                            onChange={e => updateLeg(idx, 'handover_to_driver_id', e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-emerald-500"
                          >
                            <option value="">— Same driver continues —</option>
                            {staff.filter(s => s.id !== leg.driver_id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </div>
                      )}

                      {/* Notes */}
                      <input
                        value={leg.notes}
                        onChange={e => updateLeg(idx, 'notes', e.target.value)}
                        placeholder="Notes (access details, site contact, gear condition)…"
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-4">
                <button onClick={addLeg} className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-200 transition">
                  <Plus className="w-4 h-4" /> Add Leg
                </button>
                <button
                  onClick={saveChain}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-50 ml-auto"
                >
                  <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Chain'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}