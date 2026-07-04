import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { differenceInDays } from 'date-fns';

const STORAGE_KEY = 'gc_dismissed_notifications';

export function useNotifications() {
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => base44.entities.Vehicle.list() });
  const { data: timesheets = [] } = useQuery({ queryKey: ['timesheets'], queryFn: () => base44.entities.Timesheet.list() });
  const { data: absences = [] } = useQuery({ queryKey: ['absences'], queryFn: () => base44.entities.Absence.list() });
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });

  const [dismissed, setDismissed] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')); } catch { return new Set(); }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...dismissed])); } catch { /* ignore */ }
  }, [dismissed]);

  const today = new Date();
  const vehicleAlerts = [];
  vehicles.forEach(v => {
    const check = (date, label, type) => {
      if (!date) return;
      const d = differenceInDays(new Date(date + 'T00:00:00'), today);
      if (d <= 30) vehicleAlerts.push({
        id: v.id + '_' + type,
        kind: 'vehicle',
        title: `${label}: ${v.registration_number}`,
        subtitle: v.name,
        severity: d < 0 ? 'expired' : 'warning',
        meta: d < 0 ? `${Math.abs(d)}d overdue` : `in ${d}d`
      });
    };
    check(v.mot_expiry, 'MOT', 'mot');
    check(v.service_due_date, 'Service', 'svc');
  });

  const pendingTimesheets = timesheets
    .filter(t => t.status === 'submitted')
    .map(t => {
      const s = staff.find(x => x.id === t.staff_id);
      return { id: t.id, kind: 'timesheet', title: s?.name || 'Unknown', subtitle: 'Timesheet awaiting approval', severity: 'info', meta: t.date };
    });

  const pendingAbsences = absences
    .filter(a => a.status === 'pending')
    .map(a => {
      const s = staff.find(x => x.id === a.staff_id);
      return { id: a.id, kind: 'absence', title: s?.name || 'Unknown', subtitle: `${a.reason} request`, severity: 'info', meta: `${a.start_date} → ${a.end_date}` };
    });

  const all = [...vehicleAlerts, ...pendingTimesheets, ...pendingAbsences];
  const visible = all.filter(n => !dismissed.has(n.id));

  const dismiss = useCallback((id) => {
    setDismissed(prev => { const next = new Set(prev); next.add(id); return next; });
  }, []);

  const clearAll = useCallback(() => {
    setDismissed(prev => { const next = new Set(prev); all.forEach(n => next.add(n.id)); return next; });
  }, [all]);

  return {
    items: visible,
    vehicleAlerts: visible.filter(n => n.kind === 'vehicle'),
    pendingTimesheets: visible.filter(n => n.kind === 'timesheet'),
    pendingAbsences: visible.filter(n => n.kind === 'absence'),
    count: visible.length,
    dismiss,
    clearAll,
  };
}