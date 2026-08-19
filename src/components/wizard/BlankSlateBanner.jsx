import React from 'react';
import { Info } from 'lucide-react';

/**
 * BlankSlateBanner — shown at each step of the Division Wizard to make it
 * unmistakably clear that launching a new business stream creates ONLY its structure
 * (hubs, navigation, settings). No jobs, staff, rotas, timesheets, vehicles or
 * any operational data are copied or seeded — the division starts completely
 * blank and is filled in by admins working within it after launch.
 */
export default function BlankSlateBanner({ stepLabel }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-3 mb-1">
      <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-[12px] font-bold text-amber-800 leading-snug">
          This business stream starts with a blank slate
        </p>
        <p className="text-[11px] text-amber-700/90 leading-snug mt-0.5">
          {stepLabel ? `${stepLabel} — ` : ''}Launching this business stream creates its structure only
          (hubs, navigation and settings). No jobs, staff, rotas, timesheets or vehicles are copied
          or seeded. You'll add operational data after launch by working within the business stream.
        </p>
      </div>
    </div>
  );
}