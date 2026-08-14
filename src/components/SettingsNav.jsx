import React from 'react';
import { Search, Users, Truck, Building2, HardHat, Package, CalendarX, Timer, Mail, Zap, Wrench, Tag, Banknote, Boxes,   Palette, Database, Receipt, TrendingUp, LayoutGrid, ListChecks, ShieldCheck, FlaskConical, Clock, FileUp, ClipboardCheck, ShieldAlert, Scale, Sparkles, Gauge, BookOpen, Settings2, Landmark, FileSpreadsheet, ScrollText, History, Radio, ArrowUpDown, Satellite, QrCode, Link2, Cloud, MapPin, MessageCircle, CreditCard, GitBranch, FileText, FileBarChart, Star, CalendarDays, UserCheck, Warehouse, AlertOctagon, Coins, Bell, Webhook, Layers, Activity } from 'lucide-react';
import { normalizePermissions } from '@/utils/permissions';

// Items that have migrated to operational hubs (Financial Control, Compliance,
// Assets, Staff). They remain in allSettingsItems for access-control/lockdown
// purposes but are hidden from the Settings sidebar & Command Hub overview.
export const HUB_MIGRATED_ITEMS = new Set([
  // → Financial Control Hub
  'billing', 'data-exchange', 'overtime', 'business-rules',
  'expense-presets', 'subcon-markup', 'gl-mapping', 'billing-pipeline',
  'billing-contracts', 'purchase-orders', 'financial-audit', 'job-alerts',
  'payroll-export', 'custom-reports', 'client-progress-report', 'rate-card',
  // → Compliance Hub
  'compliance-rules', 'system-audit-log',
  // → Assets Hub
  'asset-manifests', 'equipment-library', 'asset-lifecycle',
  // → Staff Hub
  'access-levels', 'absences', 'holiday-accrual', 'staff-reviews',
  'timesheet-delegation',
]);

