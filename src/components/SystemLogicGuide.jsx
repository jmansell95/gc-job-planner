import React, { useState } from 'react';
import { Download, Loader2, BookOpen, ShieldCheck, TrendingUp, Sparkles, HardHat, FileClock, Clock, Activity, Zap, FileText } from 'lucide-react';
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

const SECTIONS = [
  {
    id: 'dashboard',
    icon: Activity,
    title: 'Dashboard Stats',
    desc: 'What every number on the dashboard means',
    items: [
      { stat: 'Crew Utilisation %', meaning: 'The percentage of active staff who are on site today. Active staff = all staff where is_active is true. On site = RotaAssignment records for today. A low percentage means crews are under-utilised or the rota is not published.' },
      { stat: 'Active Jobs', meaning: 'Jobs where status is "in_progress". These are live jobs with crews on site. Planning, completed and on-hold jobs are excluded from this count.' },
      { stat: 'Timesheet Queue', meaning: 'Timesheet entries with status "submitted" — awaiting manager approval. Overdue entries are those submitted more than 48 hours ago without a decision.' },
      { stat: 'Overdue Actions', meaning: 'Safety action items (from SafetyCulture audits) whose due date has passed. These are corrective actions assigned from audit findings that have not been closed.' },
      { stat: 'Pending Deliveries', meaning: 'DeliveryLog records for today where status is "pending" or "in_progress". These are deliveries or collections scheduled for today that have not been completed.' },
    ],
  },
  {
    id: 'compliance',
    icon: ShieldCheck,
    title: 'Compliance Logic',
    desc: 'How LOLER, PUWER & PAT status is calculated',
    items: [
      { stat: 'Compliance Status', meaning: 'Derived from the most recent ServiceRecord of the relevant type. "compliant" = next expiry > 30 days. "expiring" = within 30 days. "expired" = past due. "unknown" = no service record on file.' },
      { stat: 'LOLER Interval', meaning: 'Default 6 months. Lifting equipment and rigs require a thorough examination every 6 months under LOLER reg 9. Editable per asset in Compliance Rules settings.' },
      { stat: 'PUWER Interval', meaning: 'Default 12 months. Work equipment (machinery, trailers, vehicles) inspected annually. High-risk plant may need shorter intervals.' },
      { stat: 'PAT Interval', meaning: 'Default 12 months for office, 3 months for construction sites. Portable electrical equipment (110V transformers, power tools, leads) tested via the PAT Testing Console.' },
      { stat: 'Expiring Warning Days', meaning: 'Default 30 days. Assets are flagged "expiring soon" when their next test is within this window. Drives the amber warning tiles.' },
      { stat: 'Hard-Stop Validation', meaning: 'AssignmentModal cross-references staff qualifications against job requirements. A staff member without the required qualification cannot be assigned — the system blocks the assignment, it does not warn.' },
    ],
  },
  {
    id: 'maintenance',
    icon: HardHat,
    title: 'Predictive Maintenance',
    desc: 'Usage-based servicing instead of calendar-based',
    items: [
      { stat: 'Engine Hours', meaning: 'Automatically calculated from approved InvestigationLog records. Every drilling activity (borehole_progress, sample_collection) contributes duration_minutes to the rig\'s running total since its last service. No manual hour-meter reading required.' },
      { stat: 'Service Threshold', meaning: 'A rig is flagged "due_soon" when its accumulated engine hours since the last service cross 250 hours. The threshold is configurable. At 250h, the system auto-books a maintenance slot and notifies the responsible person.' },
      { stat: 'Rig-Tooling Lockdown', meaning: 'Before a rig can be assigned to a job, the validateRigTooling function checks every linked asset (slings, shackles, bits, rods). If any linked gear is expired or inactive, the assignment is blocked with a specific reason for each blocked item.' },
      { stat: 'Maintenance Status', meaning: '"ok" = next service >30 days away. "due_soon" = within 30 days. "overdue" = past due. "unknown" = no service date recorded. Driven by next_service_date, which is set by the usage-based calculation or manually.' },
    ],
  },
  {
    id: 'financial',
    icon: TrendingUp,
    title: 'Financial Logic',
    desc: 'How charges, WIP and realisation are calculated',
    items: [
      { stat: 'Unbilled WIP', meaning: 'The sum of all JobCostItem amounts where the item has not been included on a paid invoice. This is "earned but unbilled" revenue — work that has been done and costed but not yet invoiced to the client.' },
      { stat: 'Realisation %', meaning: 'Invoiced amount ÷ earned amount across all active jobs. A dropping realisation rate is the earliest warning sign of billing leakage. The dashboard surfaces this as a live percentage.' },
      { stat: 'Charge Calculation', meaning: 'The calculateCharge function runs automatically on every approved InvestigationLog and submitted Timesheet. It matches the activity to a BillingRule (by task description or log type), applies the rate, and sets charge_amount and charge_breakdown on the record.' },
      { stat: 'Revenue Method', meaning: 'How a job earns money: "drilling_meterage" = £/metre, "groundworks_unit" = £/trial pit, "coring_unit" = £/core run, "day_rate" = fixed daily crew rate, "flat_fee" = single project fee. Set on the Team, inherited by the job.' },
      { stat: 'VAT Rate', meaning: 'Default 20% (UK standard rate). Applied to invoice net totals. Editable per job for zero-rated or exempt work. Falls back to the BusinessConfig default_vat_rate when not set on the job.' },
    ],
  },
  {
    id: 'ai',
    icon: Sparkles,
    title: 'AI Features',
    desc: 'What each intelligent assistant does',
    items: [
      { stat: 'Staff Assistant', meaning: 'A conversational AI copilot available to every user inside the app. It queries the live database to answer operational questions in plain English: "Who is on site today?", "What needs my approval?", "Show me overdue compliance." Available via the Sparkles button in the sidebar.' },
      { stat: 'Drilling Intelligence', meaning: 'A dedicated AI agent that analyses drilling logs for ground condition patterns, flags anomalous SPT values, identifies refusal trends, and surfaces geotechnical risks. It reads the logs so the engineer does not have to. Available via the HardHat button in the sidebar.' },
      { stat: 'Scheduling Assistant', meaning: 'An AI assistant that suggests crew assignments based on qualifications, availability and job type. It validates staff qualifications against crew requirements before suggesting an assignment — work that takes a scheduler 20 minutes takes seconds.' },
    ],
  },
  {
    id: 'automations',
    icon: Zap,
    title: 'Automations',
    desc: 'Background tasks that run without anyone asking',
    items: [
      { stat: 'Daily Stand-up Digest', meaning: 'Every weekday at 7 AM, emails all admins a digest: crew on site count, rig maintenance alerts, critical safety actions, and vehicle alerts. Replaces the morning phone round-robin.' },
      { stat: 'Usage-Based Maintenance', meaning: 'Daily at 6 AM. Recalculates engine hours for every rig from approved logs since its last service. Flags rigs crossing the 250h threshold and auto-books maintenance.' },
      { stat: 'Compliance Expiry Check', meaning: 'Daily. Checks every asset\'s compliance_expiry_date against today. Updates compliance_status to "expired" or "expiring" and deactivates non-compliant assets so they cannot be assigned.' },
      { stat: 'Milestone Auto-Push', meaning: 'Triggered when an investigation log is approved. Posts a "Verified Milestone" comment to the client portal and emails the project manager. Zero manual steps.' },
      { stat: 'Schedule Email', meaning: 'Triggered when a rota week is published. Emails each assigned crew member their weekly schedule with a PDF attachment.' },
      { stat: 'Bank Holiday Sync', meaning: 'Annual. Pulls UK bank holidays from gov.uk API so the rota engine knows not to schedule work on public holidays.' },
    ],
  },
];

