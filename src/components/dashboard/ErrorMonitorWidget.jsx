import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertOctagon, AlertTriangle, CheckCircle2, RefreshCw, Activity } from 'lucide-react';
import WidgetShell from './WidgetShell';

// Error Monitor — surfaces recent errors and warnings from the system's
// automation runs, failed syncs, and data quality issues. Provides a
// centralized view for admins to spot problems early.

export default function ErrorMonitorWidget() {
  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles-error-mon'],
    queryFn: async () => { const r = await base44.entities.Vehicle.list('-created_date', 100); return r.data || r || []; },
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs-error-mon'],
    queryFn: async () => { const r = await base44.entities.Job.list('-created_date', 100); return r.data || r || []; },
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['staff-error-mon'],
    queryFn: async () => { const r = await base44.entities.Staff.list('-created_date', 100); return r.data || r || []; },
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ['bookings-error-mon'],
    queryFn: async () => { const r = await base44.entities.VehicleMaintenanceBooking.list('-created_date', 50); return r.data || r || []; },
  });

  const issues = useMemo(() => {
    const list = [];

    // Vehicle sync failures
    vehicles.forEach(v => {
      if (v.geotab_sync_status === 'failed') {
        list.push({ severity: 'error', category: 'Geotab Sync', message: `${v.name || v.registration_number}: Geotab sync failed`, entity_id: v.id, entity_type: 'vehicle' });
      }
      if (v.holman_sync_status === 'failed') {
        list.push({ severity: 'error', category: 'Holman Sync', message: `${v.name || v.registration_number}: Holman sync failed`, entity_id: v.id, entity_type: 'vehicle' });
      }
      if (v.mot_status === 'not_valid') {
        list.push({ severity: 'error', category: 'MOT Expired', message: `${v.registration_number}: MOT expired`, entity_id: v.id, entity_type: 'vehicle' });
      }
      if (v.tax_status === 'untaxed') {
        list.push({ severity: 'warning', category: 'Tax Expired', message: `${v.registration_number}: Vehicle tax expired`, entity_id: v.id, entity_type: 'vehicle' });
      }
    });

    // Jobs with missing critical data
    jobs.forEach(j => {
      if (j.status === 'in_progress' && !j.start_date) {
        list.push({ severity: 'warning', category: 'Missing Data', message: `${j.name}: Active job missing start date`, entity_id: j.id, entity_type: 'job' });
      }
      if (j.status === 'in_progress' && !j.client_id) {
        list.push({ severity: 'warning', category: 'Missing Client', message: `${j.name}: Active job has no client linked`, entity_id: j.id, entity_type: 'job' });
      }
    });

    // Staff missing rates
    staff.forEach(s => {
      if (s.is_active !== false && !s.day_rate && !s.hourly_rate) {
        list.push({ severity: 'warning', category: 'Missing Rate', message: `${s.name}: No day rate or hourly rate set`, entity_id: s.id, entity_type: 'staff' });
      }
    });

    // Overdue maintenance bookings
    const today = new Date().toISOString().slice(0, 10);
    bookings.forEach(b => {
      if (b.booking_date && b.booking_date < today && b.status === 'requested') {
        list.push({ severity: 'error', category: 'Overdue Booking', message: `${b.vehicle_name}: Maintenance booking overdue (${b.booking_type})`, entity_id: b.id, entity_type: 'booking' });
      }
    });

    return list.sort((a, b) => {
      const sevOrder = { error: 0, warning: 1 };
      return sevOrder[a.severity] - sevOrder[b.severity];
    });
  }, [vehicles, jobs, staff, bookings]);

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warnCount = issues.filter(i => i.severity === 'warning').length;

  return (
    <WidgetShell
      icon={AlertOctagon}
      title="Error Monitor"
      subtitle={`${errorCount} errors · ${warnCount} warnings · auto-detected from sync & data quality checks`}
    >
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {issues.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
            <p className="text-sm font-semibold text-slate-600">All systems healthy</p>
            <p className="text-xs text-slate-400 mt-0.5">No sync failures or data quality issues detected.</p>
          </div>
        ) : (
          issues.slice(0, 15).map((issue, i) => (
            <div key={i} className={`flex items-start gap-2.5 p-2.5 rounded-lg ${
              issue.severity === 'error' ? 'bg-rose-50' : 'bg-amber-50'
            }`}>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                issue.severity === 'error' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'
              }`}>
                {issue.severity === 'error' ? <AlertOctagon className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-700 truncate">{issue.message}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{issue.category}</p>
              </div>
            </div>
          ))
        )}
        {issues.length > 15 && (
          <p className="text-xs text-slate-400 text-center py-1.5">+ {issues.length - 15} more issues…</p>
        )}
      </div>
    </WidgetShell>
  );
}