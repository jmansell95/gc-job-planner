import React, { useState } from 'react';
import { Download, Loader2, ShieldCheck, TrendingUp, Map, FileText } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { EMBLEM_URL } from '@/components/Logo';
import Breadcrumbs from '@/components/Breadcrumbs';

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

      // === Page 2: Executive Summary ===
      doc.addPage();
      drawSectionHeader(doc, margin, pageW, 'Executive Summary', 'What this changes for the business — at a glance', FileText);
      y = 120;

      // Mission line
      doc.setTextColor(SLATE_900);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      const mission = doc.splitTextToSize(
        'Ground Control has moved from paper-based site records to a single digital audit trail. Every activity on site — drilled metres, trial pits, samples, services encountered — is captured at source, manager-reviewed, and tied directly to compliance, payroll and client billing.',
        pageW - margin * 2
      );
      doc.text(mission, margin, y);
      y += mission.length * 14 + 16;

      // Two-column outcomes grid
      const colW = (pageW - margin * 2 - 16) / 2;
      const drawOutcomeBox = (x, y, title, items, accent) => {
        doc.setFillColor(SLATE_100);
        doc.roundedRect(x, y, colW, 24 + items.length * 34 + 12, 8, 8, 'F');
        doc.setFillColor(accent);
        doc.roundedRect(x, y, colW, 26, 8, 8, 'F');
        doc.roundedRect(x, y + 14, colW, 12, 0, 0, 'F');
        doc.setTextColor(WHITE);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(title, x + 12, y + 18);
        doc.setTextColor(SLATE_700);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        let iy = y + 42;
        items.forEach((it) => {
          doc.setFillColor(accent);
          doc.circle(x + 14, iy - 3, 2.2, 'F');
          const lines = doc.splitTextToSize(it, colW - 28);
          doc.text(lines, x + 22, iy);
          iy += lines.length * 12 + 8;
        });
        return iy;
      };

      const safetyOutcomes = [
        'Compliance status synced live — expired assets never reach site',
        'GPS-tagged hazard map for every service encountered',
        'Manager review on every field log — same day, not month-end',
        'One-click, legally-defensible audit pack for HSE or client',
      ];
      const financeOutcomes = [
        'Every drilled metre matched to an agreed rate — no leakage',
        'Timesheets generated from verified site activity, not estimates',
        'AGS export in seconds — cash cycle shortened',
        'Real-time cost vs budget visibility before overrun',
      ];
      const endY = Math.max(
        drawOutcomeBox(margin, y, 'Safety & Compliance outcomes', safetyOutcomes, BRAND_DARK),
        drawOutcomeBox(margin + colW + 16, y, 'Financial & Margin outcomes', financeOutcomes, '#1d4ed8')
      );
      y = endY + 16;

      // The ask box
      if (y > pageH - 130) { doc.addPage(); y = 120; }
      doc.setFillColor(BRAND_DARK);
      doc.roundedRect(margin, y, pageW - margin * 2, 80, 8, 8, 'F');
      doc.setFillColor(BRAND_LEAF);
      doc.roundedRect(margin, y, 4, 80, 2, 2, 'F');
      doc.setTextColor(WHITE);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('The ask', margin + 16, y + 22);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(220, 240, 200);
      const ask = doc.splitTextToSize(
        'Endorse rolling this platform out across all crews and job types. The infrastructure is built, the integrations are live, and the audit trail is already running for active jobs. The remaining work is adoption — getting every crew logging through the app rather than on paper.',
        pageW - margin * 2 - 32
      );
      doc.text(ask, margin + 16, y + 40);

      drawFooter(doc, margin, pageW, pageH);

      // === Page 3: Safety ===
      doc.addPage();
      drawSectionHeader(doc, margin, pageW, 'Safety & Compliance', 'Risk mitigation and audit-ready records', ShieldCheck);
      y = 130;

      const safetyPoints = [
        {
          title: 'Live hazard mapping',
          body: 'Every underground service encounter — gas, water, electric, drainage — is GPS-tagged at the point of excavation and plotted on the site hazard map. We can prove we identified and managed a hazard before it became an incident, and the record is permanent.',
          proof: 'Shown on the Site Hazard Map widget — coordinates captured at the borehole, not re-entered at the office.',
        },
        {
          title: 'Instant compliance verification',
          body: 'Rig, machinery, trailer and lifting-gear compliance status is synced live from the GC Compliance Manager. Assets that are expired, expiring or marked "needs service" are automatically deactivated and cannot be added to a job. The block happens at the yard, not after the asset has reached site.',
          proof: 'Compliance tiles on the dashboard update on every sync — no manual status entry required.',
        },
        {
          title: 'Review-first culture',
          body: 'The Log Quality Control dashboard requires a manager review on every field entry before it is finalised. Ground conditions, pit stability, SPT values and water strikes are checked, queried or approved — with anomalies flagged automatically by the system rather than spotted by chance.',
          proof: 'Anomaly detection catches missing photos, out-of-range depths and SPT mismatches on the day they are logged.',
        },
        {
          title: 'Audit-ready in seconds',
          body: 'Every briefing sign-off, service check, signature and review note is time-stamped, attributed and stored against the job. A complete, legally-defensible pack can be exported in one click if an audit or claim occurs — no reconstructing events from memory weeks later.',
          proof: 'Three-tier signature trail: crew sign-off, manager approval, weekly official lock.',
        },
        {
          title: 'Sub-contractor accountability',
          body: 'Sub-contractor and enabling-crew logs are flagged with a distinct badge in Log QC, so managers apply the correct review and billing path. Audits submitted from SafetyCulture are auto-linked to the contractor record by email, keeping the safety evidence chain intact across third parties.',
          proof: 'No more "who logged this?" — crew type and origin are visible on every record.',
        },
      ];
      safetyPoints.forEach((p, i) => {
        y = drawPoint(doc, margin, pageW, p.title, p.body, y, i + 1, p.proof);
      });

      // Section pull-quote
      y = drawPullQuote(doc, margin, pageW, y, 'Safety is no longer a folder of paper that gets audited once a year. It is a live, queryable record of every decision made on site — available the moment it is asked for.');

      drawFooter(doc, margin, pageW, pageH);

      // === Page 4: Financial ===
      doc.addPage();
      drawSectionHeader(doc, margin, pageW, 'Financial Performance', 'Margin integrity and faster cash collection', TrendingUp);
      y = 130;

      const financePoints = [
        {
          title: 'Automated charge accuracy',
          body: 'Every metre drilled and unit installed is matched to an agreed rate from the Master Schedule of Rates at the point of logging. Work that is not logged cannot happen, and work that is logged is always priced — so billing leakage from undercharged or forgotten activity is eliminated.',
          proof: 'Billing rules run automatically against the task description — charge is calculated, not guessed.',
        },
        {
          title: 'Audit-proof timesheets',
          body: 'Timesheet entries are generated from professionalised, manager-approved log data rather than self-reported hours. We pay staff for verified site activity, and client charges are calculated from the same source — so payroll and billing can never disagree.',
          proof: 'One approved log feeds payroll, the client charge and the AGS export simultaneously.',
        },
        {
          title: 'Faster cash collection',
          body: 'One-click AGS export to OpenGround removes the manual formatting bottleneck that sits between site completion and invoicing. We move from work-completed to client-invoiced significantly faster, shortening the cash conversion cycle on every job.',
          proof: 'Approved logs export straight to OpenGround with manager review comments attached for the Senior Engineer.',
        },
        {
          title: 'Real-time cost visibility',
          body: 'Daily site snapshots show meterage progress, days logged and activity costs as they happen — not at month-end. Managers can spot a budget overrun while there is still time to act, rather than explaining it after the invoice has been raised.',
          proof: 'Job dashboard surfaces cost-vs-budget the moment logs are approved.',
        },
        {
          title: 'Margin protection on every job',
          body: 'Because crew day rates, plant hire and material costs are all pulled from the same rate card, the internal cost and the client charge are calculated on identical data. There is no second spreadsheet where margin quietly erodes — the markup is applied once, consistently, and is visible on the job at all times.',
          proof: 'Single source of truth across rate card, cost items and invoices.',
        },
      ];
      financePoints.forEach((p, i) => {
        y = drawPoint(doc, margin, pageW, p.title, p.body, y, i + 1, p.proof);
      });

      y = drawPullQuote(doc, margin, pageW, y, 'Margin is protected at the point of capture, not recovered at the point of invoice. We are billing what actually happened on site — every time.');

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
            { tag: 'Setup', text: 'Open the app on the big screen, logged in to the admin dashboard. Pre-load a drilling job with approved logs in a tab so you do not search live.' },
            { tag: 'Check', text: 'Confirm the compliance tiles are fresh (run a sync if the last sync is older than a day). Stale data undermines the whole pitch.' },
            { tag: 'Say', text: '"Thanks for your time. I want to show you how we have turned site records from a paperwork problem into a safety and margin advantage. I will keep it to about 20 minutes and leave plenty of room for questions."' },
          ],
        },
        {
          phase: 'Section 1 — Safety & Compliance (6 min)',
          items: [
            { tag: 'Show', text: 'Compliance → Site Assets. The compliance tiles, then one expired or expiring asset card.' },
            { tag: 'Say', text: '"Every rig, machine, trailer and piece of lifting gear is synced live from our compliance system. If something expires or needs service, it is deactivated here and cannot be added to a job. That block happens at the yard — not after the asset has reached site."' },
            { tag: 'Show', text: 'Click that asset → Asset Passport. The maintenance timeline, responsible person, service history.' },
            { tag: 'Say', text: '"This is the full audit trail for that asset — last service, next service, who is responsible. If HSE walk in tomorrow, this is what we hand them, in one click, not after a morning in the filing cabinet."' },
            { tag: 'Ask', text: '"Honestly — how long would it take us to pull that together for an auditor today?"' },
            { tag: 'Show', text: 'Log Quality Control dashboard. Point at the pending, approved and queried counts and the review progress bar.' },
            { tag: 'Say', text: '"Every entry from site — driller remarks, trial pit logs, samples — comes in here for manager review. The system flags missing photos, SPT anomalies and water level discrepancies the same day they are logged, not three weeks later when we are writing the report."' },
            { tag: 'Show', text: 'Open one Queried log. Point at the flagged issue and the manager note.' },
            { tag: 'Ask', text: '"How often do we only discover missing data after the crew has left site?"' },
          ],
        },
        {
          phase: 'Section 2 — Financial & Margin (6 min)',
          items: [
            { tag: 'Show', text: 'A drilling job → Site Logs tab. Point at the "Days Logged" counter and the driller activity list.' },
            { tag: 'Say', text: '"Every day logged here is tied to a rate in our Schedule of Rates. If a metre is not logged, it did not happen — and we cannot bill what we cannot see. The crew cannot drill a metre that is not captured."' },
            { tag: 'Show', text: 'Billing tab for the same job — the calculated charge and the line items.' },
            { tag: 'Say', text: '"Because the logs are approved, the timesheets and the client charges come from the same data. One source of truth — no re-keying, no billing leakage, and payroll and invoicing can never disagree."' },
            { tag: 'Ask', text: '"Where do we currently lose money between site and invoice?"' },
            { tag: 'Show', text: 'Run the one-click AGS export live, then open the downloaded file.' },
            { tag: 'Say', text: '"That is our OpenGround file, with manager review comments attached for the Senior Engineer. Done. That used to be hours of manual formatting — it is now seconds."' },
          ],
        },
        {
          phase: 'Close & commitments (3 min)',
          items: [
            { tag: 'Say', text: '"So two promises: safer, audit-ready site records — and every metre we drill billed accurately and faster. The infrastructure is built and the integrations are live. What is left is adoption."' },
            { tag: 'Ask', text: '"What would make you confident to roll this out across all crews?"' },
            { tag: 'Capture', text: 'Write down every concern raised. Agree a follow-up date before you leave the room — an open concern with no owner will kill momentum.' },
            { tag: 'Commit', text: 'Name one job or crew to pilot on next week, and who will own getting them logging through the app.' },
          ],
        },
        {
          phase: 'Likely objections — ready answers',
          items: [
            { tag: 'If', text: '"The crew will not use it / it is too much admin for them." → The daily site log takes two minutes and auto-generates the timesheet, so it removes admin rather than adding it. The crew enters less, not more.' },
            { tag: 'If', text: '"We already track this on paper." → Paper cannot be queried, flagged or exported in one click. The cost is not the paper — it is the re-keying, the missing data and the audit risk.' },
            { tag: 'If', text: '"Will it slow the driller down?" → Logging happens in the natural gaps while drilling. The KeyLogBook sync can pull remarks automatically, so the driller does not even retype.' },
            { tag: 'If', text: '"What if it is wrong?" → That is exactly what Log QC is for. A queried log is a feature, not a failure — it means we caught it the same day.' },
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
        <Breadcrumbs />
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
              A polished, detailed PDF you can present from or hand out. It opens with an executive summary, covers the safety and compliance story and the financial and margin protection story in depth — each point backed by a proof line — and finishes with the recommended walk-through order plus a ready-to-read facilitator script with exactly what to say, show and ask, and ready answers to likely objections.
            </p>

            {/* What's inside */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
              <PreviewItem icon={FileText} title="Executive Summary" desc="Headline outcomes and the ask, at a glance" />
              <PreviewItem icon={ShieldCheck} title="Safety & Compliance" desc="5 points with proof lines + pull quote" />
              <PreviewItem icon={TrendingUp} title="Financial Performance" desc="5 points with proof lines + pull quote" />
              <PreviewItem icon={Map} title="Walk-through order" desc="The 4 steps to cover in the meeting" />
              <PreviewItem icon={FileText} title="Facilitator script" desc="Say / Show / Ask at each step + timing" />
              <PreviewItem icon={ShieldCheck} title="Objection handling" desc="Ready answers to the likely pushback" />
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

function drawPoint(doc, margin, pageW, title, body, y, index, proof) {
  const pageH = doc.internal.pageSize.getHeight();
  if (y > pageH - 140) { doc.addPage(); y = 130; }

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
  let nextY = y + 26 + lines.length * 13;

  // proof line
  if (proof) {
    nextY += 6;
    doc.setTextColor(BRAND_DARK);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    const proofLines = doc.splitTextToSize(`Proof point — ${proof}`, pageW - margin - 36 - margin);
    doc.text(proofLines, margin + 36, nextY);
    nextY += proofLines.length * 11 + 4;
    doc.setFont('helvetica', 'normal');
  }

  return nextY + 14;
}

function drawPullQuote(doc, margin, pageW, y, quote) {
  const pageH = doc.internal.pageSize.getHeight();
  if (y > pageH - 100) { doc.addPage(); y = 130; }
  doc.setFillColor(BRAND_DARK);
  doc.roundedRect(margin, y, pageW - margin * 2, 64, 8, 8, 'F');
  doc.setFillColor(BRAND_LEAF);
  doc.roundedRect(margin, y, 4, 64, 2, 2, 'F');
  doc.setTextColor(WHITE);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(11);
  const lines = doc.splitTextToSize(`"${quote}"`, pageW - margin * 2 - 32);
  doc.text(lines, margin + 16, y + 22);
  doc.setFont('helvetica', 'normal');
  return y + 64 + 16;
}