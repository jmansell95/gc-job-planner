import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, Search, Package, Wrench, Briefcase, Loader2, AlertTriangle, CheckCircle2, Minus, Plus } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

/**
 * Modal for logging consumable usage against a job or service/repair.
 * Staff search/select a consumable from the catalog, enter a quantity,
 * choose the destination (job or repair), and commit — stock decrements
 * and a cost record is created.
 *
 * Props:
 *   onClose()                    — close the modal
 *   presetServiceRecordId?       — pre-linked ServiceRecord (when opened from a repair)
 *   presetJobId?                  — pre-linked job (when opened from a job context)
 *   onUsed?()                     — callback after successful commit
 */
export default function ConsumableUsageModal({ onClose, presetServiceRecordId, presetJobId, onUsed }) {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [usageType, setUsageType] = useState(presetServiceRecordId ? 'service_repair' : 'job');
  const [jobId, setJobId] = useState(presetJobId || '');
  const [serviceRecordId, setServiceRecordId] = useState(presetServiceRecordId || '');
  const [notes, setNotes] = useState('');
  const [committing, setCommitting] = useState(false);

  const { data: consumables = [], isLoading } = useQuery({
    queryKey: ['consumable-stock-items'],
    queryFn: () => base44.entities.ConsumableStockItem.filter({ is_active: true }),
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list(),
    enabled: usageType === 'job' && !presetJobId,
  });

  const { data: serviceRecords = [] } = useQuery({
    queryKey: ['service-records-recent'],
    queryFn: () => base44.entities.ServiceRecord.list('-created_date', 50),
    enabled: usageType === 'service_repair' && !presetServiceRecordId,
  });

  const filtered = useMemo(() => {
    if (!search) return consumables;
    const q = search.toLowerCase();
    return consumables.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.sku || '').toLowerCase().includes(q) ||
      (c.barcode || '').toLowerCase().includes(q)
    );
  }, [consumables, search]);

  const stockLevel = (item) => {
    const stock = Number(item.current_stock) || 0;
    const min = Number(item.minimum_stock) || 0;
    if (stock <= 0) return { label: 'Out of stock', color: 'text-rose-600 bg-rose-50' };
    if (min > 0 && stock <= min) return { label: 'Low stock', color: 'text-amber-600 bg-amber-50' };
    return { label: 'In stock', color: 'text-emerald-600 bg-emerald-50' };
  };

  const handleCommit = async () => {
    if (!selectedItem) return;
    if (usageType === 'job' && !jobId) return;
    if (usageType === 'service_repair' && !serviceRecordId) return;

    setCommitting(true);
    try {
      const me = await base44.auth.me();
      const res = await base44.functions.invoke('commitConsumableUsage', {
        consumable_item_id: selectedItem.id,
        quantity,
        usage_type: usageType,
        job_id: usageType === 'job' ? jobId : '',
        service_record_id: usageType === 'service_repair' ? serviceRecordId : '',
        staff_id: me?.id,
        staff_name: me?.full_name || me?.email || '',
        notes,
      });
      const data = res.data || res;
      if (data.error) throw new Error(data.error);

      toast({
        title: 'Consumable Used',
        description: `${quantity}× ${selectedItem.name} logged — £${Number(data.cost || 0).toFixed(2)} cost. ${data.stock_remaining} remaining in stock.`,
      });
      onUsed?.();
      onClose();
    } catch (e) {
      toast({ title: 'Could not log usage', description: e.message, variant: 'destructive' });
    }
    setCommitting(false);
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92dvh] overflow-y-auto flex flex-col shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Package className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Use Consumable</h2>
              <p className="text-xs text-slate-400">Log stock used on a job or repair</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition active:scale-95">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Search */}
          {!selectedItem && (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name, SKU or barcode…"
                  autoFocus
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              {/* Results */}
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No consumables found</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                  {filtered.map(item => {
                    const sl = stockLevel(item);
                    return (
                      <button
                        key={item.id}
                        onClick={() => { setSelectedItem(item); setQuantity(1); }}
                        className="w-full flex items-center gap-3 p-3 bg-slate-50 hover:bg-emerald-50 border border-slate-100 hover:border-emerald-200 rounded-xl text-left transition active:scale-[0.98]"
                      >
                        <div className="w-10 h-10 rounded-lg bg-white border border-slate-100 flex items-center justify-center flex-shrink-0">
                          <Package className="w-5 h-5 text-slate-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-800 text-sm truncate">{item.name}</p>
                          <p className="text-xs text-slate-400">
                            {item.storage_location || 'No location'} · £{(Number(item.unit_cost) || 0).toFixed(2)}/{item.unit || 'each'}
                          </p>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${sl.color}`}>
                            {Number(item.current_stock) || 0} {item.unit || 'ea'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Selected item → quantity + destination */}
          {selectedItem && (
            <>
              {/* Selected item card */}
              <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="w-10 h-10 rounded-lg bg-white border border-emerald-100 flex items-center justify-center">
                  <Package className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 text-sm truncate">{selectedItem.name}</p>
                  <p className="text-xs text-slate-500">
                    £{(Number(selectedItem.unit_cost) || 0).toFixed(2)}/{selectedItem.unit || 'each'} · {Number(selectedItem.current_stock) || 0} in stock
                  </p>
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="text-xs text-slate-400 hover:text-slate-600 font-semibold"
                >
                  Change
                </button>
              </div>

              {/* Quantity stepper */}
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">Quantity</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition active:scale-95"
                  >
                    <Minus className="w-5 h-5 text-slate-600" />
                  </button>
                  <input
                    type="number"
                    value={quantity}
                    onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 text-center text-xl font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl py-2.5 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition active:scale-95"
                  >
                    <Plus className="w-5 h-5 text-slate-600" />
                  </button>
                  <div className="ml-auto text-right">
                    <p className="text-xs text-slate-400">Total cost</p>
                    <p className="text-lg font-bold text-slate-800 tabular-nums">
                      £{((Number(selectedItem.unit_cost) || 0) * quantity).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Usage type toggle */}
              {!presetServiceRecordId && !presetJobId && (
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">Use on</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setUsageType('job')}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition ${usageType === 'job' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                    >
                      <Briefcase className="w-4 h-4" /> Job
                    </button>
                    <button
                      onClick={() => setUsageType('service_repair')}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition ${usageType === 'service_repair' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                    >
                      <Wrench className="w-4 h-4" /> Service / Repair
                    </button>
                  </div>
                </div>
              )}

              {/* Job selector */}
              {usageType === 'job' && !presetJobId && (
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">Select Job</label>
                  <select
                    value={jobId}
                    onChange={e => setJobId(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Choose a job…</option>
                    {jobs.map(j => (
                      <option key={j.id} value={j.id}>{j.name}{j.job_reference ? ` (${j.job_reference})` : ''}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Service record selector */}
              {usageType === 'service_repair' && !presetServiceRecordId && (
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">Select Service / Repair Record</label>
                  <select
                    value={serviceRecordId}
                    onChange={e => setServiceRecordId(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Choose a record…</option>
                    {serviceRecords.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.record_type} — {r.date || 'no date'}{r.tested_by ? ` (${r.tested_by})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">Notes (optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Greased bearing on Rig 1"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {selectedItem && (
          <div className="sticky bottom-0 bg-white border-t border-slate-100 p-4 safe-area-bottom">
            <button
              onClick={handleCommit}
              disabled={committing || (usageType === 'job' && !jobId) || (usageType === 'service_repair' && !serviceRecordId)}
              className="w-full py-3.5 bg-emerald-600 text-white rounded-xl text-sm font-bold disabled:opacity-40 active:scale-[0.98] transition flex items-center justify-center gap-2"
            >
              {committing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Logging…</>
              ) : (
                <><CheckCircle2 className="w-4 h-4" /> Log Usage — £{((Number(selectedItem.unit_cost) || 0) * quantity).toFixed(2)}</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}