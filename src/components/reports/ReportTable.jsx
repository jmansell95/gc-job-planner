import React from 'react';
import { EmptyState } from '@/components/StateViews';

export default function ReportTable({ report, emptyIcon: Icon }) {
  if (!report) return null;
  if (report.rows.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <EmptyState icon={Icon} title="No data" message="No timesheets match the selected filters. Try widening the date range." />
      </div>
    );
  }
  const alignClass = (a) => a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left';
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {report.columns.map(c => (
                <th key={c.key} className={`px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide whitespace-nowrap ${alignClass(c.align)}`}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {report.rows.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                {row.map((val, j) => (
                  <td key={j} className={`px-4 py-2.5 text-slate-700 whitespace-nowrap ${alignClass(report.columns[j]?.align)}`}>{val}</td>
                ))}
              </tr>
            ))}
          </tbody>
          {report.totals && (
            <tfoot>
              <tr className="bg-emerald-50 border-t-2 border-emerald-200 font-bold text-slate-900">
                {report.totals.map((val, j) => (
                  <td key={j} className={`px-4 py-3 whitespace-nowrap ${alignClass(report.columns[j]?.align)}`}>{val}</td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}