import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  FileText, Plus, X, Save, Loader2, Search, Filter, Trash2, Send,
  CheckCircle2, Package, ArrowRight, AlertTriangle, Eye, Download
} from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import { useToast } from '@/components/ui/use-toast';
import { format, parseISO } from 'date-fns';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_BADGE = {
  draft: 'bg-slate-100 text-slate-600',
  sent: 'bg-blue-100 text-blue-700',
  acknowledged: 'bg-indigo-100 text-indigo-700',
  partially_received: 'bg-amber-100 text-amber-700',
  received: 'bg-emerald-100 text-emerald-700',
  closed: 'bg-teal-100 text-teal-700',
  cancelled: 'bg-rose-100 text-rose-600'
};

const MATCH_BADGE = {
  unmatched: 'bg-slate-100 text-slate-500',
  matched: 'bg-emerald-100 text-emerald-700',
  discrepancy: 'bg-amber-100 text-amber-700'
};

export default function PurchaseOrderManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewing, setViewing] = useState(null);

  const { data: pos = [], isLoading } = useQuery({
    queryKey: ['purchase-orders'],
    queryFn: () => base44.entities.PurchaseOrder.list('-created_date', 200)
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['po-jobs'],
    queryFn: () => base44.entities.Job.list('-updated_date', 100)
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['po-suppliers'],
    queryFn: () => base44.entities.Supplier.list()
  });

  const supplierById = useMemo(() => Object.fromEntries(suppliers.map(s => [s.id, s])), [suppliers]);

  const filtered = useMemo(() => {
    return pos.filter(po => {
      if (statusFilter !== 'all' && po.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (po.po_number || '').toLowerCase().includes(q) ||
               (po.job_name || '').toLowerCase().includes(q) ||
               (po.supplier_name || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [pos, search, statusFilter]);

  const stats = useMemo(() => {
    const open = pos.filter(p => ['draft', 'sent', 'acknowledged', 'partially_received'].includes(p.status));
    const totalValue = open.reduce((s, p) => s + (Number(p.total) || 0), 0);
    const discrepancies = pos.filter(p => p.match_status === 'discrepancy');
    return { open: open.length, totalValue, discrepancies: discrepancies.length };
  }, [pos]);

  return (
    <div>
      <SettingsSectionHeader
        icon={FileText}
        title="Purchase Orders"
        description="Create, track, and match POs against supplier invoices with three-way matching"
        actions={
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-sm font-medium">
            <Plus className="w-4 h-4" /> New PO
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-400 font-medium">Open POs</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{stats.open}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-400 font-medium">Open Value</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{fmt(stats.totalValue)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-400 font-medium">Match Discrepancies</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{stats.discrepancies}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by PO number, job, or supplier…"
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-600">
          <option value="all">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="partially_received">Partially Received</option>
          <option value="received">Received</option>
          <option value="closed">Closed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* PO List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No purchase orders found. Click "New PO" to create one.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(po => (
            <div key={po.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:border-emerald-300 transition cursor-pointer"
              onClick={() => setViewing(po)}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-900 text-sm">{po.po_number}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_BADGE[po.status] || STATUS_BADGE.draft}`}>{po.status?.replace(/_/g, ' ')}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${MATCH_BADGE[po.match_status] || MATCH_BADGE.unmatched}`}>
                      {po.match_status === 'matched' ? <CheckCircle2 className="w-2.5 h-2.5 inline mr-0.5" /> : po.match_status === 'discrepancy' ? <AlertTriangle className="w-2.5 h-2.5 inline mr-0.5" /> : null}
                      {po.match_status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{po.supplier_name} · {po.job_name || 'General'}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-slate-900 text-sm">{fmt(po.total)}</p>
                  {po.expected_delivery_date && <p className="text-[10px] text-slate-400">Due {format(parseISO(po.expected_delivery_date), 'dd MMM')}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New PO Modal */}
      {showNew && (
        <NewPOModal
          jobs={jobs}
          suppliers={suppliers}
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); queryClient.invalidateQueries({ queryKey: ['purchase-orders'] }); }}
        />
      )}

      {/* View PO Modal */}
      {viewing && (
        <ViewPOModal
          po={viewing}
          supplier={supplierById[viewing.supplier_id]}
          onClose={() => setViewing(null)}
          onUpdate={() => { queryClient.invalidateQueries({ queryKey: ['purchase-orders'] }); setViewing(null); }}
        />
      )}
    </div>
  );
}

function NewPOModal({ jobs, suppliers, onClose, onCreated }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [jobId, setJobId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ description: '', quantity: 1, unit_cost: 0, unit_label: 'each', vat_exempt: false }]);

  const job = jobs.find(j => j.id === jobId);
  const supplier = suppliers.find(s => s.id === supplierId);
  const vatRate = 20;

  const subtotal = items.reduce((s, i) => s + (Number(i.quantity || 0) * Number(i.unit_cost || 0)), 0);
  const vatAmount = items.filter(i => !i.vat_exempt).reduce((s, i) => s + (Number(i.quantity || 0) * Number(i.unit_cost || 0) * vatRate / 100), 0);
  const total = subtotal + vatAmount;

  const updateItem = (idx, field, value) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };
  const addItem = () => setItems(prev => [...prev, { description: '', quantity: 1, unit_cost: 0, unit_label: 'each', vat_exempt: false }]);
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  const generatePONumber = () => {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 9000) + 1000;
    return `PO-${year}-${random}`;
  };

  const handleSave = async () => {
    if (!supplierId) { toast({ title: 'Select a supplier' }); return; }
    if (items.some(i => !i.description)) { toast({ title: 'All items need a description' }); return; }
    setSaving(true);
    try {
      const poNumber = generatePONumber();
      await base44.entities.PurchaseOrder.create({
        po_number: poNumber,
        job_id: jobId || '',
        job_name: job?.name || '',
        supplier_id: supplierId,
        supplier_name: supplier?.name || '',
        status: 'draft',
        order_date: new Date().toISOString().slice(0, 10),
        expected_delivery_date: expectedDate || '',
        items: items.map(i => ({ ...i, quantity: Number(i.quantity) || 1, unit_cost: Number(i.unit_cost) || 0 })),
        subtotal,
        vat_amount: vatAmount,
        total,
        vat_rate: vatRate,
        notes,
        match_status: 'unmatched'
      });
      toast({ title: 'Purchase order created', description: `${poNumber} drafted for ${supplier?.name}.` });
      onCreated();
    } catch (e) {
      console.error('PO creation error:', e);
      toast({ title: 'Error', description: 'Could not create purchase order.' });
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain p-4 bg-slate-950/60 backdrop-blur-md" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-3 flex items-center justify-between z-10">
          <h3 className="font-bold text-slate-900">New Purchase Order</h3>
          <button onClick={() => !saving && onClose()} className="p-1 text-slate-400 hover:text-slate-600 rounded"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Supplier *</label>
              <select value={supplierId} onChange={e => setSupplierId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600">
                <option value="">Select supplier…</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Job (optional)</label>
              <select value={jobId} onChange={e => setJobId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600">
                <option value="">General / Stock</option>
                {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Expected delivery date</label>
              <input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-500 uppercase">Line Items</label>
              <button onClick={addItem} className="text-xs text-emerald-700 font-medium flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add item</button>
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-start bg-slate-50 rounded-lg p-2">
                  <div className="flex-1 min-w-0">
                    <input type="text" value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} placeholder="Description"
                      className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:border-emerald-600 mb-1" />
                    <div className="flex gap-1.5">
                      <input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} placeholder="Qty" min="1"
                        className="w-16 px-2 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:border-emerald-600" />
                      <input type="number" value={item.unit_cost} onChange={e => updateItem(idx, 'unit_cost', e.target.value)} placeholder="Unit cost" min="0" step="0.01"
                        className="w-24 px-2 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:border-emerald-600" />
                      <input type="text" value={item.unit_label} onChange={e => updateItem(idx, 'unit_label', e.target.value)} placeholder="Unit"
                        className="w-16 px-2 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:border-emerald-600" />
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-slate-700 min-w-[60px]">{fmt(Number(item.quantity || 0) * Number(item.unit_cost || 0))}</p>
                    {items.length > 1 && (
                      <button onClick={() => removeItem(idx)} className="mt-1 p-1 text-red-400 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="bg-slate-50 rounded-lg p-3 space-y-1">
            <div className="flex justify-between text-sm"><span className="text-slate-500">Subtotal</span><span className="font-medium">{fmt(subtotal)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">VAT ({vatRate}%)</span><span className="font-medium">{fmt(vatAmount)}</span></div>
            <div className="flex justify-between text-base font-bold pt-1 border-t border-slate-200"><span>Total</span><span>{fmt(total)}</span></div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Internal notes…"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 resize-none" />
          </div>
        </div>
        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 py-3 flex gap-2">
          <button onClick={handleSave} disabled={saving || !supplierId}
            className="flex-1 py-2.5 bg-emerald-700 text-white rounded-xl font-semibold text-sm hover:bg-emerald-800 transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Create Draft PO
          </button>
          <button onClick={() => !saving && onClose()} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-200 transition">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function ViewPOModal({ po, supplier, onClose, onUpdate }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [updating, setUpdating] = useState(false);

  const updateStatus = async (newStatus) => {
    setUpdating(true);
    try {
      const updates = { status: newStatus };
      if (newStatus === 'sent') updates.sent_date = new Date().toISOString().slice(0, 10);
      if (newStatus === 'received') updates.received_date = new Date().toISOString().slice(0, 10);
      await base44.entities.PurchaseOrder.update(po.id, updates);
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast({ title: `PO ${newStatus.replace(/_/g, ' ')}` });
      onUpdate();
    } catch (e) {
      toast({ title: 'Error', description: 'Could not update PO.' });
    }
    setUpdating(false);
  };

  const markInvoiceMatched = async () => {
    setUpdating(true);
    try {
      const invoiceAmount = Number(po.invoice_amount || 0);
      const poTotal = Number(po.total || 0);
      const matched = Math.abs(invoiceAmount - poTotal) < 0.01;
      await base44.entities.PurchaseOrder.update(po.id, {
        invoice_received: true,
        invoice_matched: matched,
        match_status: matched ? 'matched' : 'discrepancy'
      });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast({ title: matched ? 'Three-way match passed' : 'Discrepancy flagged', description: matched ? 'Invoice matches PO total.' : `Invoice ${fmt(invoiceAmount)} vs PO ${fmt(poTotal)}.` });
      onUpdate();
    } catch (e) {
      toast({ title: 'Error', description: 'Could not update match status.' });
    }
    setUpdating(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain p-4 bg-slate-950/60 backdrop-blur-md" onClick={() => !updating && onClose()}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-3 flex items-center justify-between z-10">
          <div>
            <h3 className="font-bold text-slate-900">{po.po_number}</h3>
            <p className="text-xs text-slate-400">{po.supplier_name} · {po.job_name || 'General'}</p>
          </div>
          <button onClick={() => !updating && onClose()} className="p-1 text-slate-400 hover:text-slate-600 rounded"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Status badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_BADGE[po.status]}`}>{po.status?.replace(/_/g, ' ')}</span>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${MATCH_BADGE[po.match_status]}`}>
              {po.match_status === 'matched' && <CheckCircle2 className="w-3 h-3 inline mr-1" />}
              {po.match_status === 'discrepancy' && <AlertTriangle className="w-3 h-3 inline mr-1" />}
              3-way: {po.match_status}
            </span>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-[11px] text-slate-400 uppercase">Order Date</p><p className="text-slate-700">{po.order_date ? format(parseISO(po.order_date), 'dd MMM yyyy') : '—'}</p></div>
            <div><p className="text-[11px] text-slate-400 uppercase">Expected Delivery</p><p className="text-slate-700">{po.expected_delivery_date ? format(parseISO(po.expected_delivery_date), 'dd MMM yyyy') : '—'}</p></div>
          </div>

          {/* Items */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Items</p>
            <div className="space-y-1.5">
              {(po.items || []).map((item, i) => (
                <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-800 truncate">{item.description}</p>
                    <p className="text-[10px] text-slate-400">{item.quantity} × {fmt(item.unit_cost)} / {item.unit_label}</p>
                  </div>
                  <p className="text-sm font-medium text-slate-700 flex-shrink-0">{fmt(Number(item.quantity || 0) * Number(item.unit_cost || 0))}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="bg-slate-50 rounded-lg p-3 space-y-1">
            <div className="flex justify-between text-sm"><span className="text-slate-500">Subtotal</span><span>{fmt(po.subtotal)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">VAT</span><span>{fmt(po.vat_amount)}</span></div>
            <div className="flex justify-between text-base font-bold pt-1 border-t border-slate-200"><span>Total</span><span>{fmt(po.total)}</span></div>
            {po.invoice_received && (
              <div className="flex justify-between text-sm pt-1 border-t border-slate-200">
                <span className="text-slate-500">Invoice Amount</span>
                <span className={po.invoice_matched ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'}>{fmt(po.invoice_amount)}</span>
              </div>
            )}
          </div>

          {po.notes && <p className="text-sm text-slate-600 bg-amber-50 border border-amber-100 rounded-lg p-3">{po.notes}</p>}

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {po.status === 'draft' && (
              <button onClick={() => updateStatus('sent')} disabled={updating}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                <Send className="w-3.5 h-3.5" /> Mark Sent
              </button>
            )}
            {['sent', 'acknowledged', 'partially_received'].includes(po.status) && (
              <button onClick={() => updateStatus('received')} disabled={updating}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                <Package className="w-3.5 h-3.5" /> Mark Received
              </button>
            )}
            {po.status === 'received' && !po.invoice_received && (
              <button onClick={markInvoiceMatched} disabled={updating}
                className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50">
                <CheckCircle2 className="w-3.5 h-3.5" /> Match Invoice
              </button>
            )}
            {po.status === 'received' && po.invoice_matched && (
              <button onClick={() => updateStatus('closed')} disabled={updating}
                className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
                <CheckCircle2 className="w-3.5 h-3.5" /> Close PO
              </button>
            )}
            {!['closed', 'cancelled'].includes(po.status) && (
              <button onClick={() => updateStatus('cancelled')} disabled={updating}
                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 text-slate-500 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50">
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}