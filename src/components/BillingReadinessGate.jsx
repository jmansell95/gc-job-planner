import React from 'react';
import { ShieldAlert, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';

/**
 * Renders inside the Job Status modal when the user selects 'decommissioning'
 * or 'completed'. Shows the billing readiness check results so nothing slips
 * through the cracks at hand-off.
 *
 * Blocking items (red) prevent the save button from being enabled.
 * Warnings (amber) are advisory — the manager can still proceed.
 */
export default function BillingReadinessGate({ checking, readiness, statusLabel }) {
  if (checking) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-2">
        <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
        <p className="text-xs text-slate-500">Checking billing readiness…</p>
      </div>
    );
  }

  if (!readiness || readiness.error) return null;

  const blockers = readiness.blockers || [];
  if (blockers.length === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
        <p className="text-xs font-semibold text-emerald-800">
          All billing data captured — ready for {statusLabel.toLowerCase()}
        </p>
      </div>
    );
  }

  const blocking = blockers.filter((b) => b.severity === 'blocking');
  const warnings = blockers.filter((b) => b.severity === 'warning');

  return (
    <div className="space-y-2">
      {blocking.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert className="w-4 h-4 text-red-600 flex-shrink-0" />
            <p className="text-xs font-bold text-red-800">
              {blocking.length} blocking issue{blocking.length === 1 ? '' : 's'} — resolve before {statusLabel.toLowerCase()}
            </p>
          </div>
          <ul className="space-y-1">
            {blocking.map((b, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="w-1 h-1 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-red-700">{b.label}</p>
                  {b.detail?.length > 0 && (
                    <p className="text-[10px] text-red-500 mt-0.5 truncate">{b.detail.join(', ')}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-xs font-bold text-amber-800">
              {warnings.length} warning{warnings.length === 1 ? '' : 's'} — review recommended
            </p>
          </div>
          <ul className="space-y-1">
            {warnings.map((b, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="w-1 h-1 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-amber-700">{b.label}</p>
                  {b.detail?.length > 0 && (
                    <p className="text-[10px] text-amber-500 mt-0.5 truncate">{b.detail.join(', ')}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}