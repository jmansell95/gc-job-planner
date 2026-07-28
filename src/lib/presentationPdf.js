// ============================================================
// Presentation Pack PDF builder — rendering logic + auto-fit
// layout helpers. Imports all content from presentationContent.
// Auto-breaks to A4 so nothing overflows; print-ready.
// ============================================================
import { jsPDF } from 'jspdf';
import * as C from '@/lib/presentationContent';

const BRAND_DARK = '#2E5A1A';
const BRAND_LEAF = '#8DC63F';
const SLATE_900 = '#0f172a';
const SLATE_700 = '#334155';
const SLATE_500 = '#64748b';
const SLATE_300 = '#cbd5e1';
const SLATE_100 = '#f1f5f9';
const WHITE = '#ffffff';

// Estimate how many pt a block of wrapped text will occupy,
// so we can page-break BEFORE drawing and never overflow.
function textHeight(doc, text, maxW, lineHeight) {
  return doc.splitTextToSize(text, maxW).length * lineHeight;
}

// Draw wrapped text and return the new Y cursor.
function wrapped(doc, text, x, y, maxW, lineHeight) {
  const lines = doc.splitTextToSize(text, maxW);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

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

function drawSectionHeader(doc, margin, pageW, title, subtitle) {
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

// A numbered point with body + italic proof line. Auto page-breaks.
function drawPoint(doc, margin, pageW, title, body, y, index, proof) {
  const pageH = doc.internal.pageSize.getHeight();
  const maxW = pageW - margin * 2 - 36;
  const bodyH = textHeight(doc, body, maxW, 13);
  const proofH = proof ? textHeight(doc, `Proof point — ${proof}`, maxW, 11) + 10 : 0;
  const needed = 26 + bodyH + proofH + 18;
  if (y + needed > pageH - 50) { doc.addPage(); y = 130; }

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
  let nextY = wrapped(doc, body, margin + 36, y + 26, maxW, 13);

  if (proof) {
    nextY += 6;
    doc.setTextColor(BRAND_DARK);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    nextY = wrapped(doc, `Proof point — ${proof}`, margin + 36, nextY, maxW, 11);
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

// Render an array of {title, body, proof?} points, auto-paginating.
function drawPoints(doc, margin, pageW, points, y) {
  points.forEach((p, i) => {
    y = drawPoint(doc, margin, pageW, p.title, p.body, y, i + 1, p.proof);
  });
  return y;
}

export async function buildPresentationPDF(logoUrl) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;

  let logoImg = null;
  if (logoUrl) {
    try {
      logoImg = await new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = logoUrl;
      });
    } catch (e) { /* skip */ }
  }

  // === Cover ===
  doc.setFillColor(BRAND_DARK);
  doc.rect(0, 0, pageW, 240, 'F');
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
  doc.text('Executive Presentation Pack', margin, 150);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.setTextColor(200, 220, 180);
  doc.text('AI, Automation & Financial Value Proposition — 45 minute briefing', margin, 175);
  doc.setFontSize(10);
  doc.text(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), margin, 200);

  let y = 290;
  doc.setTextColor(SLATE_900);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Why we built this', margin, y);
  y += 20;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(SLATE_700);
  y = wrapped(doc, 'Ground Control now captures every field activity digitally — from driller remarks to trial pit observations — and professionalises them into manager-reviewed logs. This pack covers the outcomes that matter most to senior leadership: reducing safety risk, protecting project margin, and connecting every system we already pay for into one platform.', margin, y, pageW - margin * 2, 14);
  y += 16;

  const boxW = (pageW - margin * 2 - 24) / 3;
  C.coverStats.forEach((s, i) => {
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
  drawFooter(doc, margin, pageW, pageH);

  // === Executive Summary ===
  doc.addPage();
  drawSectionHeader(doc, margin, pageW, 'Executive Summary', 'What this changes for the business — at a glance');
  y = 120;
  doc.setTextColor(SLATE_900);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  y = wrapped(doc, 'Ground Control has moved from paper-based site records to a single digital audit trail. Every activity on site — drilled metres, trial pits, samples, services encountered — is captured at source, manager-reviewed, and tied directly to compliance, payroll and client billing.', margin, y, pageW - margin * 2, 14);
  y += 16;

  const colW = (pageW - margin * 2 - 16) / 2;
  const drawOutcomeBox = (x, y, title, items, accent) => {
    const itemH = items.reduce((s, it) => s + textHeight(doc, it, colW - 28) * 12 + 8, 0);
    const boxH = 24 + itemH + 12;
    if (y + boxH > pageH - 50) { doc.addPage(); y = 130; }
    doc.setFillColor(SLATE_100);
    doc.roundedRect(x, y, colW, boxH, 8, 8, 'F');
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

  const endY = Math.max(
    drawOutcomeBox(margin, y, 'Safety & Compliance outcomes', C.safetyOutcomes, BRAND_DARK),
    drawOutcomeBox(margin + colW + 16, y, 'Financial & Margin outcomes', C.financeOutcomes, '#1d4ed8'),
  );
  y = endY + 16;

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
  wrapped(doc, 'Endorse rolling this platform out across all crews and job types. The infrastructure is built, the integrations are live, and the audit trail is already running for active jobs. The remaining work is adoption — getting every crew logging through the app rather than on paper.', margin + 16, y + 40, pageW - margin * 2 - 32, 14);
  drawFooter(doc, margin, pageW, pageH);

  // === Integrations & Ecosystem ===
  doc.addPage();
  drawSectionHeader(doc, margin, pageW, 'Integrations & Ecosystem', 'One platform connected to everything we already pay for');
  y = 120;
  y = drawPoints(doc, margin, pageW, C.integrationsPoints, y);
  y = drawPullQuote(doc, margin, pageW, y, C.pullQuotes.integrations);
  drawFooter(doc, margin, pageW, pageH);

  // === Safety & Compliance ===
  doc.addPage();
  drawSectionHeader(doc, margin, pageW, 'Safety & Compliance', 'Risk mitigation and audit-ready records');
  y = 130;
  y = drawPoints(doc, margin, pageW, C.safetyPoints, y);
  y = drawPullQuote(doc, margin, pageW, y, C.pullQuotes.safety);
  drawFooter(doc, margin, pageW, pageH);

  // === Field Crew Experience ===
  doc.addPage();
  drawSectionHeader(doc, margin, pageW, 'Field Crew Experience', 'Mobile-first, offline-capable, less admin not more');
  y = 130;
  y = drawPoints(doc, margin, pageW, C.fieldCrewPoints, y);
  drawFooter(doc, margin, pageW, pageH);

  // === Financial Performance ===
  doc.addPage();
  drawSectionHeader(doc, margin, pageW, 'Financial Performance', 'Margin integrity and faster cash collection');
  y = 130;
  y = drawPoints(doc, margin, pageW, C.financePoints, y);
  y = drawPullQuote(doc, margin, pageW, y, C.pullQuotes.finance);
  drawFooter(doc, margin, pageW, pageH);

  // === Payroll & CIS ===
  doc.addPage();
  drawSectionHeader(doc, margin, pageW, 'Payroll & CIS Compliance', 'One-click export, CIS-aware pay, budget alerts');
  y = 130;
  y = drawPoints(doc, margin, pageW, C.payrollPoints, y);
  drawFooter(doc, margin, pageW, pageH);

  // === AI & Automation ===
  doc.addPage();
  drawSectionHeader(doc, margin, pageW, 'AI & Automation', 'The intelligent layer that saves hours every week');
  y = 120;
  y = drawPoints(doc, margin, pageW, C.aiPoints, y);
  y = drawPullQuote(doc, margin, pageW, y, C.pullQuotes.ai);
  drawFooter(doc, margin, pageW, pageH);

  // === Predictive Maintenance ===
  doc.addPage();
  drawSectionHeader(doc, margin, pageW, 'Predictive Maintenance', 'From calendar-based to usage-based servicing');
  y = 120;
  y = drawPoints(doc, margin, pageW, C.maintPoints, y);
  y = drawPullQuote(doc, margin, pageW, y, C.pullQuotes.maintenance);
  drawFooter(doc, margin, pageW, pageH);

  // === Client Portal ===
  doc.addPage();
  drawSectionHeader(doc, margin, pageW, 'Client Portal', 'Real-time verified progress, controlled visibility');
  y = 130;
  y = drawPoints(doc, margin, pageW, C.clientPortalPoints, y);
  drawFooter(doc, margin, pageW, pageH);

  // === Audit & Compliance Trail ===
  doc.addPage();
  drawSectionHeader(doc, margin, pageW, 'Audit & Compliance Trail', 'Tamper-evident records and one-click Job Packs');
  y = 130;
  y = drawPoints(doc, margin, pageW, C.auditTrailPoints, y);
  drawFooter(doc, margin, pageW, pageH);

  // === Financial Assurance ===
  doc.addPage();
  drawSectionHeader(doc, margin, pageW, 'Financial Assurance', 'Real-time visibility into earned-but-unbilled revenue');
  y = 120;
  y = drawPoints(doc, margin, pageW, C.finAssurance, y);
  y = drawPullQuote(doc, margin, pageW, y, C.pullQuotes.assurance);
  drawFooter(doc, margin, pageW, pageH);

  // === Competitive Edge ===
  doc.addPage();
  drawSectionHeader(doc, margin, pageW, 'Competitive Edge', 'Why this is different from off-the-shelf field apps');
  y = 130;
  y = drawPoints(doc, margin, pageW, C.competitivePoints, y);
  drawFooter(doc, margin, pageW, pageH);

  // === Time Savings chart ===
  doc.addPage();
  drawSectionHeader(doc, margin, pageW, 'Time Savings', 'Hours recovered every week — manual vs automated');
  y = 120;
  doc.setTextColor(SLATE_900);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Where the hours go — before and after', margin, y);
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(SLATE_700);
  y = wrapped(doc, 'Based on a 5-rig operation with 15 crew. Conservative estimates from actual workflow analysis — your numbers will vary, but the direction is always the same: automation removes the admin layer, not the work.', margin, y, pageW - margin * 2, 13);
  y += 14;

  const chartW = pageW - margin * 2;
  const chartH = 170;
  const chartX = margin;
  const chartY = y;
  const maxVal = 10;
  const barGroupW = chartW / C.taskData.length;
  const barW = barGroupW * 0.32;
  const gap = barGroupW * 0.06;

  doc.setDrawColor(SLATE_300);
  doc.setLineWidth(0.4);
  for (let v = 0; v <= maxVal; v += 2) {
    const gy = chartY + chartH - (v / maxVal) * chartH;
    doc.line(chartX, gy, chartX + chartW, gy);
    doc.setTextColor(SLATE_500);
    doc.setFontSize(7);
    doc.text(String(v) + 'h', chartX - 4, gy + 2, { align: 'right' });
  }
  C.taskData.forEach((t, i) => {
    const cx = chartX + i * barGroupW + barGroupW / 2;
    const manualH = (t.manual / maxVal) * chartH;
    const autoH = (t.automated / maxVal) * chartH;
    doc.setFillColor(SLATE_500);
    doc.rect(cx - barW - gap / 2, chartY + chartH - manualH, barW, manualH, 'F');
    doc.setFillColor(BRAND_DARK);
    doc.rect(cx + gap / 2, chartY + chartH - autoH, barW, autoH, 'F');
    doc.setTextColor(SLATE_700);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    const lbl = doc.splitTextToSize(t.label, barGroupW - 4);
    doc.text(lbl, cx, chartY + chartH + 8, { align: 'center' });
  });
  const legY = chartY + chartH + 28;
  doc.setFillColor(SLATE_500);
  doc.rect(margin, legY, 12, 12, 'F');
  doc.setTextColor(SLATE_700);
  doc.setFontSize(9);
  doc.text('Manual (before)', margin + 16, legY + 9);
  doc.setFillColor(BRAND_DARK);
  doc.rect(margin + 120, legY, 12, 12, 'F');
  doc.text('Automated (after)', margin + 136, legY + 9);
  y = legY + 24;

  const totalManual = C.taskData.reduce((s, t) => s + t.manual, 0);
  const totalAuto = C.taskData.reduce((s, t) => s + t.automated, 0);
  const saved = totalManual - totalAuto;

  if (y > pageH - 120) { doc.addPage(); y = 120; }
  doc.setFillColor(BRAND_DARK);
  doc.roundedRect(margin, y, pageW - margin * 2, 70, 8, 8, 'F');
  doc.setFillColor(BRAND_LEAF);
  doc.roundedRect(margin, y, 4, 70, 2, 2, 'F');
  doc.setTextColor(WHITE);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(`${saved} hours saved per week`, margin + 16, y + 30);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(220, 240, 200);
  doc.text(`= ${saved * 52} hours per year = ${(saved * 52 / 37).toFixed(0)} working weeks recovered — per manager.`, margin + 16, y + 48);
  doc.text(`At £45/hr fully-loaded, that is £${(saved * 52 * 45).toLocaleString()} of management time reinvested into actual operations — every year.`, margin + 16, y + 62);
  drawFooter(doc, margin, pageW, pageH);

  // === Financial ROI ===
  doc.addPage();
  drawSectionHeader(doc, margin, pageW, 'Financial ROI', 'What the system pays back — and how fast');
  y = 120;
  doc.setTextColor(SLATE_900);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('The four ways this system pays for itself', margin, y);
  y += 18;

  C.roiPoints.forEach((p) => {
    const bodyH = textHeight(doc, p.body, pageW - margin * 2 - 140, 13);
    const rowH = Math.max(60, 24 + bodyH + 16);
    if (y + rowH > pageH - 50) { doc.addPage(); y = 120; }
    doc.setFillColor(SLATE_100);
    doc.roundedRect(margin, y, pageW - margin * 2, rowH, 6, 6, 'F');
    doc.setFillColor(BRAND_LEAF);
    doc.roundedRect(margin, y, 4, rowH, 2, 2, 'F');
    doc.setTextColor(SLATE_900);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(p.title, margin + 16, y + 20);
    doc.setTextColor(SLATE_700);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    wrapped(doc, p.body, margin + 16, y + 34, pageW - margin * 2 - 140, 13);
    doc.setFillColor(BRAND_DARK);
    doc.roundedRect(pageW - margin - 120, y + 16, 104, 28, 4, 4, 'F');
    doc.setTextColor(WHITE);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(p.value, pageW - margin - 68, y + 34, { align: 'center' });
    y += rowH + 10;
  });

  if (y > pageH - 110) { doc.addPage(); y = 120; }
  doc.setFillColor(BRAND_DARK);
  doc.roundedRect(margin, y, pageW - margin * 2, 80, 8, 8, 'F');
  doc.setFillColor(BRAND_LEAF);
  doc.roundedRect(margin, y, 4, 80, 2, 2, 'F');
  doc.setTextColor(WHITE);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Net annual return (conservative)', margin + 16, y + 22);
  doc.setFontSize(22);
  doc.text('£58,500 +', margin + 16, y + 50);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(220, 240, 200);
  doc.text('Time recovered + revenue protected + fines avoided + faster cash. The system pays for itself within the first quarter of full adoption.', margin + 16, y + 68);
  drawFooter(doc, margin, pageW, pageH);

  // === 45-minute Agenda ===
  doc.addPage();
  drawSectionHeader(doc, margin, pageW, '45-Minute Agenda', 'The timed order to cover everything in the meeting');
  y = 120;
  C.agenda.forEach((item) => {
    const bodyH = textHeight(doc, item.body, pageW - margin - 48 - margin, 13);
    const rowH = 34 + bodyH + 18;
    if (y + rowH > pageH - 50) { doc.addPage(); y = 130; }
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
    doc.setTextColor(BRAND_DARK);
    doc.setFontSize(9);
    doc.text(item.mins, pageW - margin, y - 2, { align: 'right' });
    doc.setTextColor(SLATE_700);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    wrapped(doc, item.body, margin + 48, y + 14, pageW - margin - 48 - margin, 13);
    y += rowH;
  });
  drawFooter(doc, margin, pageW, pageH);

  // === Meeting Script ===
  doc.addPage();
  drawSectionHeader(doc, margin, pageW, 'Meeting Script', 'Read-from notes — what to say, show and ask');
  y = 120;

  C.script.forEach((section) => {
    if (y > pageH - 100) { doc.addPage(); y = 120; }
    doc.setFillColor(BRAND_DARK);
    doc.roundedRect(margin, y, pageW - margin * 2, 24, 4, 4, 'F');
    doc.setTextColor(WHITE);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(section.phase, margin + 10, y + 16);
    y += 36;

    section.items.forEach((it) => {
      const lines = doc.splitTextToSize(it.text, pageW - margin - 50 - margin);
      const rowH = 22 + lines.length * 13;
      if (y + rowH > pageH - 50) { doc.addPage(); y = 120; }
      const tagColor = it.tag === 'Say' ? BRAND_DARK : it.tag === 'Ask' ? '#b45309' : it.tag === 'Show' ? '#1d4ed8' : it.tag === 'If' ? '#7c3aed' : SLATE_500;
      doc.setFillColor(tagColor);
      doc.roundedRect(margin, y, 52, 16, 3, 3, 'F');
      doc.setTextColor(WHITE);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(it.tag.toUpperCase(), margin + 26, y + 11, { align: 'center' });
      doc.setTextColor(SLATE_700);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(lines, margin + 60, y + 12);
      y += rowH;
    });
    y += 8;
  });
  drawFooter(doc, margin, pageW, pageH);

  doc.save(`Ground-Control-Executive-Presentation-Pack-${new Date().toISOString().slice(0, 10)}.pdf`);
}