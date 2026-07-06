import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Briefcase, FileText, ExternalLink, ShieldCheck, Clock, PlayCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { formatJobType } from '@/utils/format';

export default function JobBriefingModal({ assignment, job, client, onStart, onClose }) {
  const [phase, setPhase] = useState(assignment.briefing_start_at ? 'review' : 'intro');
  const [signing, setSigning] = useState(false);
  const [briefingStartAt, setBriefingStartAt] = useState(assignment.briefing_start_at || null);
  const [elapsedLabel, setElapsedLabel] = useState('');

  // Record the briefing start time immediately when the modal opens (only if not already recorded)
  useEffect(() => {
    if (assignment.briefing_start_at) {
      setBriefingStartAt(assignment.briefing_start_at);
      setPhase('review');
      return;
    }
    const startNow = async () => {
      const ts = new Date().toISOString();
      setBriefingStartAt(ts);
      try {
        // Import inline to avoid circular dependency issues
        const { base44 } = await import('@/api/base44Client');
        await base44.entities.RotaAssignment.update(assignment.id, { briefing_start_at: ts });
      } catch (err) {
        console.error('Error recording briefing start:', err);
      }
    };
    startNow();
  }, [assignment.id, assignment.briefing_start_at]);

  // Live elapsed timer
  useEffect(() => {
    if (!briefingStartAt) return;
    const update = () => {
      setElapsedLabel(formatDistanceToNow(new Date(briefingStartAt), { addSuffix: false }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [briefingStartAt]);

  const handleSignAndStart = async () => {
    setSigning(true);
    try {
      const signedAt = new Date().toISOString();
      const { base44 } = await import('@/api/base44Client');
      await base44.entities.RotaAssignment.update(assignment.id, {
        briefing_signed: true,
        briefing_signed_at: signedAt,
        status: 'started',
        started_at: signedAt
      });
      onStart();
    } catch (err) {
      console.error('Error signing briefing:', err);
      setSigning(false);
    }
  };

  if (!job) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-0 sm:px-4"
        onClick={(e) => { if (e.target === e.currentTarget && !signing) onClose(); }}
      >
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="hero-gradient px-5 py-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white/15 ring-1 ring-white/20 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-white leading-tight">Site Briefing Required</h2>
                <p className="text-emerald-100 text-xs">Review before starting work</p>
              </div>
            </div>
            {!signing && (
              <button onClick={onClose} className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition flex-shrink-0">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Content */}
          <div className="overflow-y-auto px-5 py-5 flex-1">
            {phase === 'intro' && (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck className="w-8 h-8 text-emerald-700" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Welcome to site</h3>
                <p className="text-sm text-slate-500 max-w-sm mx-auto mb-5">
                  This is your first shift on this job. You need to complete a short site briefing before you can start work.
                  This covers the job details, site location, and any safety documents.
                </p>
                <div className="bg-slate-50 rounded-xl p-4 text-left mb-5">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Job Details</p>
                  <p className="font-bold text-slate-900 text-lg mb-1">{job.name}</p>
                  <div className="flex items-center gap-1.5 text-sm text-slate-600 mb-1">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    <span className="break-words">{job.location}</span>
                  </div>
                  {client && (
                    <div className="flex items-center gap-1.5 text-sm text-slate-600">
                      <Briefcase className="w-4 h-4 text-emerald-600" />
                      <span>{client.name}</span>
                    </div>
                  )}
                </div>
                <button onClick={() => setPhase('review')}
                  className="flex items-center justify-center gap-2 w-full px-5 py-3.5 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 active:scale-95 transition text-sm font-bold touch-manipulation">
                  <PlayCircle className="w-5 h-5" /> Begin Briefing
                </button>
                {briefingStartAt && (
                  <p className="text-[11px] text-slate-400 mt-3 flex items-center justify-center gap-1">
                    <Clock className="w-3 h-3" /> Briefing timer started {elapsedLabel} ago
                  </p>
                )}
              </div>
            )}

            {phase === 'review' && (
              <div className="space-y-4">
                {/* Timer badge */}
                {briefingStartAt && (
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3.5 py-2.5">
                    <Clock className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span className="text-xs text-emerald-800 font-medium">
                      Briefing in progress · {elapsedLabel} elapsed
                    </span>
                  </div>
                )}

                {/* Site details */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Site Information</p>
                  <div className="space-y-2.5 text-sm">
                    <div>
                      <p className="text-[11px] text-slate-400">Job</p>
                      <p className="font-semibold text-slate-900">{job.name}</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[11px] text-slate-400">Site address</p>
                        <p className="text-slate-700 break-words">{job.location}</p>
                      </div>
                    </div>
                    {job.site_contact_name && (
                      <div>
                        <p className="text-[11px] text-slate-400">Site contact</p>
                        <p className="text-slate-700">{job.site_contact_name}{job.site_contact_phone ? ` · ${job.site_contact_phone}` : ''}</p>
                      </div>
                    )}
                    {client && (
                      <div className="flex items-start gap-2">
                        <Briefcase className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[11px] text-slate-400">Client</p>
                          <p className="text-slate-700">{client.name}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Job notes */}
                {job.notes && (
                  <div className="bg-amber-50/50 rounded-xl p-4 border border-amber-100">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Job Notes & Instructions</p>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{job.notes}</p>
                  </div>
                )}

                {/* Safety documents */}
                {job.requisition_list_url && (
                  <a href={job.requisition_list_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-between gap-2 p-4 bg-emerald-50 rounded-xl border border-emerald-100 hover:bg-emerald-100 transition group">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-semibold text-emerald-900 text-sm">{job.requisition_list_name || 'Requisition / Equipment List'}</p>
                        <p className="text-xs text-emerald-600">Tap to review before signing</p>
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-emerald-600 flex-shrink-0 group-hover:translate-x-0.5 transition" />
                  </a>
                )}

                {/* Declaration */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Declaration</p>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    By signing below, I confirm that I have read and understood the site briefing, including the job details,
                    site location, and any safety documents provided. I understand the hazards and control measures for this site
                    and am fit to carry out the work.
                  </p>
                </div>

                {/* Sign button */}
                <button onClick={handleSignAndStart} disabled={signing}
                  className="flex items-center justify-center gap-2 w-full px-5 py-3.5 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 active:scale-95 transition text-sm font-bold touch-manipulation disabled:opacity-50">
                  {signing ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Signing…</>
                  ) : (
                    <><CheckCircle2 className="w-5 h-5" /> Sign Briefing & Start Job</>
                  )}
                </button>
                <p className="text-[11px] text-slate-400 text-center">
                  Your signature records the briefing time for management records.
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}