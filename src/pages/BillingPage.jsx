import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PoundSterling, FileBarChart, Download, Tag,
} from 'lucide-react';
import HubShell from '@/components/HubShell';
import CVRExportTab from '@/components/billing/CVRExportTab';
import AFPPortfolioOverview from '@/components/afp/AFPPortfolioOverview';
import AFPTemplateUploader from '@/components/afp/AFPTemplateUploader';
import RateCardManager from '@/components/RateCardManager';
import KeywordMappingManager from '@/components/billing/KeywordMappingManager';
import PricingReviewBanner from '@/components/billing/PricingReviewBanner';
import RunReportButton from '@/components/reports/RunReportButton';
import { base44 } from '@/api/base44Client';

/**
 * BillingPage — AFP-centric billing hub.
 * Three views: AFP Portfolio (primary), Rate Card (Master Price List +
 * Keyword Mapping), and CVR Export (replaces invoicing — invoicing is
 * handled in an external system; CVRs are downloaded for higher management).
 */
export default function BillingPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('afp-portfolio');
  const [showTemplateUploader, setShowTemplateUploader] = useState(false);

  const tabs = [
    { id: 'afp-portfolio', label: 'AFP Portfolio', icon: FileBarChart },
    { id: 'rate-card', label: 'Rate Card', icon: Tag },
    { id: 'cvr-export', label: 'CVR Export', icon: Download },
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
      subtitle="AFP portfolio, rate card & CVR export"
      actions={<RunReportButton hub="billing" />}
      tabs={tabs}
      activeTab={tab}
      onTabChange={setTab}
    >
      {/* ── AFP Portfolio: all jobs' AFPs in one place ── */}
      {tab === 'afp-portfolio' && (
        <>
          <PricingReviewBanner />
          <AFPPortfolioOverview
            onSelectJob={goToJobById}
            onUploadTemplate={() => setShowTemplateUploader(true)}
          />
        </>
      )}

      {/* ── Rate Card: per-division Master Price List + Keyword Mapping ── */}
      {tab === 'rate-card' && (
        <div className="space-y-4">
          <RateCardManager />
          <KeywordMappingManager />
        </div>
      )}

      {/* ── CVR Export: download CVR packs for higher management ── */}
      {tab === 'cvr-export' && (
        <CVRExportTab />
      )}

      {showTemplateUploader && (
        <AFPTemplateUploader onClose={() => setShowTemplateUploader(false)} />
      )}
    </HubShell>
  );
}