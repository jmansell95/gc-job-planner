import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  X, MapPin, Calendar, Clock, FileText, Save, Loader2, CheckCircle2,
} from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'planning', label: 'Planning' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'decommissioning', label: 'Decommissioning' },
  { value: 'completed', label: 'Completed' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'cancelled', label: 'Cancelled' },
];

const inputCls = "w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10 bg-white";

/**
 * QuickEditJobModal — a lightweight inline editor for the most commonly
 * edited job fields: location, start/end dates, status, and notes.
 * Used from both the admin Job Manager grid and the field staff job card
 * so managers and field users can fix details without opening the full
 * wizard. Changes persist immediately and refresh the relevant widgets.
 */
export default function QuickEditJobModal({ open, onClose, job }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    location: '',
    start_date: '',
    end_date: '',
    status: 'planning',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open && job) {
      setForm({
        location: job.location || '',
        start_date: job.start_date || '',
        end_date: job.end_date || '',
        status: job.status || 'planning',
        notes: job.notes || '',
      });
      setSaved(false);
    }
  }, [open, job?.id]);

  if (!job) return null;

  const dirty = form.location !== (job.location || '') ||
                form.start_date !== (job.start_date || '') ||
                form.end_date !== (job.end_date || '') ||
                form.status !== (job.status || 'planning') ||
                form.notes !== (job.notes || '');

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.entities.Job.update(job.id, {
        location: form.location,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        status: form.status,
        notes: form.notes,
      });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job', job.id] });
      queryClient.invalidateQueries({ queryKey: ['auto-job-financials', job.id] });
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 800);
    } catch (e) {
      console.error('Quick edit failed:', e);
    }
    setSaving(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center overflow-y-auto overscroll-contain p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            onClick={e => e.stopPropagation()}
            className="bg-white w-full md:max-w-lg rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
          >
            {/* Header */}
            <div className="hero-gradient px-5 py-4 text-white flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-white/15 ring-1 ring-white/20 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold leading-tight truncate">Quick Edit</h2>
                  <p className="text-emerald-100 text-xs truncate">{job.name}</p>
                </div>
              </div>
              <button onClick={onClose} disabled={saving} className="p-1.5 rounded-lg hover:bg-white/15 transition flex-shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 overflow-y-auto">
              {/* Location */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#2E5A1A]" /> Site Location
                </label>
                <input
                  type="text"
                  value={form.location}
                  onChange={e => setForm({ ...form, location: e.target.value })}
                  placeholder="Site address or location"
                  className={inputCls}
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#2E5A1A]" /> Start Date
                  </label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={e => setForm({ ...form, start_date: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#2E5A1A]" /> End Date
                  </label>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={e => setForm({ ...form, end_date: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Status</label>
                <div className="grid grid-cols-3 gap-2">
                  {STATUS_OPTIONS.map(s => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setForm({ ...form, status: s.value })}
                      className={`px-2 py-2 rounded-lg border text-xs font-semibold transition ${
                        form.status === s.value
                          ? 'bg-[#2E5A1A] text-white border-[#2E5A1A]'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-[#2E5A1A]/40'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-400" /> Notes
                </label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  placeholder="Job notes, access arrangements, special requirements…"
                  className={`${inputCls} resize-none`}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 flex gap-2 flex-shrink-0">
              <button
                onClick={onClose}
                disabled={saving}
                className="flex items-center justify-center gap-1.5 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 active:scale-95 transition text-sm font-semibold disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !dirty}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#2E5A1A] text-white rounded-xl hover:bg-[#1c4a12] active:scale-95 transition text-sm font-bold disabled:opacity-50 touch-manipulation"
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                ) : saved ? (
                  <><CheckCircle2 className="w-4 h-4" /> Saved</>
                ) : (
                  <><Save className="w-4 h-4" /> Save Changes</>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}