import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useDivision } from '@/contexts/DivisionContext';
import { useAuth } from '@/lib/AuthContext';
import {
  Building2, Users, Briefcase, Truck, ClipboardCheck, ShieldCheck, PoundSterling,
  ArrowRight, Settings, Sparkles, TrendingUp, AlertTriangle, CheckCircle2,
  ChevronRight, LayoutGrid, X, Activity, Zap, Link2, Calendar, Crown, Crown as DirectorIcon,
  User, HelpCircle, LogOut,
} from 'lucide-react';
import Logo, { LandWaterLogo } from '@/components/Logo';
import EnterpriseHeader from '@/components/EnterpriseHeader';
import ProfileAvatar from '@/components/ui/ProfileAvatar';
import DivisionWizard from '@/components/wizard/DivisionWizard';
import EnterpriseIntegrationsOverview from '@/components/enterprise/EnterpriseIntegrationsOverview';
import EnterpriseReadinessOverview from '@/components/enterprise/EnterpriseReadinessOverview';

const WIDGET_STORAGE_KEY = 'gc-enterprise-widgets';
const DEFAULT_WIDGETS = {
  companyKpis: true,
  divisionHealth: true,
  financialRollup: true,
  complianceSnapshot: true,
  integrationsOverview: true,
  readinessOverview: true,
};

const DIVISION_TYPE_LABELS = {
  geotechnical: 'Geotechnical',
  environmental: 'Environmental',
  surveys: 'Surveys',
  structural: 'Structural',
  renewables: 'Renewables',
  general: 'General',
};

const STATUS_STYLES = {
  active: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200', label: 'Active', dot: 'bg-emerald-500' },
  setup: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200', label: 'Setup', dot: 'bg-amber-500' },
  on_hold: { bg: 'bg-slate-100', text: 'text-slate-600', ring: 'ring-slate-200', label: 'On Hold', dot: 'bg-slate-400' },
};

const TODAY_LABEL = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

