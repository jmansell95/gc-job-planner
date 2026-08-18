import React from 'react';
import {
  Hash, Palette, Warehouse, User, Cog, Link2, ChevronRight,
  Activity, Clock, MapPin, Briefcase, Database, Wrench, Package, Anchor, Plug,
} from 'lucide-react';
import { safeFormat } from '@/utils/format';
import ComplianceCountdownRing from './ComplianceCountdownRing';
import MaintenanceGauge from './MaintenanceGauge';
import AssetPandaInfoPanel from '@/components/righub/AssetPandaInfoPanel';

function InfoRow({ icon: Icon, label, value, mono }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-500 flex items-center gap-2">
        {Icon && <Icon className="w-3.5 h-3.5 text-slate-400" />} {label}
      </span>
      <span className={`text-xs font-semibold text-slate-800 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

/**
 * Overview tab — identity card, compliance ring, maintenance gauge,
 * current deployment, linked equipment, and Asset Panda info.
 */
export default function AssetOverviewTab({ asset, linkedItems = [], currentDeployment, currentJob, onOpenLinked }) {
  const showHoursGauge = (asset.asset_type === 'rig' || asset.asset_type === 'machinery') && asset.service_interval_hours;

  return (
    <div className="space-y-4">
      {/* Identity + Compliance ring side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Identity card */}
        <div className="insight-card rounded-2xl p-4">
          <h3 className="text-sm font-extrabold text-slate-900 mb-3 flex items-center gap-2">
            <Cog className="w-4 h-4 text-[#2E5A1A]" /> Identity
          </h3>
          <InfoRow icon={Hash} label="Serial / Tag" value={asset.serial_number} mono />
          <InfoRow icon={Palette} label="Colour" value={asset.colour} />
          <InfoRow icon={Warehouse} label="Storage Location" value={asset.storage_location} />
          <InfoRow icon={User} label="Responsible Person" value={asset.responsible_person} />
          <InfoRow icon={Wrench} label="Equipment Type" value={asset.equipment_type} />
          <InfoRow icon={Activity} label="Compliance Category" value={asset.compliance_category} />
          {asset.rig_type && asset.rig_type !== 'n/a' && <InfoRow icon={Cog} label="Rig Type" value={asset.rig_type.toUpperCase()} />}
          {asset.acquisition_date && <InfoRow icon={Clock} label="Acquired" value={safeFormat(asset.acquisition_date, 'dd MMM yyyy')} />}
        </div>

        {/* Compliance + Maintenance */}
        <div className="insight-card rounded-2xl p-4">
          <h3 className="text-sm font-extrabold text-slate-900 mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#2E5A1A]" /> Health
          </h3>
          <div className="flex flex-col items-center gap-4">
            <ComplianceCountdownRing expiryDate={asset.compliance_expiry_date} size={128} />
            <div className="text-center">
              <p className="text-xs text-slate-500">Compliance expires</p>
              <p className="text-sm font-bold text-slate-800">
                {asset.compliance_expiry_date ? safeFormat(asset.compliance_expiry_date, 'dd MMM yyyy') : 'No date on file'}
              </p>
            </div>
            {showHoursGauge && (
              <div className="w-full pt-2 border-t border-slate-100">
                <MaintenanceGauge
                  hoursSince={asset.hours_since_last_service || 0}
                  intervalHours={asset.service_interval_hours || 250}
                />
                <div className="flex items-center justify-between mt-2 text-xs">
                  <span className="text-slate-500">Total hours: <strong className="text-slate-800">{Math.round(asset.operating_hours || 0)}h</strong></span>
                  <span className="text-slate-500">Next service: <strong className="text-slate-800">{asset.next_service_date ? safeFormat(asset.next_service_date, 'dd MMM') : '—'}</strong></span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Current deployment */}
      <div className="insight-card rounded-2xl p-4">
        <h3 className="text-sm font-extrabold text-slate-900 mb-3 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-[#2E5A1A]" /> Current Deployment
        </h3>
        {currentDeployment && currentJob ? (
          <div className="flex items-center gap-3 bg-blue-50 rounded-xl p-3 border border-blue-100">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Briefcase className="w-5 h-5 text-blue-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900 truncate">{currentJob.name}</p>
              <p className="text-xs text-slate-500 truncate">{currentJob.location || 'No location'}</p>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-blue-600 text-white flex-shrink-0">
              {currentDeployment.status === 'on_site' ? 'On Site' : 'Assigned'}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-3 bg-emerald-50 rounded-xl p-3 border border-emerald-100">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <Warehouse className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">In Yard / Available</p>
              <p className="text-xs text-slate-500">Not currently assigned to a job</p>
            </div>
          </div>
        )}
      </div>

      {/* Linked equipment (rigs only) */}
      {asset.asset_type === 'rig' && linkedItems.length > 0 && (
        <div className="insight-card rounded-2xl p-4">
          <h3 className="text-sm font-extrabold text-slate-900 mb-3 flex items-center gap-2">
            <Link2 className="w-4 h-4 text-[#2E5A1A]" /> Linked Equipment ({linkedItems.length})
          </h3>
          <div className="space-y-2">
            {linkedItems.map(item => (
              <button
                key={item.id}
                onClick={() => onOpenLinked?.(item.id)}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
                  {(() => {
                    const TIcon = { machinery: Wrench, trailer: Package, lifting: Anchor, portable_appliance: Plug }[item.asset_type] || Cog;
                    return <TIcon className="w-4 h-4 text-slate-500" />;
                  })()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800 truncate">{item.name}</p>
                  <p className="text-[11px] text-slate-400 truncate">{item.equipment_type || item.asset_type}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Asset Panda info */}
      {asset.panda_asset_id && (
        <AssetPandaInfoPanel asset={asset} />
      )}

      {/* Tooling notes */}
      {asset.tooling_notes && (
        <div className="insight-card rounded-2xl p-4">
          <h3 className="text-sm font-extrabold text-slate-900 mb-2 flex items-center gap-2">
            <Wrench className="w-4 h-4 text-[#2E5A1A]" /> Tooling Notes
          </h3>
          <p className="text-sm text-slate-600 whitespace-pre-wrap">{asset.tooling_notes}</p>
        </div>
      )}

      {/* General notes */}
      {asset.notes && (
        <div className="insight-card rounded-2xl p-4">
          <h3 className="text-sm font-extrabold text-slate-900 mb-2 flex items-center gap-2">
            <Database className="w-4 h-4 text-[#2E5A1A]" /> Notes
          </h3>
          <p className="text-sm text-slate-600 whitespace-pre-wrap">{asset.notes}</p>
        </div>
      )}
    </div>
  );
}