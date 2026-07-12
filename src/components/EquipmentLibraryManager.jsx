import React, { useState } from 'react';
import { Package, Boxes } from 'lucide-react';
import EquipmentItemsTab from '@/components/EquipmentItemsTab';
import CostPresetManager from '@/components/CostPresetManager';

export default function EquipmentLibraryManager() {
  const [tab, setTab] = useState('items');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Package className="w-5 h-5 text-emerald-600" />
        <h2 className="font-bold text-slate-900">Equipment Library</h2>
      </div>
      <p className="text-sm text-slate-500 -mt-2">One place to manage all your equipment — individual items, rigs from GC Compliance, and pre-built sets. Everything here appears when adding equipment to jobs.</p>

      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-full sm:w-auto sm:inline-flex">
        <button onClick={() => setTab('items')} className={`flex-1 sm:flex-none inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition ${tab === 'items' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
          <Package className="w-4 h-4" /> Items
        </button>
        <button onClick={() => setTab('sets')} className={`flex-1 sm:flex-none inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition ${tab === 'sets' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
          <Boxes className="w-4 h-4" /> Sets
        </button>
      </div>

      {tab === 'items' ? <EquipmentItemsTab /> : <CostPresetManager />}
    </div>
  );
}