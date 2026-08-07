import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { RotateCcw, Truck, MapPin, Clock, ArrowRight, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import WidgetShell from '@/components/dashboard/WidgetShell';

/**
 * IdleAssetTransferWidget — the "Zero-Idle" engine.
 * Cross-references idle assets (in depot, not assigned) with upcoming
 * delivery legs. Suggests auto-generated transfer legs to move idle
 * assets to where they're needed, reducing yard dwell time.
 */
export default function IdleAssetTransferWidget({ onNavigate }) {
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);

  const { data: assets = [], isLoading: assetsLoading } = useQuery({
    queryKey: ['idle-transfer-assets'],
    queryFn: () => base44.entities.SiteAsset.filter({ is_active: true }),
  });
  const { data: deliveries = [], isLoading: deliveriesLoading } = useQuery({
    queryKey: ['idle-transfer-deliveries'],
    queryFn: () => base44.entities.DeliveryLog.filter({ status: 'pending' }),
  });
  const { data: assignments = [] } = useQuery({
    queryKey: ['idle-transfer-assignments'],
    queryFn: () => base44.entities.JobAssetAssignment.filter({ status: 'assigned' }),
  });

  const suggestions = useMemo(() => {
    // Find assets that are in the yard/depot (storage_location contains depot/yard)
    // and NOT currently assigned to any active job
    const assignedAssetIds = new Set(assignments.map(a => a.asset_id));
    const idleAssets = assets.filter(a =>
      !assignedAssetIds.has(a.id) &&
      a.storage_location &&
      /depot|yard|dartford/i.test(a.storage_location)
    );

    // Find upcoming deliveries that need assets not yet collected
    const upcomingDeliveries = deliveries.filter(d => {
      const deliveryDate = new Date(d.scheduled_date || d.created_date);
      const now = new Date();
      const diffDays = (deliveryDate - now) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 3; // within 3 days
    });

    // Match idle assets to upcoming deliveries by asset_id
    const matched = [];
    for (const delivery of upcomingDeliveries) {
      const asset = idleAssets.find(a => a.id === delivery.asset_id || a.name === delivery.asset_name);
      if (asset) {
        matched.push({
          asset,
          delivery,
          urgency: new Date(delivery.scheduled_date || delivery.created_date).getTime() - Date.now() < 24 * 3600 * 1000 ? 'urgent' : 'soon',
        });
      }
    }

    // Also find idle assets with no upcoming delivery but high utilization history
    const unmatchedIdle = idleAssets
      .filter(a => !matched.some(m => m.asset.id === a.id))
      .slice(0, 3)
      .map(asset => ({ asset, delivery: null, urgency: 'low' }));

    return { matched, unmatchedIdle, totalIdle: idleAssets.length };
  }, [assets, deliveries, assignments]);

  const handleAutoGenerate = async () => {
    setGenerating(true);
    try {
      const res = await base44.functions.invoke('autoGenerateTransferLegs', {});
      setResult(res.data);
    } catch (e) {
      setResult({ error: e.message });
    } finally {
      setGenerating(false);
    }
  };

  const isLoading = assetsLoading || deliveriesLoading;

  return (
    <WidgetShell icon={RotateCcw} title="Idle Asset Transfers" subtitle="Zero-Idle engine — match yard assets to upcoming deliveries">
      <div className="space-y-3">
        {/* Summary bar */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center flex-shrink-0">
            <Truck className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-slate-900">{suggestions.totalIdle} idle assets in yard</p>
            <p className="text-xs text-slate-500">{suggestions.matched.length} matched to deliveries · {suggestions.unmatchedIdle.length} available for reassignment</p>
          </div>
          <button onClick={handleAutoGenerate} disabled={generating || suggestions.matched.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg command-gradient text-white text-xs font-semibold disabled:opacity-50 transition active:scale-95">
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            Auto-Generate
          </button>
        </div>

        {/* Result feedback */}
        {result && (
          <div className={`flex items-center gap-2 p-2.5 rounded-lg text-xs ${result.error ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
            {result.error ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            {result.error || `${result.created || 0} transfer legs created`}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
        ) : suggestions.matched.length === 0 && suggestions.unmatchedIdle.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-300 mb-2" />
            <p className="text-sm text-slate-500">All assets deployed — no idle transfers needed</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {/* Matched suggestions */}
            {suggestions.matched.map((s, i) => (
              <div key={i} className={`flex items-center gap-2.5 p-2.5 rounded-lg border ${s.urgency === 'urgent' ? 'border-rose-200 bg-rose-50/50' : 'border-slate-200 bg-slate-50/50'}`}>
                <div className={`w-2 h-2 rounded-full ${s.urgency === 'urgent' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate">{s.asset.name}</p>
                  <p className="text-[11px] text-slate-500 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {s.asset.storage_location}
                    <ArrowRight className="w-3 h-3" />
                    {s.delivery?.to_location || 'Site'}
                  </p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.urgency === 'urgent' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                  {s.urgency === 'urgent' ? 'URGENT' : 'SOON'}
                </span>
              </div>
            ))}
            {/* Unmatched idle */}
            {suggestions.unmatchedIdle.map((s, i) => (
              <div key={`unmatched-${i}`} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-200 bg-slate-50/30">
                <div className="w-2 h-2 rounded-full bg-slate-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-600 truncate">{s.asset.name}</p>
                  <p className="text-[11px] text-slate-400">Idle at {s.asset.storage_location} — no upcoming delivery</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">AVAILABLE</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </WidgetShell>
  );
}