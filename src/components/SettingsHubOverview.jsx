import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Users, Briefcase, Truck, Building2, Receipt, Package, Wrench, HardHat, Boxes, Mail, Palette, Zap, Timer, Banknote, CalendarX, Database, Tag, ListChecks, ShieldCheck, FlaskConical, Clock, FileUp, ClipboardCheck, ShieldAlert, Scale, ArrowRight, Activity } from 'lucide-react';

/**
 * Settings Command Hub — premium at-a-glance overview of everything configurable.
 * Shows live counts, needs-attention alerts, and quick-jump cards grouped by domain.
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
  const activeStaff = staff.filter(s => s.is_active !== false).length;
  const activeJobs = jobs.filter(j => (j.status || 'planning') === 'in_progress').length;

  const groups = [
    { group: 'People & Teams', icon: Users, accent: 'from-emerald-500 to-teal-600', items: [
      { id: 'staff', icon: Users, label: 'Crew Members', value: staff.length, sub: `${activeStaff} active`, color: 'emerald' },
      { id: 'teams', icon: Users, label: 'Crews', value: teams.length, sub: 'Teams & sub-teams', color: 'blue' },
      { id: 'access-levels', icon: ShieldCheck, label: 'Access Levels', value: '—', sub: 'Permission groups', color: 'slate' },
      { id: 'absences', icon: CalendarX, label: 'Absences', value: '—', sub: 'Leave & time off', color: 'amber' },
    ]},
    { group: 'Operations', icon: Activity, accent: 'from-blue-500 to-cyan-600', items: [
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
    { group: 'Compliance & Review', icon: ShieldCheck, accent: 'from-rose-500 to-pink-600', items: [
      { id: 'compliance', icon: ShieldCheck, label: 'Compliance', value: complianceItems.length, sub: 'Training & qualifications', color: 'rose' },
      { id: 'log-qc', icon: FlaskConical, label: 'Log QC', value: pendingReviewLogs, sub: 'Pending review', color: 'violet' },
      { id: 'audit-trail', icon: ClipboardCheck, label: 'Audit Trail', value: jobs.length, sub: 'Job packs for auditors', color: 'emerald' },
      { id: 'timesheets', icon: Clock, label: 'Timesheets', value: pendingTimesheets, sub: 'Awaiting approval', color: 'blue' },
    ]},
    { group: 'Contacts', icon: Building2, accent: 'from-indigo-500 to-blue-600', items: [
      { id: 'clients', icon: Building2, label: 'Clients', value: clients.length, sub: 'Client contacts', color: 'emerald' },
      { id: 'contractors', icon: HardHat, label: 'Contractors', value: contractors.length, sub: 'Subcontractors', color: 'indigo' },
      { id: 'suppliers', icon: Package, label: 'Suppliers', value: suppliers.length, sub: 'Hire suppliers', color: 'amber' },
    ]},
    { group: 'Finance & Billing', icon: Receipt, accent: 'from-emerald-600 to-green-700', items: [
      { id: 'rate-card', icon: Receipt, label: 'Master Price List', value: ourRateItems, sub: 'Your rate card', color: 'emerald' },
      { id: 'billing', icon: Banknote, label: 'Billing Rules', value: billingRules.length, sub: 'Charge rules', color: 'blue' },
      { id: 'invoicing', icon: Receipt, label: 'Billing & Invoicing', value: '—', sub: 'Job cost summaries', color: 'emerald' },
      { id: 'overtime', icon: Timer, label: 'Overtime', value: '—', sub: 'Rate multipliers', color: 'rose' },
      { id: 'business-rules', icon: Scale, label: 'Business Rules', value: '—', sub: 'Hours & travel rules', color: 'slate' },
    ]},
    { group: 'Communication', icon: Mail, accent: 'from-violet-500 to-purple-600', items: [
      { id: 'global-branding', icon: Palette, label: 'Global Branding', value: '—', sub: 'Email colours & banners', color: 'violet' },
      { id: 'email-alerts', icon: Mail, label: 'Email Alerts', value: '—', sub: 'Templates & timing', color: 'blue' },
    ]},
  ];

  // Accent stripe + icon tile colour per card colour
  const accent = {
    emerald: { stripe: 'from-emerald-400 to-emerald-600', tile: 'bg-gradient-to-br from-emerald-400 to-emerald-600', text: 'text-emerald-600', ring: 'ring-emerald-100' },
    blue: { stripe: 'from-blue-400 to-blue-600', tile: 'bg-gradient-to-br from-blue-400 to-blue-600', text: 'text-blue-600', ring: 'ring-blue-100' },
    amber: { stripe: 'from-amber-400 to-orange-500', tile: 'bg-gradient-to-br from-amber-400 to-orange-500', text: 'text-amber-600', ring: 'ring-amber-100' },
    rose: { stripe: 'from-rose-400 to-pink-600', tile: 'bg-gradient-to-br from-rose-400 to-pink-600', text: 'text-rose-600', ring: 'ring-rose-100' },
    slate: { stripe: 'from-slate-400 to-slate-600', tile: 'bg-gradient-to-br from-slate-400 to-slate-600', text: 'text-slate-600', ring: 'ring-slate-100' },
    violet: { stripe: 'from-violet-400 to-purple-600', tile: 'bg-gradient-to-br from-violet-400 to-purple-600', text: 'text-violet-600', ring: 'ring-violet-100' },
    cyan: { stripe: 'from-cyan-400 to-sky-600', tile: 'bg-gradient-to-br from-cyan-400 to-sky-600', text: 'text-cyan-600', ring: 'ring-cyan-100' },
    indigo: { stripe: 'from-indigo-400 to-blue-600', tile: 'bg-gradient-to-br from-indigo-400 to-blue-600', text: 'text-indigo-600', ring: 'ring-indigo-100' },
  };

  // Needs-attention alerts
  const alerts = [];
  if (pendingReviewLogs > 0) alerts.push({ id: 'log-qc', icon: FlaskConical, label: `${pendingReviewLogs} log${pendingReviewLogs !== 1 ? 's' : ''} pending review`, color: 'violet' });
  if (pendingTimesheets > 0) alerts.push({ id: 'timesheets', icon: Clock, label: `${pendingTimesheets} timesheet${pendingTimesheets !== 1 ? 's' : ''} awaiting approval`, color: 'blue' });
  const todayStr = new Date().toISOString().slice(0, 10);
  const expiredCompliance = complianceItems.filter(c => c.status_override !== 'not_required' && c.expiry_date && c.expiry_date.slice(0, 10) < todayStr).length;
  if (expiredCompliance > 0) alerts.push({ id: 'compliance', icon: ShieldCheck, label: `${expiredCompliance} expired compliance item${expiredCompliance !== 1 ? 's' : ''}`, color: 'rose' });

  const alertStyle = {
    violet: 'bg-violet-50/70 border-violet-200 text-violet-700 hover:bg-violet-100',
    blue: 'bg-blue-50/70 border-blue-200 text-blue-700 hover:bg-blue-100',
    rose: 'bg-rose-50/70 border-rose-200 text-rose-700 hover:bg-rose-100',
  };

  const heroStats = [
    { label: 'Crew', value: activeStaff, icon: Users },
    { label: 'Active Jobs', value: activeJobs, icon: Briefcase },
    { label: 'Vehicles', value: vehicles.length, icon: Truck },
    { label: 'Clients', value: clients.length, icon: Building2 },
  ];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl mesh-bg shadow-xl">
        <div className="relative z-10 px-5 py-5 md:px-6 md:py-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-xl bg-white/15 ring-1 ring-white/25 flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-white tracking-tight">Settings Command Hub</h2>
              <p className="text-emerald-50/90 text-sm">Full control of your site — manage everything from one place.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {heroStats.map(s => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2.5 ring-1 ring-white/15">
                  <div className="flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5 text-emerald-200" />
                    <p className="text-[11px] font-medium text-emerald-100 uppercase tracking-wide">{s.label}</p>
                  </div>
                  <p className="text-2xl font-bold text-white mt-0.5 tabular-nums">{s.value}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Needs Attention */}
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
                  className={`text-left rounded-xl border p-4 transition flex items-center gap-3 group ${alertStyle[a.color]}`}>
                  <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Icon className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-semibold flex-1">{a.label}</p>
                  <ArrowRight className="w-4 h-4 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Grouped cards */}
      {groups.map(group => {
        const GroupIcon = group.icon;
        return (
          <div key={group.group}>
            <div className="flex items-center gap-2.5 mb-3 px-1">
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${group.accent} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                <GroupIcon className="w-4 h-4 text-white" />
              </div>
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">{group.group}</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {group.items.map(item => {
                const Icon = item.icon;
                const a = accent[item.color] || accent.slate;
                return (
                  <button key={item.id} onClick={() => onNavigate(item.id)}
                    className="insight-card relative rounded-xl p-4 text-left group overflow-hidden">
                    <span className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${a.stripe}`} />
                    <div className="flex items-center gap-3 pl-1">
                      <div className={`w-11 h-11 rounded-xl ${a.tile} flex items-center justify-center flex-shrink-0 shadow-md icon-tile-glow`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 truncate">{item.label}</p>
                        <p className="text-xs text-slate-500 truncate">{item.sub}</p>
                      </div>
                      {item.value !== '—' && (
                        <span className="text-2xl font-bold text-slate-800 tabular-nums">{item.value}</span>
                      )}
                      <ArrowRight className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition flex-shrink-0" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}