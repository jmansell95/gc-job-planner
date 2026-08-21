import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  FileText, Calendar, RefreshCw, Send, ArrowRight, CheckCircle2,
  Plus, Download, Loader2, Clock, Receipt,
  ChevronDown, ChevronRight, MessageSquare, X, FileBarChart,
} from 'lucide-react';
import CreateFirstAFPModal from './CreateFirstAFPModal';
import AFPDisputeRow from './AFPDisputeRow';
import AFPExportButtons from './AFPExportButtons';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const STATUS_META = {
  draft: { label: 'Draft', color: 'text-slate-600', bg: 'bg-slate-100', dot: 'bg-slate-400' },
  submitted: { label: 'Submitted', color: 'text-blue-700', bg: 'bg-blue-100', dot: 'bg-blue-500' },
  approved: { label: 'Approved', color: 'text-emerald-700', bg: 'bg-emerald-100', dot: 'bg-emerald-500' },
  invoiced: { label: 'Invoiced', color: 'text-violet-700', bg: 'bg-violet-100', dot: 'bg-violet-500' },
};

const SOURCE_META = {
  driller_log: { label: 'Driller Log', icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
  delivery: { label: 'Delivery', icon: FileText, color: 'text-amber-600', bg: 'bg-amber-50' },
  subcontractor: { label: 'Subcontractor', icon: FileText, color: 'text-violet-600', bg: 'bg-violet-50' },
  timesheet: { label: 'Timesheet', icon: Clock, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  cost: { label: 'Daily Cost', icon: Receipt, color: 'text-rose-600', bg: 'bg-rose-50' },
  template: { label: 'Template', icon: FileBarChart, color: 'text-slate-600', bg: 'bg-slate-50' },
  manual: { label: 'Manual', icon: Plus, color: 'text-[#2E5A1A]', bg: 'bg-green-50' },
};

function weekKey(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().slice(0, 10);
}

function monthKey(dateStr) {
  if (!dateStr) return '';
  return dateStr.slice(0, 7);
}

export default function AFPBuilder({ job }) {
  const queryClient = useQueryClient();
  const [selectedAfpId, setSelectedAfpId] = useState(null);
  const [granularity, setGranularity] = useState('week'); // day | week | month
  const [showCreate, setShowCreate] = useState(false);
  const [populating, setPopulating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [expandedDisputes, setExpandedDisputes] = useState(new Set());
  const [showAddManual, setShowAddManual] = useState(false);
  const [manualItem, setManualItem] = useState({ item: '', unit: 'sum', qty: 1, rate: 0, category: 'other' });

  const { data: afps = [], isLoading: afpsLoading } = useQuery({
    queryKey: ['afp', job.id],
    queryFn: () => base44.entities.AFP.filter({ job_id: job.id }, 'afp_number', 50),
  });

  const selectedAfp = useMemo(() => {
    if (!afps.length) return null;
    return afps.find(a => a.id === selectedAfpId) || afps[0];
  }, [afps, selectedAfpId]);

  const { data: lineItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['afp-line-items', selectedAfp?.id],
    queryFn: () => base44.entities.AFPLineItem.filter({ afp_id: selectedAfp.id }, 'source_date', 500),
    enabled: !!selectedAfp?.id,
  });

  // Group line items by time bucket
  const groupedItems = useMemo(() => {
    const groups = {};
    for (const li of lineItems) {
      let key;
      if (granularity === 'day') key = li.source_date || 'undated';
      else if (granularity === 'week') key = weekKey(li.source_date) || 'undated';
      else key = monthKey(li.source_date) || 'undated';
      if (!groups[key]) groups[key] = [];
      groups[key].push(li);
    }
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [lineItems, granularity]);

  // Totals
  const totals = useMemo(() => {
    let original = 0, disputed = 0, agreed = 0;
    for (const li of lineItems) {
      const amt = li.amount || 0;
      original += li.original_amount || amt;
      if (li.dispute_status === 'disputed' || li.dispute_status === 'counter_offered') {
        disputed += amt;
      }
      if (li.dispute_status !== 'rejected') {
        agreed += li.agreed_amount || amt;
      }
    }
    return { original, disputed, agreed };
  }, [lineItems]);

  // Data freshness
  const freshness = useMemo(() => {
    const sources = {};
    for (const li of lineItems) {
      if (!sources[li.source]) sources[li.source] = 0;
      sources[li.source]++;
    }
    return sources;
  }, [lineItems]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['afp', job.id] });
    queryClient.invalidateQueries({ queryKey: ['afp-line-items', selectedAfp?.id] });
    queryClient.invalidateQueries({ queryKey: ['cvr', job.id] });
    queryClient.invalidateQueries({ queryKey: ['cvr-cash-flow', job.id] });
  };

  const handlePopulate = async () => {
    if (!selectedAfp) return;
    setPopulating(true);
    try {
      const res = await base44.functions.invoke('populateAFPFromFieldData', { afp_id: selectedAfp.id });
      const data = res.data || res;
      if (data.error) throw new Error(data.error);
      invalidate();
    } catch (e) {
      console.error(e);
    }
    setPopulating(false);
  };

  const handleSubmit = async () => {
    if (!selectedAfp) return;
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke('submitAFPToClient', { afp_id: selectedAfp.id });
      const data = res.data || res;
      if (data.error) throw new Error(data.error);
      // Generate Excel export and store URL on the AFP
      try {
        const exportRes = await base44.functions.invoke('exportAFPToExcel', { afp_id: selectedAfp.id });
        const exportData = exportRes.data || exportRes;
        if (exportData.file_url) {
          await base44.entities.AFP.update(selectedAfp.id, {
            source_file_url: exportData.file_url,
            source_file_name: exportData.file_name,
          });
        }
      } catch (exportErr) {
        console.error('Excel export during submit failed:', exportErr);
      }
      invalidate();
    } catch (e) {
      console.error(e);
    }
    setSubmitting(false);
  };

  const handlePushToCVR = async () => {
    if (!selectedAfp) return;
    setPushing(true);
    try {
      const res = await base44.functions.invoke('pushAFPToCVR', { afp_id: selectedAfp.id });
      const data = res.data || res;
      if (data.error) throw new Error(data.error);
      invalidate();
    } catch (e) {
      console.error(e);
    }
    setPushing(false);
  };

  const handleLineItemUpdate = async (id, updates) => {
    try {
      await base44.entities.AFPLineItem.update(id, updates);
      queryClient.invalidateQueries({ queryKey: ['afp-line-items', selectedAfp?.id] });
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddManual = async () => {
    if (!manualItem.item || !selectedAfp) return;
    try {
      await base44.entities.AFPLineItem.create({
        afp_id: selectedAfp.id,
        job_id: job.id,
        sheet_name: 'plant_hire',
        category: manualItem.category,
        item: manualItem.item,
        unit: manualItem.unit,
        qty: Number(manualItem.qty) || 0,
        rate: Number(manualItem.rate) || 0,
        amount: (Number(manualItem.qty) || 0) * (Number(manualItem.rate) || 0),
        source: 'manual',
        source_date: new Date().toISOString().slice(0, 10),
        is_manual: true,
        dispute_status: 'none',
        original_amount: (Number(manualItem.qty) || 0) * (Number(manualItem.rate) || 0),
        agreed_amount: (Number(manualItem.qty) || 0) * (Number(manualItem.rate) || 0),
        sort_order: lineItems.length,
      });
      setManualItem({ item: '', unit: 'sum', qty: 1, rate: 0, category: 'other' });
      setShowAddManual(false);
      queryClient.invalidateQueries({ queryKey: ['afp-line-items', selectedAfp?.id] });
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteItem = async (id) => {
    try {
      await base44.entities.AFPLineItem.delete(id);
      queryClient.invalidateQueries({ queryKey: ['afp-line-items', selectedAfp?.id] });
    } catch (e) {
      console.error(e);
    }
  };

  const toggleDispute = (id) => {
    setExpandedDisputes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportCSV = () => {
    const headers = ['Date', 'Source', 'Category', 'Description', 'Unit', 'Qty', 'Rate', 'Amount', 'Dispute Status', 'Agreed Amount'];
    const rows = lineItems.map(li => [
      li.source_date || '', li.source || '', li.category || '', li.item || '',
      li.unit || '', li.qty || 0, li.rate || 0, li.amount || 0,
      li.dispute_status || 'none', li.agreed_amount || li.amount || 0,
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AFP_${job.name}_${selectedAfp?.afp_number || 1}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Empty state: no AFPs yet ──
  if (!afpsLoading && afps.length === 0) {
    return (
      <>
        <div className="insight-card rounded-2xl p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#2E5A1A]/10 to-[#8DC63F]/10 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-[#2E5A1A]" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-1">No AFPs yet</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-5">
            Create the first Application for Payment to start the monthly billing chain.
            The AFP will auto-populate with live field data from the job's start date.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white rounded-xl text-sm font-bold transition active:scale-95 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Create First AFP
          </button>
        </div>
        {showCreate && <CreateFirstAFPModal job={job} onClose={() => setShowCreate(false)} onCreated={(id) => { setSelectedAfpId(id); invalidate(); }} />}
      </>
    );
  }

  if (afpsLoading || itemsLoading) {
    return <div className="insight-card rounded-2xl p-8 text-center"><Loader2 className="w-6 h-6 text-slate-400 animate-spin mx-auto" /></div>;
  }

  const statusMeta = selectedAfp ? STATUS_META[selectedAfp.status] : STATUS_META.draft;

  return (
    <div className="space-y-3">
      {/* ── AFP Chain Selector ── */}
      <div className="insight-card rounded-2xl p-3">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {afps.map(afp => {
            const meta = STATUS_META[afp.status];
            const isActive = selectedAfp?.id === afp.id;
            return (
              <button
                key={afp.id}
                onClick={() => setSelectedAfpId(afp.id)}
                className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition active:scale-95 ${
                  isActive ? 'bg-[#2E5A1A] text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                AFP {afp.afp_number}
                <span className={`text-[10px] ${isActive ? 'text-white/60' : 'text-slate-400'}`}>
                  {afp.period_end_date ? fmtDate(afp.period_end_date) : 'Open'}
                </span>
              </button>
            );
          })}
          <button
            onClick={() => setShowCreate(true)}
            className="flex-shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 text-slate-500 hover:bg-slate-100 border border-dashed border-slate-300 transition active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" /> New
          </button>
        </div>
      </div>

      {/* ── AFP Header ── */}
      {selectedAfp && (
        <div className="insight-card rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">AFP {selectedAfp.afp_number} — {job.name}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${statusMeta.bg} ${statusMeta.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} /> {statusMeta.label}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {fmtDate(selectedAfp.period_start_date)} → {selectedAfp.period_end_date ? fmtDate(selectedAfp.period_end_date) : 'Open'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectedAfp.status === 'draft' && (
                <button
                  onClick={handlePopulate}
                  disabled={populating}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition active:scale-95 disabled:opacity-50"
                >
                  {populating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Refresh from Field
                </button>
              )}
              {selectedAfp.status === 'draft' && (
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-xl text-xs font-bold transition active:scale-95 shadow-sm disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Submit to Client
                </button>
              )}
              {selectedAfp.status === 'approved' && (
                <button
                  onClick={handlePushToCVR}
                  disabled={pushing}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white rounded-xl text-xs font-bold transition active:scale-95 shadow-sm disabled:opacity-50"
                >
                  {pushing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                  Push to CVR
                </button>
              )}
              <AFPExportButtons afp={selectedAfp} job={job} />
            </div>
          </div>

          {/* Totals bar */}
          <div className="px-4 py-3 grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide">Original</p>
              <p className="text-lg font-bold text-slate-700 tabular-nums">{fmt(totals.original)}</p>
            </div>
            <div className={`text-center ${totals.disputed > 0 ? 'bg-amber-50 rounded-lg' : ''}`}>
              <p className="text-[10px] text-amber-600 uppercase font-semibold tracking-wide">Disputed</p>
              <p className={`text-lg font-bold tabular-nums ${totals.disputed > 0 ? 'text-amber-700' : 'text-slate-400'}`}>{fmt(totals.disputed)}</p>
            </div>
            <div className="text-center bg-emerald-50 rounded-lg">
              <p className="text-[10px] text-emerald-700 uppercase font-semibold tracking-wide">Agreed</p>
              <p className="text-lg font-bold text-emerald-700 tabular-nums">{fmt(totals.agreed)}</p>
            </div>
          </div>

          {/* Data freshness */}
          <div className="px-4 py-2 border-t border-slate-100 flex items-center gap-3 flex-wrap">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Data Sources:</span>
            {Object.entries(SOURCE_META).map(([key, meta]) => {
              const count = freshness[key] || 0;
              if (key === 'manual' && count === 0) return null;
              return (
                <span key={key} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${meta.bg} ${meta.color}`}>
                  <meta.icon className="w-3 h-3" /> {meta.label}: {count}
                </span>
              );
            })}
            {selectedAfp.last_populated_at && (
              <span className="text-[10px] text-slate-400 ml-auto">
                Last refreshed {new Date(selectedAfp.last_populated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Granularity Toggle ── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
          {['day', 'week', 'month'].map(g => (
            <button
              key={g}
              onClick={() => setGranularity(g)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition capitalize ${granularity === g ? 'bg-white text-[#2E5A1A] shadow-sm' : 'text-slate-500'}`}
            >
              {g}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowAddManual(!showAddManual)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" /> Add Line
        </button>
      </div>

      {/* ── Add Manual Line ── */}
      {showAddManual && (
        <div className="insight-card rounded-2xl p-3 space-y-2">
          <div className="grid grid-cols-12 gap-2">
            <input
              type="text"
              placeholder="Description"
              value={manualItem.item}
              onChange={e => setManualItem(p => ({ ...p, item: e.target.value }))}
              className="col-span-12 sm:col-span-4 px-3 py-2 border border-slate-200 rounded-lg text-xs"
            />
            <select
              value={manualItem.category}
              onChange={e => setManualItem(p => ({ ...p, category: e.target.value }))}
              className="col-span-6 sm:col-span-2 px-2 py-2 border border-slate-200 rounded-lg text-xs"
            >
              <option value="drilling">Drilling</option>
              <option value="plant_hire">Plant Hire</option>
              <option value="labour">Labour</option>
              <option value="subcontractor">Subcontractor</option>
              <option value="materials">Materials</option>
              <option value="mobilisation">Mobilisation</option>
              <option value="delivery">Delivery</option>
              <option value="other">Other</option>
            </select>
            <input
              type="text"
              placeholder="Unit"
              value={manualItem.unit}
              onChange={e => setManualItem(p => ({ ...p, unit: e.target.value }))}
              className="col-span-3 sm:col-span-1 px-2 py-2 border border-slate-200 rounded-lg text-xs"
            />
            <input
              type="number"
              placeholder="Qty"
              value={manualItem.qty}
              onChange={e => setManualItem(p => ({ ...p, qty: e.target.value }))}
              className="col-span-3 sm:col-span-2 px-2 py-2 border border-slate-200 rounded-lg text-xs"
            />
            <input
              type="number"
              placeholder="Rate"
              value={manualItem.rate}
              onChange={e => setManualItem(p => ({ ...p, rate: e.target.value }))}
              className="col-span-3 sm:col-span-2 px-2 py-2 border border-slate-200 rounded-lg text-xs"
            />
            <div className="col-span-6 sm:col-span-1 flex items-center px-2 text-xs font-bold text-slate-700 tabular-nums">
              {fmt((Number(manualItem.qty) || 0) * (Number(manualItem.rate) || 0))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAddManual(false)} className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700">Cancel</button>
            <button onClick={handleAddManual} disabled={!manualItem.item} className="px-3 py-1.5 bg-[#2E5A1A] text-white rounded-lg text-xs font-bold disabled:opacity-50">Add</button>
          </div>
        </div>
      )}

      {/* ── Line Items Table (grouped by time bucket) ── */}
      <div className="insight-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50/80 sticky top-0">
              <tr className="text-slate-500 uppercase tracking-wide text-[10px]">
                <th className="text-left px-3 py-2.5 font-semibold">Source</th>
                <th className="text-left px-3 py-2.5 font-semibold">Description</th>
                <th className="text-right px-3 py-2.5 font-semibold">Unit</th>
                <th className="text-right px-3 py-2.5 font-semibold">Qty</th>
                <th className="text-right px-3 py-2.5 font-semibold">Rate</th>
                <th className="text-right px-3 py-2.5 font-semibold">Amount</th>
                <th className="text-center px-3 py-2.5 font-semibold">Dispute</th>
                <th className="text-right px-3 py-2.5 font-semibold w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {groupedItems.map(([bucket, items]) => {
                const bucketTotal = items.reduce((s, li) => s + (li.amount || 0), 0);
                const bucketLabel = bucket === 'undated' ? 'Undated' :
                  granularity === 'day' ? fmtDate(bucket) :
                  granularity === 'week' ? `Week of ${fmtDate(bucket)}` :
                  new Date(bucket + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
                return (
                  <React.Fragment key={bucket}>
                    <tr className="bg-slate-100/60">
                      <td colSpan={5} className="px-3 py-1.5 font-bold text-slate-700 text-[11px] uppercase tracking-wide">
                        {bucketLabel} — {items.length} items
                      </td>
                      <td className="text-right px-3 py-1.5 font-bold text-slate-700 tabular-nums">{fmt(bucketTotal)}</td>
                      <td colSpan={2}></td>
                    </tr>
                    {items.map((li) => (
                      <AFPDisputeRow
                        key={li.id}
                        item={li}
                        canEdit={selectedAfp.status === 'draft'}
                        canDispute={selectedAfp.status === 'submitted'}
                        expanded={expandedDisputes.has(li.id)}
                        onToggleDispute={() => toggleDispute(li.id)}
                        onUpdate={(updates) => handleLineItemUpdate(li.id, updates)}
                        onDelete={() => handleDeleteItem(li.id)}
                      />
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50/80 border-t-2 border-slate-200 sticky bottom-0">
              <tr className="font-bold text-slate-800">
                <td colSpan={5} className="px-3 py-2.5">AFP Total</td>
                <td className="text-right px-3 py-2.5 tabular-nums">{fmt(totals.agreed)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Spacer for sticky bar */}
      <div className="h-16" />

      {/* ── Sticky Running Total Bar ── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-lg border-t border-slate-200 px-4 py-2.5 flex items-center justify-between safe-area-bottom">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-[10px] text-slate-400 uppercase font-semibold">Agreed Total</p>
            <p className="text-xl font-bold text-emerald-700 tabular-nums">{fmt(totals.agreed)}</p>
          </div>
          {totals.disputed > 0 && (
            <div>
              <p className="text-[10px] text-amber-500 uppercase font-semibold">Disputed</p>
              <p className="text-xl font-bold text-amber-600 tabular-nums">{fmt(totals.disputed)}</p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">{lineItems.length} items</span>
          {selectedAfp?.status === 'submitted' && (
            <button
              onClick={async () => {
                const hasUnresolved = lineItems.some(li => li.dispute_status === 'disputed' || li.dispute_status === 'counter_offered');
                if (hasUnresolved) return;
                try {
                  await base44.entities.AFP.update(selectedAfp.id, { status: 'approved', dispute_status: 'resolved' });
                  invalidate();
                } catch (e) { console.error(e); }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold transition active:scale-95 shadow-sm"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Mark Approved
            </button>
          )}
        </div>
      </div>

      {showCreate && <CreateFirstAFPModal job={job} onClose={() => setShowCreate(false)} onCreated={(id) => { setSelectedAfpId(id); invalidate(); }} />}
    </div>
  );
}