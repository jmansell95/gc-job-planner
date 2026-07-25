import React from 'react';
import { ShieldCheck, ShieldAlert, ShieldX, FileText, Download, ExternalLink, Cog, Anchor, Wrench, Package, Truck, Layers, X, FileCheck2, Calendar, HelpCircle } from 'lucide-react';
import { formatComplianceDate } from '@/utils/complianceDate';

const complianceBadge = {
  compliant: { label: 'Compliant', icon: ShieldCheck, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  expiring: { label: 'Expiring', icon: ShieldAlert, cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  expired: { label: 'Expired', icon: ShieldX, cls: 'bg-red-50 text-red-700 border-red-200' },
  unknown: { label: 'Unknown', icon: HelpCircle, cls: 'bg-slate-100 text-slate-500 border-slate-200' },
};

const assetTypeIcon = { rig: Cog, machinery: Wrench, trailer: Package, vehicle: Truck, lifting: Anchor };

// A focused modal showing every compliance certificate attached to the
// equipment assigned to a job. Staff use this to view and download rig
// certificates (LOLER, PUWER, insurance etc.) before or during a shift.
export default function RigCertificateModal({ open, assets = [], complianceItems = [], onClose }) {
  if (!open) return null;

  const itemsByRef = {};
  complianceItems.forEach(ci => {
    if (ci.reference_id) {
      if (!itemsByRef[ci.reference_id]) itemsByRef[ci.reference_id] = [];
      itemsByRef[ci.reference_id].push(ci);
    }
  });

  // Rigs first, then lifting gear, then everything else
  const ordered = [...assets].sort((a, b) => {
    const rank = { rig: 0, lifting: 1 };
    return (rank[a.asset_type] ?? 9) - (rank[b.asset_type] ?? 9);
  });

  const totalCerts = ordered.reduce((sum, a) => sum + (itemsByRef[a.id] || []).filter(ci => ci.document_url).length, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
              <FileCheck2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Rig Certificates</h2>
              <p className="text-xs text-slate-500">{totalCerts} certificate{totalCerts !== 1 ? 's' : ''} across {ordered.length} asset{ordered.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-5 py-4 space-y-4 flex-1">
          {ordered.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">No equipment assigned to this job yet.</p>
          )}
          {ordered.map(asset => {
            const TypeIcon = assetTypeIcon[asset.asset_type] || Layers;
            const status = asset.compliance_status || 'unknown';
            const cb = complianceBadge[status] || complianceBadge.unknown;
            const CompIcon = cb.icon;
            const certItems = (itemsByRef[asset.id] || []).filter(ci => ci.document_url);
            const isRig = asset.asset_type === 'rig' || asset.rig_type === 'cp' || asset.rig_type === 'rotary';

            return (
              <div key={asset.id} className="rounded-xl border border-slate-200 overflow-hidden">
                {/* Asset header */}
                <div className={`flex items-center gap-2.5 px-3.5 py-2.5 ${isRig ? 'bg-emerald-50/60' : 'bg-slate-50'}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isRig ? 'bg-emerald-100' : 'bg-white border border-slate-200'}`}>
                    <TypeIcon className={`w-4 h-4 ${isRig ? 'text-emerald-600' : 'text-slate-500'}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 truncate">{asset.name}</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {asset.serial_number && <span className="text-[10px] text-slate-400 font-mono truncate">{asset.serial_number}</span>}
                      {asset.equipment_type && <span className="text-[10px] text-emerald-600 font-medium truncate">{asset.equipment_type}</span>}
                      {isRig && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold uppercase tracking-wide">Rig</span>}
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-1 rounded-full font-medium inline-flex items-center gap-1 border flex-shrink-0 ${cb.cls}`}>
                    <CompIcon className="w-3 h-3" /> {cb.label}
                  </span>
                </div>

                {/* Certificates */}
                <div className="px-3.5 py-3">
                  {certItems.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No certificate on file for this asset.</p>
                  ) : (
                    <div className="space-y-2">
                      {certItems.map(ci => (
                        <div key={ci.id} className="flex items-center gap-2 p-2.5 bg-white border border-slate-200 rounded-lg hover:border-emerald-300 transition">
                          <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                            <FileText className="w-4 h-4 text-emerald-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-800 truncate">{ci.title || ci.document_name || 'Certificate'}</p>
                            <div className="flex items-center gap-2 flex-wrap mt-0.5">
                              {ci.document_name && (
                                <span className="text-[10px] text-slate-400 truncate max-w-[140px]">{ci.document_name}</span>
                              )}
                              {ci.expiry_date && ci.status_override !== 'not_required' && (
                                <span className="text-[10px] text-slate-500 inline-flex items-center gap-0.5">
                                  <Calendar className="w-2.5 h-2.5" /> Exp {formatComplianceDate(ci.expiry_date)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <a href={ci.document_url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 active:scale-95 transition">
                              <ExternalLink className="w-3.5 h-3.5" /> View
                            </a>
                            <a href={ci.document_url} download={ci.document_name || undefined}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-200 active:scale-95 transition">
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
          <p className="text-[11px] text-slate-400">Certificates are synced from the GC Compliance Manager.</p>
          <button onClick={onClose} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}