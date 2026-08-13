import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  ShieldCheck, ShieldAlert, AlertTriangle, BarChart3, HardHat,
  ClipboardCheck, CalendarDays, ExternalLink, Lock, Loader2,
  TrendingUp, Users, FileText, Zap,
} from 'lucide-react';
import SafetyCultureCheckHub from '@/components/safety/SafetyCultureCheckHub';
import IncidentReporter from '@/components/safety/IncidentReporter';
import RIDDORStatsPanel from '@/components/safety/RIDDORStatsPanel';
import ToolboxTalkManager from '@/components/safety/ToolboxTalkManager';
import ComplianceCalendar from '@/components/compliance/ComplianceCalendar';
import SiteReadinessGateWidget from '@/components/dashboard/SiteReadinessGateWidget';
import CrewCertificationPulseWidget from '@/components/dashboard/CrewCertificationPulseWidget';
import CarbonFootprintWidget from '@/components/dashboard/CarbonFootprintWidget';
import { resolveRole } from '@/utils/access';

const SC_URL = 'https://app.safetyculture.com';

export default function CompliancePage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('safety-hub');
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    (async () => {
      try { const res = await base44.functions.invoke('getMyStaffProfile'); setProfile(res.data); } catch (e) {}
    })();
  }, []);

  const role = resolveRole(profile) || 'field';
  const canAccess = role === 'admin' || role === 'super_admin' || role === 'management' || role === 'manager';

  const { data: reports = [], isLoading: loadingReports } = useQuery({
    queryKey: ['safety-reports', 'compliance-page'],
    queryFn: () => base44.entities.SafetyReport.list('-created_date', 200),
  });

  const openReports = reports.filter(r => r.status === 'open');
  const criticalReports = reports.filter(r => r.severity === 'critical' && r.status === 'open');
  const now = new Date();
  const overdueActions = reports
    .filter(r => r.status === 'open')
    .flatMap(r => (r.action_items || []).filter(a => a?.due_date && new Date(a.due_date) < now));

  const tabs = [
    { id: 'safety-hub', label: 'Safety Hub', icon: ShieldAlert },
    { id: 'readiness', label: 'Readiness', icon: ShieldCheck },
    { id: 'incidents', label: 'Incidents', icon: AlertTriangle },
    { id: 'stats', label: 'H&S Stats', icon: BarChart3 },
    { id: 'toolbox', label: 'Toolbox Talks', icon: HardHat },
    { id: 'environmental', label: 'Environmental', icon: TrendingUp },
    { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  ];

  const navToAdmin = (section) => navigate('/admin', { state: { section } });

  // Access guard — management & admin only
  if (!canAccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="insight-card rounded-3xl p-8 max-w-md text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Management Access Only</h2>
          <p className="text-sm text-slate-500">
            The Safety & Compliance Hub is restricted to management and admin roles.
            Contact your supervisor if you need access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Modern Hero Header ── */}
      <div className="relative overflow-hidden rounded-3xl shadow-lg">
        <div className="absolute inset-0 hero-vibrant" />
        <div className="relative z-10 px-5 py-5 md:px-7 md:py-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center flex-shrink-0 ring-1 ring-white/20 shadow-xl">
                <ShieldAlert className="w-7 h-7 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-tight">
                  Safety & Compliance Hub
                </h1>
                <p className="text-white/80 text-sm font-medium mt-0.5">
                  SafetyCulture integration pending — configure in Settings to sync audits & incidents
                </p>
              </div>
            </div>
            <a
              href={SC_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 backdrop-blur-md text-white text-sm font-semibold hover:bg-white/25 transition ring-1 ring-white/20 flex-shrink-0"
            >
              <ExternalLink className="w-4 h-4" />
              Open SafetyCulture
            </a>
          </div>

          {/* Info banner — SafetyCulture not synced */}
          <div className="mt-5 flex items-start gap-3 bg-white/10 backdrop-blur-md rounded-2xl p-4 ring-1 ring-white/15">
            <div className="w-9 h-9 rounded-lg bg-amber-400/20 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4.5 h-4.5 text-amber-300" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white">No SafetyCulture data synced</p>
              <p className="text-xs text-white/70 mt-0.5">
                Audit, incident and inspection data is not currently being pulled from SafetyCulture.
                Configure the integration in Settings → Integrations → SafetyCulture to start syncing.
              </p>
            </div>
            <button
              onClick={() => navigate('/admin', { state: { section: 'settings' } })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 text-white text-xs font-semibold hover:bg-white/25 transition flex-shrink-0"
            >
              <Zap className="w-3.5 h-3.5" /> Configure
            </button>
          </div>
        </div>
      </div>

      {/* ── Modern Tab Bar ── */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/70 shadow-sm p-1.5 flex gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {tabs.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              type="button"
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition flex-shrink-0 whitespace-nowrap active:scale-[0.97] ${
                active
                  ? 'bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white shadow-sm shadow-emerald-200/60'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-slate-400'}`} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ── */}
      {tab === 'safety-hub' && (
        <SafetyCultureCheckHub onNavigate={navToAdmin} />
      )}

      {tab === 'readiness' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SiteReadinessGateWidget onNavigate={navToAdmin} />
          <CrewCertificationPulseWidget onNavigate={navToAdmin} />
        </div>
      )}

      {tab === 'incidents' && (
        <div className="insight-card rounded-2xl p-4 md:p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            <h3 className="text-lg font-bold text-slate-900">Incidents & Near-Miss Reports</h3>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            All incidents sync automatically from SafetyCulture. Report a new incident below or view the full audit trail in the Safety Hub.
          </p>
          <IncidentReporter />
        </div>
      )}

      {tab === 'stats' && (
        <div className="insight-card rounded-2xl p-4 md:p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-[#2E5A1A]" />
            <h3 className="text-lg font-bold text-slate-900">Health & Safety Statistics</h3>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            RIDDOR-reportable incidents, near-miss trends, and audit performance — sourced from SafetyCulture.
          </p>
          <RIDDORStatsPanel />
        </div>
      )}

      {tab === 'toolbox' && (
        <div className="insight-card rounded-2xl p-4 md:p-5">
          <div className="flex items-center gap-2 mb-4">
            <HardHat className="w-5 h-5 text-amber-600" />
            <h3 className="text-lg font-bold text-slate-900">Toolbox Talks</h3>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            Schedule, deliver, and track toolbox talks with digital sign-off.
          </p>
          <ToolboxTalkManager />
        </div>
      )}

      {tab === 'environmental' && (
        <CarbonFootprintWidget onNavigate={navToAdmin} />
      )}

      {tab === 'calendar' && (
        <ComplianceCalendar />
      )}

      {/* ── SafetyCulture link footer ── */}
      <div className="insight-card rounded-2xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center flex-shrink-0 shadow-md">
          <ShieldAlert className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900">SafetyCulture is your safety engine</p>
          <p className="text-xs text-slate-500">
            All audits, inspections & incidents are synced from SafetyCulture (iAuditor).
            Configure the connection in Settings → Integrations → SafetyCulture.
          </p>
        </div>
        <button
          onClick={() => navigate('/admin', { state: { section: 'settings' } })}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition flex-shrink-0"
        >
          <Zap className="w-4 h-4" />
          Configure
        </button>
      </div>
    </div>
  );
}