import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PoundSterling, Receipt, FileBarChart, FileText, Banknote } from 'lucide-react';
import SettingsPage from '@/components/SettingsPage';
import InvoiceDiscrepancyWidget from '@/components/billing/InvoiceDiscrepancyWidget';

export default function BillingPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('invoicing');

  const tabs = [
    { id: 'invoicing', label: 'Invoicing', icon: PoundSterling },
    { id: 'rate-card', label: 'Price List', icon: Receipt },
    { id: 'billing', label: 'Billing Rules', icon: Banknote },
    { id: 'custom-reports', label: 'Custom Reports', icon: FileBarChart },
    { id: 'client-progress-report', label: 'Client Reports', icon: FileText },
  ];

  return (
    <div className="space-y-4">
      <div className="mb-1">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Financial Management</h1>
        <p className="text-sm text-slate-500 mt-0.5">Invoicing, price lists, billing rules, custom reports & client progress reports</p>
      </div>
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
      {tab === 'invoicing' && <InvoiceDiscrepancyWidget />}
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