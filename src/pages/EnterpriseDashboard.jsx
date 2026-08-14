import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useDivision } from '@/contexts/DivisionContext';
import {
  Building2, Users, Briefcase, Truck, ClipboardCheck, ShieldCheck, PoundSterling,
  ArrowRight, Settings, Sparkles, TrendingUp, AlertTriangle, CheckCircle2, ChevronRight, LayoutGrid, X,
} from 'lucide-react';
import Logo from '@/components/Logo';

const WIDGET_STORAGE_KEY = 'gc-enterprise-widgets';
const DEFAULT_WIDGETS = {
  companyKpis: true,
  divisionHealth: true,
  financialRollup: true,
  complianceSnapshot: true,
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

export default function EnterpriseDashboard() {
  const navigate = useNavigate();
  const { divisions, setActiveDivision, isLoading: divisionsLoading } = useDivision();
  const [customising, setCustomising] = useState(false);
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

  // Per-division stats
  const divisionStats = useMemo(() => {
    return divisions.map(d => {
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
  }, [divisions, staff, jobs, vehicles, invoices]);

  // Global rollups
  const globalStats = useMemo(() => {
    const activeJobs = jobs.filter(j => (j.status || 'planning') === 'in_progress').length;
    const pendingTs = timesheets.filter(t => t.status === 'submitted').length;
    const openCompliance = compliance.filter(c => {
      if (!c.expiry_date) return false;
      return new Date(c.expiry_date) < new Date();
    }).length;
    const totalOutstanding = invoices
      .filter(i => i.status && i.status !== 'paid' && i.status !== 'void')
      .reduce((sum, i) => sum + (i.gross_total || 0), 0);
    return {
      divisions: divisions.length,
      activeDivisions: divisions.filter(d => d.status === 'active').length,
      staff: staff.length,
      activeJobs,
      vehicles: vehicles.length,
      pendingTs,
      openCompliance,
      totalOutstanding,
    };
  }, [divisions, staff, jobs, vehicles, timesheets, compliance, invoices]);

  const gbp = (n) => n ? '£' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '£0';

  const enterDivision = (d) => {
    setActiveDivision(d.id);
    navigate('/admin');
  };

  const openSettings = () => {
    window.dispatchEvent(new CustomEvent('app-navigate', { detail: 'settings' }));
    navigate('/admin');
  };

  if (divisionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center page-bg-vibrant">
        <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  const kpiTiles = [
    { label: 'Divisions', value: globalStats.divisions, sub: `${globalStats.activeDivisions} active`, icon: Building2, gradient: 'from-emerald-400 to-teal-500' },
    { label: 'Total Crew', value: globalStats.staff, sub: 'across all divisions', icon: Users, gradient: 'from-blue-400 to-cyan-500' },
    { label: 'Active Jobs', value: globalStats.activeJobs, sub: `${jobs.length} total`, icon: Briefcase, gradient: 'from-amber-400 to-orange-500' },
    { label: 'Fleet', value: globalStats.vehicles, sub: 'vehicles', icon: Truck, gradient: 'from-violet-400 to-purple-500' },
    { label: 'Ts Queue', value: globalStats.pendingTs, sub: 'awaiting approval', icon: ClipboardCheck, gradient: 'from-rose-400 to-pink-500' },
    { label: 'Outstanding', value: gbp(globalStats.totalOutstanding), sub: 'unpaid invoices', icon: PoundSterling, gradient: 'from-indigo-400 to-blue-500' },
  ];

  return (
    <div className="min-h-screen page-bg-vibrant">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Logo variant="full" height={34} />
            <div className="hidden sm:block h-8 w-px bg-slate-200" />
            <div className="hidden sm:block min-w-0">
              <h1 className="text-base font-extrabold text-slate-900 tracking-tight leading-none">Enterprise Command Centre</h1>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">Cross-division oversight, global settings & lockdowns</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setCustomising(!customising)} className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition shadow-sm">
              <LayoutGrid className="w-4 h-4" /> Customise
            </button>
            <button onClick={openSettings} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl command-gradient text-white text-sm font-semibold shadow-md hover:shadow-lg transition">
              <Settings className="w-4 h-4" /> Settings
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5">
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {kpiTiles.map(t => {
                const Icon = t.icon;
                return (
                  <div key={t.label} className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                    <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${t.gradient} flex items-center justify-center mb-2 shadow-sm`}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{t.label}</p>
                    <p className="text-xl font-extrabold text-slate-900 mt-0.5 tabular-nums">{t.value}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 truncate">{t.sub}</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Division Health — the division cards */}
        {widgets.divisionHealth && (
          <section>
            <div className="flex items-center gap-2.5 mb-3 px-1">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-md">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900">Divisions</h2>
                <p className="text-xs text-slate-500">Click a division to enter its workspace</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {divisionStats.map(({ division: d, staffCount, activeStaff, jobsCount, activeJobs, vehiclesCount, outstanding }) => {
                const st = STATUS_STYLES[d.status || 'setup'] || STATUS_STYLES.setup;
                return (
                  <button
                    key={d.id}
                    onClick={() => enterDivision(d)}
                    className="insight-card relative rounded-2xl p-5 text-left group overflow-hidden">
                    <span className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: d.color || '#2E5A1A' }} />
                    <div className="pl-2">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md" style={{ background: d.color || '#2E5A1A' }}>
                            <Building2 className="w-5 h-5 text-white" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-base font-extrabold text-slate-900 truncate">{d.name}</h3>
                            <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">{DIVISION_TYPE_LABELS[d.division_type] || d.division_type} · {d.code}</p>
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${st.bg} ${st.text} ring-1 ${st.ring} flex-shrink-0`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} /> {st.label}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5 mb-3">
                        <div className="bg-slate-50 rounded-lg p-2 text-center">
                          <p className="text-base font-bold text-slate-900 tabular-nums">{activeStaff}</p>
                          <p className="text-[9px] text-slate-400 uppercase font-semibold">Crew</p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-2 text-center">
                          <p className="text-base font-bold text-slate-900 tabular-nums">{activeJobs}</p>
                          <p className="text-[9px] text-slate-400 uppercase font-semibold">Active</p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-2 text-center">
                          <p className="text-base font-bold text-slate-900 tabular-nums">{vehiclesCount}</p>
                          <p className="text-[9px] text-slate-400 uppercase font-semibold">Fleet</p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-2 text-center">
                          <p className="text-base font-bold text-slate-900 tabular-nums">{jobsCount}</p>
                          <p className="text-[9px] text-slate-400 uppercase font-semibold">Jobs</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500 font-medium">
                          {outstanding > 0 ? <span className="text-amber-600 font-semibold">{gbp(outstanding)} outstanding</span> : <span className="text-emerald-600 font-semibold">No outstanding invoices</span>}
                        </span>
                        <span className="inline-flex items-center gap-1 text-sm font-bold text-[#2E5A1A] group-hover:gap-2 transition-all">
                          Enter <ArrowRight className="w-4 h-4" />
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
              {/* Create new division card */}
              <button
                onClick={openSettings}
                className="rounded-2xl border-2 border-dashed border-slate-300 p-5 text-left hover:border-[#2E5A1A] hover:bg-emerald-50/30 transition group flex flex-col items-center justify-center gap-2 min-h-[180px]">
                <div className="w-11 h-11 rounded-xl bg-slate-100 group-hover:bg-[#2E5A1A]/10 flex items-center justify-center transition">
                  <Sparkles className="w-5 h-5 text-slate-400 group-hover:text-[#2E5A1A] transition" />
                </div>
                <p className="text-sm font-bold text-slate-500 group-hover:text-[#2E5A1A] transition">Add a Division</p>
                <p className="text-xs text-slate-400 text-center">Configure in Settings → Divisions</p>
              </button>
            </div>
          </section>
        )}

        {/* Financial Roll-up + Compliance Snapshot side by side */}
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
                {divisionStats.filter(s => s.outstanding > 0).map(({ division: d, outstanding }) => (
                  <div key={d.id} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color || '#2E5A1A' }} />
                      <span className="text-sm font-semibold text-slate-700">{d.name}</span>
                    </div>
                    <span className="text-sm font-bold text-amber-600 tabular-nums">{gbp(outstanding)}</span>
                  </div>
                ))}
                {divisionStats.filter(s => s.outstanding > 0).length === 0 && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 text-emerald-700">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-sm font-semibold">All invoices settled across all divisions</span>
                  </div>
                )}
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 text-white mt-2">
                  <span className="text-sm font-bold">Total Outstanding</span>
                  <span className="text-base font-extrabold tabular-nums">{gbp(globalStats.totalOutstanding)}</span>
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
                <div className="bg-rose-50 rounded-xl p-3 border border-rose-100">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <p className="text-xs font-bold text-rose-700 uppercase tracking-wide">Expired</p>
                  </div>
                  <p className="text-2xl font-extrabold text-rose-600 tabular-nums">{globalStats.openCompliance}</p>
                  <p className="text-[10px] text-rose-400">items past expiry</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                  <div className="flex items-center gap-2 mb-1">
                    <ClipboardCheck className="w-4 h-4 text-amber-600" />
                    <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">Ts Queue</p>
                  </div>
                  <p className="text-2xl font-extrabold text-amber-600 tabular-nums">{globalStats.pendingTs}</p>
                  <p className="text-[10px] text-amber-400">awaiting approval</p>
                </div>
              </div>
              <button onClick={() => { setActiveDivision(null); navigate('/admin'); }} className="w-full mt-3 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-sm font-semibold text-slate-600 transition">
                Review in Compliance Hub <ChevronRight className="w-4 h-4" />
              </button>
            </section>
          )}
        </div>
      </main>

      {/* Customise panel */}
      {customising && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={() => setCustomising(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-slate-900">Customise Dashboard</h3>
              <button onClick={() => setCustomising(false)} className="p-1.5 rounded-lg hover:bg-slate-100 transition"><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="space-y-2">
              {[
                { key: 'companyKpis', label: 'Company KPIs', desc: 'Global rollup stat tiles' },
                { key: 'divisionHealth', label: 'Division Health', desc: 'Division cards grid' },
                { key: 'financialRollup', label: 'Financial Roll-up', desc: 'Outstanding invoices per division' },
                { key: 'complianceSnapshot', label: 'Compliance Snapshot', desc: 'Expired items & timesheet queue' },
              ].map(w => (
                <label key={w.key} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{w.label}</p>
                    <p className="text-xs text-slate-400">{w.desc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleWidget(w.key)}
                    className={`relative w-11 h-6 rounded-full transition ${widgets[w.key] ? 'bg-[#2E5A1A]' : 'bg-slate-300'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition ${widgets[w.key] ? 'translate-x-5' : ''}`} />
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