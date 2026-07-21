import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { X, CheckCircle2, Car, Ruler, FileText, ClipboardCheck, Send, ChevronRight, AlertTriangle, Coffee, Briefcase, Info, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';

const fmtDur = (mins) => {
  const m = Math.round(Number(mins) || 0);
  const h = Math.floor(m / 60), r = m % 60;
  if (h && r) return `${h}h ${r}m`;
  if (h) return `${h}h`;
  return m > 0 ? `${r}m` : '0m';
};

const entryMeta = (t) => {
  if (t.is_break) return { Icon: Coffee, bg: 'bg-amber-50/50', iconBg: 'bg-amber-100', label: 'Lunch Break' };
  if (t.task_type === 'travel_to') return { Icon: Car, bg: 'bg-blue-50/50', iconBg: 'bg-blue-100', label: 'Travel to Site' };
  if (t.task_type === 'travel_from') return { Icon: Car, bg: 'bg-blue-50/50', iconBg: 'bg-blue-100', label: 'Travel Home' };
  if (/briefing|induction/i.test(t.task_description || '')) return { Icon: ShieldCheck, bg: 'bg-purple-50/50', iconBg: 'bg-purple-100', label: t.task_description };
  return { Icon: Briefcase, bg: 'bg-white', iconBg: 'bg-emerald-100', label: t.task_description };
};

// A step-by-step wizard that flows staff through reviewing their day and
// submitting everything: tasks review → meterage (drillers) → progress notes →
// travel home (last job) → final review & submit.
export default function EndOfShiftWizard({ open, onClose, onSubmit, assignment, job, staffId, isDriller, isLastJob }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [step, setStep] = useState(0);
  const [meterage, setMeterage] = useState('');
  const [progressNotes, setProgressNotes] = useState('');
  const [departSite, setDepartSite] = useState('');
  const [arriveHome, setArriveHome] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: todayEntries = [], isLoading } = useQuery({
    queryKey: ['daily-tasks', staffId, today],
    queryFn: () => base44.entities.Timesheet.filter({ staff_id: staffId, date: today }),
    enabled: !!staffId && open,
  });

  useEffect(() => {
    if (open) {
      setStep(0); setMeterage(''); setProgressNotes(assignment?.progress_notes || '');
      setDepartSite(''); setArriveHome(''); setSubmitting(false);
    }
  }, [open]);

  const steps = [
    { key: 'review', label: 'Review' },
    ...(isDriller ? [{ key: 'meterage', label: 'Meterage' }] : []),
    { key: 'notes', label: 'Notes' },
    ...(isLastJob ? [{ key: 'travel', label: 'Travel Home' }] : []),
    { key: 'submit', label: 'Submit' },
  ];

  const entries = todayEntries.filter(t => t.status !== 'deleted' && t.status !== 'rejected' && t.status !== 'merged');
  const sortedEntries = [...entries].sort((a, b) => (a.start_time || '00:00').localeCompare(b.start_time || '00:00'));
  const totalMins = entries.reduce((s, t) => s + (Number(t.task_duration_minutes) || 0), 0);
  const hasTasks = entries.length > 0;

  const travelMins = departSite && arriveHome
    ? (() => { const [dh, dm] = departSite.split(':').map(Number); const [ah, am] = arriveHome.split(':').map(Number); const m = (ah * 60 + am) - (dh * 60 + dm); return m > 0 ? m : 0; })()
    : 0;
  const invalidTravel = departSite && arriveHome && travelMins === 0;

  const handleFinalSubmit = () => {
    setSubmitting(true);
    onSubmit({
      meterage: isDriller ? (parseFloat(meterage) || 0) : undefined,
      progressNotes: progressNotes.trim(),
      travelHome: isLastJob ? { departSite: departSite || null, arriveHome: arriveHome || null } : null,
    });
  };

  const currentStep = steps[step];
  const isLastStep = step === steps.length - 1;
  const canAdvance = () => {
    if (currentStep.key === 'review') return hasTasks;
    if (currentStep.key === 'travel') return !invalidTravel;
    return true;
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-white flex flex-col"
          onClick={onClose}>
          <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            onClick={e => e.stopPropagation()}
            className="bg-white w-full h-full overflow-hidden flex flex-col">

            {/* Header */}
            <div className="hero-gradient px-5 py-4 text-white flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-white/15 ring-1 ring-white/20 flex items-center justify-center">
                    <ClipboardCheck className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold leading-tight">End of Shift</h2>
                    <p className="text-emerald-100 text-xs">{job?.name || 'Shift completion'}</p>
                  </div>
                </div>
                <button onClick={onClose} disabled={submitting} className="p-1.5 rounded-lg hover:bg-white/15 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center gap-1">
                {steps.map((s, i) => (
                  <div key={s.key} className={`h-1.5 flex-1 rounded-full transition ${i <= step ? 'bg-white' : 'bg-white/25'}`} />
                ))}
              </div>
              <p className="text-[11px] text-emerald-100 mt-2">Step {step + 1} of {steps.length} — {currentStep.label}</p>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {/* Step 1: Review Tasks */}
              {currentStep.key === 'review' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="w-4 h-4 text-emerald-600" />
                    <p className="text-sm font-semibold text-slate-700">Here's everything you've logged today:</p>
                  </div>
                  {isLoading ? (
                    <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)}</div>
                  ) : sortedEntries.length === 0 ? (
                    <div className="text-center py-8 bg-amber-50 rounded-xl border border-amber-100">
                      <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-amber-900">No tasks logged yet</p>
                      <p className="text-xs text-amber-700 mt-1">Close this and add your daily tasks first.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
                      {sortedEntries.map(t => {
                        const meta = entryMeta(t);
                        const mins = Number(t.task_duration_minutes) || 0;
                        return (
                          <div key={t.id} className={`px-3.5 py-3 flex items-center gap-3 ${meta.bg}`}>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.iconBg}`}>
                              <meta.Icon className="w-4 h-4 text-slate-600" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm text-slate-900 truncate">{meta.label}</p>
                              <p className="text-xs text-slate-400">{t.start_time}–{t.end_time}{t.meterage ? ` · ${t.meterage}m` : ''}</p>
                            </div>
                            <span className="text-sm font-bold text-slate-700 tabular-nums">{fmtDur(mins)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {sortedEntries.length > 0 && (
                    <div className="flex items-center justify-between bg-emerald-50 rounded-xl px-4 py-3 border border-emerald-100">
                      <span className="text-sm font-medium text-emerald-900">Total time logged</span>
                      <span className="text-lg font-bold text-emerald-700 tabular-nums">{fmtDur(totalMins)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Meterage (driller only) */}
              {currentStep.key === 'meterage' && (
                <div className="space-y-4">
                  <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-3.5 py-3">
                    <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-900 leading-relaxed">
                      Borehole logs are recorded in <strong>KeyLogBook</strong> and imported via AGS — just confirm your total metres drilled today for the timesheet.
                    </p>
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 mb-2">
                      <Ruler className="w-4 h-4 text-amber-600" /> Metres drilled today
                    </label>
                    <div className="relative">
                      <input type="number" min="0" step="0.1" placeholder="0.0" value={meterage}
                        onChange={e => setMeterage(e.target.value)} autoFocus
                        className="w-full px-4 py-4 pr-12 border-2 border-slate-200 rounded-xl text-2xl font-bold text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg font-medium text-slate-400">m</span>
                    </div>
                    {meterage && parseFloat(meterage) > 0 && (
                      <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {parseFloat(meterage)}m recorded
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3: Progress Notes */}
              {currentStep.key === 'notes' && (
                <div className="space-y-3">
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 mb-2">
                      <FileText className="w-4 h-4 text-slate-500" /> Progress notes for the next shift
                    </label>
                    <textarea value={progressNotes} onChange={e => setProgressNotes(e.target.value)} rows={5} autoFocus
                      placeholder="What was done today? What's left for the next shift? Any issues?"
                      className="w-full px-3 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 resize-none" />
                    <p className="text-[11px] text-slate-400 mt-1.5">Optional — visible to management and the next shift.</p>
                  </div>
                </div>
              )}

              {/* Step 4: Travel Home (last job only) */}
              {currentStep.key === 'travel' && (
                <div className="space-y-4">
                  <div className="rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white px-4 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <Car className="w-5 h-5 flex-shrink-0" />
                      <p className="text-sm font-bold">Have a safe journey home!</p>
                    </div>
                    <p className="text-xs text-emerald-50 mt-1.5 leading-relaxed">Log your travel home before submitting your timesheet.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">Left site</label>
                      <input type="time" value={departSite} onChange={e => setDepartSite(e.target.value)}
                        className="w-full px-3 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 bg-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">Arrived home</label>
                      <input type="time" value={arriveHome} onChange={e => setArriveHome(e.target.value)}
                        className="w-full px-3 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 bg-white" />
                    </div>
                  </div>
                  {invalidTravel && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5">
                      <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <p className="text-xs text-red-800 font-medium">Arrival home must be after leaving site.</p>
                    </div>
                  )}
                  {travelMins > 0 && (
                    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3.5 py-2.5">
                      <Car className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <p className="text-xs text-emerald-900 font-medium">Travel time: {fmtDur(travelMins)}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 5: Final Review & Submit */}
              {currentStep.key === 'submit' && (
                <div className="space-y-4">
                  <div className="text-center py-2">
                    <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                      <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">Ready to submit?</h3>
                    <p className="text-sm text-slate-500 mt-1">Check your day below and submit to your manager.</p>
                  </div>
                  <div className="space-y-2.5 bg-slate-50 rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Tasks logged</span>
                      <span className="font-semibold text-slate-900">{entries.length} entries · {fmtDur(totalMins)}</span>
                    </div>
                    {isDriller && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Meterage</span>
                        <span className="font-semibold text-slate-900">{meterage ? `${parseFloat(meterage)}m` : '0m'}</span>
                      </div>
                    )}
                    {progressNotes.trim() && (
                      <div className="text-sm">
                        <span className="text-slate-500">Notes: </span>
                        <span className="text-slate-700">{progressNotes.trim()}</span>
                      </div>
                    )}
                    {isLastJob && travelMins > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Travel home</span>
                        <span className="font-semibold text-slate-900">{fmtDur(travelMins)}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 text-center">
                    Your timesheet will be submitted to your manager for approval. A daily summary of who has and hasn't submitted is emailed to managers automatically.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 flex gap-2 flex-shrink-0">
              {step > 0 && (
                <button onClick={() => setStep(s => s - 1)} disabled={submitting}
                  className="flex items-center gap-1.5 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 active:scale-95 transition text-sm font-semibold">
                  Back
                </button>
              )}
              {!isLastStep ? (
                <button onClick={() => setStep(s => s + 1)} disabled={!canAdvance() || submitting}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 active:scale-95 transition text-sm font-bold disabled:opacity-50 touch-manipulation">
                  Continue <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button onClick={handleFinalSubmit} disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 active:scale-95 transition text-sm font-bold disabled:opacity-50 touch-manipulation">
                  {submitting ? 'Submitting…' : 'Submit Shift'} <Send className="w-4 h-4" />
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}