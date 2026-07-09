import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Car, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function TravelFromSiteModal({ open, onClose, onConfirm, jobName }) {
  const [departSite, setDepartSite] = useState('');
  const [arriveHome, setArriveHome] = useState('');

  const travelMins = departSite && arriveHome
    ? (() => { const [dh, dm] = departSite.split(':').map(Number); const [ah, am] = arriveHome.split(':').map(Number); const m = (ah * 60 + am) - (dh * 60 + dm); return m > 0 ? m : 0; })()
    : 0;
  const invalidTime = departSite && arriveHome && travelMins === 0;

  const handleConfirm = () => {
    if (invalidTime) return;
    onConfirm({ departSite: departSite || null, arriveHome: arriveHome || null });
    setDepartSite(''); setArriveHome('');
  };

  const handleSkip = () => {
    onConfirm({ departSite: null, arriveHome: null });
    setDepartSite(''); setArriveHome('');
  };

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
                  <Car className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold leading-tight">Travel Home</h2>
                  <p className="text-emerald-100 text-xs">{jobName || 'Shift completion'}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-3.5 py-3">
                <Clock className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-900 leading-relaxed">
                  Log your travel time home from site. This will be added to your daily tasks and included in your timesheet.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Left site</label>
                  <input type="time" value={departSite} onChange={e => setDepartSite(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Arrived home</label>
                  <input type="time" value={arriveHome} onChange={e => setArriveHome(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 bg-white" />
                </div>
              </div>

              {invalidTime && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <p className="text-xs text-red-800 font-medium">Arrival home must be after leaving site.</p>
                </div>
              )}

              {travelMins > 0 && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3.5 py-2.5">
                  <Car className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <p className="text-xs text-emerald-900 font-medium">Travel time: {Math.floor(travelMins / 60)}h {travelMins % 60}m</p>
                  <span className="text-[10px] text-emerald-600 ml-auto">First 1.5h unpaid</span>
                </div>
              )}

              <p className="text-[11px] text-slate-400">
                Your shift will be completed and your timesheet submitted to your manager after this step.
              </p>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 flex gap-2 flex-shrink-0">
              <button onClick={handleSkip}
                className="flex items-center justify-center gap-1.5 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 active:scale-95 transition text-sm font-semibold">
                Skip
              </button>
              <button onClick={handleConfirm} disabled={invalidTime}
                className="flex items-center justify-center gap-1.5 flex-1 px-4 py-3 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 active:scale-95 transition text-sm font-bold disabled:opacity-50 touch-manipulation">
                <CheckCircle2 className="w-4 h-4" /> Complete & Submit
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}