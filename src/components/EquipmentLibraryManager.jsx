import React from 'react';
import { Boxes, Info } from 'lucide-react';
import CostPresetManager from '@/components/CostPresetManager';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';

export default function EquipmentLibraryManager() {
  return (
    <div className="space-y-4">
      <SettingsSectionHeader icon={Boxes} title="Equipment Sets" description="Pre-built equipment sets you can apply to a job in one click. Individual assets sync automatically from Asset Panda into your Site Assets." />

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