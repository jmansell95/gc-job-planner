import React from 'react';
import { useNavigate } from 'react-router-dom';
import FinancialReconciliationWidget from '@/components/dashboard/FinancialReconciliationWidget';
import ProjectHealthDashboardWidget from '@/components/dashboard/ProjectHealthDashboardWidget';
import BenchmarkComparisonsWidget from '@/components/dashboard/BenchmarkComparisonsWidget';
import ClientFeedbackWidget from '@/components/dashboard/ClientFeedbackWidget';
import ReportsHubWidget from '@/components/dashboard/ReportsHubWidget';

/**
 * BillingInsightsTab — the "Insights" view of the Financial Control Hub.
 * Aggregates reconciliation, project health, benchmarks, client feedback,
 * and the reports hub into a clean 2-column dashboard grid.
 */
export default function BillingInsightsTab() {
  const navigate = useNavigate();
  const go = (section) => navigate('/admin', { state: { section } });

  return (
    <div className="space-y-3 sm:space-y-4">
      <FinancialReconciliationWidget onNavigate={go} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <ProjectHealthDashboardWidget onNavigate={go} />
        <BenchmarkComparisonsWidget onNavigate={go} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <ClientFeedbackWidget onNavigate={go} />
        <ReportsHubWidget onNavigate={go} />
      </div>
    </div>
  );
}