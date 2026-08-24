import React from 'react';
import {
  Cog, Wrench, Package, Truck, Anchor, Plug,
  ShieldCheck, ShieldAlert, ShieldX, HelpCircle,
  ArrowLeft, Pencil, RefreshCw, QrCode, Hash, Weight, Upload,
} from 'lucide-react';
import { COMPLIANCE_META, ASSET_TYPE_META } from '@/utils/rigRollup';

const TYPE_ICON = { rig: Cog, machinery: Wrench, trailer: Package, vehicle: Truck, lifting: Anchor, portable_appliance: Plug };
const TYPE_GRADIENT = {
  rig: 'from-emerald-500 to-emerald-700',
  machinery: 'from-violet-500 to-purple-700',
  trailer: 'from-amber-500 to-orange-600',
  vehicle: 'from-slate-500 to-slate-700',
  lifting: 'from-teal-500 to-cyan-700',
  portable_appliance: 'from-amber-400 to-yellow-600',
};

/**
 * Full-width hero header with type-coloured gradient, large icon tile,
 * asset name, type subtitle, compliance pill, and action buttons.
 * Used in both the mobile top and the desktop left rail.
 */
export default function AssetDetailHero({ asset, onBack, onEdit, onRecert, onQR, onRefresh, refreshing }) {
  if (!asset) return null;
  const Icon = TYPE_ICON[asset.asset_type] || Wrench;
  const meta = COMPLIANCE_META[asset.compliance_status || 'unknown'];
  const CompIcon = asset.compliance_status === 'expired' ? ShieldX
    : asset.compliance_status === 'expiring' ? ShieldAlert
    : asset.compliance_status === 'unknown' ? HelpCircle
    : ShieldCheck;
  const grad = TYPE_GRADIENT[asset.asset_type] || 'from-slate-500 to-slate-700';

  return (
    <div className={`bg-gradient-to-br ${grad} text-white rounded-2xl overflow-hidden shadow-lg`}>
      {/* Top row — back + actions */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-white/80 hover:text-white text-xs font-semibold transition">
          <ArrowLeft className="w-4 h-4" /> Assets
        </button>
        <div className="flex items-center gap-1.5">
          {onEdit && (
            <button onClick={onEdit} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-xs font-semibold transition backdrop-blur-sm">
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
          )}
          {onRecert && (
            <button onClick={onRecert} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white text-[#2E5A1A] hover:bg-white/90 rounded-lg text-xs font-bold transition shadow-sm">
              <Upload className="w-3.5 h-3.5" /> Upload Cert
            </button>
          )}
          {onQR && (
            <button onClick={onQR} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-xs font-semibold transition backdrop-blur-sm">
              <QrCode className="w-3.5 h-3.5" /> QR
            </button>
          )}
          {asset.panda_asset_id && onRefresh && (
            <button onClick={onRefresh} disabled={refreshing} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-xs font-semibold transition backdrop-blur-sm disabled:opacity-60">
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> {refreshing ? 'Syncing' : 'Sync Panda'}
            </button>
          )}
        </div>
      </div>

      {/* Main identity */}
      <div className="flex items-center gap-3 px-4 pb-4 pt-2">
        <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0 border border-white/20">
          <Icon className="w-7 h-7 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-extrabold text-white text-lg lg:text-xl truncate leading-tight">{asset.name}</h1>
            {asset.fleet_number && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-white whitespace-nowrap">
                <Hash className="w-3 h-3" /> FAA {asset.fleet_number}
              </span>
            )}
          </div>
          <p className="text-xs text-white/80 truncate mt-0.5">
            {[asset.make, asset.model].filter(Boolean).join(' · ') || (ASSET_TYPE_META[asset.asset_type]?.label || asset.asset_type)}
            {asset.equipment_type ? ` · ${asset.equipment_type}` : ''}
            {asset.rig_type && asset.rig_type !== 'n/a' ? ` · ${asset.rig_type.toUpperCase()}` : ''}
          </p>
          {asset.serial_number && (
            <p className="text-[11px] text-white/60 font-mono truncate mt-0.5">Serial: {asset.serial_number}</p>
          )}
        </div>
      </div>

      {/* Compliance pill bar */}
      <div className="flex items-center gap-2 px-4 pb-3 flex-wrap">
        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-sm border border-white/20`}>
          <CompIcon className="w-3.5 h-3.5" /> {meta.label}
        </span>
        {asset.is_active === false && (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-red-500/30 border border-red-300/30 text-white">
            <ShieldX className="w-3.5 h-3.5" /> Inactive
          </span>
        )}
        {asset.maintenance_status && asset.maintenance_status !== 'unknown' && (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-white/90">
            <Wrench className="w-3.5 h-3.5" /> {asset.maintenance_status === 'ok' ? 'Serviced' : asset.maintenance_status === 'due_soon' ? 'Service Due' : asset.maintenance_status === 'overdue' ? 'Overdue' : ''}
          </span>
        )}
        {asset.weight_kg != null && (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-white/90">
            <Weight className="w-3.5 h-3.5" /> {Math.round(asset.weight_kg)} kg
          </span>
        )}
      </div>
    </div>
  );
}