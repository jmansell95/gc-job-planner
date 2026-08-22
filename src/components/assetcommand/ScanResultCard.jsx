import React from 'react';
import {
  CheckCircle2, AlertTriangle, XCircle, Truck, Wrench, Navigation,
  ShieldCheck, ShieldAlert, ShieldX, ArrowRight, Package, Clock,
  MapPin, Database, Gauge, CalendarClock, Cog, Anchor, Plug,
} from 'lucide-react';
import { differenceInDays } from 'date-fns';

const TYPE_ICONS = {
  rig: Cog, machinery: Wrench, trailer: Package, vehicle: Truck,
  lifting: Anchor, portable_appliance: Plug,
};

const MAINT_META = {
  ok: { Icon: CheckCircle2, tint: 'text-emerald-600 bg-emerald-50', label: 'Serviced' },
  due_soon: { Icon: CalendarClock, tint: 'text-amber-600 bg-amber-50', label: 'Service Due' },
  overdue: { Icon: ShieldX, tint: 'text-red-600 bg-red-50', label: 'Overdue' },
  unknown: { Icon: CalendarClock, tint: 'text-slate-500 bg-slate-50', label: 'No Data' },
};

/**
 * ScanResultCard — premium Hilti ON!Track-style immediate actionable feedback.
 * Pops up the moment an asset is scanned with rich information density:
 *   - Gradient status header with compliance + maintenance badges
 *   - Asset identity with type icon, serial, equipment type
 *   - Info grid: storage location, stock level, operating hours, last service
 *   - Large action buttons: Start Shift / Book to Vehicle / Details / Report Fault
 */
