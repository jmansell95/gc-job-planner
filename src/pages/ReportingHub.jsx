import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart3, FileBarChart } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ReportFilterBar from '@/components/reports/ReportFilterBar';
import PowerBIReportSection from '@/components/reports/PowerBIReportSection';
import NativeReportSection from '@/components/reports/NativeReportSection';
import { downloadCsv } from '@/utils/csvExport';

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
    <div className="min-h-screen page-bg-vibrant">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Header */}
        <div className="insight-card rounded-2xl p-5 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center shadow-lg flex-shrink-0">
            <FileBarChart className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Reporting Hub</h1>
            <p className="text-sm text-slate-500">Run reports across every hub — financial, jobs, fleet, staff, compliance and assets — plus live Power BI data.</p>
          </div>
        </div>

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
    </div>
  );
}