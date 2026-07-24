import React, { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  PoundSterling, Receipt, Download, FileBarChart, Search, Loader2,
  Wallet, TrendingUp, Briefcase, ArrowRight, Mountain,
} from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import StatCard from '@/components/dashboard/StatCard';
import { Skeleton } from '@/components/StateViews';
import { computeBillingRow, groupByJob, READY_STATUSES } from '@/utils/billingSummary';
import { getTotalMetres } from '@/utils/geotechBilling';
import { canViewCostings } from '@/utils/access';
import GeotechBillingReport from '@/components/GeotechBillingReport';
import GenerateInvoiceModal from '@/components/billing/GenerateInvoiceModal';
import InvoiceHistoryPanel from '@/components/billing/InvoiceHistoryPanel';

const fmt = (n) => '£' + (Math.round((n || 0) * 100) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_STYLES = {
  planning: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-blue-100 text-blue-700',
  decommissioning: 'bg-amber-100 text-amber-700',
  completed: 'bg-[#2E5A1A]/15 text-[#2E5A1A]',
  on_hold: 'bg-rose-100 text-rose-700',
  cancelled: 'bg-slate-200 text-slate-500 line-through',
};
const STATUS_LABELS = {
  planning: 'Planning', in_progress: 'In Progress', decommissioning: 'Decommissioning',
  completed: 'Completed', on_hold: 'On Hold', cancelled: 'Cancelled',
};

const STATUS_FILTERS = [
  { id: 'ready', label: 'Ready to Invoice' },
  { id: 'all', label: 'All Jobs' },
  { id: 'completed', label: 'Completed' },
  { id: 'decommissioning', label: 'Decommissioning' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'planning', label: 'Planning' },
];

function statusStyle(s) { return STATUS_STYLES[s] || 'bg-slate-100 text-slate-600'; }
function statusLabel(s) { return STATUS_LABELS[s] || (s ? s.replace(/_/g, ' ') : '—'); }

export default function BillingPage({ onSelectJob }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ready');
  const [reportingJobId, setReportingJobId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [view, setView] = useState('summary'); // 'summary' | 'geotech' | 'invoices'
  const [invoiceJob, setInvoiceJob] = useState(null);
  const [companyName, setCompanyName] = useState('Ground Control');

  useEffect(() => {
    (async () => {
      try { const res = await base44.functions.invoke('getMyStaffProfile'); setProfile(res.data); } catch (e) {}
    })();
  }, []);

  const { data: jobs = [], isLoading } = useQuery({ queryKey: ['billing-jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: clients = [] } = useQuery({ queryKey: ['billing-clients'], queryFn: () => base44.entities.Client.list() });
  const { data: costItems = [] } = useQuery({ queryKey: ['billing-cost-items'], queryFn: () => base44.entities.JobCostItem.list() });
  const { data: hotelBookings = [] } = useQuery({ queryKey: ['billing-hotels'], queryFn: () => base44.entities.HotelBooking.list() });
  const { data: deliveries = [] } = useQuery({ queryKey: ['billing-deliveries'], queryFn: () => base44.entities.DeliveryLog.list() });
  const { data: timesheets = [] } = useQuery({ queryKey: ['billing-timesheets'], queryFn: () => base44.entities.Timesheet.list() });
  const { data: invLogs = [] } = useQuery({ queryKey: ['billing-inv-logs'], queryFn: () => base44.entities.InvestigationLog.list() });
  const { data: rigAssignments = [] } = useQuery({ queryKey: ['billing-rig-assignments'], queryFn: () => base44.entities.JobAssetAssignment.list() });
  const { data: rateItems = [] } = useQuery({
    queryKey: ['billing-rate-items'],
    queryFn: async () => {
      const all = await base44.entities.RateCardItem.filter({ category: 'labour' });
      return all.filter((r) => r.unit === 'day' && r.price != null);
    },
  });

  const clientById = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c])), [clients]);

  const rows = useMemo(() => {
    const byCost = groupByJob(costItems);
    const byHotel = groupByJob(hotelBookings);
    const byDelivery = groupByJob(deliveries);
    const byTimesheet = groupByJob(timesheets);
    const byInv = groupByJob(invLogs);
    const byRig = groupByJob(rigAssignments);
    return jobs.map((job) => computeBillingRow(job, {
      costItems: byCost[job.id] || [],
      hotelBookings: byHotel[job.id] || [],
      deliveries: byDelivery[job.id] || [],
      timesheets: byTimesheet[job.id] || [],
      invLogs: byInv[job.id] || [],
      rigAssignments: byRig[job.id] || [],
      rateItems,
    }));
  }, [jobs, costItems, hotelBookings, deliveries, timesheets, invLogs, rigAssignments, rateItems]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (statusFilter === 'all') return true;
        if (statusFilter === 'ready') return READY_STATUSES.includes(r.job.status);
        return r.job.status === statusFilter;
      })
      .filter((r) => {
        if (!q) return true;
        const client = clientById[r.job.client_id];
        return (
          r.job.name?.toLowerCase().includes(q) ||
          r.job.job_reference?.toLowerCase().includes(q) ||
          client?.name?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.revenueGross - a.revenueGross);
  }, [rows, search, statusFilter, clientById]);

  const totals = useMemo(() => filtered.reduce((acc, r) => ({
    netCost: acc.netCost + r.totalCostNet,
    vat: acc.vat + r.revenueVat,
    invoice: acc.invoice + r.revenueGross,
    count: acc.count + 1,
  }), { netCost: 0, vat: 0, invoice: 0, count: 0 }), [filtered]);

  // Metres drilled per job from AGS imports (for the geotech badge in the table)
  const metresByJob = useMemo(() => {
    const map = {};
    invLogs.forEach((l) => { if (l.job_id) { if (!map[l.job_id]) map[l.job_id] = []; map[l.job_id].push(l); } });
    Object.keys(map).forEach((jid) => { map[jid] = getTotalMetres(map[jid]); });
    return map;
  }, [invLogs]);

  const readyCount = rows.filter((r) => READY_STATUSES.includes(r.job.status)).length;

  const downloadReport = async (job) => {
    setReportingJobId(job.id);
    try {
      const res = await base44.functions.invoke('generateJobReport', { jobId: job.id });
      const win = window.open('', '_blank');
      win.document.write(res.data.html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 500);
    } catch (e) {
      console.error('Report error:', e);
    }
    setReportingJobId(null);
  };

  const groupedForJob = (job) => ({
    costItems: (groupByJob(costItems)[job.id]) || [],
    hotelBookings: (groupByJob(hotelBookings)[job.id]) || [],
    deliveries: (groupByJob(deliveries)[job.id]) || [],
    timesheets: (groupByJob(timesheets)[job.id]) || [],
    invLogs: (groupByJob(invLogs)[job.id]) || [],
    rigAssignments: (groupByJob(rigAssignments)[job.id]) || [],
    rateItems,
  });

  const openInvoice = (job) => {
    if (!job.client_id) { alert('This job has no client assigned. Add a client before raising an invoice.'); return; }
    setInvoiceJob(job);
  };

  const exportCsv = () => {
    const headers = [
      'Job Reference', 'Job Name', 'Client', 'Status', 'Billing Method',
      'Net Cost', 'Cost VAT', 'Cost Gross', 'Delivery & Task Charges',
      'Revenue Net', 'Revenue VAT', 'Invoice Total',
    ];
    const lines = filtered.map((r) => {
      const client = clientById[r.job.client_id]?.name || '';
      return [
        r.job.job_reference || '',
        r.job.name || '',
        client,
        statusLabel(r.job.status),
        r.revenueLabel,
        r.totalCostNet.toFixed(2),
        r.totalCostVat.toFixed(2),
        r.totalCostGross.toFixed(2),
        r.additionalCharges.toFixed(2),
        r.revenueNet.toFixed(2),
        r.revenueVat.toFixed(2),
        r.revenueGross.toFixed(2),
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    const csv = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `billing-summary-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (profile && !canViewCostings(profile)) {
    return (
      <div className="flex items-center justify-center py-20 text-center">
        <div>
          <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700">Billing access required</p>
          <p className="text-xs text-slate-400 mt-1">Only admins and managers can view billing summaries.</p>
        </div>
      </div>
    );
  }

  if (view === 'geotech') {
    return (
      <div>
        <div className="flex gap-1.5 mb-5 bg-white rounded-xl border border-slate-200 p-1.5 shadow-sm w-fit flex-wrap">
          <button onClick={() => setView('summary')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${view === 'summary' ? 'bg-[#2E5A1A] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}><Receipt className="w-4 h-4" /> Invoice Summary</button>
          <button onClick={() => setView('geotech')} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition bg-[#2E5A1A] text-white shadow-sm"><Mountain className="w-4 h-4" /> Geotechnical Report</button>
          <button onClick={() => setView('invoices')} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition text-slate-600 hover:bg-slate-100"><PoundSterling className="w-4 h-4" /> Invoices</button>
        </div>
        <GeotechBillingReport onSelectJob={onSelectJob} />
      </div>
    );
  }

  if (view === 'invoices') {
    return (
      <div>
        <div className="flex gap-1.5 mb-5 bg-white rounded-xl border border-slate-200 p-1.5 shadow-sm w-fit flex-wrap">
          <button onClick={() => setView('summary')} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition text-slate-600 hover:bg-slate-100"><Receipt className="w-4 h-4" /> Invoice Summary</button>
          <button onClick={() => setView('geotech')} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition text-slate-600 hover:bg-slate-100"><Mountain className="w-4 h-4" /> Geotechnical Report</button>
          <button onClick={() => setView('invoices')} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition bg-[#2E5A1A] text-white shadow-sm"><PoundSterling className="w-4 h-4" /> Invoices</button>
        </div>
        <SettingsSectionHeader icon={PoundSterling} title="Raised Invoices" description="Track every invoice raised from the billing summary — mark sent, paid, or void, and reprint anytime." />
        <InvoiceHistoryPanel companyName={companyName} />
        <GenerateInvoiceModal open={!!invoiceJob} onClose={() => setInvoiceJob(null)} job={invoiceJob}
          client={clientById[invoiceJob?.client_id]} data={invoiceJob ? groupedForJob(invoiceJob) : {}}
          companyName={companyName} raisedByName={profile?.name} />
      </div>
    );
  }

  return (
    <div>
      <SettingsSectionHeader
        icon={Receipt}
        title="Billing & Invoicing"
        description="Complete cost summary per job — reconcile CDRs and raise invoices in your finance system"
        actions={
          <button onClick={exportCsv} disabled={filtered.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-lg text-sm font-semibold hover:bg-[#1c4a12] transition disabled:opacity-50 shadow-sm">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        }
      />

      {/* View toggle */}
      <div className="flex gap-1.5 mb-5 bg-white rounded-xl border border-slate-200 p-1.5 shadow-sm w-fit flex-wrap">
        <button onClick={() => setView('summary')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${view === 'summary' ? 'bg-[#2E5A1A] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
          <Receipt className="w-4 h-4" /> Invoice Summary
        </button>
        <button onClick={() => setView('geotech')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${view === 'geotech' ? 'bg-[#2E5A1A] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
          <Mountain className="w-4 h-4" /> Geotechnical Report
        </button>
        <button onClick={() => setView('invoices')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${view === 'invoices' ? 'bg-[#2E5A1A] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
          <PoundSterling className="w-4 h-4" /> Invoices
        </button>
      </div>

      {/* Stat summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {isLoading ? (
          [...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
        ) : (
          <>
            <StatCard icon={PoundSterling} value={fmt(totals.invoice)} label="To Invoice (Gross)" sub={`${totals.count} ${totals.count === 1 ? 'job' : 'jobs'} in view`} gradient="stat-gradient-brand" />
            <StatCard icon={Wallet} value={fmt(totals.netCost)} label="Net Cost" sub="Internal cost" gradient="stat-gradient-blue" />
            <StatCard icon={TrendingUp} value={fmt(totals.vat)} label="VAT Payable" sub="On revenue" gradient="stat-gradient-amber" />
            <StatCard icon={Briefcase} value={readyCount} label="Ready to Invoice" sub="Decommissioning + Completed" gradient="stat-gradient-violet" />
          </>
        )}
      </div>

      {/* Toolbar */}
      <div className="card-modern rounded-2xl p-4 mb-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search job, reference or client…"
              className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5A1A]/30"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {STATUS_FILTERS.map((f) => (
              <button key={f.id} onClick={() => setStatusFilter(f.id)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition ${statusFilter === f.id ? 'bg-[#2E5A1A] text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card-modern rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-5 space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">
            <Receipt className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            No jobs match the current filter.
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium">Job</th>
                    <th className="text-left px-4 py-2.5 font-medium">Client</th>
                    <th className="text-left px-4 py-2.5 font-medium">Status</th>
                    <th className="text-left px-4 py-2.5 font-medium">Method</th>
                    <th className="text-right px-4 py-2.5 font-medium">Net Cost</th>
                    <th className="text-right px-4 py-2.5 font-medium">VAT</th>
                    <th className="text-right px-4 py-2.5 font-medium">Invoice Total</th>
                    <th className="text-right px-4 py-2.5 font-medium">Invoice</th>
                    <th className="text-right px-4 py-2.5 font-medium">Report</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((r) => (
                    <tr key={r.job.id} className="hover:bg-[#2E5A1A]/5 transition">
                      <td className="px-4 py-3 max-w-[220px]">
                        <button onClick={() => onSelectJob?.(r.job)} className="text-left font-medium text-slate-800 truncate hover:text-[#2E5A1A] block">
                          {r.job.name}
                        </button>
                        {r.job.job_reference && <p className="text-[10px] text-slate-400">{r.job.job_reference}</p>}
                        {metresByJob[r.job.id] > 0 && (
                          <span className="inline-flex items-center gap-0.5 mt-1 px-1.5 py-0.5 rounded-md bg-[#2E5A1A]/10 text-[#2E5A1A] text-[10px] font-semibold">
                            <Mountain className="w-2.5 h-2.5" /> {metresByJob[r.job.id].toFixed(1)}m drilled
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-[160px] truncate">{clientById[r.job.client_id]?.name || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusStyle(r.job.status)}`}>{statusLabel(r.job.status)}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{r.revenueLabel}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{fmt(r.totalCostNet)}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{fmt(r.revenueVat)}</td>
                      <td className="px-4 py-3 text-right font-bold text-[#2E5A1A]">{fmt(r.revenueGross)}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => openInvoice(r.job)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#2E5A1A] text-white rounded-lg text-[11px] font-medium hover:bg-[#1c4a12] transition">
                          <PoundSterling className="w-3 h-3" /> Raise
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => downloadReport(r.job)} disabled={reportingJobId === r.job.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 text-white rounded-lg text-[11px] font-medium hover:bg-slate-900 transition disabled:opacity-50">
                          {reportingJobId === r.job.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileBarChart className="w-3 h-3" />}
                          {reportingJobId === r.job.id ? '…' : 'PDF'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {filtered.map((r) => (
                <div key={r.job.id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <button onClick={() => onSelectJob?.(r.job)} className="text-left min-w-0 flex-1">
                      <p className="font-medium text-slate-800 text-sm truncate">{r.job.name}</p>
                      {r.job.job_reference && <p className="text-[10px] text-slate-400">{r.job.job_reference}</p>}
                      {metresByJob[r.job.id] > 0 && (
                        <span className="inline-flex items-center gap-0.5 mt-1 px-1.5 py-0.5 rounded-md bg-[#2E5A1A]/10 text-[#2E5A1A] text-[10px] font-semibold">
                          <Mountain className="w-2.5 h-2.5" /> {metresByJob[r.job.id].toFixed(1)}m drilled
                        </span>
                      )}
                    </button>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${statusStyle(r.job.status)}`}>{statusLabel(r.job.status)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <span className="font-medium text-slate-600">{clientById[r.job.client_id]?.name || '—'}</span>
                    <span>·</span>
                    <span>{r.revenueLabel}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide">Net Cost</p>
                      <p className="text-sm font-semibold text-slate-800">{fmt(r.totalCostNet)}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300" />
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide">Invoice Total</p>
                      <p className="text-sm font-bold text-[#2E5A1A]">{fmt(r.revenueGross)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openInvoice(r.job)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[#2E5A1A] text-white rounded-lg text-xs font-medium hover:bg-[#1c4a12] transition">
                      <PoundSterling className="w-3.5 h-3.5" /> Raise Invoice
                    </button>
                    <button onClick={() => downloadReport(r.job)} disabled={reportingJobId === r.job.id}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 text-white rounded-lg text-xs font-medium hover:bg-slate-900 transition disabled:opacity-50">
                      {reportingJobId === r.job.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileBarChart className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <GenerateInvoiceModal open={!!invoiceJob} onClose={() => setInvoiceJob(null)} job={invoiceJob}
        client={invoiceJob ? clientById[invoiceJob.client_id] : null}
        data={invoiceJob ? groupedForJob(invoiceJob) : {}}
        companyName={companyName} raisedByName={profile?.name} />
    </div>
  );
}