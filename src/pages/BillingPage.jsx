import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PoundSterling, Receipt, FileBarChart, FileText, Banknote } from 'lucide-react';
import SettingsPage from '@/components/SettingsPage';
import InvoiceDiscrepancyWidget from '@/components/billing/InvoiceDiscrepancyWidget';
import PageHeader from '@/components/PageHeader';
import TabBar from '@/components/TabBar';

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
      <PageHeader
        icon={PoundSterling}
        title="Financial Management"
        subtitle="Invoicing, price lists, billing rules, custom reports & client progress reports"
      />
      <TabBar tabs={tabs} activeTab={tab} onChange={setTab} />
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