export default function EnterpriseDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { divisions, permittedDivisions, setActiveDivision, isSuperAdmin, isDirector, isLoading: divisionsLoading } = useDivision();
  const [customising, setCustomising] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const integrationsRef = React.useRef(null);
  const readinessRef = React.useRef(null);

  const scrollTo = (ref) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const { data: myProfile } = useQuery({ queryKey: ['ent-my-profile'], queryFn: async () => { const res = await base44.functions.invoke('getMyStaffProfile'); return res.data; } });
  // Clear division context on mount — the Enterprise Dashboard sits above all
  // divisions. No division sidebar, no division-scoped data, no crossover.
  useEffect(() => { setActiveDivision(null); }, []);
  useEffect(() => {
    if (!profileMenuOpen) return;
    const handler = () => setProfileMenuOpen(false);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [profileMenuOpen]);
  const myProfileName = myProfile?.name || user?.full_name || user?.email || 'User';
  const myProfileAvatar = myProfile?.avatar_url || null;
  const [widgets, setWidgets] = useState(() => {
    try { return { ...DEFAULT_WIDGETS, ...JSON.parse(localStorage.getItem(WIDGET_STORAGE_KEY) || '{}') }; }
    catch { return DEFAULT_WIDGETS; }
  });

  const { data: staff = [] } = useQuery({ queryKey: ['ent-staff'], queryFn: () => base44.entities.Staff.list('-created_date', 5000) });
  const { data: jobs = [] } = useQuery({ queryKey: ['ent-jobs'], queryFn: () => base44.entities.Job.list('-created_date', 5000) });
  const { data: vehicles = [] } = useQuery({ queryKey: ['ent-vehicles'], queryFn: () => base44.entities.Vehicle.list('-created_date', 5000) });
  const { data: timesheets = [] } = useQuery({ queryKey: ['ent-timesheets'], queryFn: () => base44.entities.Timesheet.list('-created_date', 500) });
  const { data: invoices = [] } = useQuery({ queryKey: ['ent-invoices'], queryFn: () => base44.entities.Invoice.list('-created_date', 500) });
  const { data: compliance = [] } = useQuery({ queryKey: ['ent-compliance'], queryFn: () => base44.entities.ComplianceItem.list('-created_date', 1000) });

  const toggleWidget = (key) => {
    const next = { ...widgets, [key]: !widgets[key] };
    setWidgets(next);
    try { localStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(next)); } catch {}
  };

  const divisionStats = useMemo(() => {
    return permittedDivisions.map(d => {
      const dStaff = staff.filter(s => s.division_id === d.id);
      const dJobs = jobs.filter(j => j.division_id === d.id);
      const dVehicles = vehicles.filter(v => v.division_id === d.id);
      const dInvoices = invoices.filter(i => i.division_id === d.id);
      const activeJobs = dJobs.filter(j => (j.status || 'planning') === 'in_progress').length;
      const outstanding = dInvoices
        .filter(i => i.status && i.status !== 'paid' && i.status !== 'void')
        .reduce((sum, i) => sum + (i.gross_total || 0), 0);
      return {
        division: d,
        staffCount: dStaff.length,
        activeStaff: dStaff.filter(s => s.is_active !== false).length,
        jobsCount: dJobs.length,
        activeJobs,
        vehiclesCount: dVehicles.length,
        outstanding,
      };
    });
  }, [permittedDivisions, staff, jobs, vehicles, invoices]);

  const globalStats = useMemo(() => {
    const permittedJobIds = new Set(jobs.filter(j => permittedDivisions.some(d => d.id === j.division_id)).map(j => j.id));
    const permittedStaffIds = new Set(staff.filter(s => permittedDivisions.some(d => d.id === s.division_id)).map(s => s.id));
    const permittedVehicleIds = new Set(vehicles.filter(v => permittedDivisions.some(d => d.id === v.division_id)).map(v => v.id));
    const activeJobs = jobs.filter(j => permittedJobIds.has(j.id) && (j.status || 'planning') === 'in_progress').length;
    const pendingTs = timesheets.filter(t => permittedStaffIds.has(t.staff_id) && t.status === 'submitted').length;
    const openCompliance = compliance.filter(c => {
      if (!c.expiry_date) return false;
      return new Date(c.expiry_date) < new Date();
    }).length;
    const totalOutstanding = invoices
      .filter(i => i.status && i.status !== 'paid' && i.status !== 'void')
      .reduce((sum, i) => sum + (i.gross_total || 0), 0);
    return {
      divisions: permittedDivisions.length,
      activeDivisions: permittedDivisions.filter(d => d.status === 'active').length,
      staff: staff.filter(s => permittedStaffIds.has(s.id)).length,
      activeJobs,
      vehicles: vehicles.filter(v => permittedVehicleIds.has(v.id)).length,
      pendingTs,
      openCompliance,
      totalOutstanding,
    };
  }, [permittedDivisions, staff, jobs, vehicles, timesheets, compliance, invoices]);

  const gbp = (n) => n ? '\u00A3' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '\u00A30';

  const enterDivision = (d) => {
    setActiveDivision(d.id);
    const landing = d.landing_page || '/admin';
    navigate(landing, { state: { section: 'overview' } });
  };

  const goToSettings = (tab) => {
    navigate('/enterprise/settings', { state: { tab: tab || 'divisions' } });
  };

  // Only super admins can manage divisions and integrations
  const canManageDivisions = isSuperAdmin;

  if (divisionsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  const kpiTiles = [
    { label: 'Divisions', value: globalStats.divisions, sub: globalStats.activeDivisions + ' active', icon: Building2, gradient: 'stat-gradient-emerald' },
    { label: 'Total Crew', value: globalStats.staff, sub: 'across all divisions', icon: Users, gradient: 'stat-gradient-blue' },
    { label: 'Active Jobs', value: globalStats.activeJobs, sub: jobs.length + ' total', icon: Briefcase, gradient: 'stat-gradient-amber' },
    { label: 'Fleet', value: globalStats.vehicles, sub: 'vehicles', icon: Truck, gradient: 'stat-gradient-violet' },
    { label: 'Ts Queue', value: globalStats.pendingTs, sub: 'awaiting approval', icon: ClipboardCheck, gradient: 'stat-gradient-rose' },
    { label: 'Outstanding', value: gbp(globalStats.totalOutstanding), sub: 'unpaid invoices', icon: PoundSterling, gradient: 'stat-gradient-indigo' },
  ];

  const quickActions = isSuperAdmin ? [
    { label: 'Settings', icon: Settings, action: () => goToSettings('divisions'), gradient: 'from-slate-600 to-slate-800' },
    { label: 'Divisions', icon: Building2, action: () => goToSettings('divisions'), gradient: 'from-emerald-600 to-teal-700' },
    { label: 'Readiness', icon: Zap, action: () => scrollTo(readinessRef), gradient: 'from-amber-500 to-orange-600' },
    { label: 'Integrations', icon: Link2, action: () => scrollTo(integrationsRef), gradient: 'from-blue-600 to-indigo-700' },
  ] : [
    { label: 'Settings', icon: Settings, action: () => goToSettings('hub'), gradient: 'from-slate-600 to-slate-800' },
    { label: 'Readiness', icon: Zap, action: () => scrollTo(readinessRef), gradient: 'from-amber-500 to-orange-600' },
    { label: 'Integrations', icon: Link2, action: () => scrollTo(integrationsRef), gradient: 'from-blue-600 to-indigo-700' },
    { label: 'Help', icon: HelpCircle, action: () => navigate('/enterprise/help'), gradient: 'from-rose-500 to-pink-600' },
  ];

  const heroHighlights = [
    { label: 'Divisions', value: globalStats.divisions, icon: Building2 },
    { label: 'Crew', value: globalStats.staff, icon: Users },
    { label: 'Active Jobs', value: globalStats.activeJobs, icon: Briefcase },
    { label: 'Outstanding', value: gbp(globalStats.totalOutstanding), icon: PoundSterling },
  ];

  return (
    <div className="min-h-screen page-bg-vibrant">
      <EnterpriseHeader />
      <div className="px-4 pb-24 pt-[calc(3.5rem+env(safe-area-inset-top)+0.5rem)] xl:pt-6 xl:px-6 xl:pb-6 space-y-4">
      {/* Page header with title + desktop profile menu — responsive mobile / tablet / desktop */}
      <div className="flex items-center justify-between gap-2 sm:gap-3 mb-4">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0 shadow-lg glow-brand">
            <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl lg:text-2xl font-extrabold text-slate-900 tracking-tight leading-none truncate">
              Land &amp; Water Solutions
            </h1>
            <p className="text-[11px] sm:text-sm text-slate-500 font-semibold mt-0.5 truncate">Enterprise Command Centre</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isSuperAdmin && (
            <button onClick={() => setCustomising(!customising)} className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition shadow-sm">
              <LayoutGrid className="w-4 h-4" /> <span className="hidden md:inline">Customise</span>
            </button>
          )}
          <div className="hidden xl:block relative">
            <button onClick={(e) => { e.stopPropagation(); setProfileMenuOpen(!profileMenuOpen); }} type="button" aria-label="Profile menu" className="relative flex items-center justify-center active:scale-95 rounded-full transition ring-2 ring-transparent hover:ring-slate-200">
              <ProfileAvatar name={myProfileName} avatarUrl={myProfileAvatar} size={36} />
            </button>
            {profileMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-60 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50" onClick={(e) => e.stopPropagation()}>
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-sm font-semibold text-slate-900 truncate">{myProfileName}</p>
                  {user?.email && <p className="text-xs text-slate-500 truncate mt-0.5">{user.email}</p>}
                </div>
                <div className="py-1">
                  <button onClick={() => { navigate('/enterprise-profile'); setProfileMenuOpen(false); }} type="button" className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition text-left">
                    <User className="w-4 h-4 text-slate-400" /> My Profile
                  </button>
                  <button onClick={() => { navigate('/enterprise/help'); setProfileMenuOpen(false); }} type="button" className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition text-left">
                    <HelpCircle className="w-4 h-4 text-slate-400" /> Help Guides
                  </button>
                </div>
                <div className="border-t border-slate-100 py-1">
                  <button onClick={() => { base44.auth.logout('/'); setProfileMenuOpen(false); }} type="button" className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 transition text-left">
                    <LogOut className="w-4 h-4" /> Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Access strip — responsive */}
      <div className="grid grid-cols-4 gap-1.5 sm:gap-3">
        {quickActions.map(a => {
          const Icon = a.icon;
          return (
            <button key={a.label} onClick={a.action} className={'bg-gradient-to-br ' + a.gradient + ' rounded-xl sm:rounded-2xl p-2.5 sm:p-3 flex flex-col items-center gap-1 sm:gap-1.5 text-white shadow-md hover:shadow-lg hover:scale-105 transition'}>
              <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-[10px] sm:text-[11px] font-bold truncate w-full text-center">{a.label}</span>
            </button>
          );
        })}
      </div>

      {/* Company KPIs */}
      {widgets.companyKpis && (
        <section className="insight-card rounded-3xl p-5 sm:p-6">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center shadow-md">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Company KPIs</h2>
              <p className="text-xs text-slate-500">Live rollup across every division</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 sm:gap-2.5">
            {kpiTiles.map(t => {
              const Icon = t.icon;
              return (
                <div key={t.label} className={t.gradient + ' rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 text-white relative overflow-hidden shadow-md'}>
                  <div className="absolute right-2 top-2 opacity-20">
                    <Icon className="w-7 h-7 sm:w-8 sm:h-8" />
                  </div>
                  <div className="relative">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-white/20 flex items-center justify-center mb-1.5 sm:mb-2">
                      <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                    </div>
                    <p className="text-[10px] font-bold text-white/80 uppercase tracking-wide">{t.label}</p>
                    <p className="text-lg sm:text-xl font-extrabold text-white mt-0.5 tabular-nums">{t.value}</p>
                    <p className="text-[10px] text-white/70 mt-0.5 truncate">{t.sub}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Divisions */}
      {widgets.divisionHealth && (
        <section>
          <div className="flex items-center gap-2.5 mb-3 px-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-md">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Divisions</h2>
              <p className="text-xs text-slate-500">Tap a division to enter its workspace</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {divisionStats.map(ds => {
              const d = ds.division;
              const st = STATUS_STYLES[d.status || 'setup'] || STATUS_STYLES.setup;
              const divColor = d.color || '#2E5A1A';
              const headerGradient = 'linear-gradient(90deg, ' + divColor + ', ' + divColor + '99)';
              const iconGradient = 'linear-gradient(135deg, ' + divColor + ', ' + divColor + 'cc)';
              const badgeClass = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ' + st.bg + ' ' + st.text + ' ring-1 ' + st.ring + ' flex-shrink-0';
              return (
                <button
                  key={d.id}
                  onClick={() => enterDivision(d)}
                  className="insight-card relative rounded-2xl overflow-hidden text-left group">
                  <div className="h-16 sm:h-20 px-4 sm:px-5 flex items-center justify-between relative overflow-hidden" style={{ background: headerGradient }}>
                    <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, rgba(255,255,255,0.3) 0%, transparent 60%)' }} />
                    <div className="relative flex items-center gap-2.5 sm:gap-3 min-w-0">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0 shadow-lg ring-1 ring-white/30">
                        <Building2 className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm sm:text-base font-extrabold text-white truncate drop-shadow-sm">{d.name}</h3>
                        <p className="text-[10px] sm:text-[11px] text-white/80 font-semibold uppercase tracking-wide">{DIVISION_TYPE_LABELS[d.division_type] || d.division_type} {'\u00B7'} {d.code}</p>
                      </div>
                    </div>
                    <span className="relative inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 backdrop-blur-sm text-white ring-1 ring-white/30 flex-shrink-0">
                      <span className={'w-1.5 h-1.5 rounded-full ' + st.dot} /> {st.label}
                    </span>
                  </div>
                  <div className="p-4 sm:p-5">
                    {d.tagline && <p className="text-[11px] text-slate-500 font-medium truncate mb-3">{d.tagline}</p>}
                    <div className="grid grid-cols-4 gap-1.5 mb-3.5">
                      <div className="bg-slate-50 rounded-xl p-2 text-center">
                        <p className="text-lg font-extrabold text-slate-900 tabular-nums">{ds.activeStaff}</p>
                        <p className="text-[9px] text-slate-400 uppercase font-bold">Crew</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-2 text-center">
                        <p className="text-lg font-extrabold text-slate-900 tabular-nums">{ds.activeJobs}</p>
                        <p className="text-[9px] text-slate-400 uppercase font-bold">Active</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-2 text-center">
                        <p className="text-lg font-extrabold text-slate-900 tabular-nums">{ds.vehiclesCount}</p>
                        <p className="text-[9px] text-slate-400 uppercase font-bold">Fleet</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-2 text-center">
                        <p className="text-lg font-extrabold text-slate-900 tabular-nums">{ds.jobsCount}</p>
                        <p className="text-[9px] text-slate-400 uppercase font-bold">Jobs</p>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Land &amp; Water Solutions</span>
                        <span className="text-xs font-medium">
                          {ds.outstanding > 0
                            ? <span className="inline-flex items-center gap-1 text-amber-600 font-semibold"><PoundSterling className="w-3 h-3" />{gbp(ds.outstanding)} outstanding</span>
                            : <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold"><CheckCircle2 className="w-3 h-3" />All settled</span>}
                        </span>
                      </div>
                      <div className="flex items-center justify-end">
                        <span className="inline-flex items-center gap-1 text-sm font-bold text-[#2E5A1A] group-hover:gap-2 transition-all">
                          Enter <ArrowRight className="w-4 h-4" />
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
            {canManageDivisions && (
              <button
                onClick={() => setShowWizard(true)}
                className="rounded-2xl border-2 border-dashed border-slate-300 p-5 text-left hover:border-[#2E5A1A] hover:bg-emerald-50/30 transition group flex flex-col items-center justify-center gap-2 min-h-[200px]">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 group-hover:bg-[#2E5A1A]/10 flex items-center justify-center transition">
                  <Sparkles className="w-6 h-6 text-slate-400 group-hover:text-[#2E5A1A] transition" />
                </div>
                <p className="text-sm font-bold text-slate-500 group-hover:text-[#2E5A1A] transition">Add a Division</p>
                <p className="text-xs text-slate-400 text-center">Guided setup wizard</p>
              </button>
            )}
          </div>
        </section>
      )}

      {/* Financial Roll-up + Compliance Snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {widgets.financialRollup && (
          <section className="insight-card rounded-2xl p-5">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md">
                <PoundSterling className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-base font-extrabold text-slate-900">Financial Roll-up</h2>
            </div>
            <div className="space-y-2">
              {divisionStats.filter(s => s.outstanding > 0).map(ds => {
                const d = ds.division;
                return (
                  <div key={d.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color || '#2E5A1A' }} />
                      <span className="text-sm font-semibold text-slate-700">{d.name}</span>
                    </div>
                    <span className="text-sm font-bold text-amber-600 tabular-nums">{gbp(ds.outstanding)}</span>
                  </div>
                );
              })}
              {divisionStats.filter(s => s.outstanding > 0).length === 0 && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-sm font-semibold">All invoices settled across all divisions</span>
                </div>
              )}
              <div className="flex items-center justify-between p-3 rounded-xl stat-gradient-indigo text-white mt-2">
                <span className="text-sm font-bold">Total Outstanding</span>
                <span className="text-lg font-extrabold tabular-nums">{gbp(globalStats.totalOutstanding)}</span>
              </div>
            </div>
          </section>
        )}

        {widgets.complianceSnapshot && (
          <section className="insight-card rounded-2xl p-5">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-md">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-base font-extrabold text-slate-900">Compliance Snapshot</h2>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="stat-gradient-rose rounded-2xl p-4 text-white relative overflow-hidden">
                <div className="absolute right-1 top-1 opacity-20"><AlertTriangle className="w-10 h-10" /></div>
                <div className="relative">
                  <p className="text-xs font-bold text-white/80 uppercase tracking-wide">Expired</p>
                  <p className="text-3xl font-extrabold tabular-nums mt-1">{globalStats.openCompliance}</p>
                  <p className="text-[10px] text-white/70">items past expiry</p>
                </div>
              </div>
              <div className="stat-gradient-amber rounded-2xl p-4 text-white relative overflow-hidden">
                <div className="absolute right-1 top-1 opacity-20"><ClipboardCheck className="w-10 h-10" /></div>
                <div className="relative">
                  <p className="text-xs font-bold text-white/80 uppercase tracking-wide">Ts Queue</p>
                  <p className="text-3xl font-extrabold tabular-nums mt-1">{globalStats.pendingTs}</p>
                  <p className="text-[10px] text-white/70">awaiting approval</p>
                </div>
              </div>
            </div>
            <button onClick={() => goToSettings('readiness')} className="w-full mt-3 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-sm font-semibold text-slate-600 transition">
              Manage in Settings <ChevronRight className="w-4 h-4" />
            </button>
          </section>
        )}
      </div>

      {/* Integrations & Readiness Overview — cross-division, enterprise-level */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {widgets.integrationsOverview && (
          <div ref={integrationsRef}>
            <EnterpriseIntegrationsOverview />
          </div>
        )}
        {widgets.readinessOverview && (
          <div ref={readinessRef}>
            <EnterpriseReadinessOverview />
          </div>
        )}
      </div>

      {/* System Status strip */}
      <section className="insight-card rounded-2xl p-4 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <span className="text-sm font-bold text-slate-700">All systems operational</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium ml-auto">
          <Activity className="w-3.5 h-3.5 text-emerald-500" />
          <span>RLS isolation active</span>
          <span className="text-slate-300">{'\u00B7'}</span>
          <span>{globalStats.activeDivisions} of {globalStats.divisions} divisions live</span>
        </div>
      </section>

      {/* Division creation wizard */}
      {showWizard && (
        <DivisionWizard onClose={() => setShowWizard(false)} onCreated={() => setShowWizard(false)} />
      )}

      {/* Customise panel */}
      {customising && (
        <div className="fixed inset-0 z-[60] bg-slate-950/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={() => setCustomising(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 max-h-[85dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-slate-900">Customise Dashboard</h3>
              <button onClick={() => setCustomising(false)} className="p-1.5 rounded-lg hover:bg-slate-100 transition"><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="space-y-2">
              {[
                { key: 'companyKpis', label: 'Company KPIs', desc: 'Global rollup stat tiles' },
                { key: 'divisionHealth', label: 'Divisions', desc: 'Division cards grid' },
                { key: 'financialRollup', label: 'Financial Roll-up', desc: 'Outstanding invoices per division' },
                { key: 'complianceSnapshot', label: 'Compliance Snapshot', desc: 'Expired items & timesheet queue' },
                { key: 'integrationsOverview', label: 'Integrations Overview', desc: 'Cross-division integration status' },
                { key: 'readinessOverview', label: 'Readiness Overview', desc: 'Hub readiness across divisions' },
              ].map(w => (
                <label key={w.key} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{w.label}</p>
                    <p className="text-xs text-slate-400">{w.desc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleWidget(w.key)}
                    className={'relative w-11 h-6 rounded-full transition ' + (widgets[w.key] ? 'bg-[#2E5A1A]' : 'bg-slate-300')}>
                    <span className={'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition ' + (widgets[w.key] ? 'translate-x-5' : '')} />
                  </button>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}