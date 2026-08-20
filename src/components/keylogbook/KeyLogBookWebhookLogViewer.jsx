import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  ChevronDown, ChevronRight, Inbox, RefreshCw, Loader2,
  CheckCircle2, AlertCircle, Trash2, FileWarning,
} from 'lucide-react';

const OUTCOME_STYLES = {
  success: { icon: CheckCircle2, color: 'text-emerald-600', label: 'Success' },
  no_data: { icon: FileWarning, color: 'text-amber-600', label: 'No data' },
  deleted: { icon: Trash2, color: 'text-slate-500', label: 'Deleted' },
  error: { icon: AlertCircle, color: 'text-red-600', label: 'Error' },
};

export default function KeyLogBookWebhookLogViewer() {
  const [expanded, setExpanded] = useState(null);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['keylogbook-webhook-logs'],
    queryFn: async () => {
      const list = await base44.entities.KeyLogBookWebhookLog.list('-created_date', 10);
      return list;
    },
  });

  const logs = data || [];

  return (
    <div className="border-t border-slate-100 pt-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Inbox className="w-4 h-4 text-amber-600" />
          <h4 className="text-sm font-bold text-slate-900">Recent Webhook Requests</h4>
          <span className="text-xs text-slate-400">— last 10 requests received</span>
        </div>
        <button onClick={() => refetch()} className="p-1.5 text-slate-400 hover:text-slate-600 rounded" title="Refresh">
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-6">
          <Inbox className="w-8 h-8 text-slate-200 mb-2" />
          <p className="text-sm font-medium text-slate-500">No webhook requests yet</p>
          <p className="text-xs text-slate-400 mt-0.5">Once KeyLogBook starts sending events, they'll appear here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const style = OUTCOME_STYLES[log.outcome] || OUTCOME_STYLES.error;
            const OutcomeIcon = style.icon;
            const isOpen = expanded === log.id;
            const jobRef = log.matched_job_reference
              || log.matched_job_name
              || (log.created_job ? 'Auto-created' : 'No match');
            const refColor = log.created_job
              ? 'text-amber-600'
              : log.matched_job_reference ? 'text-emerald-600' : 'text-slate-400';
            return (
              <div key={log.id} className="rounded-lg border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : log.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-slate-50 transition"
                >
                  {isOpen
                    ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    : <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />}
                  <OutcomeIcon className={`w-4 h-4 ${style.color} flex-shrink-0`} />
                  <span className="text-xs text-slate-400 flex-shrink-0 w-32 tabular-nums">
                    {log.created_date
                      ? new Date(log.created_date).toLocaleString('en-GB', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                        })
                      : ''}
                  </span>
                  <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-mono font-semibold flex-shrink-0">
                    {log.event_type || 'webhook'}
                  </span>
                  {log.hole_id && (
                    <span className="text-xs text-slate-500 flex-shrink-0 font-mono">{log.hole_id}</span>
                  )}
                  <span className="flex-1 min-w-0" />
                  <span className={`text-xs font-semibold flex-shrink-0 ${refColor}`}>→ {jobRef}</span>
                </button>

                {isOpen && (
                  <div className="px-3 pb-3 pt-1 space-y-2.5 bg-slate-50/50">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      {log.project_name && (
                        <div><span className="text-slate-400">Project:</span> <span className="text-slate-700 font-medium">{log.project_name}</span></div>
                      )}
                      {log.project_number && (
                        <div><span className="text-slate-400">Ref:</span> <span className="text-slate-700 font-mono">{log.project_number}</span></div>
                      )}
                      <div><span className="text-slate-400">Matched job:</span> <span className="text-slate-700 font-medium">{log.matched_job_name || '—'}</span></div>
                      <div><span className="text-slate-400">Job ref:</span> <span className="text-slate-700 font-mono">{log.matched_job_reference || (log.created_job ? 'auto-created' : 'no match')}</span></div>
                      {log.log_count != null && (
                        <div><span className="text-slate-400">{log.outcome === 'deleted' ? 'Removed:' : 'Logs:'}</span> <span className="text-slate-700 tabular-nums">{log.log_count}</span></div>
                      )}
                    </div>

                    {Array.isArray(log.group_summary) && log.group_summary.length > 0 ? (
                      <div>
                        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">AGS groups parsed</p>
                        <div className="flex flex-wrap gap-1.5">
                          {log.group_summary.map((g, i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 rounded text-[11px]">
                              <span className="font-mono font-semibold text-slate-700">{g.name}</span>
                              <span className="text-slate-400">·</span>
                              <span className="text-slate-500 tabular-nums">{g.row_count}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No AGS groups parsed.</p>
                    )}

                    {log.summary && <p className="text-xs text-slate-600">{log.summary}</p>}
                    {log.error && <p className="text-xs text-red-600">Error: {log.error}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}