export default function SystemLogicGuide() {
  const [generating, setGenerating] = useState(false);

  const buildPDF = async () => {
    setGenerating(true);
    try {
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 48;

      // Cover
      doc.setFillColor(BRAND_DARK);
      doc.rect(0, 0, pageW, 200, 'F');
      doc.setFillColor(BRAND_LEAF);
      doc.rect(0, 200, pageW, 4, 'F');
      doc.setTextColor(WHITE);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text('System Logic & Stats Guide', margin, 130);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.setTextColor(200, 220, 180);
      doc.text('What every number, rule and automation means', margin, 155);
      doc.setFontSize(9);
      doc.text(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), margin, 178);

      let y = 240;
      doc.setTextColor(SLATE_700);
      doc.setFontSize(10);
      const intro = doc.splitTextToSize(
        'This guide explains every statistic, rule and automation in the Ground Control Mission Control. It is the reference document for anyone who needs to understand what the system is doing and why — from new managers to auditors to the board.',
        pageW - margin * 2
      );
      doc.text(intro, margin, y);
      y += intro.length * 14 + 20;

      SECTIONS.forEach((section) => {
        if (y > pageH - 80) { doc.addPage(); y = 60; }
        // Section header
        doc.setFillColor(BRAND_DARK);
        doc.roundedRect(margin, y, pageW - margin * 2, 26, 4, 4, 'F');
        doc.setTextColor(WHITE);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(section.title, margin + 12, y + 17);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(200, 220, 180);
        doc.text(section.desc, margin + 12, y + 24);
        y += 36;

        section.items.forEach((item) => {
          if (y > pageH - 70) { doc.addPage(); y = 60; }
          // Stat name pill
          doc.setFillColor(BRAND_LEAF);
          doc.roundedRect(margin, y, 140, 16, 3, 3, 'F');
          doc.setTextColor(WHITE);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.text(item.stat.toUpperCase(), margin + 6, y + 11);
          // Meaning
          doc.setTextColor(SLATE_700);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9.5);
          const lines = doc.splitTextToSize(item.meaning, pageW - margin * 2);
          doc.text(lines, margin, y + 28);
          y += 28 + lines.length * 12 + 12;
        });
        y += 8;
      });

      // Footer on every page
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(SLATE_300);
        doc.setLineWidth(0.5);
        doc.line(margin, pageH - 30, pageW - margin, pageH - 30);
        doc.setTextColor(SLATE_500);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.text('Ground Control · System Logic & Stats Guide', margin, pageH - 18);
        doc.text(`Page ${i} of ${pageCount}`, pageW - margin, pageH - 18, { align: 'right' });
      }

      doc.save(`Ground-Control-System-Logic-Guide-${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (e) {
      console.error('PDF generation failed:', e);
      alert('Sorry, the PDF could not be generated. Please try again.');
    }
    setGenerating(false);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="insight-card rounded-2xl overflow-hidden">
        <div className="hero-gradient px-6 py-5 text-white flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/15 ring-1 ring-white/25 flex items-center justify-center backdrop-blur-sm">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">System Logic & Stats Guide</h2>
              <p className="text-white/80 text-sm">Every stat, rule and automation explained — downloadable as a PDF</p>
            </div>
          </div>
          <button onClick={buildPDF} disabled={generating}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-[#2E5A1A] rounded-xl font-semibold text-sm shadow-lg hover:shadow-xl transition disabled:opacity-60">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {generating ? 'Building…' : 'Download PDF Guide'}
          </button>
        </div>
      </div>

      {/* On-screen guide */}
      {SECTIONS.map(section => {
        const Icon = section.icon;
        return (
          <div key={section.id} className="insight-card rounded-2xl p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center shadow-sm">
                <Icon className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">{section.title}</h3>
                <p className="text-xs text-slate-500">{section.desc}</p>
              </div>
            </div>
            <div className="space-y-3">
              {section.items.map((item, i) => (
                <div key={i} className="border border-slate-100 rounded-xl p-3.5 hover:border-[#2E5A1A]/20 transition">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-[#2E5A1A]/10 text-[#2E5A1A] text-xs font-bold uppercase tracking-wide">{item.stat}</span>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">{item.meaning}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}