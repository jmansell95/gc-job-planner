import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import {
  X, Calendar, Loader2, FileText, Info,
} from 'lucide-react';

/**
 * CreateFirstAFPModal — billing team creates the first (or next) AFP for a job.
 * Sets period_start, period_end (agreed date with client), and submission deadline.
 * On creation, the system immediately populates it with live field data.
 */
export default function CreateFirstAFPModal({ job, onClose, onCreated }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    period_start_date: job.start_date || new Date().toISOString().slice(0, 10),
    period_end_date: '',
    submission_deadline: '',
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!form.period_start_date) {
      setError('Period start date is required');
      return;
    }
    setCreating(true);
    setError('');
    try {
      // Fetch existing AFPs to determine the next number
      const existing = await base44.entities.AFP.filter({ job_id: job.id });
      const nextNumber = existing.length + 1;

      const afp = await base44.entities.AFP.create({
        job_id: job.id,
        job_name: job.name,
        job_reference: job.job_reference || '',
        division_id: job.division_id || '',
        afp_number: nextNumber,
        period_start_date: form.period_start_date,
        period_end_date: form.period_end_date || '',
        submission_deadline: form.submission_deadline || '',
        status: 'draft',
        client_name: job.client_name || '',
        client_po: job.job_reference || '',
        gc_job_number: job.job_reference || '',
        contract_value: job.budget_amount || 0,
        total_claimed: 0,
        original_total: 0,
        disputed_total: 0,
        agreed_total: 0,
        dispute_status: 'none',
      });

      // Immediately populate with field data
      try {
        await base44.functions.invoke('populateAFPFromFieldData', { afp_id: afp.id });
      } catch (e) {
        console.error('Auto-populate failed:', e);
      }

      queryClient.invalidateQueries({ queryKey: ['afp', job.id] });
      onCreated(afp.id);
    } catch (e) {
      setError(e.message || 'Failed to create AFP');
    }
    setCreating(false);
  };

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-pop-in">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Create AFP</h3>
              <p className="text-[11px] text-white/70">{job.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="bg-blue-50 rounded-xl p-3 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800">
              The AFP will auto-populate with live field data (driller logs, deliveries, subcontractors, timesheets, costs) from the period start date. You can refresh it anytime.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Period Start Date
            </label>
            <input
              type="date"
              value={form.period_start_date}
              onChange={e => setForm(p => ({ ...p, period_start_date: e.target.value }))}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#2E5A1A]"
            />
            <p className="text-[10px] text-slate-400 mt-1">Usually the job start date or the day after the previous AFP's end date.</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Period End Date (Agreed Cut-off)
            </label>
            <input
              type="date"
              value={form.period_end_date}
              onChange={e => setForm(p => ({ ...p, period_end_date: e.target.value }))}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#2E5A1A]"
            />
            <p className="text-[10px] text-slate-400 mt-1">The agreed date with the client — records up to this date go in this AFP.</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Submission Deadline
            </label>
            <input
              type="date"
              value={form.submission_deadline}
              onChange={e => setForm(p => ({ ...p, submission_deadline: e.target.value }))}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#2E5A1A]"
            />
            <p className="text-[10px] text-slate-400 mt-1">When this AFP must be sent to the client.</p>
          </div>

          {error && (
            <div className="bg-rose-50 text-rose-700 text-xs font-semibold rounded-lg px-3 py-2">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 transition">Cancel</button>
          <button
            onClick={handleCreate}
            disabled={creating || !form.period_start_date}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white rounded-xl text-sm font-bold transition active:scale-95 shadow-sm disabled:opacity-50"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {creating ? 'Creating…' : 'Create & Populate'}
          </button>
        </div>
      </div>
    </div>
  );
}