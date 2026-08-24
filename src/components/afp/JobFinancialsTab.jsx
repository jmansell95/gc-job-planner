import React, { useState } from 'react';
import {
  FileBarChart, Receipt, TrendingUp, GitBranch, FileText,
} from 'lucide-react';
import SubTabNav from '@/components/SubTabNav';
import AFPBuilder from '@/components/afp/AFPBuilder';
import AFPControlsSubTab from '@/components/afp/AFPControlsSubTab';
import AFPCVRView from '@/components/afp/AFPCVRView';
import AFPVariationLifecycleTab from '@/components/afp/AFPVariationLifecycleTab';
import JobRateCardSubTab from '@/components/afp/JobRateCardSubTab';
import PricingReviewBanner from '@/components/billing/PricingReviewBanner';

/**
 * JobFinancialsTab — the Financials tab for job details.
 * Sub-tabs follow the billing lifecycle order:
 * AFP Builder → Variations → CVR → Contract/BOQ → Rate Card.
 */
export default function JobFinancialsTab({ job, canSeeCosts }) {
  const [finSub, setFinSub] = useState('afp-builder');

  return (
    <div className="space-y-3 mt-0">
      <SubTabNav
        tabs={[
          { id: 'afp-builder', label: 'AFP Builder', icon: FileBarChart },
          { id: 'variations', label: 'Variations', icon: GitBranch },
          { id: 'cvr', label: 'CVR', icon: TrendingUp },
          { id: 'boq', label: 'Contract/BOQ', icon: FileText },
          { id: 'rate-card', label: 'Rate Card', icon: Receipt },
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

      {finSub === 'variations' && <AFPVariationLifecycleTab job={job} />}

      {finSub === 'cvr' && <AFPCVRView job={job} onSelectAfp={() => setFinSub('afp-builder')} />}

      {finSub === 'boq' && <AFPControlsSubTab job={job} canSeeCosts={canSeeCosts} />}

      {finSub === 'rate-card' && <JobRateCardSubTab job={job} />}
    </div>
  );
}