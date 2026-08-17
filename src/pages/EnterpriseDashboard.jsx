import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useDivision } from '@/contexts/DivisionContext';
import { useAuth } from '@/lib/AuthContext';
import {
  Building2, Users, Briefcase, Truck, ClipboardCheck, ShieldCheck, PoundSterling,
  ArrowRight, Settings, Sparkles, AlertTriangle, CheckCircle2,
  LayoutGrid, X, Activity, Crown, Wrench, TrendingUp, Clock,
  User, HelpCircle, LogOut,
} from 'lucide-react';
import EnterpriseHeader from '@/components/EnterpriseHeader';
import ProfileAvatar from '@/components/ui/ProfileAvatar';
import DivisionWizard from '@/components/wizard/DivisionWizard';
import DivisionCard from '@/components/enterprise/DivisionCard';

import { STATUS_STYLES, WIDGET_STORAGE_KEY, DEFAULT_WIDGETS } from '@/components/enterprise/enterpriseConstants';

export default function EnterpriseDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { divisions, permittedDivisions, setActiveDivision, isSuperAdmin, isLoading: divisionsLoading } = useDivision();
  const [customising, setCustomising] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  const { data: myProfile } = useQuery({ queryKey: ['ent-my-profile'], queryFn: async () => { const res = await base44.functions.invoke('getMyStaffProfile'); return res.data; } });

  // Single server-side aggregation — replaces 6 separate list() calls that were
  // capped at 500–5000 records and went stale when mutations didn't invalidate.
  // Refetches on mount and window focus so changes inside divisions pull through.
  const { data: statsData } = useQuery({
    queryKey: ['ent-stats'],
    queryFn: async () => { const res = await base44.functions.invoke('getEnterpriseStats'); return res.data; },
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

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

  const toggleWidget = (key) => {
    const next = { ...widgets, [key]: !widgets[key] };
    setWidgets(next);
    try { localStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(next)); } catch {}
  };

  // Filter server-side division stats by the user's permitted divisions.
  const divisionStats = useMemo(() => {
    const all = statsData?.divisionStats || [];
    const permittedIds = new Set(permittedDivisions.map(d => d.id));
    // Merge: use the full division object from context (for landing_page etc.),
    // but pull the computed counts from the server response.
    return permittedDivisions.map(d => {
      const s = all.find(x => x.division.id === d.id);
      return s ? { division: d, staffCount: s.staffCount, activeStaff: s.activeStaff, jobsCount: s.jobsCount, activeJobs: s.activeJobs, vehiclesCount: s.vehiclesCount, outstanding: s.outstanding } : { division: d, staffCount: 0, activeStaff: 0, jobsCount: 0, activeJobs: 0, vehiclesCount: 0, outstanding: 0 };
    });
  }, [permittedDivisions, statsData]);

  // Global stats from the server, scoped to permitted divisions.
  const globalStats = useMemo(() => {
    const base = statsData?.globalStats || { divisions: 0, activeDivisions: 0, staff: 0, activeJobs: 0, vehicles: 0, pendingTs: 0, openCompliance: 0, totalOutstanding: 0 };
    return {
      ...base,
      divisions: permittedDivisions.length,
      activeDivisions: permittedDivisions.filter(d => d.status === 'active').length,
    };
  }, [permittedDivisions, statsData]);

  const gbp = (n) => n ? '\u00A3' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '\u00A30';

  const enterDivision = (d) => {
    setActiveDivision(d.id);
    navigate(d.landing_page || '/admin', { state: { section: 'overview' } });
  };

  const goToSettings = (tab) => navigate('/enterprise/settings', { state: { tab: tab || 'divisions' } });
  const canManageDivisions = isSuperAdmin;

  if (divisionsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  const quickActions = isSuperAdmin ? [
    { label: 'Settings', icon: Settings, action: () => goToSettings('divisions'), gradient: 'from-slate-600 to-slate-800' },
    { label: 'Divisions', icon: Building2, action: () => goToSettings('divisions'), gradient: 'from-emerald-600 to-teal-700' },
    { label: 'Access', icon: ShieldCheck, action: () => goToSettings('access'), gradient: 'from-amber-500 to-orange-600' },
    { label: 'Help', icon: HelpCircle, action: () => navigate('/enterprise/help'), gradient: 'from-rose-500 to-pink-600' },
  ] : [
    { label: 'Settings', icon: Settings, action: () => goToSettings('divisions'), gradient: 'from-slate-600 to-slate-800' },
    { label: 'Access', icon: ShieldCheck, action: () => goToSettings('access'), gradient: 'from-amber-500 to-orange-600' },
    { label: 'Profile', icon: User, action: () => navigate('/enterprise-profile'), gradient: 'from-blue-600 to-indigo-700' },
    { label: 'Help', icon: HelpCircle, action: () => navigate('/enterprise/help'), gradient: 'from-rose-500 to-pink-600' },
  ];

  return (
    <div className="min-h-screen page-bg-vibrant">
      <EnterpriseHeader />

      {/* ─── Hero Section ─── */}
      <div className="relative">
        <div className="hero-vibrant absolute inset-0 overflow-hidden" />
        <div className="relative px-4 xl:px-6 pt-[calc(3.5rem+env(safe-area-inset-top)+0.5rem)] xl:pt-8 pb-6">
          <div className="max-w-7xl mx-auto">
            {/* Top row: title + profile */}
            <div className="flex items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0 shadow-lg ring-1 ring-white/20">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight leading-none truncate">
                    Land &amp; Water Solutions
                  </h1>
                  <p className="text-xs sm:text-sm text-white/70 font-semibold mt-1 truncate">Enterprise Command Centre</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                  <span className="text-sm font-bold text-white">All systems operational</span>
                  <span className="text-white/50">·</span>
                  <span className="text-xs font-medium text-white/70">{globalStats.activeDivisions} of {globalStats.divisions} live</span>
                </div>
                {isSuperAdmin && (
                  <button onClick={() => setCustomising(!customising)} className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white text-sm font-semibold hover:bg-white/20 transition">
                    <LayoutGrid className="w-4 h-4" /> <span className="hidden md:inline">Customise</span>
                  </button>
                )}
                <div className="hidden xl:block relative">
                  <button onClick={(e) => { e.stopPropagation(); setProfileMenuOpen(!profileMenuOpen); }} type="button" aria-label="Profile menu" className="relative flex items-center justify-center active:scale-95 rounded-full transition ring-2 ring-transparent hover:ring-white/30">
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

            {/* Hero metrics strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { label: 'Divisions', value: globalStats.divisions, icon: Building2, gradient: 'stat-gradient-brand' },
                { label: 'Crew', value: globalStats.staff, icon: Users, gradient: 'stat-gradient-blue' },
                { label: 'Active Jobs', value: globalStats.activeJobs, icon: Briefcase, gradient: 'stat-gradient-amber' },
                { label: 'Outstanding', value: gbp(globalStats.totalOutstanding), icon: PoundSterling, gradient: 'stat-gradient-rose' },
              ].map(m => (
                <div key={m.label} className={`${m.gradient} rounded-2xl p-3 flex items-center gap-2.5 shadow-lg`}>
                  <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                    <m.icon className="w-4.5 h-4.5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-white/80 uppercase tracking-wide truncate">{m.label}</p>
                    <p className="text-lg font-extrabold text-white tabular-nums truncate">{m.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Body ─── */}
      <div className="px-4 xl:px-6 pb-24 xl:pb-6 space-y-4 max-w-7xl mx-auto">

        {/* Quick Access */}
        <div className="grid grid-cols-4 gap-2 sm:gap-4 mt-6 sm:mt-8 relative z-10">
          {quickActions.map(a => {
            const Icon = a.icon;
            return (
              <button key={a.label} onClick={a.action} className={'bg-gradient-to-br ' + a.gradient + ' rounded-xl sm:rounded-2xl p-3 sm:p-4 flex flex-col items-center gap-1.5 sm:gap-2 text-white shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200'}>
                <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-[10px] sm:text-[11px] font-bold truncate w-full text-center">{a.label}</span>
              </button>
            );
          })}
        </div>

        {/* Divisions */}
        {widgets.divisionHealth && (
          <section>
            <SectionTitle icon={Building2} title="Divisions" subtitle="Tap a division to enter its workspace" gradient="from-blue-500 to-cyan-600" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {divisionStats.map(ds => <DivisionCard key={ds.division.id} ds={ds} onEnter={enterDivision} />)}
              {canManageDivisions && (
                <button onClick={() => setShowWizard(true)} className="rounded-2xl border-2 border-dashed border-slate-300 p-5 text-left hover:border-[#2E5A1A] hover:bg-emerald-50/30 transition group flex flex-col items-center justify-center gap-2 min-h-[200px]">
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

        {/* Fleet & Assets */}
        {widgets.fleetAssets && (
          <section className="insight-card rounded-2xl p-5">
            <SectionTitle icon={Truck} title="Fleet & Assets" subtitle="Vehicles and equipment across divisions" gradient="from-cyan-500 to-blue-600" />
            <div className="grid grid-cols-3 gap-2.5">
              <div className="stat-gradient-teal rounded-2xl p-4 text-white relative overflow-hidden">
                <div className="absolute right-1 top-1 opacity-20"><Truck className="w-9 h-9" /></div>
                <div className="relative">
                  <p className="text-[10px] font-bold text-white/80 uppercase tracking-wide">Vehicles</p>
                  <p className="text-2xl xl:text-3xl font-extrabold tabular-nums mt-1">{globalStats.vehicles}</p>
                  <p className="text-[10px] text-white/70">in fleet</p>
                </div>
              </div>
              <div className="stat-gradient-slate rounded-2xl p-4 text-white relative overflow-hidden">
                <div className="absolute right-1 top-1 opacity-20"><Wrench className="w-9 h-9" /></div>
                <div className="relative">
                  <p className="text-[10px] font-bold text-white/80 uppercase tracking-wide">Assets</p>
                  <p className="text-2xl xl:text-3xl font-extrabold tabular-nums mt-1">{globalStats.assets || 0}</p>
                  <p className="text-[10px] text-white/70">active equipment</p>
                </div>
              </div>
              <div className="stat-gradient-rose rounded-2xl p-4 text-white relative overflow-hidden">
                <div className="absolute right-1 top-1 opacity-20"><AlertTriangle className="w-9 h-9" /></div>
                <div className="relative">
                  <p className="text-[10px] font-bold text-white/80 uppercase tracking-wide">Attention</p>
                  <p className="text-2xl xl:text-3xl font-extrabold tabular-nums mt-1">{globalStats.assetsExpiring || 0}</p>
                  <p className="text-[10px] text-white/70">compliance expiring</p>
                </div>
              </div>
            </div>
            <button onClick={() => navigate('/enterprise/fleet')} className="w-full mt-3 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-sm font-semibold text-slate-600 transition">
              Go to Fleet Hub <ArrowRight className="w-4 h-4" />
            </button>
          </section>
        )}

        {/* Workforce Overview */}
        {widgets.workforceOverview && (
          <section className="insight-card rounded-2xl p-5">
            <SectionTitle icon={Users} title="Workforce Overview" subtitle="Headcount across divisions" gradient="from-violet-500 to-purple-600" />
            <div className="grid grid-cols-2 gap-2.5 mb-3">
              <div className="stat-gradient-violet rounded-2xl p-4 text-white relative overflow-hidden">
                <div className="absolute right-1 top-1 opacity-20"><Users className="w-9 h-9" /></div>
                <div className="relative">
                  <p className="text-[10px] font-bold text-white/80 uppercase tracking-wide">Total Staff</p>
                  <p className="text-2xl xl:text-3xl font-extrabold tabular-nums mt-1">{globalStats.staff}</p>
                  <p className="text-[10px] text-white/70">across all divisions</p>
                </div>
              </div>
              <div className="stat-gradient-emerald rounded-2xl p-4 text-white relative overflow-hidden">
                <div className="absolute right-1 top-1 opacity-20"><CheckCircle2 className="w-9 h-9" /></div>
                <div className="relative">
                  <p className="text-[10px] font-bold text-white/80 uppercase tracking-wide">Active</p>
                  <p className="text-2xl xl:text-3xl font-extrabold tabular-nums mt-1">{globalStats.activeStaff || 0}</p>
                  <p className="text-[10px] text-white/70">currently working</p>
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              {divisionStats.map(ds => (
                <div key={ds.division.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: ds.division.color || '#2E5A1A' }} />
                    <span className="text-xs font-semibold text-slate-700">{ds.division.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-slate-500 font-medium">{ds.activeStaff} active</span>
                    <span className="text-slate-400">·</span>
                    <span className="font-bold text-slate-700 tabular-nums">{ds.staffCount} total</span>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => navigate('/enterprise/staff')} className="w-full mt-3 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-sm font-semibold text-slate-600 transition">
              Go to Staff Hub <ArrowRight className="w-4 h-4" />
            </button>
          </section>
        )}

      </div>

      {/* Wizard */}
      {showWizard && <DivisionWizard onClose={() => setShowWizard(false)} onCreated={() => setShowWizard(false)} />}

      {/* Customise panel */}
      {customising && (
        <div className="fixed inset-0 z-[60] bg-blue-950/60 backdrop-blur-md flex items-end sm:items-center justify-center p-4" onClick={() => setCustomising(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 max-h-[calc(100dvh-2rem)] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-slate-900">Customise Dashboard</h3>
              <button onClick={() => setCustomising(false)} className="p-1.5 rounded-lg hover:bg-slate-100 transition"><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="space-y-2">
              {[
                { key: 'divisionHealth', label: 'Divisions', desc: 'Division cards grid' },
                { key: 'fleetAssets', label: 'Fleet & Assets', desc: 'Vehicles, equipment & compliance' },
                { key: 'workforceOverview', label: 'Workforce Overview', desc: 'Headcount across divisions' },
              ].map(w => (
                <label key={w.key} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{w.label}</p>
                    <p className="text-xs text-slate-400">{w.desc}</p>
                  </div>
                  <button type="button" onClick={() => toggleWidget(w.key)} className={'relative w-11 h-6 rounded-full transition ' + (widgets[w.key] ? 'bg-[#2E5A1A]' : 'bg-slate-300')}>
                    <span className={'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition ' + (widgets[w.key] ? 'translate-x-5' : '')} />
                  </button>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionTitle({ icon: Icon, title, subtitle, gradient }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-md flex-shrink-0`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <h2 className="text-base font-extrabold text-slate-900">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
    </div>
  );
}