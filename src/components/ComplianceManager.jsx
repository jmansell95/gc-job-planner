import React, { useState } from 'react';
import { ShieldCheck, BarChart3, GraduationCap, AlertTriangle } from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import PillTabs from '@/components/PillTabs';
import ComplianceTracking from '@/components/compliance/ComplianceTracking';
import ComplianceReports from '@/components/compliance/ComplianceReports';
import TrainingManager from '@/components/TrainingManager';
import TrainingGapAnalysis from '@/components/compliance/TrainingGapAnalysis';

const tabs = [
  { id: 'tracking', label: 'Tracking', icon: ShieldCheck },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'training', label: 'Training', icon: GraduationCap },
  { id: 'gaps', label: 'Training Gaps', icon: AlertTriangle },
];

export default function ComplianceManager() {
  const [activeTab, setActiveTab] = useState('tracking');

  return (
    <div>
      <SettingsSectionHeader icon={ShieldCheck} title="Compliance" description="Track certificates, training & site qualifications" />
      <PillTabs tabs={tabs} activeId={activeTab} onChange={setActiveTab} />
      {activeTab === 'tracking' && <ComplianceTracking />}
      {activeTab === 'reports' && <ComplianceReports />}
      {activeTab === 'training' && <TrainingManager />}
      {activeTab === 'gaps' && <TrainingGapAnalysis />}
    </div>
  );
}