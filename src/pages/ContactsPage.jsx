import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Contact, Building2, HardHat, Package } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import SettingsPage from '@/components/SettingsPage';

export default function ContactsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('clients');

  const tabs = [
    { id: 'clients', label: 'Clients', icon: Building2 },
    { id: 'contractors', label: 'Sub-contractors', icon: HardHat },
    { id: 'suppliers', label: 'Suppliers', icon: Package },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Contact}
        title="Contacts"
        subtitle="Clients, sub-contractors & suppliers"
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