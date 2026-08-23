import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FlaskConical, Plus, X, Send, CheckCircle2, Clock, AlertTriangle, Trash2, Edit2, Loader2, Package, Truck, ClipboardCheck } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ScheduleSampleCollectionModal from '@/components/geotech/ScheduleSampleCollectionModal';

const SAMPLE_TYPES = [
  { value: 'disturbed', label: 'Disturbed (Bag)' },
  { value: 'undisturbed_u100', label: 'U100 Tube' },
  { value: 'undisturbed_ut100', label: 'UT100 Tube' },
  { value: 'spt_split_spoon', label: 'SPT Split Spoon' },
  { value: 'rotary_core', label: 'Rotary Core' },
  { value: 'window_sample', label: 'Window Sample' },
  { value: 'bulk_sample', label: 'Bulk Sample' },
  { value: 'water_sample', label: 'Water Sample' },
  { value: 'gas_sample', label: 'Gas Sample' },
  { value: 'hand_excavated', label: 'Hand Excavated' },
];

const TEST_OPTIONS = [
  'sieve_analysis', 'atterberg_limits', 'moisture_content', 'bulk_density',
  'particle_density', 'triaxial_test', 'oedometer_test', 'cbr_test',
  'unconfined_compressive_strength', 'point_load_test', 'shear_box',
  'chemical_contamination', 'organic_content', 'sulphate_content',
  'ph_value', 'petrographic_analysis', 'asbestos_screening',
  'groundwater_chemistry', 'gas_analysis', 'other',
];

