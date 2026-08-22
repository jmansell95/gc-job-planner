import React, { useState } from 'react';
import {
  FileBarChart, Receipt, Shield, TrendingUp,
} from 'lucide-react';
import SubTabNav from '@/components/SubTabNav';
import AFPBuilder from '@/components/afp/AFPBuilder';
import AFPControlsSubTab from '@/components/afp/AFPControlsSubTab';
import AFPCVRView from '@/components/afp/AFPCVRView';
import JobRateCardSubTab from '@/components/afp/JobRateCardSubTab';
import PricingReviewBanner from '@/components/billing/PricingReviewBanner';

/**
 * JobFinancialsTab — the redesigned Financials tab for job details.
 * Sub-tabs: AFP Builder (primary), Rate Card, Controls, CVR (read-only).
 * Shows the pricing review banner so pending log pricing is surfaced
 * right where the billing team is working on the job.
 */
export default function JobFinancialsTab({ job, canSeeCosts }) {
  const [finSub, setFinSub] = useState('afp-builder');

  return (
    <div className="space-y-3 mt-0">
      <SubTabNav
        tabs={[
          { id: 'afp-builder', label: 'AFP Builder', icon: FileBarChart },
          { id: 'rate-card', label: 'Rate Card', icon: Receipt },
          { id: 'controls', label: 'Controls', icon: Shield },
          { id: 'cvr', label: 'CVR', icon: TrendingUp },
        ]}
        activeTab={finSub}
        onChange={setFinSub}
      />

      {finSub === 'afp-builder' && (
        <>
          <PricingReviewBanner jobId={job?.id} />
          <AFPBuilder job={job} />
        </>
      )}

      {finSub === 'rate-card' && <JobRateCardSubTab job={job} />}

      {finSub === 'controls' && <AFPControlsSubTab job={job} canSeeCosts={canSeeCosts} />}

      {finSub === 'cvr' && <AFPCVRView job={job} />}
    </div>
  );
}