import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PoundSterling, Receipt, FileBarChart, FileText, Banknote, TrendingDown, FileCheck, ArrowRight, CheckCircle2, Clock, Lock } from 'lucide-react';
import SettingsPage from '@/components/SettingsPage';
import InvoiceDiscrepancyWidget from '@/components/billing/InvoiceDiscrepancyWidget';
import AgedDebtorsDashboard from '@/components/billing/AgedDebtorsDashboard';
import BillingReadinessReport from '@/components/billing/BillingReadinessReport';
import FinancialOverviewWidget from '@/components/billing/FinancialOverviewWidget';
import POAWorklist from '@/components/billing/POAWorklist';
import PageHeader from '@/components/PageHeader';
import TabBar from '@/components/TabBar';

// Pipeline flow bar — shows the billing workflow as connected steps
const PIPELINE_STEPS = [
  { id: 'billing-readiness', label: 'Ready to Bill', icon: FileCheck, desc: 'Unbilled work' },
  { id: 'invoicing', label: 'Invoicing', icon: PoundSterling, desc: 'Raise & check' },
  { id: 'aged-debtors', label: 'Aged Debtors', icon: TrendingDown, desc: 'Chase overdue' },
];

function PipelineFlow({ activeTab, onSelect }) {
  const activeIdx = PIPELINE_STEPS.findIndex(s => s.id === activeTab);
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-2 overflow-x-auto">
      {PIPELINE_STEPS.map((step, i) => {
        const Icon = step.icon;
        const isActive = step.id === activeTab;
        const isPast = activeIdx > i;
        return (
          <React.Fragment key={step.id}>
            <button
              onClick={() => onSelect(step.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition flex-shrink-0 ${
                isActive ? 'bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white shadow-sm' :
                isPast ? 'bg-emerald-50 text-emerald-700' :
                'bg-slate-50 text-slate-500 hover:bg-slate-100'
              }`}
            >
              {isPast && !isActive ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              <div className="text-left">
                <p className="text-xs font-bold leading-none">{step.label}</p>
                <p className={`text-[10px] mt-0.5 ${isActive ? 'text-white/70' : 'text-slate-400'}`}>{step.desc}</p>
              </div>
            </button>
            {i < PIPELINE_STEPS.length - 1 && (
              <ArrowRight className={`w-4 h-4 flex-shrink-0 ${isPast ? 'text-emerald-400' : 'text-slate-300'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function NextStepButton({ currentTab, onSelect }) {
  const idx = PIPELINE_STEPS.findIndex(s => s.id === currentTab);
  if (idx < 0 || idx >= PIPELINE_STEPS.length - 1) return null;
  const next = PIPELINE_STEPS[idx + 1];
  const NextIcon = next.icon;
  return (
    <div className="flex justify-end pt-2">
      <button
        onClick={() => onSelect(next.id)}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white text-sm font-semibold shadow-sm hover:shadow-md transition"
      >
        Next: {next.label}
        <NextIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function BillingPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('invoicing');

  const tabs = [
    { id: 'invoicing', label: 'Invoicing', icon: PoundSterling },
    { id: 'aged-debtors', label: 'Aged Debtors', icon: TrendingDown },
    { id: 'billing-readiness', label: 'Billing Readiness', icon: FileCheck },
    { id: 'rate-card', label: 'Price List', icon: Receipt },
    { id: 'poa-lock', label: 'POA Locks', icon: Lock },
    { id: 'billing', label: 'Billing Rules', icon: Banknote },
    { id: 'billing-pipeline', label: 'Pipeline', icon: FileBarChart },
    { id: 'billing-contracts', label: 'Contracts', icon: FileText },
    { id: 'purchase-orders', label: 'Purchase Orders', icon: FileText },
    { id: 'overtime', label: 'Overtime', icon: Clock },
    { id: 'business-rules', label: 'Business Rules', icon: Receipt },
    { id: 'expense-presets', label: 'Expense Presets', icon: Receipt },
    { id: 'subcon-markup', label: 'Sub-Con Markup', icon: TrendingDown },
    { id: 'gl-mapping', label: 'GL Mapping', icon: FileBarChart },
    { id: 'data-exchange', label: 'Data Exchange', icon: ArrowRight },
    { id: 'payroll-export', label: 'Payroll Export', icon: FileText },
    { id: 'financial-audit', label: 'Audit Log', icon: FileCheck },
    { id: 'job-alerts', label: 'Budget Alerts', icon: FileCheck },
    { id: 'custom-reports', label: 'Custom Reports', icon: FileBarChart },
    { id: 'client-progress-report', label: 'Client Reports', icon: FileText },
  ];

  const isPipelineTab = ['invoicing', 'aged-debtors', 'billing-readiness'].includes(tab);

  return (
    <div className="space-y-4">
      <PageHeader
        icon={PoundSterling}
        title="Financial Control"
        subtitle="Invoicing, debtors, billing rules, rate cards & financial reports"
      />
      {isPipelineTab && <FinancialOverviewWidget onSelectTab={setTab} />}
      {isPipelineTab && <PipelineFlow activeTab={tab} onSelect={setTab} />}
      <TabBar tabs={tabs} activeTab={tab} onChange={setTab} />
      {tab === 'invoicing' && (
        <>
          <InvoiceDiscrepancyWidget />
          <NextStepButton currentTab={tab} onSelect={setTab} />
        </>
      )}
      {tab === 'aged-debtors' && <AgedDebtorsDashboard />}
      {tab === 'billing-readiness' && (
        <>
          <BillingReadinessReport onSelectJob={(job) => navigate('/admin', { state: { section: 'job-detail', job } })} />
          <NextStepButton currentTab={tab} onSelect={setTab} />
        </>
      )}
      {tab === 'poa-lock' && <POAWorklist />}
      {tab !== 'invoicing' && tab !== 'aged-debtors' && tab !== 'billing-readiness' && tab !== 'poa-lock' && tabs.map(t => tab === t.id && (
        <SettingsPage
          key={t.id}
          initialTab={t.id}
          standalone
          onSelectJob={(job) => navigate('/admin', { state: { section: 'job-detail', job } })}
        />
      ))}
    </div>
  );
}