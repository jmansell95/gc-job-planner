import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, X, PoundSterling } from 'lucide-react';
import BulkRateEntryModal from './BulkRateEntryModal';

/**
 * Detects staff members with no personal day rate (RateCardItem with staff_id)
 * and shows a warning banner with a bulk-fix button. Resolves the known issue
 * where crew labour costs show as £0 because personal rates are missing.
 */
export default function MissingRatesBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [showBulkFix, setShowBulkFix] = useState(false);

  const { data: staff = [] } = useQuery({
    queryKey: ['staff-active'],
    queryFn: () => base44.entities.Staff.filter({ is_active: true }),
  });

  const { data: rateCards = [] } = useQuery({
    queryKey: ['rate-cards-personal'],
    queryFn: () => base44.entities.RateCardItem.filter({ category: 'labour', staff_id: { $exists: true } }),
  });

  if (dismissed || !staff.length) return null;

  const staffWithRates = new Set(rateCards.map(r => r.staff_id).filter(Boolean));
  const missing = staff.filter(s => !staffWithRates.has(s.id));

  if (missing.length === 0) return null;

  return (
    <>
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-3">
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-900">
            {missing.length} crew {missing.length === 1 ? 'member is' : 'members are'} missing a personal day rate
          </p>
          <p className="text-xs text-amber-700 mt-0.5">
            Their labour costs show as £0 on jobs and financials. Set rates to fix.
          </p>
        </div>
        <button
          onClick={() => setShowBulkFix(true)}
          className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition"
        >
          <PoundSterling className="w-4 h-4" />
          <span className="hidden sm:inline">Set Rates</span>
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 p-1.5 text-amber-500 hover:text-amber-700 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {showBulkFix && (
        <BulkRateEntryModal
          staff={missing}
          onClose={() => setShowBulkFix(false)}
        />
      )}
    </>
  );
}