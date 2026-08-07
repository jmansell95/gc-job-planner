import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ShieldAlert, AlertTriangle, BarChart3, HardHat, ClipboardCheck, FlaskConical } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import SettingsPage from '@/components/SettingsPage';
import SafetyCultureCheckHub from '@/components/safety/SafetyCultureCheckHub';
import IncidentReporter from '@/components/safety/IncidentReporter';
import RIDDORStatsPanel from '@/components/safety/RIDDORStatsPanel';
import ToolboxTalkManager from '@/components/safety/ToolboxTalkManager';

export default function CompliancePage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('compliance');
  const [safetyTab, setSafetyTab] = useState('checks');

  const topTabs = [
    { id: 'compliance', label: 'Compliance', icon: ShieldCheck },
    { id: 'safety', label: 'Safety', icon: ShieldAlert },
    { id: 'audit-trail', label: 'Audit Trail', icon: ClipboardCheck },
    { id: 'log-qc', label: 'Log QC', icon: FlaskConical },
  ];

  const safetyTabs = [
    { id: 'checks', label: 'Safety Checks', icon: ShieldCheck },
    { id: 'incidents', label: 'Incidents & Near-Miss', icon: AlertTriangle },
    { id: 'stats', label: 'H&S Statistics', icon: BarChart3 },
    { id: 'toolbox', label: 'Toolbox Talks', icon: HardHat },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        icon={ShieldCheck}
        title="Compliance & Audit Hub"
        subtitle="Staff certs, equipment compliance, safety, audit trail & investigation log review"
      />

      {/* Top-level tabs: Compliance | Safety | Audit Trail | Log QC */}
      <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/70 shadow-sm p-1.5 inline-flex flex-wrap gap-1">
        {topTabs.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} type="button"
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition ${active ? 'bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'compliance' && (
        <SettingsPage initialTab="compliance" standalone />
      )}

      {tab === 'audit-trail' && (
        <SettingsPage initialTab="audit-trail" standalone onSelectJob={(job) => navigate('/admin', { state: { section: 'job-detail', job } })} />
      )}

      {tab === 'log-qc' && (
        <SettingsPage initialTab="log-qc" standalone onSelectJob={(job) => navigate('/admin', { state: { section: 'job-detail', job } })} />
      )}

      {tab === 'safety' && (
        <>
          {/* Safety sub-tabs */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/70 shadow-sm p-1.5 inline-flex flex-wrap gap-1">
            {safetyTabs.map(t => {
              const Icon = t.icon;
              const active = safetyTab === t.id;
              return (
                <button key={t.id} onClick={() => setSafetyTab(t.id)} type="button"
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition ${active ? 'bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
                  <Icon className="w-4 h-4" /> {t.label}
                </button>
              );
            })}
          </div>

          {safetyTab === 'checks' && <SafetyCultureCheckHub onNavigate={(section) => navigate('/admin', { state: { section } })} />}
          {safetyTab === 'incidents' && <IncidentReporter />}
          {safetyTab === 'toolbox' && (
            <div className="insight-card rounded-2xl p-4 md:p-5">
              <h3 className="text-lg font-bold text-slate-900 mb-1">Toolbox Talks</h3>
              <p className="text-sm text-slate-500 mb-4">Schedule, deliver, and track toolbox talks with digital sign-off</p>
              <ToolboxTalkManager />
            </div>
          )}
          {safetyTab === 'stats' && (
            <div className="insight-card rounded-2xl p-4 md:p-5">
              <h3 className="text-lg font-bold text-slate-900 mb-1">Health & Safety Statistics</h3>
              <p className="text-sm text-slate-500 mb-4">RIDDOR-reportable incidents, near-miss trends, and audit performance</p>
              <RIDDORStatsPanel />
            </div>
          )}
        </>
      )}
    </div>
  );
}