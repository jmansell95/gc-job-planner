import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Rocket, Users, Briefcase, DollarSign, ShieldCheck, Wrench, Clock,
  Globe, Truck, BarChart3, Plug, Smartphone, Settings, FileText,
  Zap, ChevronDown, ChevronRight, CheckCircle2, Circle, AlertCircle
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';

const CATEGORIES = [
  {
    id: 'data-import',
    icon: Plug,
    title: 'Data Import & Sync',
    color: 'blue',
    items: [
      { priority: 'high', title: 'Refined Import Deduplication & Staff Linking', desc: 'Cross-tab staff matching now handles nicknames (Jon→John, Bob→Robert), initials (J Smith→John Smith), and typos via a layered fuzzy matcher. The dry-run preview shows the match method and confidence score for every linked staff member so planners can verify deduplication before applying.', status: 'done' },
      { priority: 'high', title: 'Incremental (non-destructive) import mode', desc: 'Add a mode that merges new data instead of wiping everything. Lets you re-import without losing manual edits, photos, and custom fields.' },
      { priority: 'high', title: 'Import preview with undo/rollback', desc: 'Show a full diff before applying and keep a snapshot so you can roll back if the import produced unexpected results.' },
      { priority: 'medium', title: 'CSV import for bulk staff & jobs', desc: 'Quick-create multiple records from a simple CSV without the full planner spreadsheet rebuild.' },
      { priority: 'medium', title: 'iCal / calendar feed export', desc: 'Calendar button on every staff card calls the getStaffICalFeed backend function, which builds an iCal (.ics) file of the crew member\'s upcoming rota assignments (jobs, annual leave, sick, training) with all-day events including location, site contact, and shift times. Downloads instantly for import into any phone or desktop calendar app.', status: 'done' },
      { priority: 'low', title: 'AGS real-time validation & error recovery', desc: 'Validate AGS files on upload with inline error highlighting and partial-import recovery.' },
    ],
  },
  {
    id: 'staff',
    icon: Users,
    title: 'Staff Management',
    color: 'emerald',
    items: [
      { priority: 'high', title: 'Skills & certifications matrix', desc: 'New Skills Matrix tab in the Compliance Manager showing every active staff member × qualification type (CSCS, CPCS, NPORS, First Aid, Driving Licence, DBS, Forklift) as a color-coded grid — green=compliant, amber=expiring ≤30d, red=expired, gray=missing. Searchable by name or job title with summary stats at the top.', status: 'done' },
      { priority: 'high', title: 'Availability calendar', desc: 'Month-grid calendar in the Staff Manager showing every active staff member × day. Approved absences (holiday, sick, personal, training) are color-coded with letter badges. Navigate months, jump to today, and see at a glance who is free before assigning.', status: 'done' },
      { priority: 'high', title: 'Auto-assign crew suggestions', desc: 'CrewSuggester component ranks all active staff by a composite score: team membership (40pts), availability — no approved absence overlap (30pts), valid certs — CSCS/CPCS/First Aid (20pts), and past rota experience (10pts). Shows badges for each factor and one-click assign.', status: 'done' },
      { priority: 'medium', title: 'Staff utilization analytics', desc: 'Staff Utilization widget on the dashboard shows billable vs non-billable hours per staff member for the current week, with an overall utilization rate and color-coded progress bars. Sits in the Performance & Financials section and the Financials view profile.', status: 'done' },
      { priority: 'medium', title: 'Digital ID cards with QR codes', desc: 'ID Cards button in the Staff Manager opens a digital ID card generator. Select any active staff member to preview a branded, credit-card-sized ID with their photo, name, role, team, and a QR code encoding their identity details. Print the card or download the QR code for site access verification.', status: 'done' },
      { priority: 'low', title: 'Performance reviews & feedback', desc: 'Periodic review workflow with manager feedback, goals, and signed acknowledgements.' },
    ],
  },
  {
    id: 'jobs',
    icon: Briefcase,
    title: 'Job Management',
    color: 'amber',
    items: [
      { priority: 'high', title: 'Multi-Discipline Job Schema', desc: 'Jobs now support multiple simultaneous disciplines (drilling + groundworks + enabling) with per-discipline status, dates, and revenue methods. Migration function deployed — all existing jobs migrated to the new disciplines array.', status: 'done' },
      { priority: 'high', title: 'Decommissioning Lifecycle', desc: 'Finish Job action transitions jobs to decommissioning status, auto-generates collection tasks for all on-site equipment, and locks new billable items. Final inspection checklist and site clearance progress ring before completion.', status: 'done' },
      { priority: 'high', title: 'Discipline Pills on Job Cards', desc: 'At-a-glance colored pill strips showing all active disciplines on every job card and context view for instant multi-discipline visibility.', status: 'done' },
      { priority: 'high', title: 'Billing Lockdown on Decommissioning/Completed', desc: 'Cost items, sub-contractor logs, and equipment can no longer be added once a job is decommissioning or completed. The billing lock banner now shows the reason (invoice issued vs job finalised) and the Add buttons are disabled until the job is reactivated.', status: 'done' },
      { priority: 'high', title: 'Multi-Discipline Job Wizard', desc: 'The New Job wizard now supports stacking multiple discipline tracks (drilling + groundworks + enabling) with a primary discipline marker. Each track inherits job-level dates and billing as defaults; the primary mirrors into legacy fields for backward compat.', status: 'done' },
      { priority: 'high', title: 'Job templates with defaults', desc: 'Job Types now carry template defaults (billing method, drilling method, markup %, budget, duration, teams, notes). The New Job wizard shows a template picker on step 1 — selecting one pre-fills the entire form. Duration auto-calculates the end date from the start date. Template defaults are configured in Settings → Job Types.', status: 'done' },
      { priority: 'high', title: 'Real-time profitability alerts', desc: 'Inline budget overrun banner on the Job Costing panel (amber ≥10%, rose ≥25%) plus a dashboard Profitability Alerts widget that runs the full checkJobBudgetAlerts engine — budget overrun, low margin, negative profit, and predictive margin-drop from daily burn rate. Nightly automation emails a digest to admins.', status: 'done' },
      { priority: 'medium', title: 'Job dependencies & sequencing', desc: 'Job Dependency Manager on the job Summary tab lets admins link prerequisite jobs. Shows a warning banner when any dependency is not yet complete, and a green "all clear" banner when all prerequisites are finished. Dependencies are stored on the Job entity and visible in the context view.', status: 'done' },
      { priority: 'medium', title: 'Milestone-based progress tracking', desc: 'Milestone Manager now auto-calculates a job progress percentage from completed milestones with a color-coded progress bar (slate <50%, blue ≥50%, emerald at 100%). The completion count badge and progress bar update instantly when milestones are toggled.', status: 'done' },
      { priority: 'medium', title: 'Multi-site job grouping', desc: 'Group related jobs under a project with shared resource allocation and cross-site reporting.', status: 'done' },
      { priority: 'medium', title: 'Global discipline filter', desc: 'Click discipline pills on any job card to filter the entire dashboard by that discipline type.', status: 'done' },
      { priority: 'low', title: 'Job cloning with date shift', desc: 'Clone button on every job card calls the cloneJob backend function, which duplicates the job with all fields, disciplines, cost items, logistics assignments, and milestones — shifting all dates by a specified number of days. New job starts in planning status with "(Clone)" suffix.', status: 'done' },
    ],
  },
  {
    id: 'financials',
    icon: DollarSign,
    title: 'Financial & Billing',
    color: 'violet',
    items: [
      { priority: 'high', title: 'Automated invoice generation workflow', desc: 'The Auto-Invoice Engine assembles draft invoices from approved timesheets, cost items, hotel bookings, deliveries, meterage logs, and sub-contractor charges. Runs nightly at 6 AM and also triggers instantly when a manager approves an InvestigationLog. A manual "Run Auto-Invoice" button is on the Billing Lifecycle hub. Admins get an email digest of created drafts.', status: 'done' },
      { priority: 'high', title: 'Cost forecasting', desc: 'Cost Forecast widget on the Job Costing panel projects final cost from the current daily burn rate × remaining days. Shows current cost vs projected final vs budget, with overrun warning and margin forecast (current → projected).', status: 'done' },
      { priority: 'high', title: 'Cash flow projection timeline', desc: 'Cash Flow Forecast widget on the dashboard visualises upcoming revenue (invoices due) and costs (supplier payments, payroll) on a timeline.', status: 'done' },
      { priority: 'medium', title: 'CIS deduction automation', desc: 'Auto-calculate CIS deductions and submit to HMRC API with verification tracking.', status: 'done' },
      { priority: 'medium', title: 'Purchase order management', desc: 'New Purchase Orders settings page (Financial Control Hub) with full PO lifecycle — draft, send, acknowledge, receive, close, cancel. Create POs with line items linked to jobs and suppliers, auto-calculate VAT and totals. Three-way matching flags discrepancies between PO total and supplier invoice amount. Stats show open PO count, open value, and match discrepancies.', status: 'done' },
      { priority: 'medium', title: 'Retention release automation', desc: 'Nightly checkRetentionStatus automation flags completed jobs with held retention as release-eligible and emails admins. Billing Contract Manager has a one-click Release button that calls the releaseRetention function, which creates a retention release invoice and updates the contract. Retention status, held amount, and released amount are tracked per contract.', status: 'done' },
      { priority: 'low', title: 'Multi-currency support', desc: 'Handle international clients and suppliers with currency conversion and FX rate tracking.' },
    ],
  },
  {
    id: 'compliance',
    icon: ShieldCheck,
    title: 'Compliance & Safety',
    color: 'rose',
    items: [
      { priority: 'high', title: 'Automated compliance expiry alerts', desc: 'Nightly automation (checkComplianceExpiry) emails admins about expired and soon-to-expire items across staff, vehicles, equipment, and company categories. New dashboard Compliance Expiry widget shows expired/expiring items grouped by category with day-countdown badges, filterable by status.', status: 'done' },
      { priority: 'high', title: 'RAMS document management', desc: 'RAMS Manager tab in the Compliance Hub shows all RAMS, method statements, and risk assessments across every job. JobDocument now tracks version numbers (current vs superseded), manager sign-off (who/when), and valid-until dates with expiry flags. Filter by signed/unsigned/expired, search by job or filename, one-click sign-off.', status: 'done' },
      { priority: 'high', title: 'Incident & near-miss reporting', desc: 'New Incidents tab in the Safety Hub for mobile-first incident reporting. Classify by type (near-miss, incident, accident, dangerous occurrence, environmental) and severity (low → critical). Captures description, immediate action, root cause, RIDDOR flag with reference tracking, and corrective actions. Expandable cards with full audit trail.', status: 'done' },
      { priority: 'medium', title: 'Toolbox talk delivery & sign-off', desc: 'Toolbox Talks tab in the Safety Hub lets supervisors schedule talks by category (drilling, groundworks, manual handling, plant, environmental, health), link to a job or yard, select attendees from active staff, and record delivery with duration and follow-up actions. Stats show total talks, delivered count, and total attendees.', status: 'done' },
      { priority: 'medium', title: 'SafetyCulture audit score tracking', desc: 'Audit Score Trends widget on the dashboard shows pass rate, average score, and failed audit count from synced SafetyCulture data. Displays an improving/declining trend indicator and a breakdown by audit template type with per-type pass rates and average scores.', status: 'done' },
      { priority: 'low', title: 'Environmental impact reporting', desc: 'Environmental Impact widget on the dashboard tracks waste (recycled vs landfill), carbon emissions (CO₂e), fuel, water, energy, spoil reuse rate, and environmental incidents across all jobs. Recycling rate and spoil reuse rate shown as progress bars. Data is recorded per job via the EnvironmentalReport entity.', status: 'done' },
    ],
  },
  {
    id: 'assets',
    icon: Wrench,
    title: 'Asset & Equipment',
    color: 'cyan',
    items: [
      { priority: 'high', title: 'QR code asset tracking with mobile scanning', desc: 'AssetQRCard generates printable QR labels encoding compliance summaries. BarcodeScanner uses native BarcodeDetector API (with manual-entry fallback) for field scanning. AssetManifest manages manifest QRs for bulk items (casing sets, tooling bundles). processAssetReturn handles return scanning and pushes stock updates to Asset Panda.', status: 'done' },
      { priority: 'high', title: 'Predictive maintenance scheduling', desc: 'Three automations handle maintenance: recalculateUsageMaintenance (daily 5 AM, sums engine hours from drilling logs and flags rigs exceeding service intervals), autoBookMaintenance (daily 5:30 AM, auto-creates maintenance bookings for vehicles due within 14 days), and checkVehicleMaintenance (weekly, emails admins about overdue/upcoming maintenance).', status: 'done' },
      { priority: 'medium', title: 'Asset utilization analytics', desc: 'Asset Utilization widget on the dashboard shows rig utilization rate (on-site vs in-yard), total and average engine hours, service-overdue and due-soon alerts, top rigs by hours, and idle rig identification. Sits in the Compliance & Fleet section.', status: 'done' },
      { priority: 'medium', title: 'Yard management visual map', desc: 'Visual layout of the depot showing where each asset is parked/stored.' },
      { priority: 'low', title: 'Asset lifecycle management', desc: 'Track from acquisition to disposal with depreciation, resale value, and replacement planning.' },
    ],
  },
  {
    id: 'timesheets',
    icon: Clock,
    title: 'Timesheets & Payroll',
    color: 'orange',
    items: [
      { priority: 'high', title: 'GPS-verified timesheets with geofencing', desc: 'Auto-detect arrival/departure from site using Geotab GPS data for accurate time tracking. A nightly automation generates draft travel-to / on-site / travel-home entries from the previous day\'s GPS logs; admins can also trigger it manually for any date from Settings → Geotab GPS Sync.', status: 'done' },
      { priority: 'high', title: 'Payroll export to multiple providers', desc: 'Exports approved weekly-summary timesheets to CSV, Xero, or Sage 50 format with configurable pay-element mapping. Locks exported records to prevent re-export. Settings UI in Payroll Export Settings with preview queue and download.', status: 'done' },
      { priority: 'medium', title: 'Auto-break detection & compliance', desc: 'Automatically deduct breaks and flag non-compliant working patterns.' },
      { priority: 'medium', title: 'Holiday pay accrual tracking', desc: 'Track accrued holiday pay per staff member with carry-over rules and year-end reconciliation.' },
      { priority: 'medium', title: 'Timesheet approval delegation', desc: 'Allow managers to delegate approval authority during absence with audit trail.' },
      { priority: 'low', title: 'Shift differential automation', desc: 'Auto-apply night shift, weekend, and bank holiday rates based on rota data.' },
    ],
  },
  {
    id: 'portal',
    icon: Globe,
    title: 'Client Portal',
    color: 'blue',
    items: [
      { priority: 'high', title: 'Online payment portal with Stripe', desc: 'Clients can pay invoices directly through the client portal via Stripe checkout. PortalPaymentButton creates a checkout session, stripeWebhook handles payment confirmation and marks invoices as paid. Stripe config stored in AppSetting.', status: 'done' },
      { priority: 'high', title: 'Automated progress reports via email', desc: 'sendWeeklyProgressReport function compiles a per-job summary (status, schedule, meterage progress, milestones, recent site photos, billing totals) and emails it to the client contact. Scheduled automation runs every Monday at 8 AM for all portal-enabled, non-completed jobs. Can also be triggered manually for a single job.', status: 'done' },
      { priority: 'medium', title: 'Document sharing with version control', desc: 'Document Manager groups documents by category and filename, showing version badges (v1, v2, etc.) with a version history drawer. Upload new version button supersedes the current document — previous versions are marked as superseded and kept for audit. Client-visible documents show acknowledgment status with who/when.', status: 'done' },
      { priority: 'medium', title: 'Photo gallery with time-lapse', desc: 'Time-Lapse toggle on the Site Photos gallery shows all job photos in chronological order with a slider scrubber, auto-play, and a thumbnail strip. Overlay shows date, location, and caption for each frame.', status: 'done' },
      { priority: 'low', title: 'Client feedback & rating system', desc: 'Client Feedback widget on the dashboard shows NPS scores, average star ratings, and promoter/passive/detractor breakdown. Feedback is collected via the client portal after job completion. Management can mark feedback as reviewed or actioned, with expandable cards showing full comments.', status: 'done' },
    ],
  },
  {
    id: 'logistics',
    icon: Truck,
    title: 'Delivery & Logistics',
    color: 'teal',
    items: [
      { priority: 'high', title: 'Route optimization with live traffic', desc: 'The optimizeDailyRoute function uses Google Maps Directions API with waypoint optimisation and traffic-aware ETAs. Delivery stops are sequenced with leg durations and distances.', status: 'done' },
      { priority: 'medium', title: 'Delivery confirmation with photo evidence', desc: 'Delivery Complete modal captures up to 4 photos, GPS coordinates (auto-captured on open), recipient signature, condition report, and notes — all stored on the DeliveryLog record as evidence of delivery.', status: 'done' },
      { priority: 'medium', title: 'Vehicle capacity planning & load optimization', desc: 'Load Planner modal matches deliveries to vehicles with live weight and volume capacity bars. Overload warnings flag when a vehicle is exceeded, and the vehicle dropdown shows max capacity per vehicle for quick matching.', status: 'done' },
      { priority: 'medium', title: 'Driver mobile app with offline support', desc: 'Full offline delivery workflow with sync-when-online for areas with no signal.' },
      { priority: 'low', title: 'Third-party courier integration', desc: 'Book and track third-party courier deliveries for non-fleet shipments.' },
    ],
  },
  {
    id: 'dashboard',
    icon: BarChart3,
    title: 'Dashboard & Analytics',
    color: 'indigo',
    items: [
      { priority: 'high', title: 'Customizable widget dashboard', desc: 'Drag-and-drop widget reordering with S/M/L resize, hide/show, and per-user saved layouts. Three view profiles (Operations / Financials / Compliance) surface only the widgets relevant to each focus area.', status: 'done' },
      { priority: 'high', title: 'Executive KPI dashboard', desc: 'Executive Snapshot widget provides a one-page view of revenue, margin, utilization, safety stats, and cash position on the dashboard.', status: 'done' },
      { priority: 'medium', title: 'Predictive job completion forecasting', desc: 'AI-driven estimates of job completion dates based on progress, crew, and historical data.' },
      { priority: 'medium', title: 'Real-time site status map', desc: 'Live Site Map widget on the dashboard uses react-leaflet to plot all active jobs with GPS coordinates on an interactive OpenStreetMap. Markers are color-coded by job status with popups showing crew count today. Summary bar shows active job count, crew on site, and mapped sites.', status: 'done' },
      { priority: 'medium', title: 'Benchmark comparisons', desc: 'Compare job vs job, crew vs crew, and period vs period for performance insights.' },
      { priority: 'low', title: 'Custom report builder', desc: 'Drag-and-drop report builder with scheduled email delivery and multiple export formats.' },
    ],
  },
  {
    id: 'integrations',
    icon: Plug,
    title: 'Integrations',
    color: 'slate',
    items: [
      { priority: 'high', title: 'Xero / Sage accounting sync', desc: 'syncAccounting function pushes sent invoices and subcontractor costs to Xero or Sage via OAuth 2.0. Provider credentials configured in Accounting Sync settings. Admin-only "Sync Now" button triggers a manual push.', status: 'done' },
      { priority: 'medium', title: 'Microsoft Teams / Slack notifications', desc: 'Send job alerts, assignment notifications, and compliance warnings to team channels.' },
      { priority: 'medium', title: 'Google Calendar two-way sync', desc: 'Sync staff schedules to Google Calendar with real-time updates both ways.' },
      { priority: 'medium', title: 'SharePoint document sync', desc: 'Mirror job documents to SharePoint folders for corporate document management.' },
      { priority: 'low', title: 'Zapier / Make webhook integration', desc: 'Expose key events as webhooks for no-code automation with third-party tools.' },
      { priority: 'low', title: 'Public REST API', desc: 'Documented API for third-party access to jobs, staff, and financial data with API keys.' },
    ],
  },
  {
    id: 'mobile',
    icon: Smartphone,
    title: 'Mobile Experience',
    color: 'emerald',
    items: [
      { priority: 'high', title: 'Progressive Web App (PWA) with offline mode', desc: 'Offline sync service (offlineSync.js) queues briefing signatures, delivery logs, and offline actions in localStorage when network is unavailable. Data URL photos are converted to File blobs on sync. Background sync uploads queued items when connection returns.', status: 'done' },
      { priority: 'high', title: 'Push notifications', desc: 'Real-time push for new assignments, schedule changes, and compliance alerts.' },
      { priority: 'medium', title: 'Biometric login (Face ID / Touch ID)', desc: 'Fast, secure authentication without re-entering passwords on mobile devices.' },
      { priority: 'medium', title: 'Voice-to-text for site notes & logs', desc: 'Reusable VoiceToTextButton component uses the Web Speech API (en-GB) to dictate text into any input or textarea. Shows a pulsing red indicator while listening and appends transcribed text to the linked field. Automatically hidden on unsupported browsers.', status: 'done' },
      { priority: 'low', title: 'Photo capture with auto-tagging', desc: 'Auto-tag photos with job, date, GPS, and equipment using on-device AI.' },
    ],
  },
  {
    id: 'settings',
    icon: Settings,
    title: 'Settings & Configuration',
    color: 'slate',
    items: [
      { priority: 'high', title: 'Granular role-based access control (RBAC)', desc: 'Permission Group Manager with per-module, per-action permissions (read/create/update/delete) for every admin module. Custom groups beyond admin/user, plus page lockdowns to restrict sensitive settings. Staff records link to permission groups for access-level parity.', status: 'done' },
      { priority: 'high', title: 'Audit trail for all configuration changes', desc: 'recordFinancialAudit function captures tamper-evident audit records of every create/update/delete on locked financial entities (RateCardItem, InvestigationSOR, BillingRule, AppSetting, ExpensePreset, JobBillingContract) into FinancialAuditLog with who/what/when/before-after values.', status: 'done' },
      { priority: 'medium', title: 'Custom field builder', desc: 'Add custom fields to jobs, staff, and assets without code changes.' },
      { priority: 'medium', title: 'Email template editor with live preview', desc: 'Email Alerts settings page includes a full visual editor for every system email template — custom subject, intro message, full body template with token insertion, accent colour picker, banner title, footer text, and show/hide banner toggle. A live preview iframe renders the styled HTML email instantly with sample data. Send test email and reset-to-default buttons included. Custom templates can be created and deleted.', status: 'done' },
      { priority: 'low', title: 'Multi-company / white-label support', desc: 'Support multiple trading entities with separate branding, clients, and financials.' },
      { priority: 'low', title: 'Data backup & restore', desc: 'On-demand snapshots with point-in-time restore for disaster recovery.' },
    ],
  },
  {
    id: 'reporting',
    icon: FileText,
    title: 'Reporting',
    color: 'amber',
    items: [
      { priority: 'high', title: 'Scheduled report delivery', desc: 'Weekly client progress reports are delivered automatically via a scheduled automation (Mondays 8 AM). The sendWeeklyProgressReport function handles generation and email delivery in one step.', status: 'done' },
      { priority: 'high', title: 'PDF / Excel / CSV export for all views', desc: 'Multiple export paths: generateRotaPDF (weekly schedule), generateJobReport (full job pack), WeeklyTimesheetPDF (payroll), PrintReportButton (staff list), BillingExportButton (invoices), GeotabReportModal (fleet data), JobPackReport (audit pack). All produce downloadable PDF/CSV files.', status: 'done' },
      { priority: 'medium', title: 'Compliance report generation', desc: 'New LOLER/PUWER/PAT tab in the Compliance Manager generates a full asset compliance register from SiteAsset data — filterable by category (rigs, machinery, trailers, vehicles, lifting gear, portable appliances) and status (compliant/expiring/expired/unknown). Shows expiry date, days remaining, and compliance status per asset with summary stats. Print to PDF or email for audits and HSE submissions.', status: 'done' },
      { priority: 'medium', title: 'Health & safety statistics (RIDDOR)', desc: 'New H&S Statistics tab in the Safety Hub shows RIDDOR-reportable counts, submitted-to-HSE counts, open vs closed actions, incident type breakdown (near-miss, incident, accident, dangerous occurrence, environmental), severity distribution (low → critical), and SafetyCulture audit pass/fail rates. Filterable by 30/90/365 day periods.', status: 'done' },
      { priority: 'low', title: 'Client-facing progress reports', desc: 'Branded PDF progress reports with photos, milestones, and financial summaries.' },
    ],
  },
  {
    id: 'performance',
    icon: Zap,
    title: 'Performance & Reliability',
    color: 'rose',
    items: [
      { priority: 'high', title: 'Real-time updates via WebSocket subscriptions', desc: 'The Base44 SDK provides entity.subscribe() for live WebSocket updates. Components can subscribe to entity changes (create/update/delete) and update state without page refresh. Used for rota, job status, and dashboard data.', status: 'done' },
      { priority: 'medium', title: 'Database optimization for large datasets', desc: 'Index optimization and pagination for jobs/rotas/timesheets as data grows beyond 10k records.' },
      { priority: 'medium', title: 'Batch processing for large imports', desc: 'Process spreadsheet imports in background with progress bar and email notification on completion.' },
      { priority: 'low', title: 'Error monitoring & auto-retry', desc: 'Centralized error logging with automatic retry for transient failures and alerting.' },
      { priority: 'low', title: 'Caching strategy for frequently accessed data', desc: 'Cache rate cards, staff lists, and job data to reduce API calls and improve load times.' },
    ],
  },
];

