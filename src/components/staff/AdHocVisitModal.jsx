import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Navigation, MapPin, Clock, Building2 } from 'lucide-react';

export default function AdHocVisitModal({ open, onClose, onSubmit, jobs }) {
  const [jobId, setJobId] = useState('');
  const [customSite, setCustomSite] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setJobId(''); setCustomSite(''); setDescription(''); setDurationMinutes('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!durationMinutes || Number(durationMinutes) <= 0) return;
    setSubmitting(true);
    try {
      await onSubmit({
        jobId: jobId || '',
        customSite: jobId ? '' : customSite.trim(),
        description: description.trim(),
        durationMinutes: Number(durationMinutes)
      });
      reset();
    } catch (err) {
      console.error('Ad-hoc visit error:', err);
    }
    setSubmitting(false);
  };

  const selectedJob = jobs.find(j => j.id === jobId);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center p-0 md:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            onClick={e => e.stopPropagation()}
            className="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            {/* Header */}
            <div className="bg-blue-600 px-5 py-4 text-white flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/15 ring-1 ring-white/20 flex items-center justify-center">
                  <Navigation className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold leading-tight">Nearby Site Visit</h2>
                  <p className="text-blue-100 text-xs">Log unplanned work at another site</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
              {/* Site selection */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Which site?</label>
                <div className="flex gap-2 mb-2">
                  <button type="button" onClick={() => setCustomSite('')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition ${!customSite ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-600'}`}>
                    <Building2 className="w-3.5 h-3.5 inline mr-1" /> Existing Job
                  </button>
                  <button type="button" onClick={() => { setJobId(''); setCustomSite(customSite || ' '); }}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition ${customSite ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-600'}`}>
                    <MapPin className="w-3.5 h-3.5 inline mr-1" /> Custom Site
                  </button>
                </div>
                {!customSite ? (
                  <select value={jobId} onChange={e => setJobId(e.target.value)} required
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-600 bg-white">
                    <option value="">Select a job site</option>
                    {jobs.map(j => <option key={j.id} value={j.id}>{j.name}{j.location ? ` — ${j.location}` : ''}</option>)}
                  </select>
                ) : (
                  <input type="text" value={customSite.trim()} onChange={e => setCustomSite(e.target.value)} required placeholder="e.g. B&Q Leeds, Depot, Site address..."
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-600" />
                )}
                {selectedJob?.location && (
                  <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {selectedJob.location}
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">What did you do?</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} required
                  placeholder="e.g. Collected left-over pipes, finished off fencing..."
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-600 resize-none" />
              </div>

              {/* Duration */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Time spent (minutes)</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="number" min="1" step="1" value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)} required
                    placeholder="e.g. 30"
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-600" />
                </div>
                <div className="flex gap-1.5 mt-2">
                  {[15, 30, 60, 90].map(m => (
                    <button type="button" key={m} onClick={() => setDurationMinutes(String(m))}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${durationMinutes === String(m) ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-500'}`}>
                      {m}m
                    </button>
                  ))}
                </div>
              </div>
            </form>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 flex gap-2 flex-shrink-0">
              <button onClick={onClose}
                className="flex items-center justify-center gap-1.5 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 active:scale-95 transition text-sm font-semibold">
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={submitting || !durationMinutes}
                className="flex items-center justify-center gap-1.5 flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 active:scale-95 transition text-sm font-bold disabled:opacity-50 touch-manipulation">
                <Navigation className="w-4 h-4" /> {submitting ? 'Logging...' : 'Log Visit'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}