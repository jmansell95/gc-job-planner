import React from 'react';
import { Truck, AlertTriangle, CalendarClock, Wrench } from 'lucide-react';
import { differenceInDays } from 'date-fns';

export default function VehicleMaintenanceAlerts({ vehicles }) {
  const today = new Date();

  const alerts = vehicles.map(v => {
    const issues = [];
    if (v.mot_expiry) {
      const days = differenceInDays(new Date(v.mot_expiry + 'T00:00:00'), today);
      if (days < 0) issues.push({ type: 'mot', severity: 'expired', label: 'MOT Expired', days });
      else if (days <= 30) issues.push({ type: 'mot', severity: 'warning', label: 'MOT Due', days });
    }
    if (v.service_due_date) {
      const days = differenceInDays(new Date(v.service_due_date + 'T00:00:00'), today);
      if (days < 0) issues.push({ type: 'service', severity: 'expired', label: 'Service Overdue', days });
      else if (days <= 30) issues.push({ type: 'service', severity: 'warning', label: 'Service Due', days });
    }
    return { vehicle: v, issues };
  }).filter(a => a.issues.length > 0);

  const expiredCount = alerts.flatMap(a => a.issues).filter(i => i.severity === 'expired').length;
  const warningCount = alerts.flatMap(a => a.issues).filter(i => i.severity === 'warning').length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="w-5 h-5 text-amber-600" />
          <h2 className="font-semibold text-slate-900">Vehicle Maintenance</h2>
        </div>
        {alerts.length > 0 && (
          <div className="flex gap-1.5">
            {expiredCount > 0 && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">{expiredCount} expired</span>}
            {warningCount > 0 && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{warningCount} due</span>}
          </div>
        )}
      </div>
      {alerts.length === 0 ? (
        <div className="px-5 py-8 text-center text-slate-400 text-sm">
          <Wrench className="w-8 h-8 text-slate-200 mx-auto mb-2" />
          All vehicles up to date
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {alerts.map(({ vehicle, issues }) => (
            <div key={vehicle.id} className="px-5 py-3.5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <Truck className="w-4 h-4 text-amber-600" />
                </div>
                <span className="font-mono font-bold text-slate-900 text-sm">{vehicle.registration_number}</span>
                <span className="text-xs text-slate-400 truncate">{vehicle.name}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 ml-9">
                {issues.map((issue, idx) => (
                  <span key={idx} className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${
                    issue.severity === 'expired' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                  }`}>
                    {issue.severity === 'expired' ? <AlertTriangle className="w-3 h-3" /> : <CalendarClock className="w-3 h-3" />}
                    {issue.label}
                    <span className="opacity-70">
                      {issue.days < 0 ? ` ${Math.abs(issue.days)}d ago` : ` in ${issue.days}d`}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}