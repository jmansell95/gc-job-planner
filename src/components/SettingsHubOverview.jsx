import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Users, Briefcase, Truck, Building2, Receipt, Package, ShieldCheck, Wrench, TrendingUp, HardHat, Boxes, Mail, Palette, Zap, Timer, Banknote, CalendarX, Database, Tag, ListChecks } from 'lucide-react';

/**
 * Settings Command Hub — an at-a-glance overview of everything configurable.
 * Shows live counts and quick-jump buttons for each settings area.
 */
export default function SettingsHubOverview({ onNavigate }) {
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => base44.entities.Vehicle.list() });
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list() });
  const { data: contractors = [] } = useQuery({ queryKey: ['contractors'], queryFn: () => base44.entities.Contractor.list() });
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: () => base44.entities.Supplier.list() });
  const { data: rateItems = [] } = useQuery({ queryKey: ['rate-card-items'], queryFn: () => base44.entities.RateCardItem.list('-created_date', 500) });
  const { data: catalogue = [] } = useQuery({ queryKey: ['equipment-catalogue'], queryFn: () => base44.entities.EquipmentCatalogue.list('-created_date', 500) });
  const { data: assets = [] } = useQuery({ queryKey: ['site-assets-catalogue'], queryFn: () => base44.entities.SiteAsset.list('-created_date', 500) });
  const { data: teams = [] } = useQuery({ queryKey: ['teams'], queryFn: () => base44.entities.Team.list() });
  const { data: billingRules = [] } = useQuery({ queryKey: ['billing-rules'], queryFn: () => base44.entities.BillingRule.list() });
  const { data: complianceItems = [] } = useQuery({ queryKey: ['compliance-items'], queryFn: () => base44.entities.ComplianceItem.list('-created_date', 500) });

  const expiringCompliance = complianceItems.filter(c => {
    if (!c.expiry_date) return false;
    const d = new Date(c.expiry_date);
    const days = (d - new Date()) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 30;
  }).length;
  const expiredCompliance = complianceItems.filter(c => {
    if (!c.expiry_date) return false;
    return new Date(c.expiry_date) < new Date();
  }).length;

  const activeCatalogue = catalogue.filter(c => c.is_active !== false).length;
  const ourRateItems = rateItems.filter(r => r.rate_card_source !== 'supplier').length;

  const cards = [
    { group: 'People', items: [
      { id: 'staff', icon: Users, label: 'Crew Members', value: staff.length, sub: `${staff.filter(s => s.is_active !== false).length} active`, color: 'emerald' },
      { id: 'teams', icon: HardHat, label: 'Crews', value: teams.length, sub: 'Teams & sub-teams', color: 'blue' },
      { id: 'absences', icon: CalendarX, label: 'Absences', value: '—', sub: 'Leave & time off', color: 'amber' },
    ]},
    { group: 'Operations', items: [
      { id: 'assets', icon: Wrench, label: 'Site Assets', value: assets.length, sub: 'GC Compliance sync', color: 'blue' },
      { id: 'asset-panda', icon: Database, label: 'Asset Panda', value: '—', sub: 'Inventory sync', color: 'cyan' },
      { id: 'equipment-library', icon: Boxes, label: 'Equipment Library', value: catalogue.length, sub: `${activeCatalogue} active`, color: 'emerald' },
      { id: 'vehicles', icon: Truck, label: 'Vehicles', value: vehicles.length, sub: 'Fleet & MOTs', color: 'amber' },
      { id: 'job-types', icon: Tag, label: 'Job Types', value: '—', sub: 'Types & colours', color: 'slate' },
      { id: 'dropdowns', icon: ListChecks, label: 'Dropdown Manager', value: '—', sub: 'Edit every dropdown', color: 'violet' },
      { id: 'automations', icon: Zap, label: 'Automations', value: '—', sub: 'Background tasks', color: 'violet' },
    ]},
    { group: 'Contacts', items: [
      { id: 'clients', icon: Building2, label: 'Clients', value: clients.length, sub: 'Client contacts', color: 'emerald' },
      { id: 'contractors', icon: HardHat, label: 'Contractors', value: contractors.length, sub: 'Subcontractors', color: 'indigo' },
      { id: 'suppliers', icon: Package, label: 'Suppliers', value: suppliers.length, sub: 'Hire suppliers', color: 'amber' },
    ]},
    { group: 'Finance & Billing', items: [
      { id: 'rate-card', icon: Receipt, label: 'Master Price List', value: ourRateItems, sub: 'Your rate card', color: 'emerald' },
      { id: 'billing', icon: Banknote, label: 'Billing Rules', value: billingRules.length, sub: 'Charge rules', color: 'blue' },
      { id: 'overtime', icon: Timer, label: 'Overtime', value: '—', sub: 'Rate multipliers', color: 'rose' },
    ]},
    { group: 'Compliance', items: [
      { id: 'compliance', icon: ShieldCheck, label: 'Compliance Items', value: complianceItems.length, sub: `${expiredCompliance} expired · ${expiringCompliance} expiring`, color: expiredCompliance > 0 ? 'rose' : 'emerald' },
    ]},
    { group: 'Communication', items: [
      { id: 'global-branding', icon: Palette, label: 'Global Branding', value: '—', sub: 'Email colours & banners', color: 'violet' },
      { id: 'email-alerts', icon: Mail, label: 'Email Alerts', value: '—', sub: 'Templates & timing', color: 'blue' },
    ]},
  ];

  const colorMap = {
    emerald: 'border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50',
    blue: 'border-blue-200 bg-blue-50/50 hover:bg-blue-50',
    amber: 'border-amber-200 bg-amber-50/50 hover:bg-amber-50',
    rose: 'border-rose-200 bg-rose-50/50 hover:bg-rose-50',
    slate: 'border-slate-200 bg-slate-50/50 hover:bg-slate-100',
    violet: 'border-violet-200 bg-violet-50/50 hover:bg-violet-50',
    cyan: 'border-cyan-200 bg-cyan-50/50 hover:bg-cyan-50',
    indigo: 'border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50',
  };
  const iconColor = {
    emerald: 'text-emerald-600', blue: 'text-blue-600', amber: 'text-amber-600',
    rose: 'text-rose-600', slate: 'text-slate-600', violet: 'text-violet-600',
    cyan: 'text-cyan-600', indigo: 'text-indigo-600',
  };

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl command-gradient p-5 md:p-6 shadow-lg">
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-12 h-12 rounded-xl bg-white/15 ring-1 ring-white/25 flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-bold text-white">Settings Command Hub</h2>
            <p className="text-emerald-50 text-sm">Full control of your site — manage everything from one place.</p>
          </div>
        </div>
      </div>

      {cards.map(group => (
        <div key={group.group}>
          <h3 className="text-sm font-bold text-slate-700 mb-2.5 px-1">{group.group}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {group.items.map(item => {
              const Icon = item.icon;
              return (
                <button key={item.id} onClick={() => onNavigate(item.id)}
                  className={`text-left rounded-xl border p-4 transition ${colorMap[item.color]}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
                      <Icon className={`w-5 h-5 ${iconColor[item.color]}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                      <p className="text-xs text-slate-500 truncate">{item.sub}</p>
                    </div>
                    {item.value !== '—' && (
                      <span className="text-2xl font-bold text-slate-800 tabular-nums">{item.value}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}