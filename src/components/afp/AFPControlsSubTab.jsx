import React from 'react';
import BOQManager from '@/components/billing/BOQManager';

/**
 * AFPControlsSubTab — the 'Controls' sub-tab in the job Financials tab.
 * Contains the BOQ (Bill of Quantities) which defines the contract value,
 * budget, and expected line items that seed the AFP.
 * Company-wide billing rules, markup rules, and billing contracts remain
 * in Enterprise Settings.
 */
export default function AFPControlsSubTab({ job, canSeeCosts }) {
  return (
    <div className="space-y-3">
      <BOQManager job={job} />
    </div>
  );
}