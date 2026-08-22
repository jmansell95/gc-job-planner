import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, Users, Calendar, Loader2, Download, LayoutDashboard,
  PoundSterling,
} from 'lucide-react';
import HubShell from '@/components/HubShell';
import RigProfitabilityView from '@/components/performance/RigProfitabilityView';
import CrewEarningsView from '@/components/performance/CrewEarningsView';
import PerformanceOverviewTab from '@/components/performance/PerformanceOverviewTab';
import RunReportButton from '@/components/reports/RunReportButton';
import { base44 } from '@/api/base44Client';

/**
 * PerformanceHub — dedicated rig & crew financial intelligence page.
 * Three views: Overview (combined), Rig Profitability, Crew Earnings.
 * Everything links: rig/crew rows drill into job detail, quick links
 * jump to the Billing hub.
 */
export default function PerformanceHub() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Default to current year if empty
  const dateRange = useMemo(() => {
    const today = new Date();
    const from = dateFrom || `${today.getFullYear()}-01-01`;
    const to = dateTo || today.toISOString().slice(0, 10);
    return { date_from: from, date_to: to };
  }, [dateFrom, dateTo]);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'rig-profitability', label: 'Rig Profitability', icon: TrendingUp },
    { id: 'crew-earnings', label: 'Crew Earnings', icon: Users },
  ];

  // Navigate to a job's detail in the admin dashboard
  const handleSelectJob = async (jobId) => {
    try {
      const jobs = await base44.entities.Job.filter({ id: jobId });
      if (jobs[0]) navigate('/admin', { state: { section: 'job-detail', job: jobs[0] } });
    } catch (e) { /* ignore */ }
  };

  return (
    <HubShell
      icon={TrendingUp}
      title="Performance Hub"
      subtitle="Rig & crew financial intelligence"
      actions={
        <div className="flex items-center gap-2">
          <a
            href="/billing"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition active:scale-95"
          >
            <PoundSterling className="w-3.5 h-3.5" /> Billing Hub
          </a>
          <RunReportButton hub="billing" />
        </div>
      }
      tabs={tabs}
      activeTab={tab}
      onTabChange={setTab}
    >
      {/* Date range picker */}
      <div className="insight-card rounded-2xl p-3 mb-3 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
          <Calendar className="w-4 h-4" /> Period:
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#2E5A1A]"
          />
          <span className="text-slate-400 text-xs">→</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#2E5A1A]"
          />
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            onClick={() => { setDateFrom(''); setDateTo(''); }}
            className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition"
          >
            This Year
          </button>
          <button
            onClick={() => {
              const d = new Date();
              d.setMonth(d.getMonth() - 1);
              setDateFrom(d.toISOString().slice(0, 10));
              setDateTo(new Date().toISOString().slice(0, 10));
            }}
            className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition"
          >
            Last 30 Days
          </button>
        </div>
      </div>

      {tab === 'overview' && (
        <PerformanceOverviewTab
          dateRange={dateRange}
          onSelectJob={handleSelectJob}
          onGoToTab={setTab}
        />
      )}
      {tab === 'rig-profitability' && (
        <RigProfitabilityView dateRange={dateRange} onSelectJob={handleSelectJob} />
      )}
      {tab === 'crew-earnings' && (
        <CrewEarningsView dateRange={dateRange} onSelectJob={handleSelectJob} />
      )}
    </HubShell>
  );
}