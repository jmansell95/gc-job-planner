import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PoundSterling, Receipt, FileBarChart, Banknote, TrendingDown,
  FileCheck, ArrowRight, CheckCircle2, Lock, TrendingUp, Shield, ScrollText,
} from 'lucide-react';
import HubShell from '@/components/HubShell';
import SubPills from '@/components/SubPills';
import SettingsPage from '@/components/SettingsPage';
import InvoiceDiscrepancyWidget from '@/components/billing/InvoiceDiscrepancyWidget';
import AgedDebtorsDashboard from '@/components/billing/AgedDebtorsDashboard';
import BillingReadinessReport from '@/components/billing/BillingReadinessReport';
import FinancialOverviewWidget from '@/components/billing/FinancialOverviewWidget';
import POAWorklist from '@/components/billing/POAWorklist';
import BillingInsightsTab from '@/components/billing/BillingInsightsTab';
import ContractsAndOrdersTab from '@/components/billing/ContractsAndOrdersTab';
import MarginGuardTab from '@/components/billing/MarginGuardTab';
import AfPPipelineWidget from '@/components/billing/AfPPipelineWidget';
import GenerateInvoiceModal from '@/components/billing/GenerateInvoiceModal';
import RunReportButton from '@/components/reports/RunReportButton';
import CVRPortfolioOverview from '@/components/cvr/CVRPortfolioOverview';
import { base44 } from '@/api/base44Client';

// ─── 3-step billing pipeline (now inline within the Pipeline tab) ──────────
const PIPELINE_STEPS = [
  { id: 'billing-readiness', step: 1, label: 'Ready to Bill', icon: FileCheck, desc: 'Unbilled work' },
  { id: 'invoicing', step: 2, label: 'Raise & Check', icon: PoundSterling, desc: 'Invoicing' },
  { id: 'aged-debtors', step: 3, label: 'Aged Debtors', icon: TrendingDown, desc: 'Chase overdue' },
];

