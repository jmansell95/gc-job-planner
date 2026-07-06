import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, Wrench, Clock, CalendarOff, CheckCircle2, AlertTriangle, CheckCheck, RotateCcw, PauseCircle, CalendarClock } from 'lucide-react';

export default function NotificationCenter({ isOpen, onClose, onNavigate, notifications }) {
  const { items, vehicleAlerts, pendingTimesheets, withdrawnTimesheets, pendingAbsences, onHoldJobs, rotaAlerts, count, dismiss, clearAll } = notifications;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div key="nc-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
          onClick={onClose} className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-[65]" />
      )}
      {isOpen && (
        <motion.div key="nc-panel" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          className="fixed top-0 right-0 h-screen w-full max-w-sm z-[75] glass border-l border-white/40 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/60">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-emerald-700" />
              <h2 className="font-semibold text-slate-900">Notifications</h2>
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">{count}</span>
            </div>
            <div className="flex items-center gap-1">
              {count > 0 && (
                <button onClick={clearAll} type="button"
                  className="flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 px-2.5 py-1.5 rounded-lg transition cursor-pointer touch-manipulation select-none">
                  <CheckCheck className="w-3.5 h-3.5" /> Clear all
                </button>
              )}
              <button onClick={onClose} type="button" aria-label="Close notifications"
                className="p-1.5 hover:bg-slate-100 rounded-lg transition cursor-pointer touch-manipulation select-none">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {items.length === 0 && (
              <div className="text-center py-12">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-600">You're all caught up!</p>
                <p className="text-xs text-slate-400 mt-1">Nothing needs your attention right now.</p>
              </div>
            )}
            {vehicleAlerts.length > 0 && (
              <NotifGroup label="Vehicle Maintenance" icon={Wrench} color="text-amber-600" items={vehicleAlerts}
                onNavigate={() => { onNavigate?.('settings'); onClose(); }} onDismiss={dismiss} />
            )}
            {pendingTimesheets.length > 0 && (
              <NotifGroup label="Timesheet Approvals" icon={Clock} color="text-blue-600" items={pendingTimesheets}
                onNavigate={() => { onNavigate?.('timesheets'); onClose(); }} onDismiss={dismiss} />
            )}
            {withdrawnTimesheets.length > 0 && (
              <NotifGroup label="Withdrawn to Review" icon={RotateCcw} color="text-slate-600" items={withdrawnTimesheets}
                onNavigate={() => { onNavigate?.('timesheets'); onClose(); }} onDismiss={dismiss} />
            )}
            {onHoldJobs.length > 0 && (
              <NotifGroup label="Jobs On Hold" icon={PauseCircle} color="text-rose-600" items={onHoldJobs}
                onNavigate={() => { onNavigate?.('jobs'); onClose(); }} onDismiss={dismiss} />
            )}
            {rotaAlerts.length > 0 && (
              <NotifGroup label="Rota" icon={CalendarClock} color="text-blue-600" items={rotaAlerts}
                onNavigate={() => { onNavigate?.('rota'); onClose(); }} onDismiss={dismiss} />
            )}
            {pendingAbsences.length > 0 && (
              <NotifGroup label="Absence Requests" icon={CalendarOff} color="text-purple-600" items={pendingAbsences}
                onNavigate={() => { onNavigate?.('settings'); onClose(); }} onDismiss={dismiss} />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function NotifGroup({ label, icon: Icon, color, items, onNavigate, onDismiss }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2 px-1">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
        <span className="text-xs text-slate-400">· {items.length}</span>
      </div>
      <div className="space-y-1.5">
        {items.map(it => {
          const severe = it.severity === 'expired';
          return (
            <div key={it.id} className="flex items-stretch bg-white/70 hover:bg-white rounded-xl border border-slate-200/70 transition overflow-hidden">
              <button onClick={onNavigate} type="button" className="flex-1 text-left px-3 py-2.5 cursor-pointer touch-manipulation">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-900 truncate">{it.title}</span>
                  {severe && <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-xs text-slate-500 truncate">{it.subtitle}</span>
                  <span className="text-[10px] text-slate-400 flex-shrink-0 ml-2">{it.meta}</span>
                </div>
              </button>
              <button onClick={() => onDismiss(it.id)} type="button" aria-label="Mark as done"
                className="w-11 flex-shrink-0 flex items-center justify-center text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 active:scale-95 transition border-l border-slate-200/70 cursor-pointer touch-manipulation select-none">
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}