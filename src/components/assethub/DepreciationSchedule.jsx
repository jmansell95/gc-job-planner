import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { TrendingDown, Calendar, PoundSterling } from 'lucide-react';
import { Skeleton } from '@/components/StateViews';

const gbp = (n) => n != null ? '£' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '£0';

/**
 * Depreciation schedule table — shows every asset with an acquisition cost
 * and depreciation years, calculating annual depreciation, accumulated
 * depreciation to date, and current book value. Highlights assets due for
 * replacement (book value near salvage or replacement date within 90 days).
 */
export default function DepreciationSchedule() {
  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['site-assets-depreciation'],
    queryFn: () => base44.entities.SiteAsset.list('-acquisition_date', 500),
  });

  const { rows, totals, dueForReplacement } = useMemo(() => {
    const now = new Date();
    const rows = [];
    let totalAcquisition = 0;
    let totalBookValue = 0;
    let dueCount = 0;

    assets.forEach(a => {
      if (!a.acquisition_cost || !a.acquisition_date || !a.depreciation_years) return;

      const acquisitionDate = new Date(a.acquisition_date);
      const yearsElapsed = (now - acquisitionDate) / (365.25 * 86400000);
      const annualDep = a.acquisition_cost / a.depreciation_years;
      const accumulatedDep = Math.min(annualDep * yearsElapsed, a.acquisition_cost - (a.salvage_value || 0));
      const bookValue = Math.max(a.acquisition_cost - accumulatedDep, a.salvage_value || 0);
      const remainingYears = Math.max(a.depreciation_years - yearsElapsed, 0);

      totalAcquisition += a.acquisition_cost;
      totalBookValue += bookValue;

      const replacementDate = a.replacement_date ? new Date(a.replacement_date) : null;
      const daysToReplacement = replacementDate ? Math.floor((replacementDate - now) / 86400000) : null;
      const isDue = (bookValue <= (a.salvage_value || 0) + 1) || (daysToReplacement !== null && daysToReplacement <= 90 && daysToReplacement >= -365);

      if (isDue) dueCount++;

      rows.push({
        id: a.id,
        name: a.name,
        type: a.asset_type,
        acquisitionCost: a.acquisition_cost,
        acquisitionDate: a.acquisition_date,
        depreciationYears: a.depreciation_years,
        annualDep,
        accumulatedDep,
        bookValue,
        remainingYears: Math.round(remainingYears * 10) / 10,
        salvageValue: a.salvage_value || 0,
        replacementDate: a.replacement_date,
        daysToReplacement,
        isDue,
      });
    });

    rows.sort((a, b) => a.bookValue - b.bookValue);

    return { rows, totals: { totalAcquisition, totalBookValue, totalDepreciated: totalAcquisition - totalBookValue }, dueForReplacement: dueCount };
  }, [assets]);

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />;

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <TrendingDown className="w-8 h-8 mx-auto mb-2 text-slate-300" />
        <p className="text-sm text-slate-400">No assets with depreciation data yet.</p>
        <p className="text-xs text-slate-400 mt-1">Set acquisition cost and useful life on assets to see their depreciation schedule.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <PoundSterling className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-500">Acquisition Value</span>
          </div>
          <p className="text-lg font-bold text-slate-900 tabular-nums">{gbp(totals.totalAcquisition)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-slate-500">Depreciated</span>
          </div>
          <p className="text-lg font-bold text-amber-600 tabular-nums">{gbp(totals.totalDepreciated)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <PoundSterling className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-slate-500">Current Book Value</span>
          </div>
          <p className="text-lg font-bold text-emerald-600 tabular-nums">{gbp(totals.totalBookValue)}</p>
        </div>
      </div>

      {dueForReplacement > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-amber-600" />
          <p className="text-sm text-amber-800">
            <span className="font-semibold">{dueForReplacement}</span> asset{dueForReplacement !== 1 ? 's' : ''} due for replacement (book value near salvage or replacement date within 90 days).
          </p>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr className="text-left text-xs text-slate-500 font-semibold">
                <th className="px-4 py-2.5">Asset</th>
                <th className="px-4 py-2.5 text-right">Acquired</th>
                <th className="px-4 py-2.5 text-right">Cost</th>
                <th className="px-4 py-2.5 text-right">Annual Dep</th>
                <th className="px-4 py-2.5 text-right">Accumulated</th>
                <th className="px-4 py-2.5 text-right">Book Value</th>
                <th className="px-4 py-2.5 text-right">Remaining</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map(r => (
                <tr key={r.id} className={`hover:bg-slate-50 transition ${r.isDue ? 'bg-amber-50/50' : ''}`}>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-slate-900 truncate max-w-[200px]">{r.name}</p>
                    <p className="text-[10px] text-slate-400 capitalize">{r.type?.replace(/_/g, ' ')}</p>
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs text-slate-500 tabular-nums">
                    {r.acquisitionDate ? new Date(r.acquisitionDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{gbp(r.acquisitionCost)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{gbp(r.annualDep)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-amber-600">{gbp(r.accumulatedDep)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-bold text-slate-900">{gbp(r.bookValue)}</td>
                  <td className="px-4 py-2.5 text-right text-xs tabular-nums">
                    <span className={r.remainingYears < 1 ? 'text-rose-600 font-semibold' : 'text-slate-500'}>
                      {r.remainingYears}y
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}