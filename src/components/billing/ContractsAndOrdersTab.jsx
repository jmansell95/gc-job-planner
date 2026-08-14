import React, { useState } from 'react';
import { ScrollText, FileText } from 'lucide-react';
import SubTabNav from '@/components/SubTabNav';
import BillingContractManager from '@/components/settings/BillingContractManager';
import PurchaseOrderManager from '@/components/settings/PurchaseOrderManager';

/**
 * ContractsAndOrdersTab — merged tab combining Billing Contracts and
 * Purchase Orders into a single view with sub-tab navigation.
 * Contracts govern locked per-job billing terms; POs track supplier orders.
 */
export default function ContractsAndOrdersTab() {
  const [subTab, setSubTab] = useState('contracts');

  const subTabs = [
    { id: 'contracts', label: 'Billing Contracts', icon: ScrollText },
    { id: 'purchase-orders', label: 'Purchase Orders', icon: FileText },
  ];

  return (
    <div className="space-y-3">
      <SubTabNav tabs={subTabs} activeTab={subTab} onChange={setSubTab} />
      {subTab === 'contracts' && <BillingContractManager />}
      {subTab === 'purchase-orders' && <PurchaseOrderManager />}
    </div>
  );
}