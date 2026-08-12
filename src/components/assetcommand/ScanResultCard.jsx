import React from 'react';
import {
  CheckCircle2, AlertTriangle, XCircle, Truck, Wrench, Calendar,
  ShieldCheck, ShieldAlert, ShieldX, ArrowRight, Package, Clock,
} from 'lucide-react';
import { differenceInDays } from 'date-fns';

/**
 * ScanResultCard — Hilti ON!Track-style immediate actionable feedback.
 * Pops up the moment an asset is scanned, showing:
 *   - Asset identity (name, serial, type)
 *   - Live compliance status (green/amber/red)
 *   - Quick actions (Book to Vehicle, View Details, etc.)
 *   - Auto-dismisses after a few seconds or on next scan
 */
export default function ScanResultCard({ asset, onBookToVehicle, onViewDetails, onDismiss }) {
  if (!asset) return null;

  // Compliance status
  const expiryDate = asset.compliance_expiry_date;
  const daysToExpiry = expiryDate ? differenceInDays(new Date(expiryDate + 'T00:00:00'), new Date()) : null;
  const status = asset.compliance_status || 'unknown';

  const STATUS_META = {
    compliant: { Icon: ShieldCheck, color: 'emerald', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', label: 'Compliant' },
    expiring: { Icon: ShieldAlert, color: 'amber', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', label: 'Expiring Soon' },
    expired: { Icon: ShieldX, color: 'red', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', label: 'Expired' },
    unknown: { Icon: ShieldAlert, color: 'slate', bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', label: 'No Compliance Data' },
  };
  const statusMeta = STATUS_META[status] || STATUS_META.unknown;
  const StatusIcon = statusMeta.Icon;
  const canDispatch = status === 'compliant' || status === 'unknown';

  const TYPE_ICONS = {
    rig: Wrench, machinery: Wrench, trailer: Package, vehicle: Truck, lifting: Package, portable_appliance: Wrench,
  };
  const TypeIcon = TYPE_ICONS[asset.asset_type] || Package;

  return (
    <div className="animate-pop-in bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
      {/* Status bar */}
      <div className={`${statusMeta.bg} ${statusMeta.border} border-b px-4 py-2.5 flex items-center gap-2.5`}>
        <div className={`w-9 h-9 rounded-lg ${statusMeta.bg} border ${statusMeta.border} flex items-center justify-center flex-shrink-0`}>
          <StatusIcon className={`w-5 h-5 ${statusMeta.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold ${statusMeta.text}`}>{statusMeta.label}</p>
          {daysToExpiry !== null && (
            <p className="text-[11px] text-slate-500">
              {daysToExpiry >= 0 ? `Expires in ${daysToExpiry} days` : `Expired ${Math.abs(daysToExpiry)} days ago`}
              {' · '}{expiryDate}
            </p>
          )}
        </div>
        <button onClick={onDismiss} className="p-1.5 text-slate-400 hover:bg-white/50 rounded-lg transition flex-shrink-0">
          <XCircle className="w-4 h-4" />
        </button>
      </div>

      {/* Asset identity */}
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
          <TypeIcon className="w-5 h-5 text-slate-500" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900 truncate">{asset.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {asset.serial_number && (
              <span className="text-[11px] text-slate-500 font-mono">SN: {asset.serial_number}</span>
            )}
            {asset.equipment_type && (
              <span className="text-[11px] text-slate-400 truncate">· {asset.equipment_type}</span>
            )}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="px-4 pb-3 flex gap-2">
        <button
          onClick={() => onBookToVehicle?.(asset)}
          disabled={!canDispatch}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition ${
            canDispatch
              ? 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          <Truck className="w-3.5 h-3.5" /> Book to Vehicle
        </button>
        <button
          onClick={() => onViewDetails?.(asset)}
          className="px-3 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition active:scale-95"
        >
          Details
        </button>
      </div>

      {/* Block warning for non-compliant */}
      {!canDispatch && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-1.5 text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
            <AlertTriangle className="w-3 h-3 flex-shrink-0" />
            <span>Cannot dispatch — compliance expired. Log a new inspection to reactivate.</span>
          </div>
        </div>
      )}
    </div>
  );
}