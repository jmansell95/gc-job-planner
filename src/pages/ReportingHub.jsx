import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart3, FileBarChart } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ReportFilterBar from '@/components/reports/ReportFilterBar';
import PowerBIReportSection from '@/components/reports/PowerBIReportSection';
import NativeReportSection from '@/components/reports/NativeReportSection';
import { downloadCsv } from '@/utils/csvExport';
import PageHeader from '@/components/PageHeader';

const CATEGORIES = [
  { id: 'overview', label: 'Overview', icon: FileBarChart },
  { id: 'powerbi', label: 'Power BI', icon: BarChart3 },
  { id: 'financial', label: 'Financial', icon: FileBarChart },
  { id: 'jobs', label: 'Jobs', icon: FileBarChart },
  { id: 'fleet', label: 'Fleet', icon: FileBarChart },
  { id: 'staff', label: 'Staff', icon: FileBarChart },
  { id: 'compliance', label: 'Compliance', icon: FileBarChart },
  { id: 'assets', label: 'Assets', icon: FileBarChart },
];

const HUB_MAP = { billing: 'financial', fleet: 'fleet', staff: 'staff', compliance: 'compliance', assets: 'assets', powerbi: 'powerbi' };

export default function ReportingHub() {
  const [params] = useSearchParams();
  const initialHub = params.get('hub');
  const [category, setCategory] = useState(HUB_MAP[initialHub] || 'overview');
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', divisionId: '' });
  const [exporting, setExporting] = useState(false);

  const activeCat = CATEGORIES.find(c => c.id === category) || CATEGORIES[0];
  const isPowerBI = category === 'powerbi';

  const handleExport = async () => {
    setExporting(true);
    // Export is handled per-card; this top-level button exports a combined
    // summary CSV of the current native category's jobs.
    try {
      const q = filters.divisionId ? { division_id: filters.divisionId } : {};
      const jobs = await base44.entities.Job.filter(q, '-created_date', 500);
      downloadCsv('jobs-report.csv', jobs);
    } catch (e) { /* per-card export is the primary path */ }
    setExporting(false);
  };

  return (
    <div className="space-y-4">
        <PageHeader icon={FileBarChart} title="Reporting Hub" subtitle="Run reports across every hub — financial, jobs, fleet, staff, compliance and assets — plus live Power BI data." />

        {/* Filter bar */}
        <ReportFilterBar filters={filters} setFilters={setFilters} onExport={handleExport} exporting={exporting} hubLabel={activeCat.label} />

        {/* Category pills */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {CATEGORIES.map(c => {
            const Icon = c.icon;
            const active = c.id === category;
            return (
              <button key={c.id} onClick={() => setCategory(c.id)}
                className={'inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition ' +
                  (active ? 'command-gradient text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:border-[#2E5A1A] hover:text-[#2E5A1A]')}>
                <Icon className="w-4 h-4" /> {c.label}
              </button>
            );
          })}
        </div>

        {/* Report content */}
        {isPowerBI ? <PowerBIReportSection /> : <NativeReportSection hub={category} filters={filters} />}
    </div>
  );
}