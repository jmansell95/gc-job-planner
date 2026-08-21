import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  FileSpreadsheet, FileText, Loader2, Download,
} from 'lucide-react';
import jsPDF from 'jspdf';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

/**
 * AFPExportButtons — two export buttons for the AFP Builder header:
 * 1. Download Excel — generates a .xlsx in the Lump Sum template format
 *    pre-filled with the AFP's current data (via exportAFPToExcel backend function).
 * 2. Download PDF — generates a client-facing PDF using jsPDF (frontend).
 */
export default function AFPExportButtons({ afp, job }) {
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const { data: lineItems = [] } = useQuery({
    queryKey: ['afp-line-items', afp?.id],
    queryFn: () => base44.entities.AFPLineItem.filter({ afp_id: afp.id }, 'sort_order', 500),
    enabled: !!afp?.id,
  });

  const handleDownloadExcel = async () => {
    if (!afp) return;
    setExportingExcel(true);
    try {
      const res = await base44.functions.invoke('exportAFPToExcel', { afp_id: afp.id });
      const data = res.data || res;
      if (data.error) throw new Error(data.error);
      // Trigger download
      const a = document.createElement('a');
      a.href = data.file_url;
      a.download = data.file_name || `AFP_${afp.afp_number}.xlsx`;
      a.click();
    } catch (e) {
      console.error('Excel export failed:', e);
    }
    setExportingExcel(false);
  };

  const handleDownloadPDF = () => {
    if (!afp) return;
    setExportingPdf(true);
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;
      let y = 20;

      // ── Header ──
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(46, 90, 26);
      doc.text('Application for Payment', margin, y);
      y += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`AFP ${afp.afp_number} — ${job?.name || afp.job_name || ''}`, margin, y);
      y += 10;

      // ── Contract Details ──
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('Contract Details', margin, y);
      y += 6;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const details = [
        ['Client:', afp.client_name || '—'],
        ['Client PO:', afp.client_po || '—'],
        ['GC Job Number:', afp.gc_job_number || '—'],
        ['Contract Value:', fmt(afp.contract_value)],
        ['Period:', `${fmtDate(afp.period_start_date)} → ${fmtDate(afp.period_end_date)}`],
        ['Payment Due:', afp.payment_due_date || '—'],
      ];
      for (const [label, value] of details) {
        doc.setTextColor(100, 116, 139);
        doc.text(label, margin, y);
        doc.setTextColor(15, 23, 42);
        doc.text(String(value), margin + 35, y);
        y += 5;
      }
      y += 6;

      // ── Measured Works table ──
      const mwItems = lineItems.filter(li =>
        li.sheet_name === 'measured_works' || li.sheet_name === 'drilling' ||
        li.sheet_name === 'plant_hire' || li.sheet_name === 'rates'
      );

      if (mwItems.length > 0) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Measured Works', margin, y);
        y += 6;

        // Table header
        doc.setFontSize(8);
        doc.setFillColor(241, 245, 249);
        doc.rect(margin, y - 4, pageWidth - margin * 2, 6, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(71, 85, 105);
        doc.text('Description', margin + 1, y);
        doc.text('Unit', pageWidth - 75, y);
        doc.text('Qty', pageWidth - 60, y, { align: 'right' });
        doc.text('Rate', pageWidth - 45, y, { align: 'right' });
        doc.text('Amount', pageWidth - margin - 1, y, { align: 'right' });
        y += 6;

        // Table rows
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);
        for (const li of mwItems) {
          if (y > 270) { doc.addPage(); y = 20; }
          const desc = (li.item || '').substring(0, 50);
          doc.text(desc, margin + 1, y);
          doc.text(li.unit || '—', pageWidth - 75, y);
          doc.text(String(li.qty || 0), pageWidth - 60, y, { align: 'right' });
          doc.text(fmt(li.rate), pageWidth - 45, y, { align: 'right' });
          doc.text(fmt(li.amount), pageWidth - margin - 1, y, { align: 'right' });
          y += 5;
        }
        y += 4;
      }

      // ── Variations ──
      const varItems = lineItems.filter(li => li.sheet_name === 'variations');
      if (varItems.length > 0) {
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Variations', margin, y);
        y += 6;

        doc.setFontSize(8);
        for (const li of varItems) {
          if (y > 270) { doc.addPage(); y = 20; }
          doc.text((li.item || '').substring(0, 60), margin + 1, y);
          doc.text(fmt(li.amount), pageWidth - margin - 1, y, { align: 'right' });
          y += 5;
        }
        y += 4;
      }

      // ── Materials ──
      const matItems = lineItems.filter(li => li.sheet_name === 'materials');
      if (matItems.length > 0) {
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Materials On Site', margin, y);
        y += 6;

        doc.setFontSize(8);
        for (const li of matItems) {
          if (y > 270) { doc.addPage(); y = 20; }
          doc.text((li.item || '').substring(0, 60), margin + 1, y);
          doc.text(fmt(li.amount), pageWidth - margin - 1, y, { align: 'right' });
          y += 5;
        }
        y += 4;
      }

      // ── Totals ──
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setDrawColor(46, 90, 26);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('Total Claimed:', margin, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(fmt(afp.total_claimed || afp.original_total), pageWidth - margin, y, { align: 'right' });
      y += 6;

      if (afp.disputed_total > 0) {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(180, 83, 9);
        doc.text('Disputed:', margin, y);
        doc.setFont('helvetica', 'bold');
        doc.text(fmt(afp.disputed_total), pageWidth - margin, y, { align: 'right' });
        y += 6;
      }

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(22, 163, 74);
      doc.text('Agreed Total:', margin, y);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(fmt(afp.agreed_total), pageWidth - margin, y, { align: 'right' });

      // Save
      const fileName = `AFP_${afp.afp_number}_${(job?.name || afp.job_name || 'job').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      doc.save(fileName);
    } catch (e) {
      console.error('PDF export failed:', e);
    }
    setExportingPdf(false);
  };

  return (
    <>
      <button
        onClick={handleDownloadExcel}
        disabled={exportingExcel}
        className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition active:scale-95 disabled:opacity-50"
        title="Download Excel (Lump Sum template format)"
      >
        {exportingExcel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
        Excel
      </button>
      <button
        onClick={handleDownloadPDF}
        disabled={exportingPdf}
        className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition active:scale-95 disabled:opacity-50"
        title="Download client-facing PDF"
      >
        {exportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
        PDF
      </button>
    </>
  );
}