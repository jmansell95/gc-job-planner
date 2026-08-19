import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Calendar, Building2, Download, Loader2 } from 'lucide-react';

/**
 * Shared filter bar for the Reporting Hub — date range, division scope, and a
 * CSV export action. Divisions are fetched here so the bar is self-contained.
 */
export default function ReportFilterBar({ filters, setFilters, onExport, exporting, hubLabel }) {
  const { data: divisions = [] } = useQuery({
    queryKey: ['report-filter-divisions'],
    queryFn: () => base44.entities.Division.list('-sort_order', 100),
  });

  const set = (k, v) => setFilters(prev => ({ ...prev, [k]: v }));

  return (
    <div className="insight-card rounded-2xl p-4 flex flex-col lg:flex-row lg:items-end gap-3">
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center shadow-md">
          <Building2 className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Report Scope</p>
          <p className="text-sm font-extrabold text-slate-900">{hubLabel}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 flex-1">
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">From</label>
          <input type="date" value={filters.dateFrom} onChange={e => set('dateFrom', e.target.value)}
            className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm font-medium text-slate-900 focus:border-[#2E5A1A] focus:ring-2 focus:ring-emerald-100 outline-none" />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">To</label>
          <input type="date" value={filters.dateTo} onChange={e => set('dateTo', e.target.value)}
            className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm font-medium text-slate-900 focus:border-[#2E5A1A] focus:ring-2 focus:ring-emerald-100 outline-none" />
        </div>
        <div className="min-w-[160px]">
          <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Division</label>
          <select value={filters.divisionId} onChange={e => set('divisionId', e.target.value)}
            className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm font-medium text-slate-900 focus:border-[#2E5A1A] focus:ring-2 focus:ring-emerald-100 outline-none w-full">
            <option value="">All Divisions</option>
            {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </div>

      <button onClick={onExport} disabled={exporting}
        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition disabled:opacity-50 flex-shrink-0">
        {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Export CSV
      </button>
    </div>
  );
}