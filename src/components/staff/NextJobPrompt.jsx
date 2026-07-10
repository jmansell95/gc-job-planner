import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, ChevronRight, MapPin, Clock, Navigation, X, Briefcase } from 'lucide-react';

export default function NextJobPrompt({ open, onClose, remainingJobs, jobs, onCheckIn, onAdHocVisit }) {
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
            <div className="hero-gradient px-5 py-4 text-white flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/15 ring-1 ring-white/20 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold leading-tight">Job Complete!</h2>
                  <p className="text-emerald-100 text-xs">What's next?</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 overflow-y-auto">
              {remainingJobs.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    {remainingJobs.length > 1 ? `${remainingJobs.length} jobs remaining today` : '1 job remaining today'}
                  </p>
                  <div className="space-y-2">
                    {remainingJobs.map(a => {
                      const job = jobs.find(j => j.id === a.job_id);
                      if (!job) return null;
                      return (
                        <button key={a.id} onClick={() => onCheckIn(a.id)}
                          className="w-full text-left flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 active:scale-[0.98] transition">
                          <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center flex-shrink-0">
                            <Briefcase className="w-4 h-4 text-white" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-slate-900 truncate">{job.name}</p>
                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                              {a.start_time && <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{a.start_time}</span>}
                              {job.location && <span className="flex items-center gap-0.5 truncate"><MapPin className="w-3 h-3" />{job.location}</span>}
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Ad-hoc visit option */}
              <button onClick={onAdHocVisit}
                className="w-full text-left flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 active:scale-[0.98] transition">
                <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <Navigation className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900">Log a nearby site visit</p>
                  <p className="text-xs text-slate-500 mt-0.5">Pop to another site to grab materials or finish something off</p>
                </div>
                <ChevronRight className="w-4 h-4 text-blue-600 flex-shrink-0" />
              </button>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 flex-shrink-0">
              <button onClick={onClose}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 active:scale-95 transition text-sm font-semibold">
                Finish for now
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}