function PipelineFlow({ activeStep, onSelect }) {
  const activeIdx = PIPELINE_STEPS.findIndex((s) => s.id === activeStep);
  return (
    <div className="insight-card rounded-2xl p-2.5 sm:p-3">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center">
          <FileBarChart className="w-3.5 h-3.5 text-white" />
        </div>
        <h3 className="text-sm font-bold text-slate-900">Billing Workflow</h3>
        <span className="text-xs text-slate-400 hidden sm:inline">— follow these 3 steps in order</span>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2 sm:overflow-x-auto">
        {PIPELINE_STEPS.map((step, i) => {
          const Icon = step.icon;
          const isActive = step.id === activeStep;
          const isPast = activeIdx > i;
          return (
            <React.Fragment key={step.id}>
              <button
                onClick={() => onSelect(step.id)}
                className={`flex items-center gap-2.5 px-3 sm:px-4 py-2.5 rounded-xl transition flex-shrink-0 ${
                  isActive
                    ? 'bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white shadow-md'
                    : isPast
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-transparent'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : isPast
                      ? 'bg-emerald-200 text-emerald-800'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {isPast && !isActive ? <CheckCircle2 className="w-3.5 h-3.5" /> : step.step}
                </div>
                <div className="text-left min-w-0">
                  <p className="text-xs font-bold leading-none truncate">{step.label}</p>
                  <p className={`text-[10px] mt-0.5 ${isActive ? 'text-white/70' : 'text-slate-400'} truncate`}>
                    {step.desc}
                  </p>
                </div>
                {i < PIPELINE_STEPS.length - 1 && (
                  <ArrowRight className={`hidden sm:block w-4 h-4 flex-shrink-0 ${isPast ? 'text-emerald-400' : 'text-slate-300'}`} />
                )}
              </button>
              {i < PIPELINE_STEPS.length - 1 && (
                <div className="sm:hidden flex justify-center">
                  <ArrowRight className={`w-4 h-4 rotate-90 ${isPast ? 'text-emerald-400' : 'text-slate-300'}`} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main page — 3 consolidated tabs ───────────────────────────────────────
export default function BillingPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('pipeline');
  const [pipelineStep, setPipelineStep] = useState('billing-readiness');
  const [priceSub, setPriceSub] = useState('rate-card');
  const [controlSub, setControlSub] = useState('contracts-orders');
  const [invoiceJob, setInvoiceJob] = useState(null);

  const tabs = [
    { id: 'pipeline', label: 'Pipeline', icon: FileBarChart },
    { id: 'cvr-afp', label: 'CVR / AFP', icon: FileBarChart },
    { id: 'price-rates', label: 'Price & Rates', icon: Receipt },
    { id: 'control', label: 'Control', icon: Shield },
  ];

  const goToJob = (job) => navigate('/admin', { state: { section: 'job-detail', job } });

  const goToJobById = async (jobId) => {
    try {
      const jobs = await base44.entities.Job.filter({ id: jobId });
      if (jobs[0]) navigate('/admin', { state: { section: 'job-detail', job: jobs[0] } });
    } catch (e) { /* ignore */ }
  };

  // Map FinancialOverviewWidget's legacy tab ids onto the new 3-tab structure
  const handleOverviewSelect = (t) => {
    if (PIPELINE_STEPS.some(s => s.id === t)) {
      setTab('pipeline'); setPipelineStep(t);
    } else if (['rate-card', 'poa-lock', 'billing'].includes(t)) {
      setTab('price-rates'); setPriceSub(t);
    } else if (['contracts-orders', 'margin-guard', 'financial-audit', 'insights'].includes(t)) {
      setTab('control'); setControlSub(t);
    } else {
      setTab(t);
    }
  };

  return (
    <HubShell
      icon={PoundSterling}
      title="Financial Control"
      subtitle="Invoicing, debtors, billing rules, rate cards & financial reports"
      actions={<RunReportButton hub="billing" />}
      tabs={tabs}
      activeTab={tab}
      onTabChange={setTab}
      kpiStrip={<FinancialOverviewWidget onSelectTab={handleOverviewSelect} />}
    >
      {/* ── Pipeline tab: the 3-step flow as one continuous view ── */}
      {tab === 'pipeline' && (
        <>
          <PipelineFlow activeStep={pipelineStep} onSelect={setPipelineStep} />
          {pipelineStep === 'billing-readiness' && (
            <>
              <AfPPipelineWidget onSelectJob={setInvoiceJob} />
              <BillingReadinessReport onSelectJob={goToJob} />
            </>
          )}
          {pipelineStep === 'invoicing' && <InvoiceDiscrepancyWidget />}
          {pipelineStep === 'aged-debtors' && <AgedDebtorsDashboard />}
        </>
      )}

      {/* ── CVR / AFP tab: portfolio overview of all jobs' Cost/Value Reports */}
      {tab === 'cvr-afp' && (
        <CVRPortfolioOverview onSelectJob={goToJobById} />
      )}

      {/* ── Price & Rates tab: Price List + POA Locks + Billing Rules ── */}
      {tab === 'price-rates' && (
        <>
          <SubPills active={priceSub} onChange={setPriceSub} pills={[
            { id: 'rate-card', label: 'Price List', icon: Receipt },
            { id: 'poa-lock', label: 'POA Locks', icon: Lock },
            { id: 'billing', label: 'Billing Rules', icon: Banknote },
          ]} />
          {priceSub === 'poa-lock' && <POAWorklist />}
          {['rate-card', 'billing'].includes(priceSub) && (
            <SettingsPage key={priceSub} initialTab={priceSub} standalone onSelectJob={goToJob} />
          )}
        </>
      )}

      {/* ── Control tab: Contracts & POs + Margin Guard + Audit Log + Insights ── */}
      {tab === 'control' && (
        <>
          <SubPills active={controlSub} onChange={setControlSub} pills={[
            { id: 'contracts-orders', label: 'Contracts & POs', icon: ScrollText },
            { id: 'margin-guard', label: 'Margin Guard', icon: Shield },
            { id: 'financial-audit', label: 'Audit Log', icon: FileCheck },
            { id: 'insights', label: 'Insights', icon: TrendingUp },
          ]} />
          {controlSub === 'contracts-orders' && <ContractsAndOrdersTab />}
          {controlSub === 'margin-guard' && <MarginGuardTab />}
          {controlSub === 'financial-audit' && (
            <SettingsPage key="financial-audit" initialTab="financial-audit" standalone onSelectJob={goToJob} />
          )}
          {controlSub === 'insights' && <BillingInsightsTab />}
        </>
      )}

      {/* AfP pipeline → Raise invoice popup (self-sufficient: fetches its own data) */}
      <GenerateInvoiceModal
        open={!!invoiceJob}
        onClose={() => setInvoiceJob(null)}
        job={invoiceJob}
      />
    </HubShell>
  );
}