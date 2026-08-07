import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileBarChart, FileText } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import SettingsPage from '@/components/SettingsPage';

export default function ReportsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('custom-reports');

  const tabs = [
    { id: 'custom-reports', label: 'Custom Reports', icon: FileBarChart },
    { id: 'client-progress-report', label: 'Client Progress Reports', icon: FileText },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        icon={FileBarChart}
        title="Reports"
        subtitle="Custom report builder & branded client progress reports"
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
      {tabs.map(t => tab === t.id && (
        <SettingsPage
          key={t.id}
          initialTab={t.id}
          standalone
          onSelectJob={(job) => navigate('/admin', { state: { section: 'job-detail', job } })}
        />
      ))}
    </div>
  );
}