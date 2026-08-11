import React, { useState } from 'react';
import { AlertTriangle, Package, CheckCircle2, Loader2, X, Camera, Ruler, FileCheck, MapPin } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * Decommissioning Banner — shown at the top of the job context view when a
 * job is in 'decommissioning' status. Displays the equipment removal progress
 * ring and provides the "Finish Job" / "Mark Complete" action.
 *
 * Props:
 *   job: the job record
 *   onUpdated: callback after status change
 */
export default function DecommissioningBanner({ job, onUpdated }) {
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const queryClient = useQueryClient();

  // Fetch cost items to calculate return progress
  const { data: costItems = [] } = useQuery({
    queryKey: ['job-cost-items', job?.id],
    queryFn: () => base44.entities.JobCostItem.filter({ job_id: job.id }),
    enabled: !!job?.id && job?.status === 'decommissioning',
  });

  if (!job || job.status !== 'decommissioning') return null;

  const onSiteItems = costItems.filter(ci => ci.current_location === 'site');
  const returnedItems = costItems.filter(ci => ci.current_location === 'returned' || ci.current_location === 'yard');
  const totalItems = costItems.length;
  const returnedCount = returnedItems.length;
  const progress = totalItems > 0 ? Math.round((returnedCount / totalItems) * 100) : 100;
  const allReturned = onSiteItems.length === 0;

  return (
    <>
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-xl p-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center flex-shrink-0 shadow-sm">
            <AlertTriangle className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h3 className="text-sm font-bold text-amber-900">Equipment Removal Required</h3>
                <p className="text-xs text-amber-700 mt-0.5">
                  {allReturned
                    ? 'All equipment returned — ready to complete the job.'
                    : `${onSiteItems.length} item${onSiteItems.length === 1 ? '' : 's'} still on site — collection tasks have been generated.`}
                </p>
              </div>
              {/* Progress Ring */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="relative w-12 h-12">
                  <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15" fill="none" stroke="#fde68a" strokeWidth="3" />
                    <circle
                      cx="18" cy="18" r="15" fill="none" stroke="#f59e0b" strokeWidth="3"
                      strokeDasharray={`${(progress / 100) * 94.2} 94.2`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-amber-700">{progress}%</span>
                  </div>
                </div>
                <span className="text-xs text-amber-700 font-medium whitespace-nowrap">
                  {returnedCount}/{totalItems} returned
                </span>
              </div>
            </div>

            {allReturned ? (
              <button
                onClick={() => setShowCompleteModal(true)}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition"
              >
                <CheckCircle2 className="w-4 h-4" />
                Complete Job & Sign Off
              </button>
            ) : (
              <div className="mt-3 flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-600" />
                <span className="text-xs text-amber-700">
                  Waiting for {onSiteItems.length} collection task{onSiteItems.length === 1 ? '' : 's'} to be completed.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {showCompleteModal && (
        <CompleteJobModal
          job={job}
          onClose={() => setShowCompleteModal(false)}
          onCompleted={() => {
            setShowCompleteModal(false);
            queryClient.invalidateQueries({ queryKey: ['job-cost-items', job.id] });
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            if (onUpdated) onUpdated();
          }}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Complete Job Modal — final inspection checklist
// ---------------------------------------------------------------------------
function CompleteJobModal({ job, onClose, onCompleted }) {
  const [checklist, setChecklist] = useState({
    photos_uploaded: false,
    final_meters_recorded: false,
    site_handback_confirmed: false,
    final_notes: '',
    handback_contact_name: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleComplete = async () => {
    setSaving(true);
    setError(null);
    try {
      await base44.functions.invoke('completeDecommissioning', {
        job_id: job.id,
        checklist,
      });
      onCompleted();
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Failed to complete job';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const checklistItems = [
    { key: 'photos_uploaded', label: 'Site photos uploaded', icon: Camera },
    { key: 'final_meters_recorded', label: 'Final meters recorded', icon: Ruler },
    { key: 'site_handback_confirmed', label: 'Site handback confirmed', icon: MapPin },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain p-4 bg-slate-950/60 backdrop-blur-md" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">Final Inspection — {job?.name}</h2>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-2">
            {checklistItems.map(item => {
              const Icon = item.icon;
              return (
                <label key={item.key} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
                  <input
                    type="checkbox"
                    checked={checklist[item.key]}
                    onChange={(e) => setChecklist(prev => ({ ...prev, [item.key]: e.target.checked }))}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <Icon className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-700">{item.label}</span>
                </label>
              );
            })}
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Handback contact name</label>
            <input
              type="text"
              value={checklist.handback_contact_name}
              onChange={(e) => setChecklist(prev => ({ ...prev, handback_contact_name: e.target.value }))}
              placeholder="Who signed off the site handback?"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Final notes</label>
            <textarea
              value={checklist.final_notes}
              onChange={(e) => setChecklist(prev => ({ ...prev, final_notes: e.target.value }))}
              rows={3}
              placeholder="Any final notes about the job completion..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleComplete}
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm font-medium flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Mark Job Complete
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