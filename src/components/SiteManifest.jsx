import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Warehouse, Truck, MapPin, PackageCheck, Boxes, Loader2, CheckCircle2,
  ArrowRight, AlertTriangle, Package
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const locationConfig = {
  yard: { label: 'At Depot', icon: Warehouse, color: 'text-slate-600', bg: 'bg-slate-100', ring: 'ring-slate-200', bar: 'bg-slate-400' },
  in_transit: { label: 'In Transit', icon: Truck, color: 'text-blue-600', bg: 'bg-blue-50', ring: 'ring-blue-200', bar: 'bg-blue-500' },
  site: { label: 'On Site', icon: MapPin, color: 'text-emerald-600', bg: 'bg-emerald-50', ring: 'ring-emerald-200', bar: 'bg-emerald-500' },
  returned: { label: 'Returned', icon: PackageCheck, color: 'text-teal-600', bg: 'bg-teal-50', ring: 'ring-teal-200', bar: 'bg-teal-500' },
};

const locationOrder = ['yard', 'in_transit', 'site', 'returned'];

export default function SiteManifest({ jobId, job, suppliers = [], contractors = [], isDecommissioning }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [updatingIds, setUpdatingIds] = useState(new Set());
  const [returnDestFor, setReturnDestFor] = useState(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['job-cost-items-manifest', jobId],
    queryFn: () => base44.entities.JobCostItem.filter({ job_id: jobId }),
    enabled: !!jobId
  });

  const counts = locationOrder.reduce((acc, loc) => {
    acc[loc] = items.filter(i => (i.current_location || 'yard') === loc).length;
    return acc;
  }, {});
  const total = items.length;
  const collectedPct = total > 0 ? Math.round((counts.returned / total) * 100) : 0;
  const onSitePct = total > 0 ? Math.round((counts.site / total) * 100) : 0;

  const updateLocation = async (itemId, newLocation, returnDestination = '') => {
    setUpdatingIds(prev => new Set(prev).add(itemId));
    try {
      const payload = {
        current_location: newLocation,
        location_updated_at: new Date().toISOString()
      };
      if (returnDestination) payload.return_destination = returnDestination;
      if (newLocation === 'returned') {
        payload.hire_status = 'off_hired';
        payload.off_hire_date = new Date().toISOString().split('T')[0];
      }
      await base44.entities.JobCostItem.update(itemId, payload);
      queryClient.invalidateQueries({ queryKey: ['job-cost-items-manifest', jobId] });
      queryClient.invalidateQueries({ queryKey: ['job-cost-items', jobId] });
      queryClient.invalidateQueries({ queryKey: ['job-cost-items-delivery', jobId] });
    } catch (e) {
      console.error('Location update error:', e);
      toast({ title: 'Error', description: 'Could not update item location.' });
    } finally {
      setUpdatingIds(prev => { const s = new Set(prev); s.delete(itemId); return s; });
    }
  };

  const handleReturn = (itemId, destination) => {
    updateLocation(itemId, 'returned', destination);
    setReturnDestFor(null);
  };

  const bulkCollectAll = async () => {
    const siteItems = items.filter(i => (i.current_location || 'yard') === 'site');
    if (siteItems.length === 0) return;
    setUpdatingIds(new Set(siteItems.map(i => i.id)));
    try {
      const now = new Date().toISOString();
      await base44.entities.JobCostItem.bulkUpdate(
        siteItems.map(i => ({
          id: i.id,
          current_location: 'returned',
          return_destination: i.supplier_id || 'depot',
          location_updated_at: now,
          hire_status: 'off_hired',
          off_hire_date: now.split('T')[0]
        }))
      );
      queryClient.invalidateQueries({ queryKey: ['job-cost-items-manifest', jobId] });
      queryClient.invalidateQueries({ queryKey: ['job-cost-items', jobId] });
      queryClient.invalidateQueries({ queryKey: ['job-cost-items-delivery', jobId] });
      toast({ title: 'All items collected', description: `${siteItems.length} items marked as returned to depot/supplier.` });
    } catch (e) {
      console.error('Bulk collect error:', e);
      toast({ title: 'Error', description: 'Could not collect all items.' });
    } finally {
      setUpdatingIds(new Set());
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
        <Boxes className="w-10 h-10 text-slate-300 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-600">No equipment tracked yet</p>
        <p className="text-xs text-slate-400 mt-1">Add equipment in the Costing section to start tracking its lifecycle.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <Boxes className="w-5 h-5 text-emerald-700" />
        <h2 className="font-semibold text-slate-900">Site Manifest</h2>
        <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">{total} items</span>
      </div>

      {/* Lifecycle progress bar */}
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Asset Lifecycle</span>
          {isDecommissioning && (
            <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">Decommissioning — {collectedPct}% collected</span>
          )}
        </div>
        {/* Stacked bar */}
        <div className="flex h-3 rounded-full overflow-hidden bg-slate-100">
          {locationOrder.map(loc => {
            const pct = total > 0 ? (counts[loc] / total) * 100 : 0;
            if (pct === 0) return null;
            const cfg = locationConfig[loc];
            return <div key={loc} className={cfg.bar} style={{ width: `${pct}%` }} title={`${cfg.label}: ${counts[loc]}`} />;
          })}
        </div>
        {/* Legend with counts */}
        <div className="flex flex-wrap gap-3 mt-2.5">
          {locationOrder.map(loc => {
            const cfg = locationConfig[loc];
            const Icon = cfg.icon;
            return (
              <div key={loc} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${cfg.bar}`} />
                <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                <span className="text-xs font-medium text-slate-600">{cfg.label}</span>
                <span className="text-xs font-bold text-slate-900">{counts[loc]}</span>
              </div>
            );
          })}
        </div>
        {isDecommissioning && counts.site > 0 && (
          <div className="mt-3 flex items-center justify-between gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span><b>{counts.site}</b> item{counts.site !== 1 ? 's' : ''} still on site — collect to finish decommissioning</span>
            </div>
            <button onClick={bulkCollectAll} className="px-2.5 py-1 bg-orange-600 text-white rounded-lg text-xs font-semibold hover:bg-orange-700 transition flex-shrink-0 whitespace-nowrap">
              Collect All
            </button>
          </div>
        )}
        {isDecommissioning && counts.site === 0 && counts.returned === total && (
          <div className="mt-3 flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
            <span>All equipment collected — site is clear</span>
          </div>
        )}
      </div>

      {/* Item list */}
      <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
        {items.map(item => {
          const loc = item.current_location || 'yard';
          const cfg = locationConfig[loc];
          const Icon = cfg.icon;
          const isUpdating = updatingIds.has(item.id);
          const supplier = item.supplier_id ? suppliers.find(s => s.id === item.supplier_id) : null;
          const showReturnPrompt = returnDestFor === item.id;

          return (
            <div key={item.id} className="px-4 py-3 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-4 h-4 ${cfg.color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 truncate">{item.description}</p>
                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.color} ring-1 ${cfg.ring}`}>{cfg.label}</span>
                  {item.reference_number && <span className="text-[10px] text-slate-400 font-mono">Ref: {item.reference_number}</span>}
                  {item.po_number && <span className="text-[10px] text-slate-400 font-mono inline-flex items-center gap-0.5"><Package className="w-2.5 h-2.5" />{item.po_number}</span>}
                  {supplier && <span className="text-[10px] text-slate-400">{supplier.name}</span>}
                  {loc === 'returned' && item.return_destination && (
                    <span className="text-[10px] text-teal-600 font-medium">
                      → {item.return_destination === 'depot' ? 'Depot' : suppliers.find(s => s.id === item.return_destination)?.name || contractors.find(c => c.id === item.return_destination)?.name || 'Returned'}
                    </span>
                  )}
                </div>
              </div>
              {/* Quick action buttons */}
              {isUpdating ? (
                <Loader2 className="w-4 h-4 text-slate-400 animate-spin flex-shrink-0" />
              ) : showReturnPrompt ? (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => handleReturn(item.id, 'depot')} className="text-[10px] px-2 py-1 rounded-lg bg-slate-700 text-white font-medium hover:bg-slate-800">Depot</button>
                  {supplier && <button onClick={() => handleReturn(item.id, supplier.id)} className="text-[10px] px-2 py-1 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700">Supplier</button>}
                  <button onClick={() => setReturnDestFor(null)} className="text-[10px] px-1.5 py-1 rounded-lg text-slate-400 hover:text-slate-600">✕</button>
                </div>
              ) : (
                <div className="flex items-center gap-1 flex-shrink-0">
                  {loc === 'yard' && (
                    <button onClick={() => updateLocation(item.id, 'in_transit')} className="text-[10px] px-2 py-1 rounded-lg bg-blue-50 text-blue-700 font-medium hover:bg-blue-100 transition inline-flex items-center gap-0.5">
                      <Truck className="w-3 h-3" /> Load
                    </button>
                  )}
                  {loc === 'in_transit' && (
                    <button onClick={() => updateLocation(item.id, 'site')} className="text-[10px] px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-medium hover:bg-emerald-100 transition inline-flex items-center gap-0.5">
                      <MapPin className="w-3 h-3" /> Drop
                    </button>
                  )}
                  {loc === 'site' && (
                    <button onClick={() => setReturnDestFor(item.id)} className="text-[10px] px-2 py-1 rounded-lg bg-teal-50 text-teal-700 font-medium hover:bg-teal-100 transition inline-flex items-center gap-0.5">
                      <PackageCheck className="w-3 h-3" /> Collect
                    </button>
                  )}
                  {loc === 'returned' && (
                    <button onClick={() => updateLocation(item.id, 'site')} className="text-[10px] px-2 py-1 rounded-lg text-slate-400 hover:text-slate-600 font-medium">
                      Revert
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}