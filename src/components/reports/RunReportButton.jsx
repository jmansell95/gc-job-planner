import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileBarChart } from 'lucide-react';

/**
 * Reusable "Run Report" button for hub headers. Navigates to the Reporting Hub
 * with a `hub` query param so it opens pre-scoped to the relevant category.
 */
export default function RunReportButton({ hub }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate('/reports' + (hub ? '?hub=' + hub : ''))}
      type="button"
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition active:scale-[0.98]"
    >
      <FileBarChart className="w-4 h-4" /> <span className="hidden sm:inline">Run Report</span>
    </button>
  );
}