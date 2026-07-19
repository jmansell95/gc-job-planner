import React, { useState } from 'react';
import { Search, Users, Truck, Building2, HardHat, Package, CalendarX, Timer, Mail, Zap, Wrench, Tag, Banknote, Boxes, Palette, Database, Receipt, TrendingUp, LayoutGrid, ListChecks, ShieldCheck, FlaskConical, Clock } from 'lucide-react';

export const settingsGroups = [
  {
    label: 'Overview',
    items: [
      { id: 'hub', label: 'Command Hub', icon: LayoutGrid, desc: 'At-a-glance overview of every settings area with live counts' },
    ],
  },
  {
    label: 'People & Teams',
    items: [
      { id: 'staff', label: 'Crew Members', icon: Users, desc: 'Manage crew members, app access and shift times' },
      { id: 'teams', label: 'Crews', icon: Users, desc: 'Add, edit and remove crews, sub-crews and revenue streams' },
      { id: 'absences', label: 'Absences', icon: CalendarX, desc: 'Approve leave and recurring days off' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { id: 'assets', label: 'Asset Compliance', icon: Wrench, desc: 'Rigs, machinery & trailers — compliance status synced from GC Compliance Manager' },
      { id: 'asset-panda', label: 'Asset Panda Sync', icon: Database, desc: 'Connect Asset Panda & sync live inventory, stock levels and billing rates' },
      { id: 'equipment-library', label: 'Equipment Sets', icon: Package, desc: 'Pre-built equipment sets (presets) — individual items now sync from Asset Panda' },
      { id: 'vehicles', label: 'Vehicles', icon: Truck, desc: 'Track vehicles, MOTs and service dates' },
      { id: 'job-types', label: 'Job Types', icon: Tag, desc: 'Manage job types and colours' },
      { id: 'dropdowns', label: 'Dropdown Manager', icon: ListChecks, desc: 'Add, rename, reorder or remove options in every dropdown — qualifications, asset types, revenue streams & more' },
      { id: 'automations', label: 'Automations', icon: Zap, desc: 'View and toggle background automations' },
    ],
  },
  {
    label: 'Compliance & Review',
    items: [
      { id: 'compliance', label: 'Compliance', icon: ShieldCheck, desc: 'Staff compliance, training & qualifications tracking', roles: ['admin', 'manager', 'viewer'] },
      { id: 'log-qc', label: 'Log QC', icon: FlaskConical, desc: 'Review and approve investigation logs', roles: ['admin', 'manager', 'viewer'] },
      { id: 'timesheets', label: 'Timesheets', icon: Clock, desc: 'Review and approve crew timesheets', roles: ['admin', 'manager'] },
    ],
  },
  {
    label: 'Contacts',
    items: [
      { id: 'clients', label: 'Clients', icon: Building2, desc: 'Manage client contacts' },
      { id: 'contractors', label: 'Contractors', icon: HardHat, desc: 'Manage contractor contacts' },
      { id: 'suppliers', label: 'Suppliers', icon: Package, desc: 'Suppliers & their rate cards — upload to auto-populate job costing' },
    ],
  },
  {
    label: 'Finance & Billing',
    items: [
      { id: 'rate-card', label: 'Master Price List', icon: Receipt, desc: 'Your chargeable rate card plus each supplier\'s ingested rate card — auto-populates job costing' },
      { id: 'billing', label: 'Billing Rules', icon: Banknote, desc: 'Delivery, task & consumable pricing rules' },
      { id: 'overtime', label: 'Overtime', icon: Timer, desc: 'Overtime multipliers by day' },
    ],
  },
  {
    label: 'Communication',
    items: [
      { id: 'global-branding', label: 'Global Branding', icon: Palette, desc: 'Default colours, banner and footer for all automated emails' },
      { id: 'email-alerts', label: 'Email Alerts', icon: Mail, desc: 'Edit templates, recipients and timing for each automated email' },
    ],
  },
];

export const allSettingsItems = settingsGroups.flatMap(g => g.items);

// Items visible to a given resolved role. Items without a `roles` array are
// admin-only (the default for all existing configuration tabs). Items that
// managers/viewers need (compliance, log-qc, timesheets) declare `roles`.
export function accessibleSettingsItems(role) {
  if (!role) return [];
  return allSettingsItems.filter(i => !i.roles || i.roles.includes(role));
}

export default function SettingsNav({ activeId, onChange, role = 'admin' }) {
  const [query, setQuery] = useState('');

  const roleFiltered = settingsGroups
    .map(g => ({ ...g, items: g.items.filter(i => !i.roles || i.roles.includes(role)) }))
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
            return (
              <button key={item.id} onClick={() => onChange(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition text-left ${
                  isActive ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                }`}>
                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}