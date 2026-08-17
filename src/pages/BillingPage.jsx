import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PoundSterling, Receipt, FileBarChart, FileText, Banknote, TrendingDown,
  FileCheck, ArrowRight, CheckCircle2, Lock, TrendingUp, Shield, ScrollText,
} from 'lucide-react';
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
import PageHeader from '@/components/PageHeader';
import TabBar from '@/components/TabBar';

// ─── 3-step billing pipeline ──────────────────────────────────────────────
const PIPELINE_STEPS = [
  {
    id: 'billing-readiness', step: 1, label: 'Ready to Bill', icon: FileCheck, desc: 'Unbilled work',
    blurb: 'Review all completed work that hasn\'t been invoiced yet. This is the start of the billing cycle — confirm what\'s ready before raising invoices.',
  },
  {
    id: 'invoicing', step: 2, label: 'Raise & Check', icon: PoundSterling, desc: 'Invoicing',
    blurb: 'Raise invoices for the work you confirmed in the previous step and check for discrepancies before sending them to clients.',
  },
  {
    id: 'aged-debtors', step: 3, label: 'Aged Debtors', icon: TrendingDown, desc: 'Chase overdue',
    blurb: 'Track outstanding invoices and chase overdue payments. This is the final step — keep cash flowing by following up on unpaid invoices.',
  },
];

function PipelineFlow({ activeTab, onSelect }) {
  const activeIdx = PIPELINE_STEPS.findIndex((s) => s.id === activeTab);
  return (
    <div className="insight-card rounded-2xl p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center">
          <FileBarChart className="w-3.5 h-3.5 text-white" />
        </div>
        <h3 className="text-sm font-bold text-slate-900">Billing Workflow</h3>
        <span className="text-xs text-slate-400 hidden sm:inline">— follow these 3 steps in order</span>
      </div>
      {/* Mobile: vertical stack, Desktop: horizontal flow */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2 sm:overflow-x-auto">
        {PIPELINE_STEPS.map((step, i) => {
          const Icon = step.icon;
          const isActive = step.id === activeTab;
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
                {/* Arrow: right on desktop, down on mobile */}
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

function PipelineIntro({ activeTab }) {
  const step = PIPELINE_STEPS.find((s) => s.id === activeTab);
  if (!step) return null;
  const Icon = step.icon;
  return (
    <div className="bg-gradient-to-br from-[#2E5A1A]/5 to-[#8DC63F]/5 rounded-2xl border border-[#2E5A1A]/15 px-3.5 sm:px-4 py-3 flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0 shadow-sm">
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-900">
          {step.label} — Step {PIPELINE_STEPS.findIndex((s) => s.id === activeTab) + 1} of {PIPELINE_STEPS.length}
        </p>
        <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{step.blurb}</p>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────
export default function BillingPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('billing-readiness');

  // Consolidated config tabs — merged from 9 down to 7:
  // • Contracts & POs = billing-contracts + purchase-orders
  // • Margin Guard = subcon-markup + job-alerts
  const tabs = [
    { id: 'rate-card', label: 'Price List', icon: Receipt },
    { id: 'poa-lock', label: 'POA Locks', icon: Lock },
    { id: 'billing', label: 'Billing Rules', icon: Banknote },
    { id: 'contracts-orders', label: 'Contracts & POs', icon: ScrollText },
    { id: 'margin-guard', label: 'Margin Guard', icon: Shield },
    { id: 'financial-audit', label: 'Audit Log', icon: FileCheck },
    { id: 'insights', label: 'Insights', icon: TrendingUp },
  ];

  const isPipelineTab = PIPELINE_STEPS.some((s) => s.id === tab);
  const goToJob = (job) => navigate('/admin', { state: { section: 'job-detail', job } });

  return (
    <div className="space-y-3 sm:space-y-4">
      <PageHeader
        icon={PoundSterling}
        title="Financial Control"
        subtitle="Invoicing, debtors, billing rules, rate cards & financial reports"
      />

      {/* Financial overview — always visible */}
      <FinancialOverviewWidget onSelectTab={setTab} />

      {/* 3-step billing workflow */}
      <PipelineFlow activeTab={tab} onSelect={setTab} />

      {/* Settings & configuration tabs */}
      <TabBar tabs={tabs} activeTab={tab} onChange={setTab} />

      {/* Pipeline step content */}
      {tab === 'billing-readiness' && (
        <>
          <PipelineIntro activeTab={tab} />
          <AfPPipelineWidget onSelectJob={goToJob} />
          <BillingReadinessReport onSelectJob={goToJob} />
        </>
      )}
      {tab === 'invoicing' && (
        <>
          <PipelineIntro activeTab={tab} />
          <InvoiceDiscrepancyWidget />
        </>
      )}
      {tab === 'aged-debtors' && (
        <>
          <PipelineIntro activeTab={tab} />
          <AgedDebtorsDashboard />
        </>
      )}

      {/* Insights dashboard */}
      {tab === 'insights' && <BillingInsightsTab />}

      {/* POA worklist */}
      {tab === 'poa-lock' && <POAWorklist />}

      {/* Merged: Contracts & Purchase Orders */}
      {tab === 'contracts-orders' && <ContractsAndOrdersTab />}

      {/* Merged: Sub-Con Markup & Budget Alerts */}
      {tab === 'margin-guard' && <MarginGuardTab />}

      {/* Settings-backed config tabs (Price List, Billing Rules, Audit Log) */}
      {['rate-card', 'billing', 'financial-audit'].includes(tab) && (
        <SettingsPage
          key={tab}
          initialTab={tab}
          standalone
          onSelectJob={goToJob}
        />
      )}
    </div>
  );
}