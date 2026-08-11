import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ShieldAlert, AlertTriangle, BarChart3, HardHat, ClipboardCheck, CalendarDays, Settings } from 'lucide-react';
import SettingsPage from '@/components/SettingsPage';
import SafetyCultureCheckHub from '@/components/safety/SafetyCultureCheckHub';
import IncidentReporter from '@/components/safety/IncidentReporter';
import RIDDORStatsPanel from '@/components/safety/RIDDORStatsPanel';
import ToolboxTalkManager from '@/components/safety/ToolboxTalkManager';
import ComplianceCalendar from '@/components/compliance/ComplianceCalendar';
import PageHeader from '@/components/PageHeader';
import TabBar from '@/components/TabBar';

export default function CompliancePage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('compliance');
  const [safetyTab, setSafetyTab] = useState('checks');
  const [complianceView, setComplianceView] = useState('manager');

  const topTabs = [
    { id: 'compliance', label: 'Compliance', icon: ShieldCheck },
    { id: 'calendar', label: 'Calendar', icon: CalendarDays },
    { id: 'safety', label: 'Safety', icon: ShieldAlert },
    { id: 'audit-trail', label: 'Audit Trail', icon: ClipboardCheck },
    { id: 'system-audit-log', label: 'System Log', icon: ClipboardCheck },
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
        title="Compliance, Safety & Audit"
        subtitle="Staff certifications, equipment compliance, safety incidents & investigation log review"
      />
      <TabBar tabs={topTabs} activeTab={tab} onChange={setTab} />

      {tab === 'compliance' && (
        <div className="space-y-3">
          <div className="flex gap-1 p-1 bg-white/80 backdrop-blur-md rounded-xl border border-slate-200/70 shadow-sm w-fit">
            <button onClick={() => setComplianceView('manager')} className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition ${complianceView === 'manager' ? 'bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
              <ShieldCheck className="w-4 h-4" />Records
            </button>
            <button onClick={() => setComplianceView('rules')} className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition ${complianceView === 'rules' ? 'bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
              <Settings className="w-4 h-4" />Rules
            </button>
          </div>
          {complianceView === 'manager' ? (
            <SettingsPage initialTab="compliance" standalone />
          ) : (
            <SettingsPage initialTab="compliance-rules" standalone />
          )}
        </div>
      )}

      {tab === 'system-audit-log' && (
        <SettingsPage initialTab="system-audit-log" standalone />
      )}

      {tab === 'calendar' && (
        <ComplianceCalendar />
      )}

      {tab === 'audit-trail' && (
        <SettingsPage initialTab="audit-trail" standalone onSelectJob={(job) => navigate('/admin', { state: { section: 'job-detail', job } })} />
      )}

      {tab === 'safety' && (
        <>
          <TabBar tabs={safetyTabs} activeTab={safetyTab} onChange={setSafetyTab} />

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