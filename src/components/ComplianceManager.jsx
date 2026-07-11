import React, { useState } from 'react';
import { ShieldCheck, BarChart3, GraduationCap } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import PillTabs from '@/components/PillTabs';
import ComplianceTracking from '@/components/compliance/ComplianceTracking';
import ComplianceReports from '@/components/compliance/ComplianceReports';
import TrainingManager from '@/components/TrainingManager';
import SyncComplianceButton from '@/components/SyncComplianceButton';

const tabs = [
  { id: 'tracking', label: 'Tracking', icon: ShieldCheck },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'training', label: 'Training', icon: GraduationCap },
];

export default function ComplianceManager() {
  const [activeTab, setActiveTab] = useState('tracking');

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-6 md:mb-8">
        <PageHeader title="Compliance" icon={ShieldCheck} />
        <SyncComplianceButton />
      </div>
      <PillTabs tabs={tabs} activeId={activeTab} onChange={setActiveTab} />
      {activeTab === 'tracking' && <ComplianceTracking />}
      {activeTab === 'reports' && <ComplianceReports />}
      {activeTab === 'training' && <TrainingManager />}
    </div>
  );
}