const STATUS_META = {
  collected: { label: 'Collected', color: 'bg-slate-100 text-slate-700', icon: Package },
  dispatched: { label: 'Dispatched', color: 'bg-blue-100 text-blue-700', icon: Send },
  received_at_lab: { label: 'At Lab', color: 'bg-indigo-100 text-indigo-700', icon: CheckCircle2 },
  testing: { label: 'Testing', color: 'bg-amber-100 text-amber-700', icon: Clock },
  results_returned: { label: 'Results Back', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  retained: { label: 'Retained', color: 'bg-violet-100 text-violet-700', icon: Package },
  disposed: { label: 'Disposed', color: 'bg-slate-200 text-slate-500', icon: Trash2 },
};

export default function SampleManager({ job, allStaff, suppliers }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  const { data: samples = [], isLoading } = useQuery({
    queryKey: ['samples-for-job', job.id],
    queryFn: () => base44.entities.Sample.filter({ job_id: job.id }, '-collection_date'),
  });

  // Fetch sample-related delivery logs so we can show which samples are
  // already scheduled for collection/delivery vs which still need a driver.
  const { data: sampleDeliveries = [] } = useQuery({
    queryKey: ['sample-deliveries-for-job', job.id],
    queryFn: () => base44.entities.DeliveryLog.filter({ job_id: job.id }, '-scheduled_date'),
  });
  // Build a map of sample_id → delivery progress so the SampleManager can show
  // not just "Scheduled" but the live status of each leg (collection + delivery).
  const sampleDeliveryStatus = new Map(); // sample_id → { collection: status, delivery: status }
  const scheduledSampleIds = new Set();
  sampleDeliveries.forEach((d) => {
    if ((d.delivery_type === 'sample_collection' || d.delivery_type === 'sample_delivery') && d.sample_ids) {
      d.sample_ids.split(',').map((id) => id.trim()).filter(Boolean).forEach((id) => {
        scheduledSampleIds.add(id);
        const entry = sampleDeliveryStatus.get(id) || {};
        if (d.delivery_type === 'sample_collection') entry.collection = d.status;
        if (d.delivery_type === 'sample_delivery') entry.delivery = d.status;
        sampleDeliveryStatus.set(id, entry);
      });
    }
  });

  const deliveryStatusLabel = (entry) => {
    if (!entry) return null;
    const parts = [];
    if (entry.collection) parts.push(`Collect ${entry.collection}`);
    if (entry.delivery) parts.push(`Lab ${entry.delivery}`);
    return parts.join(' · ');
  };

  const labs = suppliers?.filter(s => s.name?.match(/lab|geol|soil|test|analy/i)) || [];

  const handleSave = async (formData) => {
    setSaving(true);
    try {
      const payload = {
        ...formData,
        job_id: job.id,
        status_changed_at: new Date().toISOString(),
      };
      if (editing) {
        await base44.entities.Sample.update(editing.id, payload);
        toast({ title: 'Sample updated' });
      } else {
        await base44.entities.Sample.create(payload);
        toast({ title: 'Sample registered' });
      }
      queryClient.invalidateQueries({ queryKey: ['samples-for-job', job.id] });
      setShowModal(false);
      setEditing(null);
    } catch (e) {
      toast({ title: 'Error saving sample', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const advanceStatus = async (sample, newStatus) => {
    try {
      const updates = { status: newStatus, status_changed_at: new Date().toISOString() };
      if (newStatus === 'dispatched' && !sample.dispatch_date) updates.dispatch_date = new Date().toISOString().slice(0, 10);
      if (newStatus === 'received_at_lab' && !sample.lab_receipt_date) updates.lab_receipt_date = new Date().toISOString().slice(0, 10);
      await base44.entities.Sample.update(sample.id, updates);
      queryClient.invalidateQueries({ queryKey: ['samples-for-job', job.id] });
      toast({ title: `Sample marked as ${STATUS_META[newStatus].label}` });
    } catch (e) {
      toast({ title: 'Error updating status', description: e.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (sample) => {
    if (!confirm(`Delete sample ${sample.sample_id}?`)) return;
    try {
      await base44.entities.Sample.delete(sample.id);
      queryClient.invalidateQueries({ queryKey: ['samples-for-job', job.id] });
      toast({ title: 'Sample deleted' });
    } catch (e) {
      toast({ title: 'Error deleting', description: e.message, variant: 'destructive' });
    }
  };

  const stats = {
    total: samples.length,
    inTransit: samples.filter(s => ['dispatched', 'received_at_lab', 'testing'].includes(s.status)).length,
    resultsBack: samples.filter(s => s.status === 'results_returned').length,
    compromised: samples.filter(s => ['compromised', 'leaked', 'broken'].includes(s.lab_receipt_condition)).length,
    needsCollection: samples.filter(s => s.status === 'collected' && !scheduledSampleIds.has(s.sample_id)).length,
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
            <FlaskConical className="w-4 h-4 text-emerald-700" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">Sample Chain of Custody</h3>
            <p className="text-xs text-slate-500">{stats.total} samples · {stats.inTransit} in transit/testing · {stats.resultsBack} results returned{stats.needsCollection > 0 ? ` · ${stats.needsCollection} need collection` : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {stats.needsCollection > 0 && (
            <button onClick={() => setShowScheduleModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 text-white rounded-lg hover:bg-teal-800 transition text-xs font-medium">
              <Truck className="w-3.5 h-3.5" /> Schedule Run ({stats.needsCollection})
            </button>
          )}
          <button onClick={() => { setEditing(null); setShowModal(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-xs font-medium">
          <Plus className="w-3.5 h-3.5" /> Register Sample
        </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-slate-400 animate-spin" /></div>
      ) : samples.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <FlaskConical className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No samples registered yet.</p>
          <p className="text-xs text-slate-400 mt-1">Register samples collected on site to track them through the lab.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {samples.map(s => {
            const StatusBadge = STATUS_META[s.status] || STATUS_META.collected;
            const collector = allStaff.find(st => st.id === s.collected_by_staff_id);
            const lab = suppliers.find(sup => sup.id === s.lab_id);
            return (
              <div key={s.id} className="px-5 py-3 hover:bg-slate-50/60 transition">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-semibold text-slate-900">{s.sample_id}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${StatusBadge.color}`}>
                        <StatusBadge.icon className="w-2.5 h-2.5" /> {StatusBadge.label}
                      </span>
                      {s.status === 'collected' && !scheduledSampleIds.has(s.sample_id) && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">
                          <Clock className="w-2.5 h-2.5" /> Needs Collection
                        </span>
                      )}
                      {scheduledSampleIds.has(s.sample_id) && (() => {
                        const dStatus = sampleDeliveryStatus.get(s.sample_id);
                        const label = deliveryStatusLabel(dStatus);
                        const collectionDone = dStatus?.collection === 'completed';
                        const deliveryDone = dStatus?.delivery === 'completed';
                        const inTransit = dStatus?.collection === 'in_progress' || dStatus?.delivery === 'in_progress';
                        const cls = deliveryDone ? 'bg-indigo-100 text-indigo-700'
                          : collectionDone ? 'bg-cyan-100 text-cyan-700'
                          : inTransit ? 'bg-blue-100 text-blue-700'
                          : 'bg-teal-100 text-teal-700';
                        const Icon = deliveryDone ? CheckCircle2 : collectionDone ? CheckCircle2 : inTransit ? Clock : ClipboardCheck;
                        return (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${cls}`} title={label}>
                            <Icon className="w-2.5 h-2.5" /> {label || 'Scheduled'}
                          </span>
                        );
                      })()}
                      {s.lab_receipt_condition && ['compromised', 'leaked', 'broken'].includes(s.lab_receipt_condition) && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-100 text-rose-700">
                          <AlertTriangle className="w-2.5 h-2.5" /> {s.lab_receipt_condition}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {s.borehole_ref && <span>{s.borehole_ref} · </span>}
                      {s.depth_from != null && <span>{s.depth_from}–{s.depth_to}m · </span>}
                      {SAMPLE_TYPES.find(t => t.value === s.sample_type)?.label || s.sample_type}
                      {lab && <span> · {lab.name}</span>}
                      {collector && <span> · collected by {collector.name}</span>}
                    </div>
                    {s.test_schedule?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {s.test_schedule.map(t => (
                          <span key={t} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-mono">{t.replace(/_/g, ' ')}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {s.status === 'collected' && (
                      <button onClick={() => advanceStatus(s, 'dispatched')} title="Mark dispatched"
                        className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-[10px] font-medium hover:bg-blue-100 transition">Dispatch</button>
                    )}
                    {s.status === 'dispatched' && (
                      <button onClick={() => advanceStatus(s, 'received_at_lab')} title="Mark received at lab"
                        className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-[10px] font-medium hover:bg-indigo-100 transition">Received</button>
                    )}
                    {s.status === 'received_at_lab' && (
                      <button onClick={() => advanceStatus(s, 'testing')} title="Mark testing"
                        className="px-2 py-1 bg-amber-50 text-amber-700 rounded text-[10px] font-medium hover:bg-amber-100 transition">Testing</button>
                    )}
                    {s.status === 'testing' && (
                      <button onClick={() => advanceStatus(s, 'results_returned')} title="Mark results returned"
                        className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-[10px] font-medium hover:bg-emerald-100 transition">Results</button>
                    )}
                    <button onClick={() => { setEditing(s); setShowModal(true); }}
                      className="p-1 text-slate-400 hover:text-slate-600 transition"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(s)}
                      className="p-1 text-slate-400 hover:text-rose-600 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <SampleFormModal
          sample={editing}
          job={job}
          allStaff={allStaff}
          labs={labs}
          suppliers={suppliers}
          saving={saving}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditing(null); }}
        />
      )}

      {showScheduleModal && (
        <ScheduleSampleCollectionModal
          job={job}
          samples={samples}
          allStaff={allStaff}
          suppliers={suppliers}
          scheduledSampleIds={scheduledSampleIds}
          onClose={() => setShowScheduleModal(false)}
        />
      )}
    </div>
  );
}

function SampleFormModal({ sample, job, allStaff, labs, suppliers, saving, onSave, onClose }) {
  const [form, setForm] = useState({
    sample_id: sample?.sample_id || '',
    borehole_ref: sample?.borehole_ref || '',
    sample_type: sample?.sample_type || 'disturbed',
    depth_from: sample?.depth_from || '',
    depth_to: sample?.depth_to || '',
    strata_descriptor: sample?.strata_descriptor || '',
    collection_date: sample?.collection_date || new Date().toISOString().slice(0, 10),
    collected_by_staff_id: sample?.collected_by_staff_id || '',
    container_type: sample?.container_type || 'bag',
    container_count: sample?.container_count || 1,
    storage_location: sample?.storage_location || '',
    storage_temperature: sample?.storage_temperature || 'ambient',
    lab_id: sample?.lab_id || '',
    test_schedule: sample?.test_schedule || [],
    dispatch_date: sample?.dispatch_date || '',
    tracking_number: sample?.tracking_number || '',
    retention_expiry_date: sample?.retention_expiry_date || '',
    notes: sample?.notes || '',
  });

  const toggleTest = (t) => {
    setForm(prev => ({
      ...prev,
      test_schedule: prev.test_schedule.includes(t)
        ? prev.test_schedule.filter(x => x !== t)
        : [...prev.test_schedule, t],
    }));
  };

  const submit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      depth_from: form.depth_from ? parseFloat(form.depth_from) : null,
      depth_to: form.depth_to ? parseFloat(form.depth_to) : null,
      container_count: parseInt(form.container_count) || 1,
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{sample ? 'Edit Sample' : 'Register New Sample'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Sample ID *</label>
              <input required value={form.sample_id} onChange={e => setForm({ ...form, sample_id: e.target.value })}
                placeholder="e.g. BH01-S-003"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Borehole Ref</label>
              <input value={form.borehole_ref} onChange={e => setForm({ ...form, borehole_ref: e.target.value })}
                placeholder="e.g. BH-01"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Sample Type *</label>
              <select value={form.sample_type} onChange={e => setForm({ ...form, sample_type: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600">
                {SAMPLE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Depth From (m)</label>
              <input type="number" step="0.01" value={form.depth_from} onChange={e => setForm({ ...form, depth_from: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Depth To (m)</label>
              <input type="number" step="0.01" value={form.depth_to} onChange={e => setForm({ ...form, depth_to: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Strata Description</label>
            <input value={form.strata_descriptor} onChange={e => setForm({ ...form, strata_descriptor: e.target.value })}
              placeholder="e.g. Stiff grey CLAY"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Collection Date *</label>
              <input type="date" required value={form.collection_date} onChange={e => setForm({ ...form, collection_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Collected By</label>
              <select value={form.collected_by_staff_id} onChange={e => setForm({ ...form, collected_by_staff_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600">
                <option value="">Select staff...</option>
                {allStaff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Container</label>
              <select value={form.container_type} onChange={e => setForm({ ...form, container_type: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600">
                <option value="bag">Bag</option>
                <option value="jar">Jar</option>
                <option value="u100_tube">U100 Tube</option>
                <option value="spt_tube">SPT Tube</option>
                <option value="core_box">Core Box</option>
                <option value="water_bottle">Water Bottle</option>
                <option value="gas_bag">Gas Bag</option>
                <option value="amber_jar">Amber Jar</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Count</label>
              <input type="number" min="1" value={form.container_count} onChange={e => setForm({ ...form, container_count: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Storage Temp</label>
              <select value={form.storage_temperature} onChange={e => setForm({ ...form, storage_temperature: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600">
                <option value="ambient">Ambient</option>
                <option value="refrigerated">Refrigerated</option>
                <option value="frozen">Frozen</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Laboratory</label>
            <select value={form.lab_id} onChange={e => setForm({ ...form, lab_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600">
              <option value="">Select lab...</option>
              {(labs.length > 0 ? labs : suppliers || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Test Schedule</label>
            <div className="flex flex-wrap gap-1.5">
              {TEST_OPTIONS.map(t => (
                <button key={t} type="button" onClick={() => toggleTest(t)}
                  className={`px-2 py-1 rounded-md text-[11px] font-mono border transition ${
                    form.test_schedule.includes(t)
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
                  }`}>
                  {t.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows="2"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm font-medium hover:bg-emerald-800 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {sample ? 'Update' : 'Register'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}