export const settingsGroups = [
  {
    label: 'Overview',
    items: [
      { id: 'hub', label: 'Command Hub', icon: LayoutGrid, desc: 'At-a-glance overview of every settings area with live counts' },
      { id: 'divisions', label: 'Divisions', icon: Building2, desc: 'Create divisions, link staff to their division, and tag existing data to the Geotechnical division', roles: ['admin'] },
      { id: 'readiness', label: 'Readiness Manager', icon: Zap, desc: 'Control which hubs, tabs & integration features are Active, Coming Soon, or Locked across the platform', roles: ['admin'] },
      { id: 'integrations', label: 'Integrations Hub', icon: Link2, desc: 'All external system connections in one place — API keys, webhooks & sync status for every integration', roles: ['admin'] },
    ],
  },
  {
    label: 'Integrations',
    items: [
      { id: 'geotab-sync', label: 'Geotab GPS Sync', icon: Satellite, desc: 'Connect Geotab GPS tracking — live locations, vehicle specs (make, model, year, fuel type) & fleet reports', roles: ['admin'] },
      { id: 'holman-sync', label: 'Holman Fleet Sync', icon: Radio, desc: 'Connect Holman fleet management — auto-sync MOT, service dates & mileage via API and webhooks', roles: ['admin'] },
      { id: 'asset-panda', label: 'Asset Panda Sync', icon: Database, desc: 'Connect Asset Panda & sync live inventory, stock levels and billing rates', roles: ['admin'] },
      { id: 'bob-hr', label: 'Bob HR Sync', icon: Users, desc: 'Bidirectional time-off bridge with Bob HR (Hibob) — pull & push leave, webhook receiver for real-time events', roles: ['admin'] },
      { id: 'concur-sync', label: 'SAP Concur Sync', icon: Landmark, desc: 'API bridge to SAP Concur — pull GL codes, push approved expenses & timesheets in batch, lock synced records', roles: ['admin'] },
      { id: 'safety-culture', label: 'Safety Culture Sync', icon: ShieldAlert, desc: 'Sync site safety audits & inspection forms from SafetyCulture (iAuditor) — webhook & API integration', roles: ['admin', 'manager'] },
      { id: 'ags-import', label: 'KeyLogBook Settings', icon: FileUp, desc: 'Automated AGS file sync from KeyLogBook (every 30 min) & manual AGS imports — borehole data, strata & driller remarks', roles: ['admin', 'manager'] },
      { id: 'openground-sync', label: 'OpenGround Sync', icon: Database, desc: 'Push approved borehole logs directly to Bentley OpenGround cloud database via API — no manual AGS file downloads', roles: ['admin', 'manager'] },
      { id: 'cis-verification', label: 'CIS Verification', icon: ShieldCheck, desc: 'Verify subcontractors against HMRC CIS — deduction rates & verification numbers', roles: ['admin'] },
      { id: 'met-office', label: 'Met Office Weather', icon: Cloud, desc: 'Daily weather forecasts per site postcode — flag weather-impacted days on the rota', roles: ['admin'] },
      { id: 'google-maps', label: 'Google Maps', icon: MapPin, desc: 'Geocoding for job sites & delivery route optimisation', roles: ['admin'] },
      { id: 'whatsapp', label: 'WhatsApp Business', icon: MessageCircle, desc: 'Push critical alerts to crew via WhatsApp Business API — job cancellations, rig breakdowns, new rotas', roles: ['admin'] },
      { id: 'accounting-sync', label: 'Xero / Sage Sync', icon: FileSpreadsheet, desc: 'Push invoices & purchase costs directly to Xero or Sage accounting — eliminates double-entry', roles: ['admin'] },
      { id: 'payment-gateway', label: 'Stripe Payments', icon: CreditCard, desc: 'Accept client invoice payments in the client portal via Stripe — auto-marks invoices as paid', roles: ['admin'] },
      { id: 'microsoft-365', label: 'Microsoft 365 Hub', icon: Building2, desc: 'Unified Microsoft 365 hub — Azure AD SSO, Outlook & Teams integration', roles: ['admin'] },
      { id: 'zapier-webhooks', label: 'Zapier / Make Webhooks', icon: Webhook, desc: 'Register outbound webhook URLs to receive system events for no-code automation', roles: ['admin'] },
      { id: 'push-notifications', label: 'Push Notifications', icon: Bell, desc: 'Enable browser push notifications for new assignments, schedule changes & compliance alerts', roles: ['admin', 'manager', 'viewer'] },
    ],
  },
  {
    label: 'System Configuration',
    items: [
      { id: 'dropdowns', label: 'Dropdown Manager', icon: ListChecks, desc: 'Add, rename, reorder or remove options in every dropdown — qualifications, asset types, revenue streams & more' },
      { id: 'global-branding', label: 'Global Branding', icon: Palette, desc: 'Default colours, banner and footer for all automated emails' },
      { id: 'login-branding', label: 'Login Page Customiser', icon: Palette, desc: 'Customise the staff login page — background, colours, logo, welcome text & live preview', roles: ['admin'] },
      { id: 'portal-branding', label: 'Portal Branding Editor', icon: Palette, desc: 'Customise the client portal & sub-contractor onboarding portal — welcome text, logo, colours, support contacts & live preview', roles: ['admin'] },
      { id: 'email-templates', label: 'Email Templates', icon: Mail, desc: 'Manage branded email templates for portal invitations, schedules, billing & compliance notifications with {{variable}} token support' },
      { id: 'email-alerts', label: 'Email Alerts', icon: Mail, desc: 'Edit templates, recipients and timing for each automated email' },
      { id: 'automations', label: 'Automations', icon: Zap, desc: 'Background automations & alerts' },
      { id: 'planner-import', label: 'Planner Import', icon: FileSpreadsheet, desc: 'Upload weekly rota spreadsheet' },
      { id: 'incremental-import', label: 'Incremental Import', icon: Layers, desc: 'Non-destructive smart imports' },
      { id: 'system-guide', label: 'System Logic Guide', icon: BookOpen, desc: 'Download a PDF explaining every stat, rule and automation in the system', roles: ['admin', 'manager', 'viewer'] },
      { id: 'backup-restore', label: 'Backup & Restore', icon: Database, desc: 'Export a full data snapshot, restore from a previous backup, seed demo data or reset the database', roles: ['admin'] },
    ],
  },
  // Hidden groups — items remain here for access control / lockdown but are
  // not shown in the Settings sidebar or Hub overview. They render inside
  // their operational hub pages (Financial Control, Compliance, Assets, Staff).
  {
    label: '_hidden_migrated',
    items: [
      { id: 'billing', label: 'Billing Rules', icon: Banknote, desc: 'Delivery, task & consumable pricing rules' },
      { id: 'data-exchange', label: 'Data Exchange', icon: ArrowUpDown, desc: 'Bulk import/export rate cards, billing rules & BOQ data via CSV' },
      { id: 'overtime', label: 'Overtime', icon: Timer, desc: 'Overtime multipliers by day' },
      { id: 'business-rules', label: 'Business Rules', icon: Scale, desc: 'Core working rules — required daily hours & travel deductions — that drive the timesheet engine' },
      { id: 'expense-presets', label: 'Expense Presets', icon: Receipt, desc: 'Quick-add buttons crews see on the End-of-Shift expense step — fuel, subsistence, materials & GL codes' },
      { id: 'subcon-markup', label: 'Sub-Con Markup Rules', icon: TrendingUp, desc: 'Default markup percentages for subcontractor costs — guardrails prevent zero-margin billing' },
      { id: 'gl-mapping', label: 'GL Code Mapping', icon: FileSpreadsheet, desc: 'Map internal expense categories to SAP Concur General Ledger codes' },
      { id: 'billing-pipeline', label: 'Billing Pipeline', icon: GitBranch, desc: 'Lifecycle command view — contract stages, renewals due, vendor reconciliation & retention at a glance', roles: ['admin'] },
      { id: 'billing-contracts', label: 'Billing Contracts', icon: ScrollText, desc: 'Locked per-job billing terms — version-controlled contracts with rate snapshots, POA items & retention' },
      { id: 'purchase-orders', label: 'Purchase Orders', icon: FileText, desc: 'Create, track & match POs against supplier invoices with three-way matching — draft, send, receive & close', roles: ['admin'] },
      { id: 'financial-audit', label: 'Financial Audit Log', icon: History, desc: 'Tamper-evident record of every change to locked rate cards, SORs, billing rules, presets & contracts', roles: ['admin'] },
      { id: 'job-alerts', label: 'Job Budget Alerts', icon: Gauge, desc: 'Automated alerts when active jobs breach budget, margin or profit thresholds', roles: ['admin'] },
      { id: 'payroll-export', label: 'Payroll Export', icon: FileSpreadsheet, desc: 'Export approved weekly timesheets to CSV / Xero / Sage 50 — locks records after export', roles: ['admin'] },
      { id: 'custom-reports', label: 'Report Builder', icon: FileBarChart, desc: 'Build custom reports from 60+ data sources — pick columns, filter, and export to CSV or PDF', roles: ['admin', 'manager', 'viewer'] },
      { id: 'client-progress-report', label: 'Client Progress Report', icon: Star, desc: 'Generate a branded client-facing progress report for any job', roles: ['admin', 'manager'] },
      { id: 'rate-card', label: 'Price List', icon: Receipt, desc: 'Master Price List & project rate cards' },
      { id: 'compliance-rules', label: 'Compliance Rules', icon: Gauge, desc: 'Default LOLER, PUWER & PAT inspection intervals & expiry warnings', roles: ['admin'] },
      { id: 'system-audit-log', label: 'System Audit Log', icon: ShieldCheck, desc: 'ISO 27001 tamper-evident audit trail with SHA-256 record hashing & chain linking for non-repudiation', roles: ['admin'] },
      { id: 'audit-trail', label: 'Audit Trail & Job Packs', icon: History, desc: 'ISO-compliant audit trail — search for a job and expand its full Job Pack', roles: ['admin'] },
      { id: 'log-qc', label: 'Log QC', icon: FlaskConical, desc: 'Investigation log quality control & manager review', roles: ['admin', 'manager'] },
      { id: 'asset-manifests', label: 'Van Manifest QRs', icon: QrCode, desc: 'Create QR print-outs for bulky items (casing, rig tooling) — crews scan one sheet to log returns', roles: ['admin'] },
      { id: 'equipment-library', label: 'Equipment Sets', icon: Package, desc: 'Pre-built equipment sets (presets) — individual items now sync from Asset Panda' },
      { id: 'asset-lifecycle', label: 'Asset Lifecycle', icon: Wrench, desc: 'Track assets from acquisition to disposal — depreciation, book value & replacement planning', roles: ['admin'] },
      { id: 'access-levels', label: 'Permission Groups', icon: ShieldCheck, desc: 'Create permission groups and assign them to each crew member from Staff Command', roles: ['super_admin'] },
      { id: 'absences', label: 'Absences', icon: CalendarX, desc: 'Manage staff absences and leave' },
      { id: 'holiday-accrual', label: 'Holiday Accrual', icon: CalendarDays, desc: 'Track holiday pay accruals for staff' },
      { id: 'staff-reviews', label: 'Performance Reviews', icon: Star, desc: 'Manage staff performance reviews' },
      { id: 'timesheet-delegation', label: 'Approval Delegation', icon: UserCheck, desc: 'Manage timesheet approval delegations' },
      { id: 'vehicles', label: 'Vehicles', icon: Truck, desc: 'Manage vehicle fleet' },
      { id: 'clients', label: 'Clients', icon: Building2, desc: 'Manage clients' },
      { id: 'contractors', label: 'Sub-contractors', icon: HardHat, desc: 'Manage sub-contractors' },
      { id: 'suppliers', label: 'Suppliers', icon: Package, desc: 'Manage suppliers' },
      { id: 'teams', label: 'Crew Types', icon: Users, desc: 'Manage crew types / teams' },
      { id: 'staff', label: 'Staff', icon: Users, desc: 'Manage staff members' },
      { id: 'timesheets', label: 'Timesheets', icon: Clock, desc: 'Manage timesheets' },
      { id: 'invoicing', label: 'Invoicing', icon: Banknote, desc: 'Invoice management' },
      { id: 'compliance', label: 'Compliance', icon: ShieldCheck, desc: 'Compliance management' },
    ],
  },
];

export const allSettingsItems = settingsGroups.flatMap(g => g.items);

// Items visible to a given resolved role. Items without a `roles` array are
// admin-only (the default for all existing configuration tabs). Items that
// managers/viewers need (compliance, log-qc, timesheets) declare `roles`.
// If the profile has a permission group, the 'settings' module level is
// checked first — 'none' hides the entire settings area.
export function accessibleSettingsItems(role, profile) {
  if (!role) return [];

  // Super admins see everything — including the permission groups page
  // which is locked to super_admin only.
  if (role === 'super_admin') return allSettingsItems;

  // Permission group gate: if the group grants no access to the settings
  // module, hide every settings item.
  if (profile?.permission_group) {
    const settingsLevel = normalizePermissions(profile.permission_group.permissions).settings;
    if (settingsLevel === 'none') return [];
  }

  return allSettingsItems.filter(i => !i.roles || i.roles.includes(role));
}

// The sidebar nav UI component has been removed — the Settings Command Hub
// overview (SettingsHubOverview) now provides all navigation. The helper
// exports above (settingsGroups, allSettingsItems, accessibleSettingsItems)
// remain and are used by SettingsPage to resolve accessible tabs.