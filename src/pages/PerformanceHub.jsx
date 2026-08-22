import React, { useState, useMemo } from 'react';
import {
  TrendingUp, Users, Calendar, Loader2, Download,
} from 'lucide-react';
import HubShell from '@/components/HubShell';
import RigProfitabilityView from '@/components/performance/RigProfitabilityView';
import CrewEarningsView from '@/components/performance/CrewEarningsView';
import RunReportButton from '@/components/reports/RunReportButton';

/**
 * PerformanceHub — dedicated rig & crew financial intelligence page.
 * Two views: Rig Profitability (earned vs cost per rig) and
 * Crew Earnings (total earned by team for a date range).
 */
export default function PerformanceHub() {
  const [tab, setTab] = useState('rig-profitability');
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
    { id: 'rig-profitability', label: 'Rig Profitability', icon: TrendingUp },
    { id: 'crew-earnings', label: 'Crew Earnings', icon: Users },
  ];

  return (
    <HubShell
      icon={TrendingUp}
      title="Performance Hub"
      subtitle="Rig & crew financial intelligence"
      actions={<RunReportButton hub="billing" />}
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

      {tab === 'rig-profitability' && <RigProfitabilityView dateRange={dateRange} />}
      {tab === 'crew-earnings' && <CrewEarningsView dateRange={dateRange} />}
    </HubShell>
  );
}