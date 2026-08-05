import React from 'react';
import { useNavigate } from 'react-router-dom';
import SettingsPage from '@/components/SettingsPage';
import InvoiceDiscrepancyWidget from '@/components/billing/InvoiceDiscrepancyWidget';

export default function BillingPage() {
  const navigate = useNavigate();
  return (
    <div className="space-y-4">
      <InvoiceDiscrepancyWidget />
      <SettingsPage
        initialTab="invoicing"
        standalone
        onSelectJob={(job) => navigate('/admin', { state: { section: 'job-detail', job } })}
      />
    </div>
  );
}