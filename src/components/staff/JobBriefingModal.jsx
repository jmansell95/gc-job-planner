import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Briefcase, FileText, ExternalLink, ShieldCheck, Clock, PlayCircle, CheckCircle2, Loader2, ChevronRight, ChevronLeft, HeartPulse, Flame, AlertTriangle, Users, WifiOff, PenLine, Info } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import SignaturePad from '@/components/staff/SignaturePad';
import { saveOfflineBriefing } from '@/utils/briefingSync';

export default function JobBriefingModal({ assignment, job, client, staff, crewAssignments = [], onSigned, onClose }) {
  const [phase, setPhase] = useState(assignment.briefing_start_at ? 'documents' : 'intro');
  const [signing, setSigning] = useState(false);
  const [briefingStartAt, setBriefingStartAt] = useState(assignment.briefing_start_at || null);
  const [elapsedLabel, setElapsedLabel] = useState('');
  const [reviewedDocIds, setReviewedDocIds] = useState(new Set());
  const [inductionConfirmed, setInductionConfirmed] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState(null);
  const [offlineSaved, setOfflineSaved] = useState(false);

  const { data: briefingDocs = [] } = useQuery({
    queryKey: ['briefing-docs', job?.id],
    queryFn: async () => {
      const all = await base44.entities.JobDocument.filter({ job_id: job.id });
      return all.filter(d => d.is_briefing_document);
    },
    enabled: !!job?.id
  });

  useEffect(() => {
    if (assignment.briefing_start_at) {
      setBriefingStartAt(assignment.briefing_start_at);
      setPhase('documents');
      return;
    }
    const startNow = async () => {
      const ts = new Date().toISOString();
      setBriefingStartAt(ts);
      try {
        await base44.entities.RotaAssignment.update(assignment.id, { briefing_start_at: ts });
      } catch (err) {
        console.error('Error recording briefing start:', err);
      }
    };
    startNow();
  }, [assignment.id, assignment.briefing_start_at]);

  useEffect(() => {
    if (!briefingStartAt) return;
    const update = () => setElapsedLabel(formatDistanceToNow(new Date(briefingStartAt), { addSuffix: false }));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [briefingStartAt]);

  const crewSignedCount = crewAssignments.filter(a => a.briefing_signed).length;
  const crewTotal = crewAssignments.length;

  const toggleDocReviewed = (docId) => {
    setReviewedDocIds(prev => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  };

  const allDocsReviewed = briefingDocs.length === 0 || reviewedDocIds.size === briefingDocs.length;

  const goNext = () => {
    if (phase === 'intro') setPhase(briefingDocs.length > 0 ? 'documents' : 'induction');
    else if (phase === 'documents') setPhase('induction');
    else if (phase === 'induction') setPhase('sign');
  };

  const goPrev = () => {
    if (phase === 'sign') setPhase('induction');
    else if (phase === 'induction') setPhase(briefingDocs.length > 0 ? 'documents' : 'intro');
    else if (phase === 'documents') setPhase('intro');
  };

  const handleSign = async () => {
    if (!signatureDataUrl || signing) return;
    setSigning(true);
    const signedAt = new Date().toISOString();
    const durationMin = briefingStartAt ? Math.round((new Date(signedAt) - new Date(briefingStartAt)) / 60000) : 0;
    const docIds = Array.from(reviewedDocIds).join(',');

    try {
      if (!navigator.onLine) {
        saveOfflineBriefing({
          assignment_id: assignment.id,
          staff_id: staff.id,
          staff_name: staff.name,
          job_id: job.id,
          assigned_date: assignment.assigned_date,
          signature_data_url: signatureDataUrl,
          signed_at: signedAt,
          induction_completed: inductionConfirmed,
          induction_completed_at: inductionConfirmed ? signedAt : null,
          document_ids_reviewed: docIds,
          briefing_duration_minutes: durationMin
        });
        setOfflineSaved(true);
        return;
      }

      const blob = await (await fetch(signatureDataUrl)).blob();
      const file = new File([blob], `signature_${assignment.id}.png`, { type: 'image/png' });
      const uploadRes = await base44.integrations.Core.UploadFile({ file });

      await base44.entities.BriefingSignature.create({
        assignment_id: assignment.id,
        staff_id: staff.id,
        staff_name: staff.name,
        job_id: job.id,
        assigned_date: assignment.assigned_date,
        signature_url: uploadRes.file_url,
        signed_at: signedAt,
        induction_completed: inductionConfirmed,
        induction_completed_at: inductionConfirmed ? signedAt : null,
        document_ids_reviewed: docIds,
        briefing_duration_minutes: durationMin,
        synced_from_offline: false
      });

      await base44.entities.RotaAssignment.update(assignment.id, {
        briefing_signed: true,
        briefing_signed_at: signedAt
      });

      onSigned({ offline: false });
    } catch (err) {
      console.error('Error signing briefing:', err);
      setSigning(false);
    }
  };

  if (!job) return null;

  const stepLabels = ['Briefing', briefingDocs.length > 0 ? 'Documents' : null, 'Induction', 'Sign'].filter(Boolean);
  const activeStep = phase === 'intro' ? 0 : phase === 'documents' ? 1 : phase === 'induction' ? (briefingDocs.length > 0 ? 2 : 1) : (briefingDocs.length > 0 ? 3 : 2);

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
          className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[92vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="hero-gradient px-5 py-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white/15 ring-1 ring-white/20 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-white leading-tight">Site Briefing</h2>
                <p className="text-emerald-100 text-xs flex items-center gap-1.5">
                  <Clock className="w-3 h-3" /> {elapsedLabel || 'just started'}
                  {crewTotal > 1 && <><span className="mx-0.5">·</span><Users className="w-3 h-3" />{crewSignedCount}/{crewTotal} crew</>}
                </p>
              </div>
            </div>
            {!signing && (
              <button onClick={onClose} className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition flex-shrink-0">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-1.5 px-5 py-3 border-b border-slate-100 flex-shrink-0">
            {stepLabels.map((label, i) => (
              <React.Fragment key={label}>
                <div className={`flex items-center gap-1.5 ${i === activeStep ? 'text-emerald-700' : i < activeStep ? 'text-emerald-500' : 'text-slate-300'}`}>
                  {i < activeStep ? <CheckCircle2 className="w-3.5 h-3.5" /> : <div className={`w-3.5 h-3.5 rounded-full ${i === activeStep ? 'bg-emerald-600' : 'bg-slate-200'}`} />}
                  <span className="text-xs font-medium">{label}</span>
                </div>
                {i < stepLabels.length - 1 && <div className={`h-px flex-1 ${i < activeStep ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
              </React.Fragment>
            ))}
          </div>

          {/* Content */}
          <div className="overflow-y-auto px-5 py-5 flex-1">
            {/* INTRO */}
            {phase === 'intro' && (
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck className="w-8 h-8 text-emerald-700" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Welcome to site</h3>
                <p className="text-sm text-slate-500 max-w-sm mx-auto mb-5">
                  Complete this site briefing before starting work. You'll review mandatory documents, confirm the site induction, and sign off.
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
                {crewTotal > 1 && (
                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3.5 py-2.5 mb-5 text-left">
                    <Users className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <p className="text-xs text-blue-800 font-medium">
                      {crewTotal} crew members assigned today. Everyone must complete their briefing before the shift can start.
                    </p>
                  </div>
                )}
                <button onClick={goNext}
                  className="flex items-center justify-center gap-2 w-full px-5 py-3.5 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 active:scale-95 transition text-sm font-bold touch-manipulation">
                  <PlayCircle className="w-5 h-5" /> Begin Briefing
                </button>
              </div>
            )}

            {/* DOCUMENTS */}
            {phase === 'documents' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">Mandatory Documents</h3>
                  <p className="text-sm text-slate-500">Review each document and tick the box to confirm you've read it.</p>
                </div>
                {briefingDocs.length === 0 ? (
                  <div className="bg-slate-50 rounded-xl p-6 text-center">
                    <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No mandatory documents for this job.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {briefingDocs.map(doc => {
                      const reviewed = reviewedDocIds.has(doc.id);
                      return (
                        <div key={doc.id} className={`rounded-xl border-2 transition ${reviewed ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200 bg-white'}`}>
                          <a href={doc.document_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center justify-between gap-3 p-3.5 hover:bg-slate-50/50 rounded-t-xl transition">
                            <div className="flex items-center gap-3 min-w-0">
                              <FileText className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-900 text-sm truncate">{doc.document_name}</p>
                                <p className="text-xs text-emerald-600 flex items-center gap-1">Tap to open <ExternalLink className="w-3 h-3" /></p>
                              </div>
                            </div>
                          </a>
                          <button onClick={() => toggleDocReviewed(doc.id)}
                            className={`flex items-center gap-2 w-full px-3.5 py-2.5 border-t-2 ${reviewed ? 'border-emerald-200' : 'border-slate-100'} text-left transition`}>
                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${reviewed ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300'}`}>
                              {reviewed && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                            </div>
                            <span className={`text-sm font-medium ${reviewed ? 'text-emerald-700' : 'text-slate-600'}`}>
                              {reviewed ? 'Reviewed' : 'I have read this document'}
                            </span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <button onClick={goPrev} className="flex items-center gap-1.5 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition text-sm font-semibold">
                    <ChevronLeft className="w-4 h-4" /> Back
                  </button>
                  <button onClick={goNext} disabled={!allDocsReviewed}
                    className="flex items-center justify-center gap-1.5 flex-1 px-4 py-3 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 active:scale-95 transition text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation">
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                {!allDocsReviewed && briefingDocs.length > 0 && (
                  <p className="text-xs text-amber-600 text-center">Please review all documents to continue.</p>
                )}
              </div>
            )}

            {/* INDUCTION */}
            {phase === 'induction' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">Site Induction</h3>
                  <p className="text-sm text-slate-500">Review the site-specific safety information below.</p>
                </div>

                <div className="space-y-3">
                  {job.fire_assembly_point && (
                    <div className="flex items-start gap-3 bg-red-50/50 rounded-xl p-3.5 border border-red-100">
                      <Flame className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">Fire Assembly Point</p>
                        <p className="text-sm text-slate-700 mt-0.5">{job.fire_assembly_point}</p>
                      </div>
                    </div>
                  )}
                  {job.first_aid_location && (
                    <div className="flex items-start gap-3 bg-rose-50/50 rounded-xl p-3.5 border border-rose-100">
                      <HeartPulse className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-rose-700 uppercase tracking-wide">First Aid</p>
                        <p className="text-sm text-slate-700 mt-0.5">{job.first_aid_location}</p>
                      </div>
                    </div>
                  )}
                  {job.emergency_procedures && (
                    <div className="flex items-start gap-3 bg-amber-50/50 rounded-xl p-3.5 border border-amber-100">
                      <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Emergency Procedures</p>
                        <p className="text-sm text-slate-700 mt-0.5 whitespace-pre-wrap">{job.emergency_procedures}</p>
                      </div>
                    </div>
                  )}
                  {job.induction_notes && (
                    <div className="flex items-start gap-3 bg-slate-50 rounded-xl p-3.5 border border-slate-200">
                      <Info className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Additional Induction Notes</p>
                        <p className="text-sm text-slate-700 mt-0.5 whitespace-pre-wrap">{job.induction_notes}</p>
                      </div>
                    </div>
                  )}
                  {!job.fire_assembly_point && !job.first_aid_location && !job.emergency_procedures && !job.induction_notes && (
                    <div className="bg-slate-50 rounded-xl p-6 text-center">
                      <Info className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">No site-specific induction details recorded for this job.</p>
                    </div>
                  )}
                </div>

                {/* Induction confirmation */}
                <button onClick={() => setInductionConfirmed(!inductionConfirmed)}
                  className={`flex items-start gap-2.5 w-full text-left rounded-xl border-2 p-3.5 transition ${inductionConfirmed ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200 bg-white'}`}>
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${inductionConfirmed ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300'}`}>
                    {inductionConfirmed && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <span className={`text-sm font-medium ${inductionConfirmed ? 'text-emerald-700' : 'text-slate-600'}`}>
                    I confirm the site induction has been completed (e.g. PowerPoint, third-party presentation, or site walkthrough).
                  </span>
                </button>

                <div className="flex gap-2 pt-1">
                  <button onClick={goPrev} className="flex items-center gap-1.5 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition text-sm font-semibold">
                    <ChevronLeft className="w-4 h-4" /> Back
                  </button>
                  <button onClick={goNext} disabled={!inductionConfirmed}
                    className="flex items-center justify-center gap-1.5 flex-1 px-4 py-3 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 active:scale-95 transition text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation">
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                {!inductionConfirmed && (
                  <p className="text-xs text-amber-600 text-center">Please confirm the induction to continue.</p>
                )}
              </div>
            )}

            {/* SIGN */}
            {phase === 'sign' && (
              <div className="space-y-4">
                {offlineSaved ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
                      <WifiOff className="w-8 h-8 text-amber-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">Saved offline</h3>
                    <p className="text-sm text-slate-500 max-w-sm mx-auto">
                      Your briefing signature has been saved on this device. It will sync automatically when you reconnect to the internet.
                    </p>
                    <button onClick={() => onSigned({ offline: true })} className="mt-5 w-full px-5 py-3.5 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 active:scale-95 transition text-sm font-bold">
                      Close
                    </button>
                  </div>
                ) : (
                  <>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 mb-1">Sign the Briefing</h3>
                      <p className="text-sm text-slate-500">Draw your signature below to confirm and sign off.</p>
                    </div>

                    {/* Declaration */}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Declaration</p>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        By signing below, I confirm that I have read and understood the site briefing, reviewed all mandatory documents,
                        completed the site induction, and understand the hazards and control measures for this site. I am fit to carry out the work.
                      </p>
                    </div>

                    {/* Signature pad */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Signature</label>
                      <SignaturePad onChange={setSignatureDataUrl} />
                    </div>

                    {!navigator.onLine && (
                      <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">
                        <WifiOff className="w-4 h-4 text-amber-600 flex-shrink-0" />
                        <p className="text-xs text-amber-800 font-medium">You're offline — your signature will sync when you reconnect.</p>
                      </div>
                    )}

                    {crewTotal > 1 && (
                      <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3.5 py-2.5">
                        <Users className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        <p className="text-xs text-blue-800 font-medium">
                          {crewSignedCount} of {crewTotal} crew signed off. {crewSignedCount + 1 === crewTotal ? "You're the last one!" : 'Others still need to sign.'}
                        </p>
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      <button onClick={goPrev} disabled={signing} className="flex items-center gap-1.5 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition text-sm font-semibold">
                        <ChevronLeft className="w-4 h-4" /> Back
                      </button>
                      <button onClick={handleSign} disabled={!signatureDataUrl || signing}
                        className="flex items-center justify-center gap-2 flex-1 px-4 py-3 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 active:scale-95 transition text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation">
                        {signing ? (
                          <><Loader2 className="w-5 h-5 animate-spin" /> Signing…</>
                        ) : (
                          <><PenLine className="w-5 h-5" /> Sign Briefing</>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}