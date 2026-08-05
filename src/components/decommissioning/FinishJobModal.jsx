import React, { useState } from 'react';
import { AlertTriangle, Loader2, Package, Truck, X, CheckCircle2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * Finish Job Modal — triggered from the job context view when a manager
 * clicks "Finish Job". Calls the startDecommissioning backend function which:
 *   1. Transitions the job to 'decommissioning' status
 *   2. Auto-generates collection delivery logs for all on-site equipment
 *
 * Props:
 *   job: the job record
 *   onClose: callback to close the modal
 *   onStarted: callback after decommissioning is started (refreshes data)
 */
export default function FinishJobModal({ job, onClose, onStarted }) {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);
  const queryClient = useQueryClient();

  // Preview on-site items
  const { data: costItems = [], isLoading } = useQuery({
    queryKey: ['job-cost-items', job?.id],
    queryFn: () => base44.entities.JobCostItem.filter({ job_id: job.id }),
    enabled: !!job?.id,
  });

  const onSiteItems = costItems.filter(ci => ci.current_location === 'site');

  const handleStart = async () => {
    setStarting(true);
    setError(null);
    try {
      await base44.functions.invoke('startDecommissioning', { job_id: job.id });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job-cost-items', job.id] });
      if (onStarted) onStarted();
      onClose();
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Failed to start decommissioning';
      setError(msg);
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Finish Job — Start Decommissioning</h2>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-600">
            This will transition <span className="font-semibold text-slate-900">{job?.name}</span> to
            <span className="font-semibold text-amber-700"> decommissioning</span> status.
            Work is complete and all equipment needs to be collected from site.
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-amber-600" />
              <p className="text-xs font-semibold text-amber-800">What happens next</p>
            </div>
            <ul className="space-y-1.5 text-xs text-amber-700">
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>Job status changes to <strong>Decommissioning</strong></span>
              </li>
              <li className="flex items-start gap-1.5">
                <Truck className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>Collection tasks are auto-generated for all <strong>{onSiteItems.length} on-site item{onSiteItems.length === 1 ? '' : 's'}</strong></span>
              </li>
              <li className="flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>New billable items are <strong>locked</strong> — no more costs can be added</span>
              </li>
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>Once all items are returned, you can mark the job <strong>Complete</strong></span>
              </li>
            </ul>
          </div>

          {onSiteItems.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-slate-700 mb-2">Items to collect ({onSiteItems.length})</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {onSiteItems.slice(0, 8).map(ci => (
                  <div key={ci.id} className="flex items-center gap-2 text-xs text-slate-600">
                    <Package className="w-3 h-3 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{ci.description}</span>
                  </div>
                ))}
                {onSiteItems.length > 8 && (
                  <p className="text-xs text-slate-400 pt-1">+{onSiteItems.length - 8} more...</p>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleStart}
              disabled={starting || isLoading}
              className="flex-1 px-4 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm font-medium flex items-center justify-center gap-2"
            >
              {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
              Start Decommissioning
            </button>
            <button onClick={onClose} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition text-sm font-medium">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}