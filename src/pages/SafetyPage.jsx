import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ShieldCheck, AlertTriangle } from 'lucide-react';
import SafetyCultureCheckHub from '@/components/safety/SafetyCultureCheckHub';
import IncidentReporter from '@/components/safety/IncidentReporter';

export default function SafetyPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('checks');

  const tabs = [
    { id: 'checks', label: 'Safety Checks', icon: ShieldCheck },
    { id: 'incidents', label: 'Incidents & Near-Miss', icon: AlertTriangle },
  ];

  return (
    <div>
      {/* Tab bar */}
      <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/70 shadow-sm p-1.5 inline-flex flex-wrap gap-1 mb-4">
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
    </div>
  );
}