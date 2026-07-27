import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { FileDown, Loader2, ShieldCheck, ShieldAlert, ShieldX, HelpCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import { safeFormat } from '@/utils/format';
import { useToast } from '@/components/ui/use-toast';

const COMPLIANCE_LABEL = {
  compliant: 'Compliant',
  expiring: 'Expiring Soon',
  expired: 'Expired',
  unknown: 'Unknown',
};
const COMPLIANCE_ICON = {
  compliant: ShieldCheck,
  expiring: ShieldAlert,
  expired: ShieldX,
  unknown: HelpCircle,
};
const TYPE_LABEL = {
  rig: 'Rig', machinery: 'Machinery', trailer: 'Trailer', vehicle: 'Vehicle',
  lifting: 'Lifting Gear', portable_appliance: 'PAT / Electrical',
};

/**
 * Compliance Pack Generator — one-click "Golden Record" audit pack.
 * Builds a sealed PDF containing the asset's current status, full service
 * history and a list of all certificates on file, ready for auditors.
 */
export default function CompliancePackGenerator({ asset, linkedItems = [] }) {
  const [building, setBuilding] = useState(false);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!asset) return;
    setBuilding(true);
    try {
      const assetIds = [asset.id, ...(asset.linked_equipment_ids || [])];
      const records = await base44.entities.ServiceRecord.list('-date', 500);
      const relevant = records.filter(r => assetIds.includes(r.site_asset_id));

      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const W = doc.internal.pageSize.getWidth();
      const M = 40;
      let y = 50;

      // === Header band ===
      doc.setFillColor(46, 90, 26);
      doc.rect(0, 0, W, 70, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('ASSET COMPLIANCE PACK', M, 35);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Ground Control · Asset Hub · Generated ${safeFormat(new Date(), "dd MMM yyyy 'at' HH:mm")}`, M, 52);
      y = 100;

      // === Asset identity ===
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(asset.name, M, y);
      y += 20;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      const idLines = [
        `Type: ${TYPE_LABEL[asset.asset_type] || asset.asset_type || '—'}${asset.rig_type && asset.rig_type !== 'n/a' ? ' (' + asset.rig_type.toUpperCase() + ')' : ''}`,
        `Serial / Reg: ${asset.serial_number || '—'}`,
        `Equipment: ${asset.equipment_type || '—'}`,
        `Responsible Person: ${asset.responsible_person || '—'}`,
        `Active: ${asset.is_active !== false ? 'Yes' : 'No'}`,
      ];
      idLines.forEach(l => { doc.text(l, M, y); y += 14; });
      y += 8;

      // === Compliance status box ===
      const status = COMPLIANCE_LABEL[asset.compliance_status] || 'Unknown';
      const tone = asset.compliance_status === 'expired' ? [239, 68, 68]
        : asset.compliance_status === 'expiring' ? [245, 158, 11]
        : asset.compliance_status === 'compliant' ? [16, 185, 129]
        : [148, 163, 184];
      doc.setFillColor(tone[0], tone[1], tone[2]);
      doc.roundedRect(M, y, 220, 38, 6, 6, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(status, M + 12, y + 16);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(asset.compliance_expiry_date
        ? `Expiry: ${safeFormat(asset.compliance_expiry_date, 'dd MMM yyyy')}`
        : 'Lifetime CoC (no expiry)', M + 12, y + 30);
      doc.setTextColor(71, 85, 105);
      doc.text(`Last checked: ${asset.compliance_last_checked ? safeFormat(asset.compliance_last_checked, 'dd MMM yyyy HH:mm') : 'Never'}`, M + 240, y + 16);
      y += 60;

      // === Linked equipment ===
      if (linkedItems.length > 0) {
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(`Linked Equipment (${linkedItems.length})`, M, y);
        y += 16;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        linkedItems.forEach(eq => {
          doc.text(`• ${eq.name} — ${TYPE_LABEL[eq.asset_type] || eq.asset_type} · ${COMPLIANCE_LABEL[eq.compliance_status] || 'Unknown'}`, M + 6, y);
          y += 13;
        });
        y += 10;
      }

      // === Service history ===
      const serviceRecords = relevant.filter(r => true); // all
      if (y > 680) { doc.addPage(); y = 50; }
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(`Service & Inspection History (${serviceRecords.length})`, M, y);
      y += 16;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      if (serviceRecords.length === 0) {
        doc.text('No service records on file.', M, y); y += 14;
      } else {
        serviceRecords.slice(0, 40).forEach(r => {
          if (y > 770) { doc.addPage(); y = 50; }
          const line = `${safeFormat(r.date, 'dd MMM yyyy')}  ·  ${(r.record_type || '').replace(/_/g, ' ').toUpperCase()}  ·  ${(r.result || '').toUpperCase()}${r.tested_by ? '  ·  ' + r.tested_by : ''}${r.resulting_expiry_date ? '  ·  next ' + safeFormat(r.resulting_expiry_date, 'dd MMM yyyy') : ''}`;
          doc.text(line, M, y);
          y += 13;
          if (r.notes) {
            const split = doc.splitTextToSize(r.notes, W - M * 2 - 6);
            doc.text(split, M + 6, y);
            y += split.length * 11;
          }
        });
      }
      y += 12;

      // === Certificates list ===
      const certs = relevant.filter(r => r.certificate_url);
      if (y > 700) { doc.addPage(); y = 50; }
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(`Certificates on File (${certs.length})`, M, y);
      y += 16;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      if (certs.length === 0) {
        doc.text('No certificates uploaded.', M, y); y += 14;
      } else {
        certs.forEach(c => {
          if (y > 770) { doc.addPage(); y = 50; }
          doc.text(`• ${c.certificate_name || 'Certificate'} — ${safeFormat(c.date, 'dd MMM yyyy')}${c.resulting_expiry_date ? ' (exp ' + safeFormat(c.resulting_expiry_date, 'dd MMM yyyy') + ')' : ''}`, M, y);
          y += 13;
          if (c.certificate_url) {
            const split = doc.splitTextToSize(c.certificate_url, W - M * 2 - 6);
            doc.setTextColor(30, 64, 175);
            doc.text(split, M + 6, y);
            doc.setTextColor(71, 85, 105);
            y += split.length * 11 + 2;
          }
        });
      }

      // === Footer ===
      const pages = doc.internal.getNumberOfPages();
      for (let p = 1; p <= pages; p++) {
        doc.setPage(p);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(`Asset Compliance Pack — ${asset.name} — page ${p} of ${pages}`, W / 2, 820, { align: 'center' });
      }

      const safeName = (asset.name || 'asset').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      doc.save(`${safeName}-compliance-pack.pdf`);
      toast({ title: 'Compliance pack generated', description: `${serviceRecords.length} records · ${certs.length} certificates.` });
    } catch (e) {
      toast({ title: 'Generation failed', description: e.message, variant: 'destructive' });
    }
    setBuilding(false);
  };

  const CIcon = COMPLIANCE_ICON[asset?.compliance_status] || HelpCircle;

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center border bg-white border-slate-200">
          <FileDown className="w-3.5 h-3.5 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-800">Compliance Pack (Audit PDF)</p>
          <p className="text-[10px] text-slate-400">One-click "Golden Record" for auditors</p>
        </div>
      </div>
      <div className="p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center flex-shrink-0">
            <CIcon className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Generates a sealed PDF containing the asset's current compliance status, full service &amp; inspection history,
            and a list of all certificates on file — everything an auditor needs in one document.
          </p>
        </div>
        <button onClick={handleGenerate} disabled={building} type="button"
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white rounded-lg text-sm font-semibold hover:brightness-110 transition disabled:opacity-60">
          {building ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
          {building ? 'Building pack…' : 'Generate Compliance Pack'}
        </button>
      </div>
    </div>
  );
}