import { computeStaffOvertime, buildRateMap, weekKey, entryMinutes } from './overtime';
import { format } from 'date-fns';

export const REPORT_TYPES = [
  { key: 'staff', label: 'Staff Overtime & Hours', icon: 'Users' },
  { key: 'weekly', label: 'Weekly Hours Matrix', icon: 'CalendarRange' },
  { key: 'job', label: 'Job Hours & Meterage', icon: 'Briefcase' },
  { key: 'ledger', label: 'Timesheet Ledger', icon: 'FileText' },
];

const fmtHours = (m) => {
  const mm = Math.round(Number(m) || 0);
  return mm > 0 ? (mm / 60).toFixed(1) + 'h' : '—';
};

export function buildReport(type, ctx) {
  switch (type) {
    case 'staff': return staffReport(ctx);
    case 'weekly': return weeklyReport(ctx);
    case 'job': return jobReport(ctx);
    case 'ledger': return ledgerReport(ctx);
    default: return null;
  }
}

function staffReport({ entries, staff, otBreakdowns }) {
  const columns = [
    { key: 'staff', label: 'Staff', align: 'left' },
    { key: 'week', label: 'Week', align: 'left' },
    { key: 'std', label: 'Std Hours', align: 'right' },
    { key: 'ot', label: 'OT Hours', align: 'right' },
    { key: 'total', label: 'Total', align: 'right' },
  ];
  const byStaff = {};
  entries.forEach(t => { (byStaff[t.staff_id] = byStaff[t.staff_id] || []).push(t); });
  const rows = [];
  let tStd = 0, tOt = 0;
  const nameOf = (id) => staff.find(s => s.id === id)?.name || 'Unknown';
  Object.keys(byStaff).sort((a, b) => nameOf(a).localeCompare(nameOf(b))).forEach(sid => {
    const byWeek = {};
    byStaff[sid].forEach(t => { const wk = weekKey(t.date); (byWeek[wk] = byWeek[wk] || []).push(t); });
    Object.keys(byWeek).sort().forEach(wk => {
      let std = 0, ot = 0;
      byWeek[wk].forEach(t => {
        const b = otBreakdowns[sid]?.[t.id] || {};
        std += b.regularMins || 0;
        ot += b.otMins || 0;
      });
      rows.push([
        nameOf(sid),
        `w/c ${format(new Date(wk + 'T00:00:00'), 'dd MMM yyyy')}`,
        fmtHours(std), fmtHours(ot), fmtHours(std + ot),
      ]);
      tStd += std; tOt += ot;
    });
  });
  const totals = ['Total', '', fmtHours(tStd), fmtHours(tOt), fmtHours(tStd + tOt)];
  return { title: 'Staff Overtime & Hours', columns, rows, totals };
}

function weeklyReport({ entries, staff }) {
  const weekSet = new Set();
  const byStaff = {};
  entries.forEach(t => {
    const wk = weekKey(t.date);
    weekSet.add(wk);
    byStaff[t.staff_id] = byStaff[t.staff_id] || {};
    byStaff[t.staff_id][wk] = (byStaff[t.staff_id][wk] || 0) + entryMinutes(t);
  });
  const weeks = [...weekSet].sort();
  const columns = [
    { key: 'staff', label: 'Staff', align: 'left' },
    ...weeks.map(wk => ({ key: wk, label: format(new Date(wk + 'T00:00:00'), 'dd MMM'), align: 'right' })),
    { key: 'total', label: 'Total', align: 'right' },
  ];
  const rows = [];
  const weekTotals = {};
  weeks.forEach(wk => weekTotals[wk] = 0);
  let grand = 0;
  staff.filter(s => byStaff[s.id]).sort((a, b) => a.name.localeCompare(b.name)).forEach(s => {
    let total = 0;
    const row = [s.name];
    weeks.forEach(wk => {
      const m = byStaff[s.id][wk] || 0;
      row.push(m > 0 ? fmtHours(m) : '—');
      total += m;
      weekTotals[wk] += m;
    });
    row.push(fmtHours(total));
    grand += total;
    rows.push(row);
  });
  const totals = ['Total', ...weeks.map(wk => fmtHours(weekTotals[wk])), fmtHours(grand)];
  return { title: 'Weekly Hours Matrix', columns, rows, totals };
}

function jobReport({ entries, staff, jobs, otBreakdowns }) {
  const columns = [
    { key: 'job', label: 'Job', align: 'left' },
    { key: 'type', label: 'Type', align: 'left' },
    { key: 'staff', label: 'Staff', align: 'right' },
    { key: 'hours', label: 'Total Hours', align: 'right' },
    { key: 'ot', label: 'OT Hours', align: 'right' },
    { key: 'meterage', label: 'Meterage', align: 'right' },
  ];
  const byJob = {};
  entries.forEach(t => { const jid = t.job_id || 'none'; (byJob[jid] = byJob[jid] || []).push(t); });
  const rows = [];
  let tHours = 0, tOt = 0, tMeter = 0;
  Object.keys(byJob).forEach(jid => {
    const job = jobs.find(j => j.id === jid);
    const staffSet = new Set();
    let mins = 0, ot = 0, meter = 0;
    byJob[jid].forEach(t => {
      staffSet.add(t.staff_id);
      const b = otBreakdowns[t.staff_id]?.[t.id] || {};
      mins += entryMinutes(t);
      ot += b.otMins || 0;
      meter += Number(t.meterage) || 0;
    });
    rows.push([
      job?.name || '—',
      job?.job_type?.replace(/_/g, ' ') || '—',
      staffSet.size,
      fmtHours(mins), fmtHours(ot),
      meter > 0 ? `${meter}m` : '—',
    ]);
    tHours += mins; tOt += ot; tMeter += meter;
  });
  rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  const totals = ['Total', '', '', fmtHours(tHours), fmtHours(tOt), tMeter > 0 ? `${tMeter}m` : '—'];
  return { title: 'Job Hours & Meterage', columns, rows, totals };
}

