import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, Loader2, AlertTriangle, X, FileCheck } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';

// One-click bulk delivery reconciliation — shows all pending delivery legs
// that have photo + signature verification, and lets admins fast-approve them
// in bulk instead of clicking through each one individually.

export default function BulkDeliveryReconciliation({ jobId }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(new Set());
  const [approving, setApproving] = useState(false);

  const { data: legs = [], isLoading } = useQuery({
    queryKey: ['bulk-recon-legs', jobId],
    queryFn: () => base44.entities.DeliveryLeg.filter({
      ...(jobId ? { job_id: jobId } : {}),
      status: 'in_transit',
    }),
  });

  // Legs that have proof (photo + signature) — eligible for fast-approve
  const eligibleLegs = legs.filter(l => l.photo_url && l.signature_url);
  const incompleteLegs = legs.filter(l => !l.photo_url || !l.signature_url);

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(eligibleLegs.map(l => l.id)));
  };

  const clearAll = () => setSelected(new Set());

  const handleBulkApprove = async () => {
    if (selected.size === 0) return;
    setApproving(true);
    try {
      const toUpdate = Array.from(selected).map(id => ({ id, status: 'complete' }));
      await base44.entities.DeliveryLeg.bulkUpdate(toUpdate);
      toast({ title: `✓ ${toUpdate.length} deliveries reconciled`, description: 'All selected legs marked complete.' });
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ['bulk-recon-legs'] });
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setApproving(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-slate-300 animate-spin" /></div>;
  }

  if (legs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <FileCheck className="w-8 h-8 text-slate-200 mb-2" />
        <p className="text-sm font-medium text-slate-400">No deliveries pending reconciliation</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-600">
            <strong className="text-emerald-600">{eligibleLegs.length}</strong> ready to approve
          </span>
          {incompleteLegs.length > 0 && (
            <span className="text-slate-600">
              <strong className="text-amber-600">{incompleteLegs.length}</strong> missing proof
            </span>
          )}
          <span className="text-slate-600">
            <strong className="text-blue-600">{selected.size}</strong> selected
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={selectAll} disabled={eligibleLegs.length === 0}>
            Select All Ready
          </Button>
          <Button size="sm" variant="outline" onClick={clearAll} disabled={selected.size === 0}>
            Clear
          </Button>
          <Button
            size="sm"
            onClick={handleBulkApprove}
            disabled={selected.size === 0 || approving}
            className="bg-emerald-700 hover:bg-emerald-800 text-white"
          >
            {approving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
            Fast-Approve ({selected.size})
          </Button>
        </div>
      </div>

      {/* Eligible legs */}
      {eligibleLegs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Ready to Approve</p>
          {eligibleLegs.map(leg => (
            <label
              key={leg.id}
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                selected.has(leg.id) ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has(leg.id)}
                onChange={() => toggleSelect(leg.id)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">
                  {leg.asset_name || 'Delivery'} → {leg.to_location || 'Site'}
                </p>
                <p className="text-xs text-slate-500">
                  Driver: {leg.driver_name || '—'} · {leg.vehicle_name || '—'}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-emerald-600">
                {leg.photo_url && <span title="Photo proof">📷</span>}
                {leg.signature_url && <span title="Signature">✍️</span>}
              </div>
            </label>
          ))}
        </div>
      )}

      {/* Incomplete legs */}
      {incompleteLegs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Missing Proof</p>
          {incompleteLegs.map(leg => (
            <div key={leg.id} className="flex items-center gap-3 p-3 rounded-xl border bg-amber-50/50 border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">
                  {leg.asset_name || 'Delivery'} → {leg.to_location || 'Site'}
                </p>
                <p className="text-xs text-amber-600">
                  Missing: {!leg.photo_url && 'photo'} {!leg.photo_url && !leg.signature_url && '·'} {!leg.signature_url && 'signature'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}