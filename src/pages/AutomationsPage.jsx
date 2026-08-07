import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import SettingsPage from '@/components/SettingsPage';

export default function AutomationsPage() {
  const navigate = useNavigate();
  return (
    <div className="space-y-4">
      <PageHeader
        icon={Zap}
        title="Automations"
        subtitle="View and toggle background automations"
      />
      <SettingsPage
        initialTab="automations"
        standalone
        onSelectJob={(job) => navigate('/admin', { state: { section: 'job-detail', job } })}
      />
    </div>
  );
}