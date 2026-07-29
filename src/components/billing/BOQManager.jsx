import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  ClipboardList, Plus, Search, Loader2, Trash2, AlertTriangle,
  CheckCircle2, Clock, TrendingUp, RefreshCw, ArrowRight,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/StateViews';

const fmt = (n) => '£' + (Math.round((n || 0) * 100) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtQty = (n) => (Math.round((n || 0) * 10) / 10).toLocaleString('en-GB');

const STATUS_META = {
  not_started: { label: 'Not Started', icon: Clock, cls: 'bg-slate-100 text-slate-600' },
  in_progress: { label: 'In Progress', icon: TrendingUp, cls: 'bg-blue-100 text-blue-700' },
  complete: { label: 'Complete', icon: CheckCircle2, cls: 'bg-[#2E5A1A]/15 text-[#2E5A1A]' },
  variation: { label: 'Variation', icon: ArrowRight, cls: 'bg-violet-100 text-violet-700' },
  overrun: { label: 'Overrun', icon: AlertTriangle, cls: 'bg-rose-100 text-rose-700' },
};

export default function BOQManager({ job }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [approvingId, setApprovingId] = useState(null);
  const [variationReason, setVariationReason] = useState({});

  const { data: boqLines = [], isLoading } = useQuery({
    queryKey: ['boq-lines', job.id],
    queryFn: () => base44.entities.JobBillOfQuantities.filter({ job_id: job.id }, 'sort_order'),
  });

  const { data: rateItems = [] } = useQuery({
    queryKey: ['boq-rate-items', job.project_id],
    queryFn: async () => {
      if (job.project_id) {
        const projectItems = await base44.entities.RateCardItem.filter({ project_id: job.project_id, is_active: true }, 'sort_order', 500);
        if (projectItems.length > 0) return projectItems;
      }
      return base44.entities.RateCardItem.filter({ rate_card_source: 'our_company', is_active: true }, 'sort_order', 500);
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return boqLines;
    return boqLines.filter((l) =>
      l.description?.toLowerCase().includes(q) ||
      l.sor_ref?.toLowerCase().includes(q) ||
      l.subcategory?.toLowerCase().includes(q)
    );
  }, [boqLines, search]);

  const totals = useMemo(() => {
    const agreed = boqLines.reduce((s, l) => s + (Number(l.agreed_line_total) || 0), 0);
    const actualValue = boqLines.reduce((s, l) =>
      s + (Number(l.actual_quantity) || 0) * (Number(l.agreed_unit_price) || 0), 0);
    const overrunCount = boqLines.filter((l) => l.status === 'overrun').length;
    return { agreed, actualValue, overrunCount, lineCount: boqLines.length };
  }, [boqLines]);

  const refreshVariations = async () => {
    setRefreshing(true);
    try {
      await base44.functions.invoke('checkBOQVariations', { job_id: job.id });
      queryClient.invalidateQueries({ queryKey: ['boq-lines', job.id] });
      toast({ title: 'BOQ updated', description: 'Actual quantities recalculated from logged work.' });
    } catch (e) {
      toast({ title: 'Refresh failed', description: e?.message, variant: 'destructive' });
    }
    setRefreshing(false);
  };

  const approveVariation = async (line) => {
    const reason = variationReason[line.id];
    if (!reason?.trim()) {
      toast({ title: 'Reason required', description: 'Enter a justification for the variation.', variant: 'destructive' });
      return;
    }
    setApprovingId(line.id);
    try {
      // Create a new variation BOQ line for the surplus
      await base44.entities.JobBillOfQuantities.create({
        job_id: job.id,
        project_id: job.project_id || null,
        rate_card_item_id: line.rate_card_item_id || null,
        sor_ref: line.sor_ref || '',
        description: `${line.description} — Variation`,
        category: line.category || 'labour',
        subcategory: line.subcategory || '',
        unit: line.unit || 'nr',
        agreed_quantity: Number(line.variation_quantity) || 0,
        agreed_unit_price: Number(line.agreed_unit_price) || 0,
        agreed_line_total: ((Number(line.variation_quantity) || 0) * (Number(line.agreed_unit_price) || 0)),
        actual_quantity: 0,
        remaining_quantity: Number(line.variation_quantity) || 0,
        variation_quantity: 0,
        status: 'complete',
        is_variation: true,
        variation_of_id: line.id,
        variation_reason: reason.trim(),
        approved_by_name: 'Current User',
        approved_at: new Date().toISOString(),
        sort_order: line.sort_order || 0,
      });
      // Mark the original line as 'variation' (approved)
      await base44.entities.JobBillOfQuantities.update(line.id, { status: 'variation' });
      queryClient.invalidateQueries({ queryKey: ['boq-lines', job.id] });
      setVariationReason((p) => ({ ...p, [line.id]: '' }));
      toast({ title: 'Variation approved', description: `+${fmtQty(line.variation_quantity)} ${line.unit || ''} added as approved scope.` });
    } catch (e) {
      toast({ title: 'Approval failed', description: e?.message, variant: 'destructive' });
    }
    setApprovingId(null);
  };

  const deleteLine = async (line) => {
    if (!confirm(`Remove "${line.description}" from the BOQ?`)) return;
    try {
      await base44.entities.JobBillOfQuantities.delete(line.id);
      queryClient.invalidateQueries({ queryKey: ['boq-lines', job.id] });
      toast({ title: 'BOQ line removed' });
    } catch (e) {
      toast({ title: 'Delete failed', description: e?.message, variant: 'destructive' });
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 flex-wrap">
        <div className="w-8 h-8 rounded-lg bg-[#2E5A1A]/10 flex items-center justify-center">
          <ClipboardList className="w-4 h-4 text-[#2E5A1A]" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 text-sm">Bill of Quantities</h3>
          <p className="text-xs text-slate-500">Contracted scope vs actual logged work — variations flagged automatically</p>
        </div>
        <button onClick={refreshVariations} disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-medium transition disabled:opacity-50">
          {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Refresh
        </button>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2E5A1A] text-white hover:bg-[#1c4a12] rounded-lg text-xs font-medium transition">
          <Plus className="w-3.5 h-3.5" /> Add Line
        </button>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 p-3 bg-slate-50 border-b border-slate-100">
        <div className="bg-white rounded-lg border border-slate-200 p-2.5">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">Contract Value</p>
          <p className="text-base font-bold text-slate-900">{fmt(totals.agreed)}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-2.5">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">Earned (Actual)</p>
          <p className="text-base font-bold text-[#2E5A1A]">{fmt(totals.actualValue)}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-2.5">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">BOQ Lines</p>
          <p className="text-base font-bold text-slate-900">{totals.lineCount}</p>
        </div>
        <div className={`rounded-lg border p-2.5 ${totals.overrunCount > 0 ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'}`}>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">Overruns</p>
          <p className={`text-base font-bold ${totals.overrunCount > 0 ? 'text-rose-700' : 'text-slate-900'}`}>{totals.overrunCount}</p>
        </div>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-slate-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search SOR ref, description or section…"
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5A1A]/30" />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="p-4 space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-slate-400 text-sm">
          <ClipboardList className="w-8 h-8 text-slate-200 mx-auto mb-2" />
          {boqLines.length === 0 ? 'No BOQ lines yet — add SOR items to define contracted scope.' : 'No lines match your search.'}
        </div>
      ) : (
        <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
          {filtered.map((line) => {
            const meta = STATUS_META[line.status] || STATUS_META.not_started;
            const StatusIcon = meta.icon;
            const pct = line.agreed_quantity > 0 ? Math.min(100, (line.actual_quantity / line.agreed_quantity) * 100) : 0;
            const isOver = line.status === 'overrun';
            return (
              <div key={line.id} className={`p-3 ${isOver ? 'bg-rose-50/50' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {line.sor_ref && <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-mono font-bold">{line.sor_ref}</span>}
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${meta.cls}`}>
                        <StatusIcon className="w-2.5 h-2.5" /> {meta.label}
                      </span>
                      {line.is_variation && <span className="px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded text-[10px] font-semibold">Variation</span>}
                    </div>
                    <p className="text-sm font-medium text-slate-800 truncate">{line.description}</p>
                    {line.subcategory && <p className="text-[11px] text-slate-400 truncate">{line.subcategory}</p>}
                    <div className="flex items-center gap-3 mt-1.5 text-xs">
                      <span className="text-slate-500">{fmtQty(line.actual_quantity)} / {fmtQty(line.agreed_quantity)} {line.unit || ''}</span>
                      <span className="text-slate-600 font-medium">@ {fmt(line.agreed_unit_price)}/{line.unit || 'ea'}</span>
                      <span className="font-semibold text-slate-900">{fmt((line.actual_quantity || 0) * (line.agreed_unit_price || 0))}</span>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${isOver ? 'bg-rose-500' : pct >= 100 ? 'bg-[#2E5A1A]' : 'bg-blue-500'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                  </div>
                  <button onClick={() => deleteLine(line)} disabled={line.is_variation}
                    className="p-1.5 text-slate-300 hover:text-rose-500 disabled:opacity-30 disabled:cursor-not-allowed transition">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Overrun approval panel */}
                {isOver && (
                  <div className="mt-2 p-2.5 bg-rose-50 border border-rose-200 rounded-lg">
                    <div className="flex items-center gap-1.5 mb-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      <p className="text-xs font-semibold text-rose-800">
                        Overrun: +{fmtQty(line.variation_quantity)} {line.unit || ''} beyond contracted scope
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={variationReason[line.id] || ''}
                        onChange={(e) => setVariationReason((p) => ({ ...p, [line.id]: e.target.value }))}
                        placeholder="Variation reason (e.g. Client requested deeper drilling)…"
                        className="flex-1 px-2.5 py-1.5 bg-white border border-rose-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-rose-300"
                      />
                      <button
                        onClick={() => approveVariation(line)}
                        disabled={approvingId === line.id}
                        className="px-3 py-1.5 bg-rose-600 text-white hover:bg-rose-700 rounded-lg text-xs font-medium transition disabled:opacity-50 whitespace-nowrap"
                      >
                        {approvingId === line.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Approve Variation'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Line Modal */}
      {showAdd && (
        <AddBOQLineModal
          job={job}
          rateItems={rateItems}
          onClose={() => setShowAdd(false)}
          onAdded={() => { queryClient.invalidateQueries({ queryKey: ['boq-lines', job.id] }); setShowAdd(false); }}
        />
      )}
    </div>
  );
}

function AddBOQLineModal({ job, rateItems, onClose, onAdded }) {
  const { toast } = useToast();
  const [selectedRateId, setSelectedRateId] = useState('');
  const [qty, setQty] = useState('');
  const [priceOverride, setPriceOverride] = useState('');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const filteredRates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rateItems.slice(0, 50);
    return rateItems.filter((r) =>
      r.description?.toLowerCase().includes(q) ||
      r.subcategory?.toLowerCase().includes(q)
    ).slice(0, 50);
  }, [rateItems, search]);

  const selected = rateItems.find((r) => r.id === selectedRateId);
  const unitPrice = priceOverride ? Number(priceOverride) : (selected?.price || 0);
  const lineTotal = (Number(qty) || 0) * unitPrice;

  const save = async () => {
    if (!selected || !qty) {
      toast({ title: 'Select a rate and enter quantity', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await base44.entities.JobBillOfQuantities.create({
        job_id: job.id,
        project_id: job.project_id || null,
        rate_card_item_id: selected.id,
        sor_ref: selected.sor_ref || '',
        description: selected.description,
        category: selected.category || 'labour',
        subcategory: selected.subcategory || '',
        unit: selected.unit || 'nr',
        agreed_quantity: Number(qty),
        agreed_unit_price: unitPrice,
        agreed_line_total: Math.round(lineTotal * 100) / 100,
        actual_quantity: 0,
        remaining_quantity: Number(qty),
        variation_quantity: 0,
        status: 'not_started',
        is_variation: false,
        sort_order: selected.sort_order || 0,
      });
      toast({ title: 'BOQ line added', description: `${selected.description} — ${qty} ${selected.unit || ''}` });
      onAdded();
    } catch (e) {
      toast({ title: 'Save failed', description: e?.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Add BOQ Line from Schedule of Rates</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} autoFocus
              placeholder="Search rate card items…"
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5A1A]/30" />
          </div>
          <div className="border border-slate-200 rounded-lg max-h-[300px] overflow-y-auto divide-y divide-slate-100">
            {filteredRates.map((r) => (
              <button key={r.id} onClick={() => setSelectedRateId(r.id)}
                className={`w-full text-left p-2.5 hover:bg-[#2E5A1A]/5 transition ${selectedRateId === r.id ? 'bg-[#2E5A1A]/10 border-l-4 border-[#2E5A1A]' : ''}`}>
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-mono font-bold">{r.category?.[0]?.toUpperCase()}</span>
                  <p className="text-sm font-medium text-slate-800 flex-1 truncate">{r.description}</p>
                  <span className="text-sm font-semibold text-slate-900">£{r.price}</span>
                  <span className="text-[10px] text-slate-400">/{r.unit}</span>
                </div>
                {r.subcategory && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{r.subcategory}</p>}
              </button>
            ))}
            {filteredRates.length === 0 && <p className="text-center py-6 text-slate-400 text-sm">No rate items found</p>}
          </div>
          {selected && (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 space-y-3">
              <div className="text-xs text-slate-600">
                <span className="font-medium text-slate-800">{selected.description}</span>
                <span className="text-slate-400"> · {selected.subcategory || selected.category}</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 uppercase font-medium block mb-1">Quantity</label>
                  <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5A1A]/30" />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 uppercase font-medium block mb-1">Unit Price (£)</label>
                  <input type="number" value={priceOverride} onChange={(e) => setPriceOverride(e.target.value)}
                    placeholder={String(selected.price || '')}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5A1A]/30" />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 uppercase font-medium block mb-1">Line Total</label>
                  <div className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-bold text-[#2E5A1A]">
                    {fmt(lineTotal)}
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-400">Unit: {selected.unit || 'nr'} · Override price only for negotiated rates</p>
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition">Cancel</button>
          <button onClick={save} disabled={saving || !selected || !qty}
            className="flex items-center gap-2 px-4 py-2 bg-[#2E5A1A] text-white hover:bg-[#1c4a12] rounded-lg text-sm font-medium transition disabled:opacity-50">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Add to BOQ
          </button>
        </div>
      </div>
    </div>
  );
}