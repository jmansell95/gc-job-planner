// Weekly timesheet PDF generator — uses jspdf (installed).
// Renders a clean, payroll-ready weekly timesheet for one staff member.
// Shows ALL jobs/tasks per day (not just the first entry), with both
// employee and manager drawn signatures injected into the document.

import { format } from 'date-fns';

const fmtDur = (mins) => {
  const m = Math.round(Number(mins) || 0);
  const h = Math.floor(m / 60), r = m % 60;
  if (h && r) return `${h}h ${r}m`;
  if (h) return `${h}h`;
  return m > 0 ? `${r}m` : '—';
};

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * @param {object} data
 * @param {string} data.staffName
 * @param {string} [data.staffRole]
 * @param {string} data.weekStart  ISO Monday date
 * @param {Array}  data.dailyEntries  Array of { dateStr, dayLabel, rows: [{ jobName, taskDescription, onSiteMins, travelMins, totalMins, isOvertime, otMins, otMultiplier, meterage, status }] }
 * @param {object} data.totals  { totalMins, onSiteMins, travelMins, otMins, meterage }
 * @param {string} [data.approvedByName]
 * @param {string} [data.employeeSignatureUrl]
 * @param {string} [data.managerSignatureUrl]
 */
export async function downloadWeeklyTimesheetPDF(data) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = margin;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(30, 60, 30);
  doc.text('Weekly Timesheet', margin, y + 6);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(90, 90, 90);
  const weekEnd = new Date(data.weekStart + 'T00:00:00');
  weekEnd.setDate(weekEnd.getDate() + 6);
  doc.text(`Week of ${format(new Date(data.weekStart + 'T00:00:00'), 'dd MMM yyyy')} – ${format(weekEnd, 'dd MMM yyyy')}`, margin, y + 12);
  y += 20;

  // Staff details
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text(data.staffName || 'Staff member', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  if (data.staffRole) {
    doc.text(data.staffRole.replace(/_/g, ' '), margin, y + 5);
  }
  doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, pageW - margin, y, { align: 'right' });
  y += 12;

  // Table header
  const cols = [
    { label: 'Day', w: 16 },
    { label: 'Date', w: 16 },
    { label: 'Job / Task', w: 55 },
    { label: 'On-site', w: 20 },
    { label: 'Travel', w: 18 },
    { label: 'OT', w: 16 },
    { label: 'Total', w: 20 },
    { label: 'Meterage', w: 18 },
  ];
  const tableW = cols.reduce((s, c) => s + c.w, 0);
  let x = margin;
  doc.setFillColor(46, 90, 26);
  doc.rect(margin, y, tableW, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  cols.forEach((c) => {
    doc.text(c.label, x + 1.5, y + 5.5);
    x += c.w;
  });
  y += 8;

  // Rows — iterate all entries per day
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  let rowAlt = false;
  let dayRowCount = 0;

  data.dailyEntries.forEach((d) => {
    // d.rows is an array of task rows for this day
    const rows = d.rows || [];
    // Only render days that have at least one row with data
    const hasData = rows.some((r) => r.totalMins > 0 || r.status === 'merged');
    if (!hasData) return;

    rows.forEach((row, rowIdx) => {
      if (y > 270) { doc.addPage(); y = margin; rowAlt = false; }
      if (rowAlt) { doc.setFillColor(245, 247, 244); doc.rect(margin, y, tableW, 7, 'F'); }
      rowAlt = !rowAlt;
      doc.setTextColor(50, 50, 50);
      x = margin;
      // Show day label + date only on the first row of each day
      const dayCell = rowIdx === 0 ? d.dayLabel : '';
      const dateCell = rowIdx === 0 ? d.dateStr : '';
      const jobTask = (row.jobName || '—').slice(0, 28) + (row.taskDescription ? ` — ${row.taskDescription}` : '').slice(0, 28);
      const cells = [
        dayCell,
        dateCell,
        jobTask,
        fmtDur(row.onSiteMins),
        fmtDur(row.travelMins),
        row.isOvertime ? `${fmtDur(row.otMins)} ×${row.otMultiplier}` : '—',
        fmtDur(row.totalMins),
        row.meterage ? `${row.meterage}m` : '—',
      ];
      cells.forEach((val, i) => {
        doc.text(String(val), x + 1.5, y + 5);
        x += cols[i].w;
      });
      y += 7;
      dayRowCount++;
    });
  });

  // Totals row
  if (y > 270) { doc.addPage(); y = margin; }
  doc.setFillColor(230, 238, 225);
  doc.rect(margin, y, tableW, 9, 'F');
  doc.setTextColor(30, 60, 30);
  doc.setFont('helvetica', 'bold');
  x = margin;
  const totalCells = ['TOTAL', '', '', fmtDur(data.totals.onSiteMins), fmtDur(data.totals.travelMins), fmtDur(data.totals.otMins), fmtDur(data.totals.totalMins), data.totals.meterage ? `${data.totals.meterage}m` : '—'];
  totalCells.forEach((val, i) => {
    if (val) doc.text(String(val), x + 1.5, y + 6);
    x += cols[i].w;
  });
  y += 14;

  // Summary line
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text(`Total payable hours: ${fmtDur(data.totals.totalMins)}`, margin, y);
  if (data.totals.otMins > 0) doc.text(`Overtime: ${fmtDur(data.totals.otMins)}`, margin + 70, y);
  y += 12;

  // Sign-off — inject captured signature images (draw-to-sign) where present
  const sigH = 18;
  const empUrl = data.employeeSignatureUrl;
  const mgrUrl = data.managerSignatureUrl;
  const loadImg = async (url) => {
    if (!url) return null;
    try {
      const res = await fetch(url);
      const buf = await res.arrayBuffer();
      const u8 = new Uint8Array(buf);
      const isPng = u8[0] === 0x89 && u8[1] === 0x50;
      return { data: u8, format: isPng ? 'PNG' : 'JPEG' };
    } catch { return null; }
  };
  const [empImg, mgrImg] = await Promise.all([loadImg(empUrl), loadImg(mgrUrl)]);

  if (empImg) {
    doc.addImage(empImg.data, empImg.format, margin, y - sigH, 65, sigH);
  } else {
    doc.setDrawColor(180, 180, 180);
    doc.line(margin, y, margin + 65, y);
  }
  if (mgrImg) {
    doc.addImage(mgrImg.data, mgrImg.format, margin + 85, y - sigH, 65, sigH);
  } else {
    doc.setDrawColor(180, 180, 180);
    doc.line(margin + 85, y, margin + 85 + 65, y);
  }
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text('Employee signature', margin, y + 4);
  doc.text('Manager signature', margin + 85, y + 4);
  y += 14;
  doc.setDrawColor(180, 180, 180);
  doc.line(margin, y, pageW - margin, y);
  doc.text(`Approved by: ${data.approvedByName || '—'}`, margin, y + 4);

  const fileName = `Timesheet_${(data.staffName || 'staff').replace(/\s+/g, '_')}_${data.weekStart}.pdf`;
  doc.save(fileName);
}