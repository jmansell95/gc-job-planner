import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ShieldCheck, AlertTriangle, BarChart3, HardHat } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import SafetyCultureCheckHub from '@/components/safety/SafetyCultureCheckHub';
import IncidentReporter from '@/components/safety/IncidentReporter';
import RIDDORStatsPanel from '@/components/safety/RIDDORStatsPanel';
import ToolboxTalkManager from '@/components/safety/ToolboxTalkManager';

export default function SafetyPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('checks');

  const tabs = [
    { id: 'checks', label: 'Safety Checks', icon: ShieldCheck },
    { id: 'incidents', label: 'Incidents & Near-Miss', icon: AlertTriangle },
    { id: 'stats', label: 'H&S Statistics', icon: BarChart3 },
    { id: 'toolbox', label: 'Toolbox Talks', icon: HardHat },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        icon={ShieldAlert}
        title="Safety Hub"
        subtitle="Safety checks, incident reporting, RIDDOR stats & toolbox talks"
      />
      <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/70 shadow-sm p-1.5 inline-flex flex-wrap gap-1">
        {tabs.map(t => {
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

      {tab === 'checks' && <SafetyCultureCheckHub onNavigate={(section) => navigate('/admin', { state: { section } })} />}
      {tab === 'incidents' && <IncidentReporter />}
      {tab === 'toolbox' && (
        <div className="insight-card rounded-2xl p-4 md:p-5">
          <h3 className="text-lg font-bold text-slate-900 mb-1">Toolbox Talks</h3>
          <p className="text-sm text-slate-500 mb-4">Schedule, deliver, and track toolbox talks with digital sign-off</p>
          <ToolboxTalkManager />
        </div>
      )}
      {tab === 'stats' && (
        <div className="insight-card rounded-2xl p-4 md:p-5">
          <h3 className="text-lg font-bold text-slate-900 mb-1">Health & Safety Statistics</h3>
          <p className="text-sm text-slate-500 mb-4">RIDDOR-reportable incidents, near-miss trends, and audit performance</p>
          <RIDDORStatsPanel />
        </div>
      )}
    </div>
  );
}