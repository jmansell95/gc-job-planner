import React, { useState } from 'react';
import { TrendingDown, Gauge } from 'lucide-react';
import SubTabNav from '@/components/SubTabNav';
import SubconMarkupRules from '@/components/settings/SubconMarkupRules';
import JobAlertSettings from '@/components/settings/JobAlertSettings';

/**
 * MarginGuardTab — merged tab combining Sub-Con Markup Rules and
 * Budget Alerts into a single "margin protection" view.
 * Markup rules prevent zero-margin subcontractor billing; budget alerts
 * flag jobs breaching margin/profit thresholds.
 */
export default function MarginGuardTab() {
  const [subTab, setSubTab] = useState('markup');

  const subTabs = [
    { id: 'markup', label: 'Sub-Con Markup', icon: TrendingDown },
    { id: 'alerts', label: 'Budget Alerts', icon: Gauge },
  ];

  return (
    <div className="space-y-3">
      <SubTabNav tabs={subTabs} activeTab={subTab} onChange={setSubTab} />
      {subTab === 'markup' && <SubconMarkupRules />}
      {subTab === 'alerts' && <JobAlertSettings />}
    </div>
  );
}