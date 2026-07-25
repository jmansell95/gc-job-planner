import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Users, Briefcase, Truck, Building2, Receipt, Package, Wrench, TrendingUp, HardHat, Boxes, Mail, Palette, Zap, Timer, Banknote, CalendarX, Database, Tag, ListChecks, ShieldCheck, FlaskConical, Clock, FileUp, ClipboardCheck, ShieldAlert, Scale } from 'lucide-react';

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
  const { data: costPresets = [] } = useQuery({ queryKey: ['cost-presets-hub'], queryFn: () => base44.entities.CostPreset.list('-created_date', 500) });
  const { data: assets = [] } = useQuery({ queryKey: ['site-assets-catalogue'], queryFn: () => base44.entities.SiteAsset.list('-created_date', 500) });
  const { data: teams = [] } = useQuery({ queryKey: ['teams'], queryFn: () => base44.entities.Team.list() });
  const { data: billingRules = [] } = useQuery({ queryKey: ['billing-rules'], queryFn: () => base44.entities.BillingRule.list() });
  const { data: complianceItems = [] } = useQuery({ queryKey: ['compliance-items-hub'], queryFn: () => base44.entities.ComplianceItem.list('-created_date', 500) });
  const { data: invLogs = [] } = useQuery({ queryKey: ['inv-logs-hub'], queryFn: () => base44.entities.InvestigationLog.list('-created_date', 200) });
  const { data: timesheets = [] } = useQuery({ queryKey: ['timesheets-hub'], queryFn: () => base44.entities.Timesheet.list('-created_date', 200) });

  const ourRateItems = rateItems.filter(r => r.rate_card_source !== 'supplier').length;
  const pendingReviewLogs = invLogs.filter(l => l.manager_review_status === 'pending').length;
  const pendingTimesheets = timesheets.filter(t => t.status === 'submitted').length;

  const cards = [
    { group: 'People & Teams', items: [
      { id: 'staff', icon: Users, label: 'Crew Members', value: staff.length, sub: `${staff.filter(s => s.is_active !== false).length} active`, color: 'emerald' },
      { id: 'teams', icon: Users, label: 'Crews', value: teams.length, sub: 'Teams & sub-teams', color: 'blue' },
      { id: 'access-levels', icon: ShieldCheck, label: 'Access Levels', value: '—', sub: 'Permission groups', color: 'slate' },
      { id: 'absences', icon: CalendarX, label: 'Absences', value: '—', sub: 'Leave & time off', color: 'amber' },
    ]},
    { group: 'Operations', items: [
      { id: 'assets', icon: Wrench, label: 'Compliance Sync', value: assets.length, sub: 'GC Compliance sync', color: 'blue' },
      { id: 'asset-panda', icon: Database, label: 'Asset Panda Sync', value: '—', sub: 'Inventory sync', color: 'cyan' },
      { id: 'equipment-library', icon: Boxes, label: 'Equipment Sets', value: costPresets.length, sub: 'Pre-built sets', color: 'emerald' },
      { id: 'vehicles', icon: Truck, label: 'Vehicles', value: vehicles.length, sub: 'Fleet & MOTs', color: 'amber' },
      { id: 'job-types', icon: Tag, label: 'Job Types', value: '—', sub: 'Types & colours', color: 'slate' },
      { id: 'dropdowns', icon: ListChecks, label: 'Dropdown Manager', value: '—', sub: 'Edit every dropdown', color: 'violet' },
      { id: 'automations', icon: Zap, label: 'Automations', value: '—', sub: 'Background tasks', color: 'violet' },
      { id: 'ags-import', icon: FileUp, label: 'KeyLogBook Settings', value: '—', sub: 'Webhook sync & imports', color: 'cyan' },
      { id: 'safety-culture', icon: ShieldAlert, label: 'Safety Culture Sync', value: '—', sub: 'Audit & form sync', color: 'rose' },
    ]},
    { group: 'Compliance & Review', items: [
      { id: 'compliance', icon: ShieldCheck, label: 'Compliance', value: complianceItems.length, sub: 'Training & qualifications', color: 'rose' },
      { id: 'log-qc', icon: FlaskConical, label: 'Log QC', value: pendingReviewLogs, sub: 'Pending review', color: 'violet' },
      { id: 'audit-trail', icon: ClipboardCheck, label: 'Audit Trail', value: jobs.length, sub: 'Job packs for auditors', color: 'emerald' },
      { id: 'timesheets', icon: Clock, label: 'Timesheets', value: pendingTimesheets, sub: 'Awaiting approval', color: 'blue' },
    ]},
    { group: 'Contacts', items: [
      { id: 'clients', icon: Building2, label: 'Clients', value: clients.length, sub: 'Client contacts', color: 'emerald' },
      { id: 'contractors', icon: HardHat, label: 'Contractors', value: contractors.length, sub: 'Subcontractors', color: 'indigo' },
      { id: 'suppliers', icon: Package, label: 'Suppliers', value: suppliers.length, sub: 'Hire suppliers', color: 'amber' },
    ]},
    { group: 'Finance & Billing', items: [
      { id: 'rate-card', icon: Receipt, label: 'Master Price List', value: ourRateItems, sub: 'Your rate card', color: 'emerald' },
      { id: 'billing', icon: Banknote, label: 'Billing Rules', value: billingRules.length, sub: 'Charge rules', color: 'blue' },
      { id: 'invoicing', icon: Receipt, label: 'Billing & Invoicing', value: '—', sub: 'Job cost summaries', color: 'emerald' },
      { id: 'overtime', icon: Timer, label: 'Overtime', value: '—', sub: 'Rate multipliers', color: 'rose' },
      { id: 'business-rules', icon: Scale, label: 'Business Rules', value: '—', sub: 'Hours & travel rules', color: 'slate' },
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

  // Build "needs attention" alerts
  const alerts = [];
  if (pendingReviewLogs > 0) alerts.push({ id: 'log-qc', icon: FlaskConical, label: `${pendingReviewLogs} log${pendingReviewLogs !== 1 ? 's' : ''} pending review`, color: 'violet' });
  if (pendingTimesheets > 0) alerts.push({ id: 'timesheets', icon: Clock, label: `${pendingTimesheets} timesheet${pendingTimesheets !== 1 ? 's' : ''} awaiting approval`, color: 'blue' });
  const todayStr = new Date().toISOString().slice(0, 10);
  const expiredCompliance = complianceItems.filter(c => c.status_override !== 'not_required' && c.expiry_date && c.expiry_date.slice(0, 10) < todayStr).length;
  if (expiredCompliance > 0) alerts.push({ id: 'compliance', icon: ShieldCheck, label: `${expiredCompliance} expired compliance item${expiredCompliance !== 1 ? 's' : ''}`, color: 'rose' });

  const alertColor = {
    violet: 'bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100',
    blue: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100',
    rose: 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100',
  };

  return (
    <div className="space-y-5">
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

      {/* Needs Attention — deep-link alerts */}
      {alerts.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-slate-700 mb-2.5 px-1 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-rose-500" /> Needs Attention
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {alerts.map(a => {
              const Icon = a.icon;
              return (
                <button key={a.id} onClick={() => onNavigate(a.id)}
                  className={`text-left rounded-xl border p-4 transition flex items-center gap-3 ${alertColor[a.color]}`}>
                  <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Icon className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-semibold">{a.label}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

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