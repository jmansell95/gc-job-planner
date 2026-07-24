import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2 } from 'lucide-react';
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

// Reusable modal for staff (on site) and managers (logging a phone-call delay).
// If jobOptions has more than one job, a selector is shown; otherwise the single
// passed jobId/jobName is used.
export default function DelayLogForm({ open, onOpenChange, jobId, jobName, staffId, staffName, jobOptions, onSaved }) {
  const { toast } = useToast();
  const [selJobId, setSelJobId] = useState(jobId || '');
  const [delayType, setDelayType] = useState('ground_conditions');
  const [impactedDays, setImpactedDays] = useState(1);
  const [impactedHours, setImpactedHours] = useState(0);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { setSelJobId(jobId || (jobOptions?.[0]?.id || '')); }, [jobId, jobOptions]);

  const showJobPicker = Array.isArray(jobOptions) && jobOptions.length > 1;
  const effectiveJob = showJobPicker ? jobOptions.find(j => j.id === selJobId) : { id: jobId, name: jobName };

  const reset = () => { setDelayType('ground_conditions'); setImpactedDays(1); setImpactedHours(0); setDescription(''); };

  const handleSubmit = async () => {
    if (!effectiveJob?.id || !description.trim()) return;
    setSaving(true);
    try {
      await base44.entities.JobDelayLog.create({
        job_id: effectiveJob.id,
        job_name: effectiveJob.name || '',
        staff_id: staffId || '',
        staff_name: staffName || '',
        reported_at: new Date().toISOString(),
        delay_type: delayType,
        impacted_days: Number(impactedDays) || 0,
        impacted_hours: Number(impactedHours) || 0,
        description: description.trim(),
        manager_review_status: 'pending',
      });
      toast({ title: 'Delay logged', description: 'Your manager has been notified.' });
      reset();
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      toast({ title: 'Could not log delay', variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" /> Log a Site Delay
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {showJobPicker ? (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Job *</label>
              <select value={selJobId} onChange={e => setSelJobId(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-amber-500">
                {jobOptions.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Job</p>
              <p className="font-semibold text-slate-900 text-sm">{effectiveJob?.name || '—'}</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">What caused the delay? *</label>
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
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Estimated impact</label>
            <div className="flex items-center gap-2 flex-wrap">
              <input type="number" min="0" value={impactedDays} onChange={e => setImpactedDays(e.target.value)}
                className="w-20 px-3 py-2 border border-slate-300 rounded-lg text-sm text-center focus:outline-none focus:border-amber-500" />
              <span className="text-xs text-slate-500">working days</span>
              <input type="number" min="0" value={impactedHours} onChange={e => setImpactedHours(e.target.value)}
                className="w-20 px-3 py-2 border border-slate-300 rounded-lg text-sm text-center focus:outline-none focus:border-amber-500" />
              <span className="text-xs text-slate-500">extra hours</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Whole days shift the rota & job end date when approved. Hours are tracked only.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Describe what happened *</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              placeholder="e.g. Hit a large boulder at 6m, had to pre-bore. Adds approx 1 day."
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm resize-none focus:outline-none focus:border-amber-500" />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button className="flex-1 bg-amber-600 hover:bg-amber-700" onClick={handleSubmit} disabled={saving || !description.trim() || !effectiveJob?.id}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <AlertTriangle className="w-4 h-4 mr-1" />}
            {saving ? 'Logging…' : 'Log Delay'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}