import React from 'react';
import {
  X, Wrench, Package, Truck, Anchor, Plug, Cog, ShieldCheck, ShieldAlert, ShieldX,
  HelpCircle, Pencil, ChevronRight, Link2, CalendarClock, RefreshCw,
} from 'lucide-react';
import { safeFormat } from '@/utils/format';
import { COMPLIANCE_META, ASSET_TYPE_META, daysUntil } from '@/utils/rigRollup';
import ServiceHistoryPanel from '@/components/compliance/ServiceHistoryPanel';
import CertificateVault from '@/components/righub/CertificateVault';
import AssetPandaInfoPanel from '@/components/righub/AssetPandaInfoPanel';

const TYPE_ICON = { rig: Cog, machinery: Wrench, trailer: Package, vehicle: Truck, lifting: Anchor, portable_appliance: Plug };

export default function EquipmentDetailDrawer({ equipment, parentRig, onClose, onOpenRig, onEdit, onRecert }) {
  if (!equipment) return null;
  const Icon = TYPE_ICON[equipment.asset_type] || Wrench;
  const meta = COMPLIANCE_META[equipment.compliance_status || 'unknown'];
  const CompIcon = equipment.compliance_status === 'expired' ? ShieldX : equipment.compliance_status === 'expiring' ? ShieldAlert : equipment.compliance_status === 'unknown' ? HelpCircle : ShieldCheck;
  const d = daysUntil(equipment.compliance_expiry_date);

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 pt-8 sm:pt-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white rounded-t-2xl z-10 border-b border-slate-200 px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 border bg-slate-50 border-slate-200">
              <Icon className="w-5 h-5 text-slate-600" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 truncate">{equipment.name}</h3>
              <p className="text-[11px] text-slate-400 truncate">{ASSET_TYPE_META[equipment.asset_type]?.label || equipment.asset_type}{equipment.equipment_type ? ` · ${equipment.equipment_type}` : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${meta.tone}`}>
              <CompIcon className="w-3.5 h-3.5" /> {meta.label}
            </span>
            {onEdit && (
              <button onClick={() => onEdit(equipment)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition">
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
            )}
            {onRecert && (
              <button onClick={() => onRecert(equipment)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-xs font-semibold transition">
                <RefreshCw className="w-3.5 h-3.5" /> Re-cert
              </button>
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Parent rig link — bidirectional navigation */}
          {parentRig ? (
            <button onClick={() => onOpenRig(parentRig)}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 transition text-left group">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0 shadow-sm">
                <Cog className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase font-bold text-emerald-700 flex items-center gap-1"><Link2 className="w-3 h-3" /> Linked to rig</p>
                <p className="text-sm font-semibold text-slate-800 truncate">{parentRig.name}</p>
                <p className="text-[11px] text-slate-400 truncate">{parentRig.rig_type?.toUpperCase()} rig system · click to view rig</p>
              </div>
              <ChevronRight className="w-5 h-5 text-emerald-500 group-hover:translate-x-0.5 transition flex-shrink-0" />
            </button>
          ) : (
            <div className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50">
              <Link2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <p className="text-xs text-slate-500">Not linked to any rig. Open a rig and use <strong>Link</strong> to attach this equipment.</p>
            </div>
          )}

          {/* Identity */}
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-[10px] uppercase font-bold text-slate-400 mb-2">Identity</p>
            <div className="flex flex-wrap gap-2 text-xs mb-3">
              <span className="font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded">{equipment.serial_number || 'No serial'}</span>
              {equipment.compliance_category && <span className="text-slate-600 bg-slate-100 px-2 py-1 rounded">{equipment.compliance_category}</span>}
              {!equipment.is_active && <span className="text-red-700 font-bold bg-red-50 px-2 py-1 rounded uppercase">Inactive</span>}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div className="flex justify-between"><span className="text-slate-500">Expiry</span><span className={`font-semibold ${d === null ? 'text-slate-700' : d < 0 ? 'text-red-600' : d <= 30 ? 'text-amber-600' : 'text-slate-700'}`}>{equipment.compliance_expiry_date ? safeFormat(equipment.compliance_expiry_date, 'dd MMM yyyy') : 'Lifetime'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Last service</span><span className="font-medium text-slate-700">{equipment.last_service_date ? safeFormat(equipment.last_service_date, 'dd MMM yyyy') : '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Next service</span><span className="font-medium text-slate-700">{equipment.next_service_date ? safeFormat(equipment.next_service_date, 'dd MMM yyyy') : '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Responsible</span><span className="font-medium text-slate-700">{equipment.responsible_person || '—'}</span></div>
              {equipment.storage_location && <div className="flex justify-between"><span className="text-slate-500">Storage</span><span className="font-medium text-slate-700 truncate ml-2">{equipment.storage_location}</span></div>}
              {equipment.colour && <div className="flex justify-between"><span className="text-slate-500">Colour</span><span className="font-medium text-slate-700 truncate ml-2">{equipment.colour}</span></div>}
              {equipment.maintenance_status && equipment.maintenance_status !== 'unknown' && <div className="flex justify-between"><span className="text-slate-500">Maintenance</span><span className={`font-semibold capitalize ${equipment.maintenance_status === 'overdue' ? 'text-red-600' : equipment.maintenance_status === 'due_soon' ? 'text-amber-600' : 'text-emerald-600'}`}>{equipment.maintenance_status.replace('_', ' ')}</span></div>}
            </div>
            {equipment.tooling_notes && <p className="text-xs text-slate-500 mt-2.5"><span className="font-semibold text-slate-600">Tooling:</span> {equipment.tooling_notes}</p>}
            {equipment.service_notes && <p className="text-xs text-slate-500 mt-1"><span className="font-semibold text-slate-600">Service:</span> {equipment.service_notes}</p>}
            {equipment.notes && <p className="text-xs text-slate-500 mt-1"><span className="font-semibold text-slate-600">Notes:</span> {equipment.notes}</p>}
            {equipment.repair_notes && <p className="text-xs text-slate-500 mt-1"><span className="font-semibold text-slate-600">Repair history:</span> {equipment.repair_notes}</p>}
          </div>

          {/* Asset Panda inventory source */}
          <AssetPandaInfoPanel asset={equipment} />

          {/* Certificate vault for this equipment */}
          <CertificateVault assetIds={[equipment.id]} assetNames={{ [equipment.id]: equipment.name }} />

          {/* Service history */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center border bg-white border-slate-200">
                <CalendarClock className="w-3.5 h-3.5 text-slate-600" />
              </div>
              <p className="text-xs font-semibold text-slate-800">Service & Inspection Timeline</p>
            </div>
            <div className="p-4">
              <ServiceHistoryPanel assetId={equipment.id} assetName={equipment.name} assetType={equipment.asset_type} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}