function ledgerReport({ entries, staff, jobs, otBreakdowns }) {
  const columns = [
    { key: 'date', label: 'Date', align: 'left' },
    { key: 'staff', label: 'Staff', align: 'left' },
    { key: 'job', label: 'Job', align: 'left' },
    { key: 'task', label: 'Task', align: 'left' },
    { key: 'hours', label: 'Hours', align: 'right' },
    { key: 'ot', label: 'OT', align: 'right' },
    { key: 'status', label: 'Status', align: 'left' },
  ];
  const sorted = [...entries].sort((a, b) => {
    const da = new Date(a.date + 'T00:00:00').getTime();
    const db = new Date(b.date + 'T00:00:00').getTime();
    if (da !== db) return db - da;
    return String(b.created_date || '').localeCompare(String(a.created_date || ''));
  });
  const rows = sorted.map(t => {
    const member = staff.find(s => s.id === t.staff_id);
    const job = jobs.find(j => j.id === t.job_id);
    const b = otBreakdowns[t.staff_id]?.[t.id] || {};
    return [
      format(new Date(t.date + 'T00:00:00'), 'dd MMM yyyy'),
      member?.name || 'Unknown',
      job?.name || '—',
      t.task_description || '—',
      fmtHours(entryMinutes(t)),
      b.otMins > 0 ? `${fmtHours(b.otMins)} ×${b.multiplier}` : '—',
      t.status,
    ];
  });
  let tMins = 0;
  entries.forEach(t => { tMins += entryMinutes(t); });
  const totals = ['Total', '', '', '', fmtHours(tMins), '', ''];
  return { title: 'Timesheet Ledger', columns, rows, totals };
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const alignCss = (a) => a === 'right' ? 'right' : a === 'center' ? 'center' : 'left';

export function reportTableHtml(report) {
  const ths = report.columns.map(c => `<th style="text-align:${alignCss(c.align)};padding:10px 12px;background:#064e3b;color:#fff;font-size:11px;text-transform:uppercase;letter-spacing:.04em;">${esc(c.label)}</th>`).join('');
  const trs = report.rows.map((row, i) => {
    const tds = row.map((v, j) => `<td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;text-align:${alignCss(report.columns[j]?.align)};font-size:12px;color:#334155;">${esc(String(v))}</td>`).join('');
    return `<tr style="${i % 2 ? 'background:#f8fafc;' : ''}">${tds}</tr>`;
  }).join('');
  const tfoot = report.totals ? `<tfoot><tr>${report.totals.map((v, j) => `<td style="padding:10px 12px;background:#d1fae5;border-top:2px solid #10b981;font-weight:700;text-align:${alignCss(report.columns[j]?.align)};font-size:12px;color:#064e3b;">${esc(String(v))}</td>`).join('')}</tr></tfoot>` : '';
  if (report.rows.length === 0) {
    return `<table style="width:100%;border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;"><tbody><tr><td style="padding:24px;text-align:center;color:#94a3b8;font-family:Arial,Helvetica,sans-serif;">No data for the selected filters.</td></tr></tbody></table>`;
  }
  return `<table style="width:100%;border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody>${tfoot}</table>`;
}

export function reportHtmlFragment(report, meta) {
  const range = `${format(new Date(meta.dateFrom + 'T00:00:00'), 'dd MMM yyyy')} – ${format(new Date(meta.dateTo + 'T00:00:00'), 'dd MMM yyyy')}`;
  const staffLabel = meta.staffFilter === 'all' ? 'All staff' : (meta.staff.find(s => s.id === meta.staffFilter)?.name || 'All staff');
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:760px;margin:0 auto;">
    <div style="background:linear-gradient(135deg,#065f46,#047857);padding:20px 24px;border-radius:12px 12px 0 0;color:#fff;">
      <h1 style="margin:0;font-size:20px;">${esc(report.title)}</h1>
      <p style="margin:4px 0 0;font-size:13px;opacity:.9;">GC Job Planner · ${range} · ${esc(staffLabel)}</p>
    </div>
    <div style="padding:16px 0;">${reportTableHtml(report)}</div>
    <p style="font-size:11px;color:#94a3b8;text-align:center;margin-top:16px;">Generated ${format(new Date(), 'dd MMM yyyy HH:mm')}</p>
  </div>`;
}

export function reportPrintDocument(report, meta) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(report.title)}</title>
  <style>@page{size:landscape;margin:12mm;}body{margin:0;background:#fff;color:#1e293b;}</style>
  </head><body>${reportHtmlFragment(report, meta)}</body></html>`;
}