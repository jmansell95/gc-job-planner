import React from 'react';
import { FlaskConical, Waves, Wrench, AlertTriangle } from 'lucide-react';
import SampleManager from '@/components/geotech/SampleManager';
import MonitoringWellManager from '@/components/geotech/MonitoringWellManager';
import EquipmentCalibrationManager from '@/components/geotech/EquipmentCalibrationManager';

export default function GeotechDataTab({ job, allStaff, suppliers, assets }) {
  return (
    <div className="space-y-4">
      {/* Intro banner */}
      <div className="bg-gradient-to-br from-emerald-50 to-blue-50 rounded-xl border border-emerald-200 p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center flex-shrink-0">
            <FlaskConical className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">Geotechnical Data Management</h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Sample chain of custody, laboratory test tracking, monitoring well installations, and field equipment calibration —
              the core data trail behind every ground investigation report.
            </p>
          </div>
        </div>
      </div>

      <SampleManager job={job} allStaff={allStaff} suppliers={suppliers} />
      <MonitoringWellManager job={job} allStaff={allStaff} />
      <EquipmentCalibrationManager job={job} assets={assets} />
    </div>
  );
}