export default function ScanResultCard({ asset, onBookToVehicle, onDriveAway, onOpenCommand, onReportFault, onDismiss, refreshing }) {
  if (!asset) return null;

  const expiryDate = asset.compliance_expiry_date;
  const daysToExpiry = expiryDate ? differenceInDays(new Date(expiryDate + 'T00:00:00'), new Date()) : null;
  const status = asset.compliance_status || 'unknown';
  const maintStatus = asset.maintenance_status || 'unknown';

  const STATUS_META = {
    compliant: { Icon: ShieldCheck, gradient: 'from-emerald-500 to-green-600', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', label: 'Compliant', glow: 'glow-emerald' },
    expiring: { Icon: ShieldAlert, gradient: 'from-amber-500 to-orange-500', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', label: 'Expiring Soon', glow: 'glow-amber' },
    expired: { Icon: ShieldX, gradient: 'from-red-500 to-rose-600', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', label: 'Expired', glow: 'glow-rose' },
    unknown: { Icon: ShieldAlert, gradient: 'from-slate-400 to-slate-500', bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', label: 'No Data', glow: '' },
  };
  const statusMeta = STATUS_META[status] || STATUS_META.unknown;
  const StatusIcon = statusMeta.Icon;
  const maintMeta = MAINT_META[maintStatus] || MAINT_META.unknown;
  const MaintIcon = maintMeta.Icon;
  const canDispatch = status === 'compliant' || status === 'unknown';

  const isDriveable = asset.asset_type === 'rig' || asset.asset_type === 'vehicle';
  const TypeIcon = TYPE_ICONS[asset.asset_type] || Package;

  const infoItems = [];
  if (asset.storage_location) infoItems.push({ Icon: MapPin, label: 'Location', value: asset.storage_location });
  if (asset.stock_level && asset.stock_level !== 'unknown') infoItems.push({ Icon: Database, label: 'Stock', value: asset.stock_level.replace(/_/g, ' ') });
  if (asset.operating_hours != null && asset.asset_type === 'rig') infoItems.push({ Icon: Gauge, label: 'Hours', value: `${asset.operating_hours}h` });
  if (asset.last_service_date) infoItems.push({ Icon: MaintIcon, label: 'Last Service', value: asset.last_service_date });

  return (
    <div className="animate-pop-in bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
      {/* Refreshing shimmer bar */}
      {refreshing && (
        <div className="h-1 w-full bg-emerald-50 overflow-hidden">
          <div className="h-full w-1/3 bg-emerald-400 shimmer rounded-full" />
        </div>
      )}
      {/* Gradient status header */}
      <div className={`bg-gradient-to-r ${statusMeta.gradient} px-4 py-3 flex items-center gap-3`}>
        <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
          <StatusIcon className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">{statusMeta.label}</p>
          {daysToExpiry !== null && (
            <p className="text-[11px] text-white/80">
              {daysToExpiry >= 0 ? `${daysToExpiry} days remaining` : `Expired ${Math.abs(daysToExpiry)} days ago`}
            </p>
          )}
        </div>
        {!asset.is_active && (
          <span className="text-[10px] font-bold text-white bg-white/20 px-2 py-1 rounded-full uppercase">Inactive</span>
        )}
        <button onClick={onDismiss} className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition flex-shrink-0">
          <XCircle className="w-4 h-4" />
        </button>
      </div>

      {/* Asset identity */}
      <div className="px-4 py-3.5 flex items-center gap-3 border-b border-slate-100">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {(() => {
            const photo = asset.panda_image_urls?.[0];
            const photoUrl = photo?.thumb || photo?.medium || photo?.url;
            return photoUrl ? <img src={photoUrl} alt={asset.name} className="w-full h-full object-cover" /> : <TypeIcon className="w-6 h-6 text-slate-600" />;
          })()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-slate-900 truncate">{asset.name}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {asset.serial_number && (
              <span className="text-[11px] text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded">{asset.serial_number}</span>
            )}
            {asset.equipment_type && (
              <span className="text-[11px] text-slate-400 truncate">{asset.equipment_type}</span>
            )}
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${maintMeta.tint} flex-shrink-0`}>
          <MaintIcon className="w-3 h-3" /> {maintMeta.label}
        </span>
      </div>

      {/* Info grid */}
      {infoItems.length > 0 && (
        <div className="px-4 py-3 grid grid-cols-2 gap-2.5 border-b border-slate-100">
          {infoItems.map((item, i) => {
            const Icon = item.Icon;
            return (
              <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-2.5 py-2">
                <Icon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wide">{item.label}</p>
                  <p className="text-[11px] font-semibold text-slate-700 truncate">{item.value}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick actions */}
      <div className="px-4 py-3 flex gap-2">
        {isDriveable ? (
          <button
            onClick={() => onDriveAway?.(asset)}
            disabled={!canDispatch}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-3 rounded-xl text-sm font-bold transition active:scale-95 ${
              canDispatch
                ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white hover:from-emerald-700 hover:to-green-700 shadow-sm'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Navigation className="w-4 h-4" /> Start Shift
          </button>
        ) : (
          <button
            onClick={() => onBookToVehicle?.(asset)}
            disabled={!canDispatch}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-3 rounded-xl text-sm font-bold transition active:scale-95 ${
              canDispatch
                ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white hover:from-emerald-700 hover:to-green-700 shadow-sm'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Truck className="w-4 h-4" /> Book to Vehicle
          </button>
        )}
        {onReportFault && (
          <button
            onClick={() => onReportFault?.(asset)}
            className="px-3 py-3 bg-amber-100 text-amber-700 rounded-xl text-sm font-bold hover:bg-amber-200 transition active:scale-95"
            title="Report Fault"
          >
            <AlertTriangle className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={() => onOpenCommand?.(asset)}
          className="px-3 py-3 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition active:scale-95"
          title="Full Details"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Block warning for non-compliant */}
      {!canDispatch && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-1.5 text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-2">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="font-medium">Cannot dispatch — compliance expired. Log a new inspection to reactivate.</span>
          </div>
        </div>
      )}
    </div>
  );
}