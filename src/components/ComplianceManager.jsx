import React, { useState } from 'react';
import { ShieldCheck, BarChart3 } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import PillTabs from '@/components/PillTabs';
import ComplianceTracking from '@/components/compliance/ComplianceTracking';
import ComplianceReports from '@/components/compliance/ComplianceReports';

const tabs = [
  { id: 'tracking', label: 'Tracking', icon: ShieldCheck },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
];

export default function ComplianceManager() {
  const [activeTab, setActiveTab] = useState('tracking');

  return (
    <div>
      <PageHeader title="Compliance" icon={ShieldCheck} />
      <PillTabs tabs={tabs} activeId={activeTab} onChange={setActiveTab} />
      {activeTab === 'tracking' && <ComplianceTracking />}
      {activeTab === 'reports' && <ComplianceReports />}
    </div>
  );
}