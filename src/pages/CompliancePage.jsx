import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ShieldAlert, AlertTriangle, BarChart3, HardHat, ClipboardCheck, FlaskConical, CalendarDays } from 'lucide-react';
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

  const topTabs = [
    { id: 'compliance', label: 'Compliance', icon: ShieldCheck },
    { id: 'compliance-rules', label: 'Rules', icon: ShieldCheck },
    { id: 'calendar', label: 'Calendar', icon: CalendarDays },
    { id: 'safety', label: 'Safety', icon: ShieldAlert },
    { id: 'audit-trail', label: 'Audit Trail', icon: ClipboardCheck },
    { id: 'system-audit-log', label: 'System Log', icon: ClipboardCheck },
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
        title="Compliance, Safety & Audit"
        subtitle="Staff certifications, equipment compliance, safety incidents & investigation log review"
      />
      <TabBar tabs={topTabs} activeTab={tab} onChange={setTab} />

      {tab === 'compliance' && (
        <SettingsPage initialTab="compliance" standalone />
      )}

      {tab === 'compliance-rules' && (
        <SettingsPage initialTab="compliance-rules" standalone />
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

      {tab === 'log-qc' && (
        <SettingsPage initialTab="log-qc" standalone onSelectJob={(job) => navigate('/admin', { state: { section: 'job-detail', job } })} />
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