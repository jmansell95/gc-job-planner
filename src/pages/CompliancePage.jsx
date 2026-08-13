import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  ShieldCheck, ShieldAlert, AlertTriangle, BarChart3, HardHat,
  CalendarDays, ExternalLink, Lock,
  TrendingUp,
} from 'lucide-react';
import SafetyCultureGate from '@/components/safety/SafetyCultureGate';
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

      {/* ── Tab Content — all gated by SafetyCulture connection status ── */}
      {tab === 'safety-hub' && (
        <SafetyCultureGate onConfigure={() => navToAdmin('settings')}>
          <SafetyCultureCheckHub onNavigate={navToAdmin} />
        </SafetyCultureGate>
      )}

      {tab === 'readiness' && (
        <SafetyCultureGate onConfigure={() => navToAdmin('settings')}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SiteReadinessGateWidget onNavigate={navToAdmin} />
            <CrewCertificationPulseWidget onNavigate={navToAdmin} />
          </div>
        </SafetyCultureGate>
      )}

      {tab === 'incidents' && (
        <SafetyCultureGate onConfigure={() => navToAdmin('settings')}>
          <IncidentReporter />
        </SafetyCultureGate>
      )}

      {tab === 'stats' && (
        <SafetyCultureGate onConfigure={() => navToAdmin('settings')}>
          <RIDDORStatsPanel />
        </SafetyCultureGate>
      )}

      {tab === 'toolbox' && (
        <SafetyCultureGate onConfigure={() => navToAdmin('settings')}>
          <ToolboxTalkManager />
        </SafetyCultureGate>
      )}

      {tab === 'environmental' && (
        <SafetyCultureGate onConfigure={() => navToAdmin('settings')}>
          <CarbonFootprintWidget onNavigate={navToAdmin} />
        </SafetyCultureGate>
      )}

      {tab === 'calendar' && (
        <SafetyCultureGate onConfigure={() => navToAdmin('settings')}>
          <ComplianceCalendar />
        </SafetyCultureGate>
      )}
    </div>
  );
}