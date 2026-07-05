import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Users, CalendarRange, Briefcase, FileText, Printer, Mail, BarChart3, X, Send, Clock, TrendingUp, PoundSterling } from 'lucide-react';
import { format, subWeeks } from 'date-fns';
import PageHeader from '@/components/PageHeader';
import ReportTable from '@/components/reports/ReportTable';
import { REPORT_TYPES, buildReport, reportPrintDocument, reportHtmlFragment } from '@/utils/reports';
import { computeStaffOvertime, buildRateMap, entryMinutes } from '@/utils/overtime';

const ICONS = { Users, CalendarRange, Briefcase, FileText };

const fmtHours = (m) => { const mm = Math.round(Number(m) || 0); return (mm / 60).toFixed(1) + 'h'; };
const fmtCost = (n) => '£' + (Math.round((n || 0) * 100) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 });

export default function ReportsManager() {
  const [reportType, setReportType] = useState('staff');
  const [dateFrom, setDateFrom] = useState(format(subWeeks(new Date(), 8), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [staffFilter, setStaffFilter] = useState('all');
  const [emailOpen, setEmailOpen] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [sending, setSending] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null);

  const { data: timesheets = [], isLoading } = useQuery({ queryKey: ['reports-timesheets'], queryFn: () => base44.entities.Timesheet.list('-date', 500) });
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: overtimeRates = [] } = useQuery({ queryKey: ['overtime-rates'], queryFn: () => base44.entities.OvertimeRate.list() });
  const { data: overtimeSetting } = useQuery({ queryKey: ['overtime-setting'], queryFn: async () => { const l = await base44.entities.OvertimeSetting.list(); return l[0] || null; } });
  const { data: currentUser } = useQuery({ queryKey: ['current-user'], queryFn: () => base44.auth.me() });

  const rateMap = buildRateMap(overtimeRates);
  const threshold = overtimeSetting?.weekly_threshold_hours ?? 40;

  const otBreakdowns = useMemo(() => {
    const map = {};
    staff.forEach(s => {
      const all = timesheets.filter(t => t.staff_id === s.id && !t.is_break && ['submitted', 'approved'].includes(t.status));
      const hourly = s.day_rate ? s.day_rate / 8 : 0;
      map[s.id] = computeStaffOvertime(all, rateMap, threshold, hourly);
    });
    return map;
  }, [staff, timesheets, rateMap, threshold]);

  const entries = useMemo(() => timesheets.filter(t =>
    !t.is_break && ['submitted', 'approved'].includes(t.status) &&
    t.date >= dateFrom && t.date <= dateTo &&
    (staffFilter === 'all' || t.staff_id === staffFilter)
  ), [timesheets, dateFrom, dateTo, staffFilter]);

  const report = useMemo(() => buildReport(reportType, { entries, staff, jobs, otBreakdowns, dateFrom, dateTo }), [reportType, entries, staff, jobs, otBreakdowns, dateFrom, dateTo]);

  const summary = useMemo(() => {
    let mins = 0, otMins = 0, cost = 0;
    entries.forEach(t => {
      mins += entryMinutes(t);
      const b = otBreakdowns[t.staff_id]?.[t.id] || {};
      otMins += b.otMins || 0;
      cost += b.cost || 0;
    });
    return { entries: entries.length, hours: fmtHours(mins), ot: fmtHours(otMins), cost: fmtCost(cost) };
  }, [entries, otBreakdowns]);

  const handlePrint = () => {
    const doc = reportPrintDocument(report, { dateFrom, dateTo, staffFilter, staff });
    const w = window.open('', '_blank');
    if (!w) { alert('Please allow popups to print reports.'); return; }
    w.document.write(doc);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  const openEmail = () => {
    setRecipient(currentUser?.email || '');
    setSubject(`${report.title} — ${format(new Date(), 'dd MMM yyyy')}`);
    setEmailStatus(null);
    setEmailOpen(true);
  };

  const handleSendEmail = async () => {
    if (!recipient.trim()) return;
    setSending(true); setEmailStatus(null);
    try {
      const html = reportHtmlFragment(report, { dateFrom, dateTo, staffFilter, staff });
      await base44.integrations.Core.SendEmail({ to: recipient.trim(), subject, body: html });
      setEmailStatus({ type: 'success', message: 'Report emailed successfully.' });
    } catch (e) {
      setEmailStatus({ type: 'error', message: e.message || 'Failed to send email.' });
    }
    setSending(false);
  };

  const activeType = REPORT_TYPES.find(t => t.key === reportType);

  return (
    <div>
      <PageHeader title="Reports" icon={BarChart3} />

      {/* Report type tabs */}
      <div className="flex flex-wrap gap-2 mb-5">
        {REPORT_TYPES.map(t => {
          const Icon = ICONS[t.icon];
          return (
            <button key={t.key} onClick={() => setReportType(t.key)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition ${reportType === t.key ? 'bg-emerald-700 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Filters + actions */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-5 flex flex-col lg:flex-row gap-3 lg:items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Staff</label>
          <select value={staffFilter} onChange={e => setStaffFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-emerald-600 capitalize">
            <option value="all">All staff</option>
            {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="flex gap-2 lg:ml-auto">
          <button onClick={handlePrint} disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 active:scale-95 transition disabled:opacity-50">
            <Printer className="w-4 h-4" /> Print
          </button>
          <button onClick={openEmail} disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm font-semibold hover:bg-emerald-800 active:scale-95 transition disabled:opacity-50">
            <Mail className="w-4 h-4" /> Email
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { icon: FileText, label: 'Entries', value: summary.entries, accent: 'bg-slate-100 text-slate-600' },
          { icon: Clock, label: 'Total Hours', value: summary.hours, accent: 'bg-emerald-100 text-emerald-700' },
          { icon: TrendingUp, label: 'Overtime', value: summary.ot, accent: 'bg-amber-100 text-amber-700' },
          { icon: PoundSterling, label: 'Labour Cost', value: summary.cost, accent: 'bg-blue-100 text-blue-700' },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${s.accent}`}><Icon className="w-3.5 h-3.5" /></div>
                <p className="text-xs text-slate-500 font-medium">{s.label}</p>
              </div>
              <p className="text-xl font-bold text-slate-900 mt-1.5">{s.value}</p>
            </div>
          );
        })}
      </div>

      {/* Report table */}
      <div className="mb-2 flex items-center gap-2">
        <h2 className="font-semibold text-slate-900">{activeType?.label}</h2>
        <span className="text-xs text-slate-400">{format(new Date(dateFrom + 'T00:00:00'), 'dd MMM')} – {format(new Date(dateTo + 'T00:00:00'), 'dd MMM yyyy')}</span>
      </div>
      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center text-sm text-slate-400">Loading report…</div>
      ) : (
        <ReportTable report={report} emptyIcon={BarChart3} />
      )}

      {/* Email modal */}
      {emailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => !sending && setEmailOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-900 flex items-center gap-2"><Mail className="w-5 h-5 text-emerald-700" /> Email Report</h3>
              <button onClick={() => !sending && setEmailOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Recipient</label>
                <input type="email" value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="name@example.com"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Subject</label>
                <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
              </div>
              <p className="text-xs text-slate-400">Sends a styled HTML report of <span className="font-medium text-slate-600">{activeType?.label}</span> for {format(new Date(dateFrom + 'T00:00:00'), 'dd MMM')} – {format(new Date(dateTo + 'T00:00:00'), 'dd MMM yyyy')}.</p>
              {emailStatus && (
                <p className={`text-xs px-3 py-2 rounded-lg ${emailStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{emailStatus.message}</p>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={handleSendEmail} disabled={sending || !recipient.trim()}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 transition text-sm font-semibold disabled:opacity-50">
                  <Send className="w-3.5 h-3.5" /> {sending ? 'Sending…' : 'Send Report'}
                </button>
                <button onClick={() => !sending && setEmailOpen(false)} disabled={sending}
                  className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition text-sm font-semibold">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}