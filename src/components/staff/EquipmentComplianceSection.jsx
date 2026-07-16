import React from 'react';
import { ShieldCheck, ShieldAlert, ShieldX, FileText, ExternalLink, Cog, Anchor, Wrench, Package, Truck, Layers } from 'lucide-react';
import { formatComplianceDate } from '@/utils/complianceDate';

const complianceBadge = {
  compliant: { label: 'Compliant', icon: ShieldCheck, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  expiring: { label: 'Expiring', icon: ShieldAlert, cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  expired: { label: 'Expired', icon: ShieldX, cls: 'bg-red-50 text-red-700 border-red-200' },
  unknown: { label: 'Unknown', icon: ShieldCheck, cls: 'bg-slate-100 text-slate-500 border-slate-200' },
};

const assetTypeIcon = { rig: Cog, machinery: Wrench, trailer: Package, vehicle: Truck, lifting: Anchor };

// Renders equipment assigned to a job with compliance status + certificate links.
// `assets` = SiteAsset records (or JobAssetAssignment snapshot objects with id/name/asset_type/compliance_status).
// `complianceItems` = ComplianceItem records with category 'equipment'.
export default function EquipmentComplianceSection({ assets = [], complianceItems = [] }) {
  // Build map of compliance items by reference_id (asset id)
  const itemsByRef = {};
  complianceItems.forEach(ci => {
    if (ci.reference_id) {
      if (!itemsByRef[ci.reference_id]) itemsByRef[ci.reference_id] = [];
      itemsByRef[ci.reference_id].push(ci);
    }
  });

  if (assets.length === 0) {
    return <p className="text-xs text-slate-400 italic">No equipment assigned to this job yet.</p>;
  }

  return (
    <div className="space-y-1.5">
      {assets.map(asset => {
        const status = asset.compliance_status || 'unknown';
        const cb = complianceBadge[status] || complianceBadge.unknown;
        const CompIcon = cb.icon;
        const TypeIcon = assetTypeIcon[asset.asset_type] || Layers;
        const certItems = (itemsByRef[asset.id] || []).filter(ci => ci.document_url);
        const primaryCert = certItems[0];
        return (
          <div key={asset.id} className="flex items-center gap-2 py-1.5 px-2.5 bg-slate-50 rounded-md">
            <TypeIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-700 truncate">{asset.name}</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {asset.serial_number && <span className="text-[10px] text-slate-400 font-mono truncate">{asset.serial_number}</span>}
                {asset.equipment_type && <span className="text-[10px] text-emerald-600 font-medium truncate">{asset.equipment_type}</span>}
              </div>
            </div>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5 border flex-shrink-0 ${cb.cls}`}>
              <CompIcon className="w-2.5 h-2.5" /> {cb.label}
            </span>
            {primaryCert && (
              <a href={primaryCert.document_url} target="_blank" rel="noopener noreferrer"
                className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 inline-flex items-center gap-0.5 flex-shrink-0">
                <FileText className="w-2.5 h-2.5" /> Cert <ExternalLink className="w-2 h-2" />
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}