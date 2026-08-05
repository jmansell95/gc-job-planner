import React from 'react';
import { Clock } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import SettingsPage from '@/components/SettingsPage';

export default function TimesheetsPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        icon={Clock}
        title="Timesheets"
        subtitle="Weekly timesheets, approvals & payroll export"
      />
      <SettingsPage initialTab="timesheets" standalone />
    </div>
  );
}