import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2, Clock, CheckCircle2, XCircle, Plus, X } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

const DELAY_TYPES = [
  { value: 'ground_conditions', label: 'Ground Conditions', hint: 'Boulders, obstructions, voids' },
  { value: 'utility_clash', label: 'Utility Clash', hint: 'Uncharted services' },
  { value: 'weather', label: 'Weather', hint: 'Rain, snow, high winds' },
  { value: 'mechanical_failure', label: 'Mechanical Failure', hint: 'Rig / plant breakdown' },
  { value: 'access_issue', label: 'Access Issue', hint: "Plant can't reach location" },
  { value: 'client_request', label: 'Client Request', hint: 'Scope change by client' },
  { value: 'third_party', label: 'Third Party', hint: 'Another contractor on site' },
  { value: 'other', label: 'Other', hint: 'Anything else' },
];

const STATUS_STYLE = {
  pending: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Pending', icon: Clock },
  approved: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Approved', icon: CheckCircle2 },
  rejected: { bg: 'bg-red-50', text: 'text-red-700', label: 'Rejected', icon: XCircle },
};

// Sub-contractor delay reporting card. Shown on the SubcontractorDashboard so
// sub-cons can report site delays directly to the project manager. Creates a
// JobDelayLog with reported_by_role = 'subcontractor'.
export default function SubconDelayReport({ staff, jobs = [] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [selJobId, setSelJobId] = useState('');
  const [delayType, setDelayType] = useState('ground_conditions');
  const [impactedDays, setImpactedDays] = useState(1);
  const [impactedHours, setImpactedHours] = useState(0);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // Find the Contractor record matching this staff member (by email or name)
  const { data: contractors = [] } = useQuery({
    queryKey: ['contractors-all'],
    queryFn: () => base44.entities.Contractor.list(),
  });

  const contractor = contractors.find(c =>
    c.name === staff?.name ||
    c.contact_email === staff?.email ||
    c.contact_name === staff?.name
  );

  // Delays reported by this sub-contractor
  const { data: myDelays = [], isLoading } = useQuery({
    queryKey: ['subcon-delays', contractor?.id],
    queryFn: () => base44.entities.JobDelayLog.filter({ subcontractor_id: contractor.id, reported_by_role: 'subcontractor' }, '-reported_at', 20),
    enabled: !!contractor?.id,
  });

  const reset = () => {
    setSelJobId(''); setDelayType('ground_conditions');
    setImpactedDays(1); setImpactedHours(0); setDescription('');
  };

  const handleSubmit = async () => {
    if (!contractor?.id) {
      toast({ title: 'No contractor profile linked', description: 'Contact the office to get set up.', variant: 'destructive' });
      return;
    }
    if (!selJobId || !description.trim()) return;
    const job = jobs.find(j => j.id === selJobId);
    setSaving(true);
    try {
      await base44.entities.JobDelayLog.create({
        job_id: selJobId,
        job_name: job?.name || '',
        staff_id: staff?.id || '',
        staff_name: staff?.name || '',
        subcontractor_id: contractor.id,
        subcontractor_name: contractor.name,
        reported_by_role: 'subcontractor',
        reported_at: new Date().toISOString(),
        delay_type: delayType,
        impacted_days: Number(impactedDays) || 0,
        impacted_hours: Number(impactedHours) || 0,
        description: description.trim(),
        manager_review_status: 'pending',
      });
      toast({ title: 'Delay reported', description: 'The project manager has been notified.' });
      reset();
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['subcon-delays', contractor.id] });
    } catch (e) {
      toast({ title: 'Could not report delay', variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-slate-900">Report a Delay</h2>
          <p className="text-[11px] text-slate-400">Tell the office about site delays</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 transition">
          {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showForm ? 'Cancel' : 'Report'}
        </button>
      </div>

      {showForm && (
        <div className="p-4 bg-slate-50 border-b border-slate-100 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Job *</label>
            <select value={selJobId} onChange={e => setSelJobId(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-amber-500">
              <option value="">Select a job…</option>
              {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">What caused the delay? *</label>
            <div className="grid grid-cols-2 gap-1.5">
              {DELAY_TYPES.map(t => (
                <button key={t.value} type="button" onClick={() => setDelayType(t.value)}
                  className={`text-left p-2.5 rounded-lg border text-xs transition ${delayType === t.value ? 'border-amber-500 bg-amber-50' : 'border-slate-200 bg-white hover:border-amber-300'}`}>
                  <p className="font-semibold text-slate-800">{t.label}</p>
                  <p className="text-[10px] text-slate-400 leading-tight">{t.hint}</p>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Estimated impact</label>
            <div className="flex items-center gap-2 flex-wrap">
              <input type="number" min="0" value={impactedDays} onChange={e => setImpactedDays(e.target.value)}
                className="w-20 px-3 py-2 border border-slate-300 rounded-lg text-sm text-center focus:outline-none focus:border-amber-500" />
              <span className="text-xs text-slate-500">working days</span>
              <input type="number" min="0" value={impactedHours} onChange={e => setImpactedHours(e.target.value)}
                className="w-20 px-3 py-2 border border-slate-300 rounded-lg text-sm text-center focus:outline-none focus:border-amber-500" />
              <span className="text-xs text-slate-500">extra hours</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Describe what happened *</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              placeholder="e.g. Hit a large boulder at 6m, had to pre-bore. Adds approx 1 day."
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm resize-none focus:outline-none focus:border-amber-500" />
          </div>
          <button onClick={handleSubmit} disabled={saving || !selJobId || !description.trim()}
            className="w-full px-4 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
            {saving ? 'Sending…' : 'Send Delay Report'}
          </button>
        </div>
      )}

      {/* Previously reported delays */}
      {isLoading ? (
        <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
      ) : myDelays.length === 0 ? (
        <div className="p-6 text-center">
          <Clock className="w-7 h-7 text-slate-200 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No delays reported yet.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {myDelays.map(log => {
            const st = STATUS_STYLE[log.manager_review_status || 'pending'];
            const StIcon = st.icon;
            return (
              <div key={log.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${st.bg} ${st.text}`}>
                        <StIcon className="w-2.5 h-2.5" /> {st.label}
                      </span>
                      <span className="text-xs font-semibold text-slate-800">{log.job_name || '—'}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{log.description}</p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {log.reported_at ? format(new Date(log.reported_at), 'dd MMM HH:mm') : ''}
                      {' · '}Impact: +{log.impacted_days || 0}d {log.impacted_hours ? `+${log.impacted_hours}h` : ''}
                    </p>
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