import React from 'react';
import { Plug } from 'lucide-react';
import PATTestingPanel from '@/components/pat/PATTestingPanel';
import PageHeader from '@/components/PageHeader';

/**
 * PAT Testing Console — standalone page wrapper.
 *
 * The actual PAT testing workspace lives in PATTestingPanel so it can be
 * embedded as a sub-tab inside the Asset Hub. This page just wraps it with
 * a PageHeader for when users navigate to /pat-testing directly.
 */
export default function PATTestingConsole() {
  return (
    <div className="space-y-4">
      <PageHeader
        icon={Plug}
        title="PAT Testing Console"
        subtitle="Portable appliance testing queue & labels"
      />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
        <PATTestingPanel />
      </div>
    </div>
  );
}