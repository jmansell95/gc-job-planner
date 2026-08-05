import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Rocket, Users, Briefcase, DollarSign, ShieldCheck, Wrench, Clock,
  Globe, Truck, BarChart3, Plug, Smartphone, Settings, FileText,
  Zap, ChevronDown, ChevronRight, CheckCircle2, Circle, AlertCircle
} from 'lucide-react';

const CATEGORIES = [
  {
    id: 'data-import',
    icon: Plug,
    title: 'Data Import & Sync',
    color: 'blue',
    items: [
      { priority: 'high', title: 'Incremental (non-destructive) import mode', desc: 'Add a mode that merges new data instead of wiping everything. Lets you re-import without losing manual edits, photos, and custom fields.' },
      { priority: 'high', title: 'Import preview with undo/rollback', desc: 'Show a full diff before applying and keep a snapshot so you can roll back if the import produced unexpected results.' },
      { priority: 'medium', title: 'CSV import for bulk staff & jobs', desc: 'Quick-create multiple records from a simple CSV without the full planner spreadsheet rebuild.' },
      { priority: 'medium', title: 'iCal / calendar feed export', desc: 'Generate a subscribable calendar URL per staff member so schedules appear in their phone calendar automatically.' },
      { priority: 'low', title: 'AGS real-time validation & error recovery', desc: 'Validate AGS files on upload with inline error highlighting and partial-import recovery.' },
    ],
  },
  {
    id: 'staff',
    icon: Users,
    title: 'Staff Management',
    color: 'emerald',
    items: [
      { priority: 'high', title: 'Skills & certifications matrix', desc: 'Track every ticket, certification, and competency per staff member with expiry alerts and gap analysis.' },
      { priority: 'high', title: 'Availability calendar', desc: 'Show leave, training, and availability at a glance so planners can see who is free before assigning.' },
      { priority: 'high', title: 'Auto-assign crew suggestions', desc: 'Suggest the best crew for a job based on skills, location, availability, and past performance.' },
      { priority: 'medium', title: 'Staff utilization analytics', desc: 'Billable vs non-billable hours, utilization rate per person, and bench time tracking.' },
      { priority: 'medium', title: 'Digital ID cards with QR codes', desc: 'Generate scannable ID cards for site access and contractor verification.' },
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
      { priority: 'high', title: 'Job templates with defaults', desc: 'Pre-configured job types that auto-populate teams, equipment, cost items, and billing rules.' },
      { priority: 'high', title: 'Real-time profitability alerts', desc: 'Live margin warnings when a job approaches budget overrun, with email/push notifications.' },
      { priority: 'medium', title: 'Job dependencies & sequencing', desc: 'Link jobs that must complete before others start, with automatic scheduling updates.' },
      { priority: 'medium', title: 'Milestone-based progress tracking', desc: 'Auto-calculate completion percentage from milestones and drilling progress.' },
      { priority: 'medium', title: 'Multi-site job grouping', desc: 'Group related jobs under a project with shared resource allocation and cross-site reporting.' },
      { priority: 'medium', title: 'Global discipline filter', desc: 'Click discipline pills on any job card to filter the entire dashboard by that discipline type.' },
      { priority: 'low', title: 'Job cloning with date shift', desc: 'Duplicate a completed job for a new phase with all settings carried over and dates shifted.' },
    ],
  },
  {
    id: 'financials',
    icon: DollarSign,
    title: 'Financial & Billing',
    color: 'violet',
    items: [
      { priority: 'high', title: 'Automated invoice generation workflow', desc: 'Auto-generate draft invoices from approved timesheets and cost items with a manager approval gate.' },
      { priority: 'high', title: 'Cost forecasting', desc: 'Predict final job cost based on current burn rate, day rates, and remaining scope.' },
      { priority: 'high', title: 'Cash flow projection timeline', desc: 'Visual timeline of upcoming revenue (invoices due) and costs (supplier payments, payroll).' },
      { priority: 'medium', title: 'CIS deduction automation', desc: 'Auto-calculate CIS deductions and submit to HMRC API with verification tracking.' },
      { priority: 'medium', title: 'Purchase order management', desc: 'Create, track, and match POs against supplier invoices with three-way matching.' },
      { priority: 'medium', title: 'Retention release automation', desc: 'Automated retention eligibility detection and release reminders with client communication.' },
      { priority: 'low', title: 'Multi-currency support', desc: 'Handle international clients and suppliers with currency conversion and FX rate tracking.' },
    ],
  },
  {
    id: 'compliance',
    icon: ShieldCheck,
    title: 'Compliance & Safety',
    color: 'rose',
    items: [
      { priority: 'high', title: 'Automated compliance expiry alerts', desc: 'LOLER, PUWER, PAT expiry warnings with escalating alerts at 30/14/7/0 days.' },
      { priority: 'high', title: 'RAMS document management', desc: 'Store, version, and distribute Risk Assessments & Method Statements per job with sign-off tracking.' },
      { priority: 'high', title: 'Incident & near-miss reporting', desc: 'Mobile-first incident reporting with photo evidence, RIDDOR classification, and corrective actions.' },
      { priority: 'medium', title: 'Toolbox talk delivery & sign-off', desc: 'Schedule, deliver, and track toolbox talks with digital sign-off and attendance records.' },
      { priority: 'medium', title: 'SafetyCulture audit score tracking', desc: 'Pull audit scores from SafetyCulture and display trends per site, per crew, per category.' },
      { priority: 'low', title: 'Environmental impact reporting', desc: 'Track waste, carbon, and environmental compliance per job for client reporting.' },
    ],
  },
  {
    id: 'assets',
    icon: Wrench,
    title: 'Asset & Equipment',
    color: 'cyan',
    items: [
      { priority: 'high', title: 'QR code asset tracking with mobile scanning', desc: 'Scan QR codes to check assets in/out, log returns, and update locations from the field.' },
      { priority: 'high', title: 'Predictive maintenance scheduling', desc: 'Auto-schedule services based on operating hours with predictive alerts before failures.' },
      { priority: 'medium', title: 'Asset utilization analytics', desc: 'Rig hours, utilization rate, downtime tracking, and idle asset identification.' },
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
      { priority: 'high', title: 'GPS-verified timesheets with geofencing', desc: 'Auto-detect arrival/departure from site using Geotab GPS data for accurate time tracking.' },
      { priority: 'high', title: 'Payroll export to multiple providers', desc: 'Export to Xero, Sage, QuickBooks with mapped pay codes and overtime rules.' },
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
      { priority: 'high', title: 'Online payment portal with Stripe', desc: 'Let clients pay invoices directly through the portal with card payments and automatic receipt generation.' },
      { priority: 'high', title: 'Automated progress reports via email', desc: 'Schedule weekly progress summaries sent to clients with photos, milestones, and billing status.' },
      { priority: 'medium', title: 'Document sharing with version control', desc: 'Share reports, drawings, and certifications with version history and client download tracking.' },
      { priority: 'medium', title: 'Photo gallery with time-lapse', desc: 'Auto-organize site photos by date with a time-lapse view showing site progress over time.' },
      { priority: 'low', title: 'Client feedback & rating system', desc: 'Collect client satisfaction ratings after job completion with NPS scoring.' },
    ],
  },
  {
    id: 'logistics',
    icon: Truck,
    title: 'Delivery & Logistics',
    color: 'teal',
    items: [
      { priority: 'high', title: 'Route optimization with live traffic', desc: 'Optimize multi-stop delivery routes using Google Maps with real-time traffic and ETA updates.' },
      { priority: 'medium', title: 'Delivery confirmation with photo evidence', desc: 'Capture photo proof of delivery with GPS coordinates and timestamp.' },
      { priority: 'medium', title: 'Vehicle capacity planning & load optimization', desc: 'Match deliveries to vehicles based on weight/volume capacity and suggest load grouping.' },
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
      { priority: 'high', title: 'Customizable widget dashboard', desc: 'Drag-and-drop widget arrangement with saveable layouts per user role.' },
      { priority: 'high', title: 'Executive KPI dashboard', desc: 'One-page view of revenue, margin, utilization, safety stats, and cash position.' },
      { priority: 'medium', title: 'Predictive job completion forecasting', desc: 'AI-driven estimates of job completion dates based on progress, crew, and historical data.' },
      { priority: 'medium', title: 'Real-time site status map', desc: 'Live map with GPS overlays showing all active sites, crews, and vehicles.' },
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
      { priority: 'high', title: 'Xero / Sage accounting sync', desc: 'Two-way sync of invoices, costs, supplier bills, and payroll journals.' },
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
      { priority: 'high', title: 'Progressive Web App (PWA) with offline mode', desc: 'Full offline support for site logs, briefings, and deliveries with background sync.' },
      { priority: 'high', title: 'Push notifications', desc: 'Real-time push for new assignments, schedule changes, and compliance alerts.' },
      { priority: 'medium', title: 'Biometric login (Face ID / Touch ID)', desc: 'Fast, secure authentication without re-entering passwords on mobile devices.' },
      { priority: 'medium', title: 'Voice-to-text for site notes & logs', desc: 'Dictate site notes, progress updates, and safety observations hands-free.' },
      { priority: 'low', title: 'Photo capture with auto-tagging', desc: 'Auto-tag photos with job, date, GPS, and equipment using on-device AI.' },
    ],
  },
  {
    id: 'settings',
    icon: Settings,
    title: 'Settings & Configuration',
    color: 'slate',
    items: [
      { priority: 'high', title: 'Granular role-based access control (RBAC)', desc: 'Per-module, per-action permissions with custom roles beyond admin/user.' },
      { priority: 'high', title: 'Audit trail for all configuration changes', desc: 'Log every settings change with who, what, when, and before/after values.' },
      { priority: 'medium', title: 'Custom field builder', desc: 'Add custom fields to jobs, staff, and assets without code changes.' },
      { priority: 'medium', title: 'Email template editor with live preview', desc: 'Visual editor for all system emails with variable insertion and test send.' },
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
      { priority: 'high', title: 'Scheduled report delivery', desc: 'Automate weekly/monthly report generation and email delivery to stakeholders.' },
      { priority: 'high', title: 'PDF / Excel / CSV export for all views', desc: 'One-click export from any data table or dashboard widget.' },
      { priority: 'medium', title: 'Compliance report generation', desc: 'Auto-generate LOLER/PUWER/PAT compliance reports and HSE submissions.' },
      { priority: 'medium', title: 'Health & safety statistics (RIDDOR)', desc: 'Track and report reportable incidents, near-misses, and safety KPIs.' },
      { priority: 'low', title: 'Client-facing progress reports', desc: 'Branded PDF progress reports with photos, milestones, and financial summaries.' },
    ],
  },
  {
    id: 'performance',
    icon: Zap,
    title: 'Performance & Reliability',
    color: 'rose',
    items: [
      { priority: 'high', title: 'Real-time updates via WebSocket subscriptions', desc: 'Live data updates without page refresh for rotas, job status, and dashboard widgets.' },
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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero Header */}
      <div className="hero-gradient text-white">
        <div className="max-w-6xl mx-auto px-5 py-12 sm:py-16">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center">
              <Rocket className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Improvement Roadmap</h1>
              <p className="text-white/70 text-sm">GC Mission Control — everything you could improve next</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 mt-6">
            <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-2.5 flex items-center gap-2">
              <span className="text-2xl font-bold tabular-nums">{totalItems}</span>
              <span className="text-white/70 text-xs">Total Ideas</span>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-2.5 flex items-center gap-2">
              <span className="text-2xl font-bold tabular-nums text-rose-200">{highCount}</span>
              <span className="text-white/70 text-xs">High Priority</span>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-2.5 flex items-center gap-2">
              <span className="text-2xl font-bold tabular-nums">{CATEGORIES.length}</span>
              <span className="text-white/70 text-xs">Categories</span>
            </div>
          </div>
        </div>
      </div>

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