import React from 'react';
import { ShieldCheck } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import SettingsPage from '@/components/SettingsPage';

export default function CompliancePage() {
  return (
    <div className="space-y-4">
      <PageHeader
        icon={ShieldCheck}
        title="Compliance Hub"
        subtitle="Staff certs, equipment compliance, skills matrix & training"
      />
      <SettingsPage initialTab="compliance" standalone />
    </div>
  );
}