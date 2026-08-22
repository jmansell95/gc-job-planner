import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PoundSterling, FileBarChart, Download, Tag, TrendingUp,
  LayoutDashboard, Shield, ScrollText,
} from 'lucide-react';
import HubShell from '@/components/HubShell';
import CVRExportTab from '@/components/billing/CVRExportTab';
import AFPPortfolioOverview from '@/components/afp/AFPPortfolioOverview';
import AFPTemplateUploader from '@/components/afp/AFPTemplateUploader';
import RateCardManager from '@/components/RateCardManager';
import KeywordMappingManager from '@/components/billing/KeywordMappingManager';
import PricingReviewBanner from '@/components/billing/PricingReviewBanner';
import BillingInsightsTab from '@/components/billing/BillingInsightsTab';
import MarginGuardTab from '@/components/billing/MarginGuardTab';
import AgedDebtorsDashboard from '@/components/billing/AgedDebtorsDashboard';
import ContractsAndOrdersTab from '@/components/billing/ContractsAndOrdersTab';
import RunReportButton from '@/components/reports/RunReportButton';
import { base44 } from '@/api/base44Client';

/**
 * BillingPage — AFP-centric billing hub.
 * Seven tabs: Insights (overview), AFP Portfolio (primary), Margin Guard,
 * Aged Debtors, Contracts & Orders, Rate Card, CVR Export.
 */
export default function BillingPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('insights');
  const [showTemplateUploader, setShowTemplateUploader] = useState(false);

  const tabs = [
    { id: 'insights', label: 'Insights', icon: LayoutDashboard },
    { id: 'afp-portfolio', label: 'AFP Portfolio', icon: FileBarChart },
    { id: 'margin-guard', label: 'Margin Guard', icon: Shield },
    { id: 'aged-debtors', label: 'Aged Debtors', icon: TrendingUp },
    { id: 'contracts', label: 'Contracts', icon: ScrollText },
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
      actions={
        <div className="flex items-center gap-2">
          <a
            href="/performance"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition active:scale-95"
          >
            <TrendingUp className="w-3.5 h-3.5" /> Performance Hub
          </a>
          <RunReportButton hub="billing" />
        </div>
      }
      tabs={tabs}
      activeTab={tab}
      onTabChange={setTab}
    >
      {/* ── Insights: portfolio-wide financial health dashboard ── */}
      {tab === 'insights' && <BillingInsightsTab />}

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

      {/* ── Margin Guard: sub-con markup rules + budget alerts ── */}
      {tab === 'margin-guard' && <MarginGuardTab />}

      {/* ── Aged Debtors: outstanding invoices by age bucket ── */}
      {tab === 'aged-debtors' && <AgedDebtorsDashboard />}

      {/* ── Contracts & Orders: billing contracts + purchase orders ── */}
      {tab === 'contracts' && <ContractsAndOrdersTab />}

      {/* ── Rate Card: per-division Master Price List + Keyword Mapping ── */}
      {tab === 'rate-card' && (
        <div className="space-y-4">
          <RateCardManager />
          <KeywordMappingManager />
        </div>
      )}

      {/* ── CVR Export: download CVR packs for higher management ── */}
      {tab === 'cvr-export' && <CVRExportTab />}

      {showTemplateUploader && (
        <AFPTemplateUploader onClose={() => setShowTemplateUploader(false)} />
      )}
    </HubShell>
  );
}