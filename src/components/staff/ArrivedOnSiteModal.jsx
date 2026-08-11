import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Car, Clock, MapPin, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

// First step of the daily staff workflow: confirm arrival on site and log
// travel-to-site time. On confirm, a travel_to draft timesheet entry is
// created and the assignment is marked arrived — then the briefing/induction
// opens (if still required for this job).
export default function ArrivedOnSiteModal({ open, onClose, onConfirm, jobName, jobLocation, inductionRequired }) {
  const [departHome, setDepartHome] = useState('');
  const [arriveSite, setArriveSite] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [saving, setSaving] = useState(false);

  const travelMins = departHome && arriveSite
    ? (() => { const [dh, dm] = departHome.split(':').map(Number); const [ah, am] = arriveSite.split(':').map(Number); const m = (ah * 60 + am) - (dh * 60 + dm); return m > 0 ? m : 0; })()
    : 0;
  const invalidTime = departHome && arriveSite && travelMins === 0;
  const canConfirm = departHome && arriveSite && !invalidTime && !saving;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setSaving(true);
    await onConfirm({ departHome, arriveSite });
    setSaving(false);
    setDepartHome('');
  };

  const handleSkip = async () => {
    setSaving(true);
    await onConfirm({ departHome: null, arriveSite: null, skipped: true });
    setSaving(false);
    setDepartHome('');
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
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            onClick={e => e.stopPropagation()}
            className="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
          >
            {/* Header */}
            <div className="hero-gradient px-5 py-4 text-white flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/15 ring-1 ring-white/20 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold leading-tight">Arrived on Site</h2>
                  <p className="text-emerald-100 text-xs">{jobName || 'Log your travel to site'}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 overflow-y-auto">
              {jobLocation && (
                <div className="flex items-start gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3">
                  <MapPin className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-700 break-words">{jobLocation}</p>
                </div>
              )}

              <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-3.5 py-3">
                <Car className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-900 leading-relaxed">
                  Log your travel time to site — this is the first thing you do before starting the briefing or induction.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Left home</label>
                  <input type="time" value={departHome} onChange={e => setDepartHome(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Arrived on site</label>
                  <input type="time" value={arriveSite} onChange={e => setArriveSite(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 bg-white" />
                </div>
              </div>

              {invalidTime && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <p className="text-xs text-red-800 font-medium">Arrival on site must be after leaving home.</p>
                </div>
              )}

              {travelMins > 0 && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3.5 py-2.5">
                  <Car className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <p className="text-xs text-emerald-900 font-medium">Travel time: {Math.floor(travelMins / 60)}h {travelMins % 60}m</p>
                  <span className="text-[10px] text-emerald-600 ml-auto">First 1.5h unpaid</span>
                </div>
              )}

              {inductionRequired ? (
                <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-100 rounded-xl px-3.5 py-3">
                  <ShieldCheck className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-900 leading-relaxed">
                    After logging your travel, you'll start the site briefing and induction. This is only needed on your first day at this site.
                  </p>
                </div>
              ) : (
                <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-100 rounded-xl px-3.5 py-3">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-emerald-900 leading-relaxed">
                    You've already completed the induction for this site — you'll be ready to start work once you confirm arrival.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 flex gap-2 flex-shrink-0">
              <button onClick={handleSkip} disabled={saving}
                className="flex items-center justify-center gap-1.5 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 active:scale-95 transition text-sm font-semibold disabled:opacity-50">
                Skip
              </button>
              <button onClick={handleConfirm} disabled={!canConfirm}
                className="flex items-center justify-center gap-1.5 flex-1 px-4 py-3 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 active:scale-95 transition text-sm font-bold disabled:opacity-50 touch-manipulation">
                <CheckCircle2 className="w-4 h-4" /> {saving ? 'Saving…' : 'Confirm Arrival'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}