import React, { useState } from 'react';
import { AlertTriangle, AlertCircle, ChevronDown, CheckCircle2 } from 'lucide-react';

const severityConfig = {
  critical: { icon: AlertCircle, badge: 'bg-red-100 text-red-700', dot: 'bg-red-500', border: 'border-red-200' },
  warning: { icon: AlertTriangle, badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500', border: 'border-amber-200' },
};

export default function RotaWarningsPanel({ warnings = [] }) {
  const [expanded, setExpanded] = useState(true);
  if (warnings.length === 0) return null;

  const critical = warnings.filter(w => w.severity === 'critical');
  const warns = warnings.filter(w => w.severity === 'warning');

  return (
    <div className="mb-5 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <button onClick={() => setExpanded(e => !e)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition text-left">
        <div className="flex items-center gap-2">
          {critical.length > 0 ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
              <AlertCircle className="w-3.5 h-3.5" /> {critical.length} critical
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
              <AlertTriangle className="w-3.5 h-3.5" /> {warns.length} warning{warns.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <p className="text-sm font-semibold text-slate-800 flex-1">
          {critical.length > 0 ? 'Rota issues need attention' : 'Rota suggestions'}
        </p>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2 border-t border-slate-100 pt-3">
          {warnings.map((w, i) => {
            const cfg = severityConfig[w.severity];
            const Icon = cfg.icon;
            return (
              <div key={i} className={`flex items-start gap-2.5 rounded-lg px-3 py-2 border ${cfg.border} bg-slate-50/50`}>
                <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${w.severity === 'critical' ? 'text-red-500' : 'text-amber-500'}`} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{w.title}</p>
                  <p className="text-xs text-slate-600 mt-0.5">{w.message}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}