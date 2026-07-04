import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Bell, X, Wrench, Clock, CalendarOff, CheckCircle2, AlertTriangle } from 'lucide-react';
import { differenceInDays } from 'date-fns';

export default function NotificationCenter({ isOpen, onClose, onNavigate }) {
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => base44.entities.Vehicle.list() });
  const { data: timesheets = [] } = useQuery({ queryKey: ['timesheets'], queryFn: () => base44.entities.Timesheet.list() });
  const { data: absences = [] } = useQuery({ queryKey: ['absences'], queryFn: () => base44.entities.Absence.list() });
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });

  const today = new Date();
  const vehicleAlerts = [];
  vehicles.forEach(v => {
    const check = (date, label, type) => {
      if (!date) return;
      const d = differenceInDays(new Date(date + 'T00:00:00'), today);
      if (d <= 30) vehicleAlerts.push({ id: v.id + type, title: `${label}: ${v.registration_number}`, subtitle: v.name, severity: d < 0 ? 'expired' : 'warning', meta: d < 0 ? `${Math.abs(d)}d ago` : `in ${d}d` });
    };
    check(v.mot_expiry, 'MOT', 'mot');
    check(v.service_due_date, 'Service', 'svc');
  });

  const pendingTimesheets = timesheets.filter(t => t.status === 'submitted').map(t => {
    const s = staff.find(x => x.id === t.staff_id);
    return { id: t.id, title: s?.name || 'Unknown', subtitle: 'Timesheet awaiting approval', severity: 'info', meta: t.date };
  });

  const pendingAbsences = absences.filter(a => a.status === 'pending').map(a => {
    const s = staff.find(x => x.id === a.staff_id);
    return { id: a.id, title: s?.name || 'Unknown', subtitle: `${a.reason} request`, severity: 'info', meta: `${a.start_date} → ${a.end_date}` };
  });

  const all = [...vehicleAlerts, ...pendingTimesheets, ...pendingAbsences];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-[60]" />
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="fixed top-0 right-0 h-screen w-full max-w-sm z-[70] glass border-l border-white/40 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/60">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-emerald-700" />
                <h2 className="font-semibold text-slate-900">Notifications</h2>
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">{all.length}</span>
              </div>
              <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {all.length === 0 && (
                <div className="text-center py-10">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">You're all caught up!</p>
                </div>
              )}
              {vehicleAlerts.length > 0 && (
                <NotifGroup label="Vehicle Maintenance" icon={Wrench} color="text-amber-600" items={vehicleAlerts} onNavigate={() => { onNavigate?.('settings'); onClose(); }} />
              )}
              {pendingTimesheets.length > 0 && (
                <NotifGroup label="Timesheet Approvals" icon={Clock} color="text-blue-600" items={pendingTimesheets} onNavigate={() => { onNavigate?.('timesheets'); onClose(); }} />
              )}
              {pendingAbsences.length > 0 && (
                <NotifGroup label="Absence Requests" icon={CalendarOff} color="text-purple-600" items={pendingAbsences} onNavigate={() => { onNavigate?.('settings'); onClose(); }} />
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function NotifGroup({ label, icon: Icon, color, items, onNavigate }) {
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
            <button key={it.id} onClick={onNavigate}
              className="w-full text-left bg-white/70 hover:bg-white rounded-xl border border-slate-200/70 px-3 py-2.5 transition">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-900 truncate">{it.title}</span>
                {severe && <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-xs text-slate-500 truncate">{it.subtitle}</span>
                <span className="text-[10px] text-slate-400 flex-shrink-0 ml-2">{it.meta}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}