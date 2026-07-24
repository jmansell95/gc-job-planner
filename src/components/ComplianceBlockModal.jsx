import React from 'react';
import { AlertTriangle, ShieldAlert, X, HardHat, Wrench } from 'lucide-react';
import { format } from 'date-fns';

/**
 * Modal shown when a manager tries to publish a rota that includes staff or
 * assets with expired compliance. Lists every violation and lets the manager
 * either cancel (fix the compliance first) or force-publish (override).
 */
export default function ComplianceBlockModal({ open, violations = [], onForce, onCancel, publishing }) {
  if (!open) return null;

  const staffViolations = violations.filter(v => v.type === 'staff');
  const assetViolations = violations.filter(v => v.type === 'asset');

  const fmtDate = (d) => {
    if (!d) return '—';
    try {
      if (/^\d{4}-\d{2}$/.test(d)) return format(new Date(d + '-01'), 'MMM yyyy');
      return format(new Date(d + 'T00:00:00'), 'dd MMM yyyy');
    } catch {
      return d;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-red-100 bg-red-50/50 rounded-t-2xl">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
            <ShieldAlert className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-slate-900">Compliance issues detected</h2>
            <p className="text-sm text-slate-600 mt-0.5">
              {violations.length} expired {violations.length === 1 ? 'item' : 'items'} will block this rota.
              Fix them or publish anyway at your own risk.
            </p>
          </div>
          <button onClick={onCancel} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Violation list */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {staffViolations.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <HardHat className="w-4 h-4 text-amber-600" />
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Staff ({staffViolations.length})
                </h3>
              </div>
              <div className="space-y-1.5">
                {staffViolations.map((v, i) => (
                  <div key={`s-${i}`} className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50/40 px-3 py-2">
                    <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 truncate">{v.staffName}</p>
                      <p className="text-xs text-slate-500">{v.title} · expired {fmtDate(v.expiryDate)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {assetViolations.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Wrench className="w-4 h-4 text-orange-600" />
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Equipment ({assetViolations.length})
                </h3>
              </div>
              <div className="space-y-1.5">
                {assetViolations.map((v, i) => (
                  <div key={`a-${i}`} className="flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50/40 px-3 py-2">
                    <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 truncate">{v.assetName}</p>
                      <p className="text-xs text-slate-500 capitalize">
                        {(v.assetType || 'equipment').replace(/_/g, ' ')}
                        {v.expiryDate ? ` · expired ${fmtDate(v.expiryDate)}` : ' · no valid compliance'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2 p-4 border-t border-slate-100">
          <button
            onClick={onCancel}
            disabled={publishing}
            className="flex-1 px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition text-sm font-semibold disabled:opacity-50"
          >
            Cancel & fix
          </button>
          <button
            onClick={onForce}
            disabled={publishing}
            className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {publishing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Publishing…
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4" />
                Publish anyway
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}