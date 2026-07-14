import React, { useState } from 'react';
import { PoundSterling, TrendingUp, BarChart3, Wallet, PiggyBank } from 'lucide-react';
import ProfitabilityDashboard from '@/components/ProfitabilityDashboard';
import AssetCrewProfitability from '@/components/AssetCrewProfitability';
import WeeklyInsightsPage from '@/components/WeeklyInsightsPage';
import { canViewCostings } from '@/utils/access';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { EmptyState } from '@/components/StateViews';
import { Lock } from 'lucide-react';

const TABS = [
  { id: 'overview', label: 'Job Profitability', icon: PoundSterling, desc: 'Cost, markup & margin per job' },
  { id: 'assets', label: 'Assets & Crews', icon: TrendingUp, desc: 'Revenue vs cost per rig and crew' },
  { id: 'insights', label: 'AI Insights', icon: BarChart3, desc: 'Weekly operational summary & actions' },
];

export default function ProfitabilityHub({ profile }) {
  const [activeTab, setActiveTab] = useState('overview');

  if (!canViewCostings(profile)) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200">
        <EmptyState icon={Lock} title="Access restricted" message="Financial data is available to admins and managers only." />
      </div>
    );
  }

  const active = TABS.find(t => t.id === activeTab);
  const ActiveIcon = active?.icon;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl flex-shrink-0 shadow-sm">
            <PoundSterling className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Finance & Profitability</h1>
            <p className="text-sm text-slate-500 mt-0.5">{active?.desc}</p>
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1.5 bg-slate-100 p-1.5 rounded-xl w-full sm:w-auto sm:inline-flex mb-5">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold transition ${isActive ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div>
        {activeTab === 'overview' && <ProfitabilityDashboard />}
        {activeTab === 'assets' && <AssetCrewProfitability />}
        {activeTab === 'insights' && <WeeklyInsightsPage />}
      </div>
    </div>
  );
}