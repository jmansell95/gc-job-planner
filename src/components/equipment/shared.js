import { Truck, ShoppingCart, Wrench, HardHat, Hammer } from 'lucide-react';

export const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm";

export const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const categoryConfig = {
  hired_equipment: { label: 'Hired Equipment', icon: Truck, desc: 'Hired from a supplier', color: 'amber' },
  purchased_equipment: { label: 'Purchased Equipment', icon: ShoppingCart, desc: 'Bought for this job (needs PO + order slip)', color: 'purple' },
  internal_equipment: { label: 'Owned Equipment', icon: Wrench, desc: 'Owned by us (synced from Asset Panda)', color: 'blue' },
  contractor_supplied: { label: 'Contractor Supplied', icon: HardHat, desc: 'Supplied by the contractor — no cost tracked', color: 'indigo' },
  client_supplied: { label: 'Client Supplied', icon: Hammer, desc: 'Delivered by client — informational only', color: 'slate' },
};