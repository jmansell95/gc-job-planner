import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PoundSterling } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import SettingsPage from '@/components/SettingsPage';
import InvoiceDiscrepancyWidget from '@/components/billing/InvoiceDiscrepancyWidget';

export default function BillingPage() {
  const navigate = useNavigate();
  return (
    <div className="space-y-4">
      <PageHeader
        icon={PoundSterling}
        title="Billing & Invoicing"
        subtitle="Invoice generation, CIS verification, PO matching & financial reconciliation"
      />
      <InvoiceDiscrepancyWidget />
      <SettingsPage
        initialTab="invoicing"
        standalone
        onSelectJob={(job) => navigate('/admin', { state: { section: 'job-detail', job } })}
      />
    </div>
  );
}