import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { differenceInDays, format, startOfWeek } from 'date-fns';

const STORAGE_KEY = 'gc_dismissed_notifications';

export function useNotifications() {
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => base44.entities.Vehicle.list() });
  const { data: timesheets = [] } = useQuery({ queryKey: ['timesheets'], queryFn: () => base44.entities.Timesheet.list() });
  const { data: absences = [] } = useQuery({ queryKey: ['absences'], queryFn: () => base44.entities.Absence.list() });
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: rotaWeeks = [] } = useQuery({ queryKey: ['rota-week'], queryFn: () => base44.entities.RotaWeek.list() });
  const { data: complianceItems = [] } = useQuery({ queryKey: ['compliance'], queryFn: () => base44.entities.ComplianceItem.list('-created_date', 200) });

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

  const withdrawnTimesheets = timesheets
    .filter(t => t.status === 'deleted' && !t.withdrawal_acknowledged)
    .map(t => {
      const s = staff.find(x => x.id === t.staff_id);
      return { id: 'wd_' + t.id, kind: 'withdrawn', title: s?.name || 'Unknown', subtitle: 'Withdrawn timesheet to review', severity: 'info', meta: t.date };
    });

  const pendingAbsences = absences
    .filter(a => a.status === 'pending')
    .map(a => {
      const s = staff.find(x => x.id === a.staff_id);
      return { id: a.id, kind: 'absence', title: s?.name || 'Unknown', subtitle: `${a.reason} request`, severity: 'info', meta: `${a.start_date} → ${a.end_date}` };
    });

  const onHoldJobs = jobs
    .filter(j => j.status === 'on_hold')
    .map(j => ({ id: 'hold_' + j.id, kind: 'on_hold', title: j.name, subtitle: 'Job is on hold', severity: 'warning', meta: j.location || '' }));

  const weekStartStr = format(startOfWeek(today), 'yyyy-MM-dd');
  const thisWeekRota = rotaWeeks.find(w => w.week_start === weekStartStr);
  const rotaUnpublished = (!thisWeekRota || thisWeekRota.status !== 'published')
    ? [{ id: 'rota_unpublished', kind: 'rota', title: "This week's rota", subtitle: 'Not published yet', severity: 'warning', meta: format(startOfWeek(today), 'dd MMM') }]
    : [];

  const draftTimesheets = timesheets
    .filter(t => {
      if (t.status !== 'draft') return false;
      const created = new Date(t.created_date);
      return (today.getTime() - created.getTime()) > 48 * 60 * 60 * 1000;
    })
    .map(t => {
      const s = staff.find(x => x.id === t.staff_id);
      return { id: 'draft_' + t.id, kind: 'draft', title: s?.name || 'Unknown', subtitle: 'Draft timesheet unresolved (48h+)', severity: 'warning', meta: t.date };
    });

  const todayISO = format(today, 'yyyy-MM-dd');
  const expiryWarnDate = format(new Date(today.getTime() + 30 * 86400000), 'yyyy-MM-dd');
  const expiredCompliance = complianceItems
    .filter(c => c.status_override !== 'not_required' && c.expiry_date && c.expiry_date < todayISO)
    .map(c => ({ id: 'exp_' + c.id, kind: 'compliance_expired', title: c.title, subtitle: c.reference_name || '', severity: 'expired', meta: `expired ${c.expiry_date}` }));
  const expiringCompliance = complianceItems
    .filter(c => c.status_override !== 'not_required' && c.expiry_date && c.expiry_date >= todayISO && c.expiry_date <= expiryWarnDate)
    .map(c => ({ id: 'soon_' + c.id, kind: 'compliance_expiring', title: c.title, subtitle: c.reference_name || '', severity: 'warning', meta: `expires ${c.expiry_date}` }));

  const all = [...vehicleAlerts, ...pendingTimesheets, ...withdrawnTimesheets, ...draftTimesheets, ...pendingAbsences, ...onHoldJobs, ...rotaUnpublished, ...expiredCompliance, ...expiringCompliance];
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
    withdrawnTimesheets: visible.filter(n => n.kind === 'withdrawn'),
    draftTimesheets: visible.filter(n => n.kind === 'draft'),
    pendingAbsences: visible.filter(n => n.kind === 'absence'),
    onHoldJobs: visible.filter(n => n.kind === 'on_hold'),
    rotaAlerts: visible.filter(n => n.kind === 'rota'),
    complianceAlerts: visible.filter(n => n.kind === 'compliance_expired' || n.kind === 'compliance_expiring'),
    count: visible.length,
    dismiss,
    clearAll,
  };
}