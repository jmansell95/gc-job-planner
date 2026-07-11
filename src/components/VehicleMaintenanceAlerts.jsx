import React from 'react';
import { Truck, AlertTriangle, CalendarClock, Wrench, ArrowRight } from 'lucide-react';
import { differenceInDays } from 'date-fns';

const goToVehicles = () => {
  window.dispatchEvent(new CustomEvent('app-navigate', { detail: { section: 'settings', settingsTab: 'vehicles' } }));
};

export default function VehicleMaintenanceAlerts({ vehicles, onNavigate }) {
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
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
            <Wrench className="w-4 h-4 text-amber-600" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900">Vehicle Maintenance</h2>
            <p className="text-xs text-slate-400">MOT &amp; service alerts</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {alerts.length > 0 && (
            <div className="flex gap-1.5">
              {expiredCount > 0 && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">{expiredCount} expired</span>}
              {warningCount > 0 && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{warningCount} due</span>}
            </div>
          )}
          {onNavigate && (
            <button onClick={goToVehicles} className="text-xs text-emerald-700 font-medium hover:underline flex items-center gap-1 whitespace-nowrap">
              View all <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
      {alerts.length === 0 ? (
        <div className="px-5 py-8 text-center text-slate-400 text-sm">
          <Wrench className="w-8 h-8 text-slate-200 mx-auto mb-2" />
          All vehicles up to date
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {alerts.map(({ vehicle, issues }) => (
            <button key={vehicle.id} onClick={goToVehicles}
              className="w-full px-5 py-3.5 hover:bg-slate-50 transition cursor-pointer text-left group">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <Truck className="w-4 h-4 text-amber-600" />
                </div>
                <span className="font-mono font-bold text-slate-900 text-sm">{vehicle.registration_number}</span>
                <span className="text-xs text-slate-400 truncate">{vehicle.name}</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition ml-auto flex-shrink-0" />
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
            </button>
          ))}
        </div>
      )}
    </div>
  );
}