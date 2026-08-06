import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { PackageCheck, PackageX, Truck, RotateCcw, Loader2, Info } from 'lucide-react';
import WidgetShell from '@/components/dashboard/WidgetShell';
import { Skeleton } from '@/components/StateViews';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';

export default function OffHireReconciliationWidget({ jobId }) {
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const { data: costItems = [], isLoading } = useQuery({
    queryKey: ['off-hire-items', jobId],
    queryFn: () => base44.entities.JobCostItem.filter({ job_id: jobId }),
    enabled: !!jobId,
  });

  if (!jobId) {
    return (
      <WidgetShell title="Off-Hire Reconciliation" subtitle="Gear return tracking" icon={RotateCcw}>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Info className="w-8 h-8 text-slate-300 mb-2" />
          <p className="text-sm text-slate-400">Select a job to view gear reconciliation.</p>
        </div>
      </WidgetShell>
    );
  }

  if (isLoading) {
    return (
      <WidgetShell title="Off-Hire Reconciliation" subtitle="Gear return tracking" icon={RotateCcw}>
        <Skeleton className="h-32 rounded-xl" />
      </WidgetShell>
    );
  }

  const gearItems = costItems.filter(
    ci => ci.category === 'hired_equipment' || ci.category === 'internal_equipment'
  );
  const returned = gearItems.filter(
    ci => ci.current_location === 'returned' ||
          (ci.current_location === 'yard' && ci.hire_status === 'off_hired')
  );
  const onSite = gearItems.filter(ci => ci.current_location === 'site');
  const inTransit = gearItems.filter(ci => ci.current_location === 'in_transit');

  const handleProcess = async () => {
    setProcessing(true);
    try {
      const res = await base44.functions.invoke('processOffHire', { job_id: jobId });
      toast({
        title: 'Off-hire processed',
        description: `${res.data?.off_hired_now || 0} item(s) marked as returned`,
      });
      queryClient.invalidateQueries({ queryKey: ['off-hire-items'] });
    } catch (e) {
      toast({ title: 'Could not process', description: e.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <WidgetShell
      title="Off-Hire Reconciliation"
      subtitle={`${returned.length} returned · ${onSite.length} on site · ${inTransit.length} in transit`}
      icon={RotateCcw}
    >
      <div className="space-y-3">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-emerald-50 rounded-lg p-2.5 text-center ring-1 ring-emerald-200">
            <PackageCheck className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
            <p className="text-lg font-bold text-emerald-700 tabular-nums">{returned.length}</p>
            <p className="text-[10px] text-emerald-600 font-medium">Returned</p>
          </div>
          <div className="bg-rose-50 rounded-lg p-2.5 text-center ring-1 ring-rose-200">
            <PackageX className="w-5 h-5 text-rose-600 mx-auto mb-1" />
            <p className="text-lg font-bold text-rose-700 tabular-nums">{onSite.length}</p>
            <p className="text-[10px] text-rose-600 font-medium">On Site</p>
          </div>
          <div className="bg-amber-50 rounded-lg p-2.5 text-center ring-1 ring-amber-200">
            <Truck className="w-5 h-5 text-amber-600 mx-auto mb-1" />
            <p className="text-lg font-bold text-amber-700 tabular-nums">{inTransit.length}</p>
            <p className="text-[10px] text-amber-600 font-medium">In Transit</p>
          </div>
        </div>

        {/* Process button */}
        {isAdmin && onSite.length > 0 && (
          <button
            onClick={handleProcess}
            disabled={processing}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition"
          >
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
            {processing ? 'Processing...' : 'Process Off-Hire'}
          </button>
        )}

        {/* Items still on site */}
        {onSite.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Still on Site</p>
            {onSite.map(ci => (
              <div key={ci.id} className="flex items-center gap-2 bg-rose-50 rounded-lg px-3 py-2 ring-1 ring-rose-200">
                <div className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0" />
                <span className="text-sm text-slate-700 flex-1 truncate">{ci.description}</span>
                <span className="text-[10px] font-medium text-rose-600">
                  {ci.category === 'hired_equipment' ? 'Hired' : 'Owned'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Returned items */}
        {returned.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Returned</p>
            {returned.slice(0, 5).map(ci => (
              <div key={ci.id} className="flex items-center gap-2 bg-emerald-50 rounded-lg px-3 py-2 ring-1 ring-emerald-200">
                <PackageCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span className="text-sm text-slate-700 flex-1 truncate">{ci.description}</span>
                {ci.off_hire_date && (
                  <span className="text-[10px] text-slate-400">{ci.off_hire_date}</span>
                )}
              </div>
            ))}
            {returned.length > 5 && (
              <p className="text-xs text-slate-400 text-center">+{returned.length - 5} more returned</p>
            )}
          </div>
        )}

        {gearItems.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">No gear items for this job.</p>
        )}
      </div>
    </WidgetShell>
  );
}