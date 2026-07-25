import React, { useState } from 'react';
import { Download, Loader2, ShieldCheck, TrendingUp, Map, FileText } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { EMBLEM_URL } from '@/components/Logo';

const BRAND_DARK = '#2E5A1A';
const BRAND_LEAF = '#8DC63F';
const SLATE_900 = '#0f172a';
const SLATE_700 = '#334155';
const SLATE_500 = '#64748b';
const SLATE_300 = '#cbd5e1';
const SLATE_100 = '#f1f5f9';
const WHITE = '#ffffff';

export default function PresentationPack() {
  const [generating, setGenerating] = useState(false);

  const loadImage = (url) => new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });

  const buildPDF = async () => {
    setGenerating(true);
    try {
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 48;

      // === Load logo ===
      let logoImg = null;
      try { logoImg = await loadImage(EMBLEM_URL); } catch (e) { /* skip if blocked */ }

      // === Cover page ===
      // Dark green hero band
      doc.setFillColor(BRAND_DARK);
      doc.rect(0, 0, pageW, 240, 'F');
      // Leaf-green accent line
      doc.setFillColor(BRAND_LEAF);
      doc.rect(0, 240, pageW, 4, 'F');

      if (logoImg) {
        const logoH = 60;
        const logoW = logoImg.naturalWidth * (logoH / logoImg.naturalHeight);
        doc.addImage(logoImg, 'PNG', margin, 50, logoW, logoH);
      }

      doc.setTextColor(WHITE);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(26);
      doc.text('Manager Presentation Pack', margin, 150);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(13);
      doc.setTextColor(200, 220, 180);
      doc.text('Safety & Financial Value Proposition', margin, 175);
      doc.setFontSize(10);
      doc.text(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), margin, 200);

      // Cover body — the pitch
      let y = 290;
      doc.setTextColor(SLATE_900);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('Why we built this', margin, y);
      y += 20;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(SLATE_700);
      const pitch = doc.splitTextToSize(
        'Ground Control now captures every field activity digitally — from driller remarks to trial pit observations — and professionalises them into manager-reviewed logs. This pack covers the two outcomes that matter most to senior leadership: reducing safety risk and protecting project margin.',
        pageW - margin * 2
      );
      doc.text(pitch, margin, y);
      y += pitch.length * 14 + 16;

      // Key stats row on cover
      const stats = [
        { label: 'Compliance sync', value: 'Live', tone: BRAND_LEAF },
        { label: 'AGS export', value: 'One click', tone: BRAND_DARK },
        { label: 'Billing leakage', value: 'Eliminated', tone: '#1d4ed8' },
      ];
      const boxW = (pageW - margin * 2 - 24) / 3;
      stats.forEach((s, i) => {
        const x = margin + i * (boxW + 12);
        doc.setFillColor(SLATE_100);
        doc.roundedRect(x, y, boxW, 60, 6, 6, 'F');
        doc.setTextColor(SLATE_500);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(s.label.toUpperCase(), x + 10, y + 20);
        doc.setTextColor(s.tone);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(s.value, x + 10, y + 45);
      });
      y += 80;

      // Footer
      drawFooter(doc, margin, pageW, pageH);

      // === Page 2: Safety ===
      doc.addPage();
      drawSectionHeader(doc, margin, pageW, 'Safety & Compliance', 'Risk mitigation and audit-ready records', ShieldCheck);
      y = 130;

      const safetyPoints = [
        {
          title: 'Live hazard mapping',
          body: 'Every underground service encounter is GPS-tagged at the point of excavation. We can prove we identified and managed a hazard before it became an incident.',
        },
        {
          title: 'Instant compliance verification',
          body: 'Rig, machinery and trailer compliance status is synced from the GC Compliance Manager. Expired assets are stopped before they leave the yard, not flagged weeks later.',
        },
        {
          title: 'Review-first culture',
          body: 'The Log Quality Control dashboard forces a manager review on every field entry. Ground conditions, pit stability and water strikes are verified before they are finalised.',
        },
        {
          title: 'Audit-ready in seconds',
          body: 'Every briefing sign-off, service check and signature is time-stamped and stored. A complete, legally-defensible pack can be exported in one click if an audit occurs.',
        },
      ];
      safetyPoints.forEach((p, i) => {
        y = drawPoint(doc, margin, pageW, p.title, p.body, y, i + 1);
      });

      drawFooter(doc, margin, pageW, pageH);

      // === Page 3: Financial ===
      doc.addPage();
      drawSectionHeader(doc, margin, pageW, 'Financial Performance', 'Margin integrity and faster cash collection', TrendingUp);
      y = 130;

      const financePoints = [
        {
          title: 'Automated charge accuracy',
          body: 'Every metre drilled and unit installed is matched to an agreed rate from the Master Schedule of Rates. Billing leakage from undercharged work is eliminated.',
        },
        {
          title: 'Audit-proof timesheets',
          body: 'Timesheet entries are generated from professionalised log data. We pay staff for verified site activity, not estimated hours — and client charges align to the same source.',
        },
        {
          title: 'Faster cash collection',
          body: 'One-click AGS export to OpenGround removes the manual formatting bottleneck. We move from work-completed to client-invoiced significantly faster, improving the cash conversion cycle.',
        },
        {
          title: 'Real-time cost visibility',
          body: 'Daily site snapshots show meterage progress and activity costs as they happen. Managers can adjust before a budget overrun, not after the invoice is raised.',
        },
      ];
      financePoints.forEach((p, i) => {
        y = drawPoint(doc, margin, pageW, p.title, p.body, y, i + 1);
      });

      drawFooter(doc, margin, pageW, pageH);

      // === Page 4: Presentation order ===
      doc.addPage();
      drawSectionHeader(doc, margin, pageW, 'Recommended Walk-through', 'The order to go over things in the meeting', Map);
      y = 130;

      const order = [
        { step: '01', title: 'Compliance & Safety Summary', body: 'Open with the live compliance tiles. Shows we take duty of care seriously and assets are controlled before they leave the yard.' },
        { step: '02', title: 'Log Quality Control demo', body: 'Show the review dashboard, an anomaly flag and a bulk approve. Proves we manage risk in real time, not at month-end.' },
        { step: '03', title: 'Revenue & billing integration', body: 'Open a job and show meterage progress tied to the schedule of rates. Connects site performance to the P&L.' },
        { step: '04', title: 'One-click AGS export', body: 'Run the OpenGround export live. The single most tangible efficiency gain — minutes of work replacing hours of manual formatting.' },
      ];
      order.forEach((item) => {
        if (y > pageH - 120) { doc.addPage(); y = 130; }
        // step circle
        doc.setFillColor(BRAND_DARK);
        doc.circle(margin + 18, y, 16, 'F');
        doc.setTextColor(WHITE);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(item.step, margin + 18, y + 4, { align: 'center' });

        doc.setTextColor(SLATE_900);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text(item.title, margin + 48, y - 2);
        doc.setTextColor(SLATE_700);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        const lines = doc.splitTextToSize(item.body, pageW - margin - 48 - margin);
        doc.text(lines, margin + 48, y + 14);
        y += 34 + lines.length * 13 + 20;
      });

      // Pro-tip box
      if (y > pageH - 140) { doc.addPage(); y = 130; }
      doc.setFillColor(SLATE_100);
      doc.roundedRect(margin, y, pageW - margin * 2, 90, 8, 8, 'F');
      doc.setFillColor(BRAND_LEAF);
      doc.roundedRect(margin, y, 4, 90, 2, 2, 'F');
      doc.setTextColor(BRAND_DARK);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Meeting tip', margin + 16, y + 24);
      doc.setTextColor(SLATE_700);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const tip = doc.splitTextToSize('When you reach the Log Quality Control dashboard, open a Queried log and point out the flagged issue (e.g. missing photo evidence). Managers instantly see the value of catching that now versus three weeks later.', pageW - margin * 2 - 32);
      doc.text(tip, margin + 16, y + 42);

      drawFooter(doc, margin, pageW, pageH);

      // === Page 5: Meeting Script (facilitator notes) ===
      doc.addPage();
      drawSectionHeader(doc, margin, pageW, 'Meeting Script', 'Read-from notes — what to say, show and ask', FileText);
      y = 120;

      const script = [
        {
          phase: 'Before you start (2 min)',
          items: [
            { tag: 'Setup', text: 'Open the app on the big screen, logged in to the admin dashboard. Have a drilling job with approved logs ready in a tab.' },
            { tag: 'Say', text: '"Thanks for your time. I want to show you how we\'ve turned site logs from a paperwork problem into a safety and billing advantage. I\'ll keep it to 20 minutes and leave room for questions."' },
          ],
        },
        {
          phase: 'Section 1 — Safety (5 min)',
          items: [
            { tag: 'Show', text: 'Compliance → Site Assets. The compliance tiles and one expired or expiring asset card.' },
            { tag: 'Say', text: '"Every rig, machine and trailer is synced from our compliance system. If something expires, it\'s flagged here and can\'t be sent to a job. That\'s our first line of defence."' },
            { tag: 'Show', text: 'Click that asset → Asset Passport. The maintenance timeline, responsible person, service history.' },
            { tag: 'Say', text: '"This is the audit trail for that asset. If HSE walk in tomorrow, this is what we hand them — in one click, not after a morning in the filing cabinet."' },
            { tag: 'Ask', text: '"How long does it take us today to pull that together for an auditor?"' },
            { tag: 'Show', text: 'Log Quality Control dashboard. Point at the pending / approved / queried counts and the review progress bar.' },
            { tag: 'Say', text: '"Every entry from site comes in here for manager review. The system flags missing photos, SPT anomalies and water level discrepancies the same day — not three weeks later when we\'re writing the report."' },
            { tag: 'Show', text: 'Open one Queried log. Point at the flagged issue.' },
            { tag: 'Ask', text: '"How often do we find missing data after the crew has left site?"' },
          ],
        },
        {
          phase: 'Section 2 — Financial (5 min)',
          items: [
            { tag: 'Show', text: 'A drilling job → Site Logs tab. Point at the "Days Logged" counter and "Driller Activities" count.' },
            { tag: 'Say', text: '"Every day logged here is tied to a rate in our Schedule of Rates. The crew can\'t drill a metre that isn\'t captured, and we can\'t bill a metre that isn\'t logged."' },
            { tag: 'Show', text: 'Billing tab for the same job.' },
            { tag: 'Say', text: '"Because the logs are approved, the timesheets and client charges come from the same data. One source of truth — no re-keying, no billing leakage."' },
            { tag: 'Ask', text: '"Where do we currently lose money between site and invoice?"' },
            { tag: 'Show', text: 'Run the one-click AGS export live.' },
            { tag: 'Say', text: '"That\'s our OpenGround file. Done. That used to be hours of manual formatting — it\'s now seconds."' },
          ],
        },
        {
          phase: 'Close (3 min)',
          items: [
            { tag: 'Say', text: '"So two promises: safer, audit-ready site records; and every metre we drill gets billed accurately and faster."' },
            { tag: 'Ask', text: '"What would make you confident to roll this out across all crews?"' },
            { tag: 'Capture', text: 'Write down every concern raised. Commit to a follow-up with a date before you leave the room.' },
          ],
        },
      ];

      script.forEach((section) => {
        if (y > pageH - 100) { doc.addPage(); y = 120; }
        // phase heading
        doc.setFillColor(BRAND_DARK);
        doc.roundedRect(margin, y, pageW - margin * 2, 24, 4, 4, 'F');
        doc.setTextColor(WHITE);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(section.phase, margin + 10, y + 16);
        y += 36;

        section.items.forEach((it) => {
          if (y > pageH - 70) { doc.addPage(); y = 120; }
          // tag chip
          const tagColor = it.tag === 'Say' ? BRAND_DARK : it.tag === 'Ask' ? '#b45309' : it.tag === 'Show' ? '#1d4ed8' : SLATE_500;
          doc.setFillColor(tagColor);
          doc.roundedRect(margin, y, 42, 16, 3, 3, 'F');
          doc.setTextColor(WHITE);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.text(it.tag.toUpperCase(), margin + 21, y + 11, { align: 'center' });

          doc.setTextColor(SLATE_700);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          const lines = doc.splitTextToSize(it.text, pageW - margin - 50 - margin);
          doc.text(lines, margin + 50, y + 12);
          y += 22 + lines.length * 13;
        });
        y += 8;
      });

      drawFooter(doc, margin, pageW, pageH);

      doc.save(`Ground-Control-Manager-Pack-${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (e) {
      console.error('PDF generation failed:', e);
      alert('Sorry, the PDF could not be generated. Please try again.');
    }
    setGenerating(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-slate-100/80 flex items-center justify-center p-4 md:p-8">
      <div className="max-w-2xl w-full">
        {/* Header card */}
        <div className="insight-card rounded-2xl overflow-hidden">
          <div className="hero-gradient px-6 py-8 md:px-10 md:py-10 text-white">
            <img src={EMBLEM_URL} alt="Ground Control" className="h-12 mb-4 object-contain" />
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Manager Presentation Pack</h1>
            <p className="text-white/80 mt-1.5 text-sm md:text-base">Safety & Financial value proposition — ready to talk through.</p>
          </div>

          {/* Preview body */}
          <div className="p-6 md:p-10">
            <p className="text-slate-600 text-sm leading-relaxed">
              A polished PDF you can present from or hand out. It covers the safety and compliance story, the financial and margin protection story, the recommended walk-through order, and — most importantly — a ready-to-read facilitator script with exactly what to say, what to show and what to ask the room.
            </p>

            {/* What's inside */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
              <PreviewItem icon={ShieldCheck} title="Safety & Compliance" desc="Hazard mapping, compliance sync, audit trail" />
              <PreviewItem icon={TrendingUp} title="Financial Performance" desc="Charge accuracy, timesheets, cash collection" />
              <PreviewItem icon={Map} title="Walk-through order" desc="The 4 steps to cover in the meeting" />
              <PreviewItem icon={FileText} title="Facilitator script" desc="What to Say, Show and Ask at each step" />
            </div>

            {/* Download button */}
            <button
              onClick={buildPDF}
              disabled={generating}
              className="mt-7 w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 command-gradient text-white rounded-xl font-semibold text-sm md:text-base shadow-lg hover:shadow-xl transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
              {generating ? 'Building PDF…' : 'Download PDF'}
            </button>
            <p className="text-xs text-slate-400 text-center mt-3">Takes a few seconds. Opens in your downloads folder.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewItem({ icon: Icon, title, desc }) {
  return (
    <div className="flex items-start gap-3 bg-slate-50 rounded-xl p-3.5 border border-slate-100">
      <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4.5 h-4.5 text-emerald-700" />
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-slate-900 text-sm">{title}</p>
        <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

// === PDF helpers ===
function drawFooter(doc, margin, pageW, pageH) {
  doc.setDrawColor(SLATE_300);
  doc.setLineWidth(0.5);
  doc.line(margin, pageH - 40, pageW - margin, pageH - 40);
  doc.setTextColor(SLATE_500);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Ground Control · Confidential — Internal Use Only', margin, pageH - 26);
  const pageNum = doc.getCurrentPageInfo().pageNumber;
  doc.text(`Page ${pageNum}`, pageW - margin, pageH - 26, { align: 'right' });
}

function drawSectionHeader(doc, margin, pageW, title, subtitle, Icon) {
  doc.setFillColor(BRAND_DARK);
  doc.rect(0, 0, pageW, 84, 'F');
  doc.setFillColor(BRAND_LEAF);
  doc.rect(0, 84, pageW, 3, 'F');
  doc.setTextColor(WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(title, margin, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(200, 220, 180);
  doc.text(subtitle, margin, 62);
}

function drawPoint(doc, margin, pageW, title, body, y, index) {
  const pageH = doc.internal.pageSize.getHeight();
  if (y > pageH - 120) { doc.addPage(); y = 130; }

  // number badge
  doc.setFillColor(BRAND_LEAF);
  doc.roundedRect(margin, y, 24, 24, 4, 4, 'F');
  doc.setTextColor(WHITE);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(String(index), margin + 12, y + 16, { align: 'center' });

  doc.setTextColor(SLATE_900);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin + 36, y + 10);

  doc.setTextColor(SLATE_700);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const lines = doc.splitTextToSize(body, pageW - margin - 36 - margin);
  doc.text(lines, margin + 36, y + 26);

  return y + 30 + lines.length * 13 + 18;
}