const PRIORITY_CONFIG = {
  high: { label: 'High Priority', icon: AlertCircle, cls: 'bg-rose-50 text-rose-600 ring-rose-200', dot: 'bg-rose-500' },
  medium: { label: 'Medium', icon: Circle, cls: 'bg-amber-50 text-amber-600 ring-amber-200', dot: 'bg-amber-500' },
  low: { label: 'Low', icon: CheckCircle2, cls: 'bg-slate-50 text-slate-500 ring-slate-200', dot: 'bg-slate-400' },
};

const COLOR_MAP = {
  blue: 'from-blue-500 to-cyan-600',
  emerald: 'from-emerald-500 to-green-600',
  amber: 'from-amber-500 to-orange-600',
  violet: 'from-violet-500 to-purple-600',
  rose: 'from-rose-500 to-pink-600',
  cyan: 'from-cyan-500 to-teal-600',
  orange: 'from-orange-500 to-red-600',
  teal: 'from-teal-500 to-cyan-600',
  indigo: 'from-indigo-500 to-blue-600',
  slate: 'from-slate-500 to-slate-700',
};

export default function ImprovementRoadmap() {
  const [expanded, setExpanded] = useState(null);
  const [filter, setFilter] = useState('all');

  const filteredCategories = filter === 'all'
    ? CATEGORIES
    : CATEGORIES.map(c => ({ ...c, items: c.items.filter(i => i.priority === filter) })).filter(c => c.items.length > 0);

  const totalItems = CATEGORIES.reduce((sum, c) => sum + c.items.length, 0);
  const highCount = CATEGORIES.reduce((sum, c) => sum + c.items.filter(i => i.priority === 'high').length, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Rocket}
        title="Improvement Roadmap"
        subtitle="GC Mission Control — everything you could improve next"
        stats={[
          { label: 'Total Ideas', value: totalItems, icon: Rocket },
          { label: 'High Priority', value: highCount, icon: AlertCircle },
          { label: 'Categories', value: CATEGORIES.length, icon: ChevronRight },
        ]}
      />

      {/* Filter Bar */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-xs font-semibold text-slate-400 whitespace-nowrap">Filter:</span>
          {['all', 'high', 'medium', 'low'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap transition ${
                filter === f ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1) + ' Priority'}
            </button>
          ))}
        </div>
      </div>

      {/* Roadmap Grid */}
      <div className="max-w-6xl mx-auto px-5 py-8 space-y-4">
        {filteredCategories.map((cat, idx) => {
          const Icon = cat.icon;
          const isExpanded = expanded === cat.id;
          const gradient = COLOR_MAP[cat.color] || 'from-slate-500 to-slate-700';
          return (
            <motion.div key={cat.id}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04, duration: 0.3 }}
              className="insight-card rounded-2xl overflow-hidden">
              <button onClick={() => setExpanded(isExpanded ? null : cat.id)}
                className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-slate-50/50 transition">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0 shadow-md icon-tile-glow`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 text-base">{cat.title}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{cat.items.length} improvement {cat.items.length === 1 ? 'idea' : 'ideas'}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {cat.items.filter(i => i.priority === 'high').length > 0 && (
                    <span className="text-[11px] font-semibold bg-rose-50 text-rose-600 px-2 py-1 rounded-full ring-1 ring-rose-200">
                      {cat.items.filter(i => i.priority === 'high').length} high
                    </span>
                  )}
                  {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
                </div>
              </button>
              {isExpanded && (
                <div className="px-5 pb-4 space-y-2.5 border-t border-slate-100/80 pt-3">
                  {cat.items.map((item, i) => {
                    const prio = PRIORITY_CONFIG[item.priority];
                    const PrioIcon = prio.icon;
                    return (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/60 hover:bg-slate-50 transition">
                        <div className="flex-shrink-0 mt-0.5">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ring-1 ${prio.cls}`}>
                            <PrioIcon className="w-3.5 h-3.5" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-semibold text-slate-800 text-sm">{item.title}</h4>
                          </div>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="max-w-6xl mx-auto px-5 py-10 text-center">
        <p className="text-xs text-slate-400">
          This roadmap is generated from a full audit of the current system. Priorities are suggestions — adjust as needed.
        </p>
      </div>
    </div>
  );
}