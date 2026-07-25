import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, ShieldX, FileText, ExternalLink, Cog, Anchor, Wrench, Package, Truck, Layers, FileCheck2, ChevronRight, HelpCircle } from 'lucide-react';
import RigCertificateModal from '@/components/staff/RigCertificateModal';

const complianceBadge = {
  compliant: { label: 'Compliant', icon: ShieldCheck, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  expiring: { label: 'Expiring', icon: ShieldAlert, cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  expired: { label: 'Expired', icon: ShieldX, cls: 'bg-red-50 text-red-700 border-red-200' },
  unknown: { label: 'Unknown', icon: HelpCircle, cls: 'bg-slate-100 text-slate-500 border-slate-200' },
};

const assetTypeIcon = { rig: Cog, machinery: Wrench, trailer: Package, vehicle: Truck, lifting: Anchor };

// Renders equipment assigned to a job with compliance status + a prominent
// certificate viewer so field staff can view and download rig certificates.
// `assets` = SiteAsset records (or JobAssetAssignment snapshot objects).
// `complianceItems` = ComplianceItem records with category 'equipment'.
export default function EquipmentComplianceSection({ assets = [], complianceItems = [] }) {
  const [modalOpen, setModalOpen] = useState(false);

  const itemsByRef = {};
  complianceItems.forEach(ci => {
    if (ci.reference_id) {
      if (!itemsByRef[ci.reference_id]) itemsByRef[ci.reference_id] = [];
      itemsByRef[ci.reference_id].push(ci);
    }
  });

  // Count certificates available across all assets
  const totalCerts = assets.reduce((sum, a) => sum + (itemsByRef[a.id] || []).filter(ci => ci.document_url).length, 0);
  const rigCount = assets.filter(a => a.asset_type === 'rig' || a.rig_type === 'cp' || a.rig_type === 'rotary').length;

  if (assets.length === 0) {
    return <p className="text-xs text-slate-400 italic">No equipment assigned to this job yet.</p>;
  }

  return (
    <>
      <div className="space-y-2">
        {assets.map(asset => {
          const status = asset.compliance_status || 'unknown';
          const cb = complianceBadge[status] || complianceBadge.unknown;
          const CompIcon = cb.icon;
          const TypeIcon = assetTypeIcon[asset.asset_type] || Layers;
          const certItems = (itemsByRef[asset.id] || []).filter(ci => ci.document_url);
          const isRig = asset.asset_type === 'rig' || asset.rig_type === 'cp' || asset.rig_type === 'rotary';

          return (
            <div key={asset.id} className={`flex items-center gap-2.5 py-2 px-3 rounded-lg ${isRig ? 'bg-emerald-50/50 ring-1 ring-emerald-100' : 'bg-slate-50'}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isRig ? 'bg-emerald-100' : 'bg-white border border-slate-200'}`}>
                <TypeIcon className={`w-4 h-4 ${isRig ? 'text-emerald-600' : 'text-slate-400'}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold text-slate-800 truncate">{asset.name}</p>
                  {isRig && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold uppercase tracking-wide">Rig</span>}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {asset.serial_number && <span className="text-[10px] text-slate-400 font-mono truncate">{asset.serial_number}</span>}
                  {asset.equipment_type && <span className="text-[10px] text-emerald-600 font-medium truncate">{asset.equipment_type}</span>}
                </div>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5 border flex-shrink-0 ${cb.cls}`}>
                <CompIcon className="w-2.5 h-2.5" /> {cb.label}
              </span>
              {certItems.length > 0 && (
                <a href={certItems[0].document_url} target="_blank" rel="noopener noreferrer"
                  className="text-[10px] px-2 py-1 rounded-full font-semibold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border border-emerald-200 inline-flex items-center gap-1 flex-shrink-0 transition active:scale-95">
                  <FileText className="w-3 h-3" /> {certItems.length === 1 ? 'Cert' : `${certItems.length}`}
                </a>
              )}
            </div>
          );
        })}
      </div>

      {/* Prominent View Certificates button — opens the full modal */}
      {totalCerts > 0 && (
        <button onClick={() => setModalOpen(true)}
          className="mt-2.5 w-full flex items-center justify-between gap-2 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition active:scale-[0.98] shadow-sm">
          <span className="flex items-center gap-2">
            <FileCheck2 className="w-4 h-4" />
            View & Download Certificates
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded-full tabular-nums">{totalCerts}</span>
            <ChevronRight className="w-4 h-4" />
          </span>
        </button>
      )}
      {totalCerts === 0 && rigCount > 0 && (
        <p className="mt-2 text-[11px] text-slate-400 italic">No certificates on file for the assigned rig{rigCount > 1 ? 's' : ''}.</p>
      )}

      <RigCertificateModal open={modalOpen} assets={assets} complianceItems={complianceItems} onClose={() => setModalOpen(false)} />
    </>
  );
}