import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Copy, Loader2, AlertTriangle, Check } from 'lucide-react';
import { format, addDays, startOfWeek } from 'date-fns';

/**
 * "Copy last week's rota" button. Duplicates all assignments from the
 * previous week to the target week, shifting dates by 7 days. Shows a
 * conflict preview (staff already assigned on target dates) before applying.
 */
export default function TemplateWeekCopy({ targetWeekStart, onDone }) {
  const { toast } = useToast();
  const [showPreview, setShowPreview] = useState(false);
  const [copying, setCopying] = useState(false);

  const prevWeekStart = format(addDays(new Date(targetWeekStart), -7), 'yyyy-MM-dd');

  const { data: prevWeekRotas = [], isLoading } = useQuery({
    queryKey: ['rotas-prev-week', prevWeekStart],
    queryFn: () => base44.entities.RotaAssignment.filter({ week_start: prevWeekStart }, '-assigned_date', 500),
    enabled: showPreview,
  });

  const { data: targetWeekRotas = [] } = useQuery({
    queryKey: ['rotas-target-week', targetWeekStart],
    queryFn: () => base44.entities.RotaAssignment.filter({ week_start: targetWeekStart }, '-assigned_date', 500),
    enabled: showPreview,
  });

  // Detect conflicts: staff already assigned on the same date in the target week
  const conflicts = (() => {
    if (!prevWeekRotas.length || !targetWeekRotas.length) return [];
    const targetSet = new Set(targetWeekRotas.map(r => `${r.staff_id}_${r.assigned_date}`));
    return prevWeekRotas
      .filter(r => targetSet.has(`${r.staff_id}_${r.assigned_date}`))
      .map(r => ({ staff_id: r.staff_id, date: r.assigned_date }));
  })();

  const handleCopy = async () => {
    setCopying(true);
    try {
      const newRotas = prevWeekRotas.map(r => ({
        staff_id: r.staff_id,
        job_id: r.job_id,
        assigned_date: format(addDays(new Date(r.assigned_date), 7), 'yyyy-MM-dd'),
        week_start: targetWeekStart,
        vehicle_id: r.vehicle_id,
        rig_asset_id: r.rig_asset_id,
        assignment_type: r.assignment_type || 'job',
        non_job_label: r.non_job_label,
        status: 'assigned',
        start_time: r.start_time,
        end_time: r.end_time,
      }));

      // Batch create (skip conflicting ones)
      const toCreate = conflicts.length > 0
        ? newRotas.filter(nr => !conflicts.some(c => c.staff_id === nr.staff_id && c.date === nr.assigned_date))
        : newRotas;

      if (toCreate.length === 0) {
        toast({ title: 'Nothing to copy — all assignments conflict', variant: 'destructive' });
        setShowPreview(false);
        return;
      }

      for (let i = 0; i < toCreate.length; i += 20) {
        await base44.entities.RotaAssignment.bulkCreate(toCreate.slice(i, i + 20));
      }

      toast({
        title: `${toCreate.length} assignments copied`,
        description: conflicts.length > 0 ? `${conflicts.length} skipped due to conflicts` : undefined,
      });
      setShowPreview(false);
      onDone?.();
    } catch (err) {
      toast({ title: 'Failed to copy rota', description: err.message, variant: 'destructive' });
    } finally {
      setCopying(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowPreview(true)}
        className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
      >
        <Copy className="w-4 h-4" />
        <span className="hidden sm:inline">Copy Last Week</span>
      </button>

      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                <Copy className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Copy Last Week's Rota</h2>
                <p className="text-xs text-slate-500">From {format(new Date(prevWeekStart), 'dd MMM')} to {format(new Date(targetWeekStart), 'dd MMM')}</p>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : prevWeekRotas.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-slate-400">No assignments found in the previous week.</p>
              </div>
            ) : (
              <>
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-emerald-500" />
                    <span className="text-slate-700">
                      <span className="font-bold">{prevWeekRotas.length}</span> assignments to copy
                    </span>
                  </div>
                  {conflicts.length > 0 && (
                    <div className="flex items-start gap-2 text-sm bg-amber-50 rounded-lg px-3 py-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      <span className="text-amber-800">
                        <span className="font-bold">{conflicts.length}</span> conflict{conflicts.length !== 1 ? 's' : ''} — these will be skipped (staff already assigned)
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button onClick={() => setShowPreview(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition">
                    Cancel
                  </button>
                  <button
                    onClick={handleCopy}
                    disabled={copying || prevWeekRotas.length === 0}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {copying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                    {copying ? 'Copying...' : 'Copy Rota'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}