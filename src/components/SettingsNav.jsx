import React, { useState } from 'react';
import { Search, Users, Truck, Building2, HardHat, Package, CalendarX, Timer, Mail, Zap, Wrench, Tag, Banknote, Boxes,   Palette, Database, Receipt, TrendingUp, LayoutGrid, ListChecks, ShieldCheck, FlaskConical, Clock, FileUp, ClipboardCheck, ShieldAlert, Scale, Sparkles, Gauge, BookOpen, Settings2, Landmark, FileSpreadsheet, ScrollText, History, Lock, Radio, ArrowUpDown, Satellite, QrCode, Link2, Cloud, MapPin, MessageCircle, CreditCard, GitBranch, FileText } from 'lucide-react';
import { normalizePermissions } from '@/utils/permissions';

export const settingsGroups = [
  {
    label: 'Overview',
    items: [
      { id: 'hub', label: 'Command Hub', icon: LayoutGrid, desc: 'At-a-glance overview of every settings area with live counts' },
      { id: 'integrations', label: 'Integrations Hub', icon: Link2, desc: 'All external system connections in one place — API keys, webhooks & sync status for every integration', roles: ['admin'] },
    ],
  },
  {
    label: 'People & Teams',
    items: [
      { id: 'staff', label: 'Staff Command', icon: Users, desc: 'Manage everything about each crew member — profile, access, compliance, training, schedule & bookings' },
      { id: 'teams', label: 'Crew Types', icon: Users, desc: 'Manage everything about each crew type — capabilities, qualifications, revenue, assets & roster' },
      { id: 'access-levels', label: 'Permission Groups', icon: ShieldCheck, desc: 'Create permission groups and assign them to each crew member from Staff Command', roles: ['admin'] },
      { id: 'absences', label: 'Absences', icon: CalendarX, desc: 'Approve leave and recurring days off' },
      { id: 'bob-hr', label: 'Bob HR Sync', icon: Users, desc: 'Bidirectional time-off bridge with Bob HR (Hibob) — pull & push leave, webhook receiver for real-time events', roles: ['admin'] },
    ],
  },
  {
    label: 'Operations',
    items: [
      { id: 'asset-panda', label: 'Asset Panda Sync', icon: Database, desc: 'Connect Asset Panda & sync live inventory, stock levels and billing rates' },
      { id: 'asset-manifests', label: 'Van Manifest QRs', icon: QrCode, desc: 'Create QR print-outs for bulky items (casing, rig tooling) — crews scan one sheet to log returns', roles: ['admin'] },
      { id: 'equipment-library', label: 'Equipment Sets', icon: Package, desc: 'Pre-built equipment sets (presets) — individual items now sync from Asset Panda' },
      { id: 'vehicles', label: 'Vehicles', icon: Truck, desc: 'Track vehicles, MOTs and service dates' },
      { id: 'holman-sync', label: 'Holman Fleet Sync', icon: Radio, desc: 'Connect Holman fleet management — auto-sync MOT, service dates & mileage via API and webhooks', roles: ['admin'] },
      { id: 'geotab-sync', label: 'Geotab GPS Sync', icon: Satellite, desc: 'Connect Geotab GPS tracking — live vehicle locations, staff tracking by registration & fleet reports', roles: ['admin'] },
      { id: 'job-types', label: 'Job Types', icon: Tag, desc: 'Manage job types and colours' },
      { id: 'dropdowns', label: 'Dropdown Manager', icon: ListChecks, desc: 'Add, rename, reorder or remove options in every dropdown — qualifications, asset types, revenue streams & more' },
      { id: 'automations', label: 'Automations', icon: Zap, desc: 'View and toggle background automations' },
      { id: 'ags-import', label: 'KeyLogBook Settings', icon: FileUp, desc: 'Automated AGS file sync from KeyLogBook (every 30 min) & manual AGS imports — borehole data, strata & driller remarks', roles: ['admin', 'manager'] },
      { id: 'planner-import', label: 'Planner Import', icon: FileSpreadsheet, desc: 'Upload your Team & Plant Planner Excel file — auto-creates staff, jobs, teams & rotas with deduplication', roles: ['admin'] },
      { id: 'safety-culture', label: 'Safety Culture Sync', icon: ShieldAlert, desc: 'Sync site safety audits & inspection forms from SafetyCulture (iAuditor) — webhook & API integration ready for later setup', roles: ['admin', 'manager'] },
      { id: 'met-office', label: 'Met Office Weather', icon: Cloud, desc: 'Daily weather forecasts per site postcode — flag weather-impacted days on the rota', roles: ['admin'] },
      { id: 'google-maps', label: 'Google Maps', icon: MapPin, desc: 'Geocoding for job sites & delivery route optimisation', roles: ['admin'] },
      { id: 'whatsapp', label: 'WhatsApp Business', icon: MessageCircle, desc: 'Push critical alerts to crew via WhatsApp Business API — job cancellations, rig breakdowns, new rotas', roles: ['admin'] },
    ],
  },
  {
    label: 'Compliance & Review',
    items: [
      { id: 'compliance', label: 'Compliance', icon: ShieldCheck, desc: 'Staff compliance, training & qualifications tracking', roles: ['admin', 'manager', 'viewer'] },
      { id: 'compliance-rules', label: 'Compliance Rules', icon: Gauge, desc: 'Default LOLER, PUWER & PAT inspection intervals & expiry warnings', roles: ['admin'] },
      { id: 'log-qc', label: 'Log QC', icon: FlaskConical, desc: 'Review and approve investigation logs', roles: ['admin', 'manager', 'viewer'] },
      { id: 'audit-trail', label: 'Audit Trail', icon: ClipboardCheck, desc: 'ISO-compliant job packs — full start-to-finish audit trail for auditors', roles: ['admin', 'manager', 'viewer'] },
      { id: 'timesheets', label: 'Timesheets', icon: Clock, desc: 'Review and approve crew timesheets', roles: ['admin', 'manager'] },
      { id: 'cis-verification', label: 'CIS Verification', icon: ShieldCheck, desc: 'Verify subcontractors against HMRC CIS — deduction rates & verification numbers', roles: ['admin'] },
    ],
  },
  {
    label: 'Contacts',
    items: [
      { id: 'clients', label: 'Clients', icon: Building2, desc: 'Manage client contacts' },
      { id: 'contractors', label: 'Sub-contractors', icon: HardHat, desc: 'Onboard, vet & approve sub-contractors — insurance, accreditations & SafetyCulture email' },
      { id: 'suppliers', label: 'Suppliers', icon: Package, desc: 'Suppliers & their rate cards — upload to auto-populate job costing' },
    ],
  },
  {
    label: 'Finance & Billing',
    items: [
      { id: 'rate-card', label: 'Master Price List', icon: Receipt, desc: 'Your chargeable rate card plus each supplier\'s ingested rate card — auto-populates job costing' },
      { id: 'billing', label: 'Billing Rules', icon: Banknote, desc: 'Delivery, task & consumable pricing rules' },
      { id: 'data-exchange', label: 'Data Exchange', icon: ArrowUpDown, desc: 'Bulk import/export rate cards, billing rules & BOQ data via CSV' },
      { id: 'invoicing', label: 'Billing & Invoicing', icon: Receipt, desc: 'Per-job cost summary & invoice totals — reconcile CDRs and raise invoices', roles: ['admin', 'manager'] },
      { id: 'overtime', label: 'Overtime', icon: Timer, desc: 'Overtime multipliers by day' },
      { id: 'business-rules', label: 'Business Rules', icon: Scale, desc: 'Core working rules — required daily hours & travel deductions — that drive the timesheet engine' },
    ],
  },
  {
    label: 'Financial Control Hub',
    items: [
      { id: 'billing-pipeline', label: 'Billing Pipeline', icon: GitBranch, desc: 'Lifecycle command view — contract stages, renewals due, vendor reconciliation & retention at a glance', roles: ['admin'] },
      { id: 'expense-presets', label: 'Expense Presets', icon: Receipt, desc: 'Quick-add buttons crews see on the End-of-Shift expense step — fuel, subsistence, materials & GL codes' },
      { id: 'concur-sync', label: 'SAP Concur Sync', icon: Landmark, desc: 'API bridge to SAP Concur — pull GL codes, push approved expenses & timesheets in batch, lock synced records' },
      { id: 'subcon-markup', label: 'Sub-Con Markup Rules', icon: TrendingUp, desc: 'Default markup percentages for subcontractor costs — guardrails prevent zero-margin billing' },
      { id: 'gl-mapping', label: 'GL Code Mapping', icon: FileSpreadsheet, desc: 'Map internal expense categories to SAP Concur General Ledger codes' },
      { id: 'billing-contracts', label: 'Billing Contracts', icon: ScrollText, desc: 'Locked per-job billing terms — version-controlled contracts with rate snapshots, POA items & retention' },
      { id: 'purchase-orders', label: 'Purchase Orders', icon: FileText, desc: 'Create, track & match POs against supplier invoices with three-way matching — draft, send, receive & close', roles: ['admin'] },
      { id: 'financial-audit', label: 'Financial Audit Log', icon: History, desc: 'Tamper-evident record of every change to locked rate cards, SORs, billing rules, presets & contracts', roles: ['admin'] },
      { id: 'payroll-export', label: 'Payroll Export', icon: FileSpreadsheet, desc: 'Export approved weekly timesheets to CSV / Xero / Sage 50 — locks records after export', roles: ['admin'] },
      { id: 'accounting-sync', label: 'Xero / Sage Sync', icon: FileSpreadsheet, desc: 'Push invoices & purchase costs directly to Xero or Sage accounting — eliminates double-entry', roles: ['admin'] },
      { id: 'payment-gateway', label: 'Stripe Payments', icon: CreditCard, desc: 'Accept client invoice payments in the client portal via Stripe — auto-marks invoices as paid', roles: ['admin'] },
      { id: 'job-alerts', label: 'Job Budget Alerts', icon: Gauge, desc: 'Automated alerts when active jobs breach budget, margin or profit thresholds', roles: ['admin'] },
    ],
  },
  {
    label: 'Communication',
    items: [
      { id: 'global-branding', label: 'Global Branding', icon: Palette, desc: 'Default colours, banner and footer for all automated emails' },
      { id: 'login-branding', label: 'Login Page Customizer', icon: Palette, desc: 'Customise the staff login page — background, colours, logo, welcome text & live preview', roles: ['admin'] },
      { id: 'email-alerts', label: 'Email Alerts', icon: Mail, desc: 'Edit templates, recipients and timing for each automated email' },
    ],
  },
  {
    label: 'System',
    items: [
      { id: 'demo-data', label: 'Demo Data Manager', icon: Sparkles, desc: 'Populate realistic showcase data or wipe everything for a clean slate', roles: ['admin'] },
      { id: 'system-guide', label: 'System Logic Guide', icon: BookOpen, desc: 'Download a PDF explaining every stat, rule and automation in the system', roles: ['admin', 'manager', 'viewer'] },
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
  const effective = role === 'super_admin' ? 'admin' : role;

  // Permission group gate: if the group grants no access to the settings
  // module, hide every settings item.
  if (profile?.permission_group) {
    const settingsLevel = normalizePermissions(profile.permission_group.permissions).settings;
    if (settingsLevel === 'none') return [];
  }

  return allSettingsItems.filter(i => !i.roles || i.roles.includes(effective));
}

export default function SettingsNav({ activeId, onChange, role = 'admin', lockdownMap = {}, profile }) {
  const [query, setQuery] = useState('');
  const effectiveRole = role === 'super_admin' ? 'admin' : role;

  // If the staff member's permission group grants no access to the settings
  // module, hide every settings item.
  const settingsHidden = profile?.permission_group
    ? normalizePermissions(profile.permission_group.permissions).settings === 'none'
    : false;

  const roleFiltered = settingsHidden ? [] : settingsGroups
    .map(g => ({ ...g, items: g.items.filter(i => !i.roles || i.roles.includes(effectiveRole)) }))
    .filter(g => g.items.length > 0)
    .map(g => ({ ...g, items: g.items.filter(i => !lockdownMap[i.id]?.locked || (lockdownMap[i.id]?.allowedRoles || []).includes(effectiveRole) || effectiveRole === 'admin') }))
    .filter(g => g.items.length > 0);

  const q = query.toLowerCase().trim();
  const filtered = q
    ? roleFiltered
        .map(g => ({ ...g, items: g.items.filter(i => i.label.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q)) }))
        .filter(g => g.items.length > 0)
    : roleFiltered;

  return (
    <div>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search settings..."
          className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
      </div>
      {filtered.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-6">No settings match "{query}"</p>
      )}
      {filtered.map(group => (
        <div key={group.label} className="mb-2">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 py-1.5">{group.label}</p>
          {group.items.map(item => {
            const Icon = item.icon;
            const isActive = activeId === item.id;
            const isLocked = lockdownMap[item.id]?.locked;
            return (
              <button key={item.id} onClick={() => onChange(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition text-left ${
                  isActive ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                }`}>
                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="truncate flex-1 text-left">{item.label}</span>
                {isLocked && <Lock className={`w-3 h-3 flex-shrink-0 ${isActive ? 'text-white/70' : 'text-amber-500'}`} />}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}