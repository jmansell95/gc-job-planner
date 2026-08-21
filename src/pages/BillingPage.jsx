import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PoundSterling, FileBarChart, Receipt, Tag,
} from 'lucide-react';
import HubShell from '@/components/HubShell';
import AgedDebtorsDashboard from '@/components/billing/AgedDebtorsDashboard';
import AFPPortfolioOverview from '@/components/afp/AFPPortfolioOverview';
import AFPTemplateUploader from '@/components/afp/AFPTemplateUploader';
import RateCardManager from '@/components/RateCardManager';
import RunReportButton from '@/components/reports/RunReportButton';
import { base44 } from '@/api/base44Client';

/**
 * BillingPage — AFP-centric billing hub.
 * Three views: AFP Portfolio (primary), Rate Card (per-division Master Price List),
 * and Invoicing / Aged Debtors (secondary). All per-job financial management
 * (AFP builder, rate cards, controls) lives inside each job's Financials tab.
 */
export default function BillingPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('afp-portfolio');
  const [showTemplateUploader, setShowTemplateUploader] = useState(false);

  const tabs = [
    { id: 'afp-portfolio', label: 'AFP Portfolio', icon: FileBarChart },
    { id: 'rate-card', label: 'Rate Card', icon: Tag },
    { id: 'invoicing', label: 'Invoicing', icon: Receipt },
  ];

  const goToJobById = async (jobId) => {
    try {
      const jobs = await base44.entities.Job.filter({ id: jobId });
      if (jobs[0]) navigate('/admin', { state: { section: 'job-detail', job: jobs[0] } });
    } catch (e) { /* ignore */ }
  };

  return (
    <HubShell
      icon={PoundSterling}
      title="Financial Control"
      subtitle="AFP portfolio, rate card & aged debtors"
      actions={<RunReportButton hub="billing" />}
      tabs={tabs}
      activeTab={tab}
      onTabChange={setTab}
    >
      {/* ── AFP Portfolio: all jobs' AFPs in one place ── */}
      {tab === 'afp-portfolio' && (
        <AFPPortfolioOverview
          onSelectJob={goToJobById}
          onUploadTemplate={() => setShowTemplateUploader(true)}
        />
      )}

      {/* ── Rate Card: per-division Master Price List ── */}
      {tab === 'rate-card' && (
        <RateCardManager />
      )}

      {/* ── Invoicing: aged debtors & invoice tracking ── */}
      {tab === 'invoicing' && (
        <AgedDebtorsDashboard />
      )}

      {showTemplateUploader && (
        <AFPTemplateUploader onClose={() => setShowTemplateUploader(false)} />
      )}
    </HubShell>
  );
}