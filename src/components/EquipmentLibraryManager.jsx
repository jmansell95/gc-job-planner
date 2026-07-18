import React from 'react';
import { Boxes, Info } from 'lucide-react';
import CostPresetManager from '@/components/CostPresetManager';

export default function EquipmentLibraryManager() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Boxes className="w-5 h-5 text-emerald-600" />
        <h2 className="font-bold text-slate-900">Equipment Sets</h2>
      </div>
      <p className="text-sm text-slate-500 -mt-2">Pre-built equipment sets you can apply to a job in one click. Individual assets (rigs, machinery, trailers, lifting gear) now sync automatically from Asset Panda into your Site Assets — manage them under Settings → Asset Compliance.</p>

      <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-xl p-3.5">
        <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-800">
          The standalone items library has been retired. Each set item can still link to a Site Asset (synced from Asset Panda) or a Rate Card item from the Master Price List. Build sets here, then apply them to jobs from the Logistics tab.
        </p>
      </div>

      <CostPresetManager />
    </div>
  );
}