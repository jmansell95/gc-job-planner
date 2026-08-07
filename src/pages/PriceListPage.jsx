import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Receipt } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import SettingsPage from '@/components/SettingsPage';

export default function PriceListPage() {
  const navigate = useNavigate();
  return (
    <div className="space-y-4">
      <PageHeader
        icon={Receipt}
        title="Master Price List"
        subtitle="Your chargeable rate card plus each supplier's ingested rate card"
      />
      <SettingsPage
        initialTab="rate-card"
        standalone
        onSelectJob={(job) => navigate('/admin', { state: { section: 'job-detail', job } })}
      />
    </div>
  );
}