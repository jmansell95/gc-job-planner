import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import {
  Wrench, Package, Truck, Anchor, Plug, Cog, ShieldX,
  Navigation, ChevronRight, Loader2, PackageOpen, MapPin,
  Gauge, CalendarClock, CheckCircle2,
} from 'lucide-react';

const TYPE_ICON = {
  rig: Cog, machinery: Wrench, trailer: Package, vehicle: Truck,
  lifting: Anchor, portable_appliance: Plug,
};

const STATUS_RING = {
  compliant: 'ring-emerald-500 bg-emerald-50',
  expiring: 'ring-amber-500 bg-amber-50',
  expired: 'ring-red-500 bg-red-50',
  unknown: 'ring-slate-300 bg-slate-50',
};

const STATUS_BADGE = {
  compliant: 'bg-emerald-100 text-emerald-700',
  expiring: 'bg-amber-100 text-amber-700',
  expired: 'bg-red-100 text-red-700',
  unknown: 'bg-slate-100 text-slate-600',
};

const STATUS_DOT = {
  compliant: 'bg-emerald-500',
  expiring: 'bg-amber-500',
  expired: 'bg-red-500',
  unknown: 'bg-slate-300',
};

const MAINT_META = {
  ok: { Icon: CheckCircle2, tint: 'text-emerald-600', label: 'Serviced' },
  due_soon: { Icon: CalendarClock, tint: 'text-amber-600', label: 'Service Due' },
  overdue: { Icon: ShieldX, tint: 'text-red-600', label: 'Overdue' },
  unknown: { Icon: CalendarClock, tint: 'text-slate-400', label: 'No Data' },
};

/**
 * My Gear — personalized asset list for the logged-in field staff member.
 * Shows two groups:
 *   1. "In Use Today" — rigs/assets linked via today's RotaAssignment.rig_asset_id
 *   2. "Assigned to Me" — assets where responsible_person matches the staff name
 * Tapping any asset opens the Asset Command Drawer (via onOpenAsset).
 */
export default function MyGearTab({ staffProfile, allAssets = [], onOpenAsset }) {
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: todayRota = [], isLoading: rotaLoading } = useQuery({
    queryKey: ['my-gear-rota', staffProfile?.id, today],
    queryFn: async () => {
      if (!staffProfile?.id) return [];
      const all = await base44.entities.RotaAssignment.filter({ staff_id: staffProfile.id, assigned_date: today });
      return all.filter(a => a.rig_asset_id);
    },
    enabled: !!staffProfile?.id,
  });

  const { inUseAssets, assignedAssets } = useMemo(() => {
    const inUseIds = new Set(todayRota.map(a => a.rig_asset_id));
    const inUse = allAssets.filter(a => inUseIds.has(a.id));

    const assigned = allAssets.filter(a => {
      if (inUseIds.has(a.id)) return false;
      const resp = (a.responsible_person || '').toLowerCase().trim();
      const name = (staffProfile?.name || '').toLowerCase().trim();
      return resp && name && resp === name;
    });

    return { inUseAssets: inUse, assignedAssets: assigned };
  }, [todayRota, allAssets, staffProfile]);

  const renderAssetCard = (asset, isInUse) => {
    const Icon = TYPE_ICON[asset.asset_type] || Package;
    const ringClass = STATUS_RING[asset.compliance_status] || STATUS_RING.unknown;
    const badgeClass = STATUS_BADGE[asset.compliance_status] || STATUS_BADGE.unknown;
    const dotClass = STATUS_DOT[asset.compliance_status] || STATUS_DOT.unknown;
    const maintMeta = MAINT_META[asset.maintenance_status] || MAINT_META.unknown;
    const MaintIcon = maintMeta.Icon;

    return (
      <button
        key={asset.id}
        onClick={() => onOpenAsset?.(asset)}
        className={`w-full flex items-center gap-3 bg-white border rounded-2xl p-3.5 hover:shadow-md transition active:scale-[0.99] text-left ${
          isInUse ? 'border-emerald-200 shadow-sm' : 'border-slate-200'
        }`}
      >
        {/* Compliance ring badge around the type icon */}
        <div className="relative flex-shrink-0">
          <div className={`w-12 h-12 rounded-2xl ring-2 ${ringClass} flex items-center justify-center`}>
            <Icon className={`w-6 h-6 ${isInUse ? 'text-emerald-700' : 'text-slate-500'}`} />
          </div>
          <span className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full ring-2 ring-white ${dotClass}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900 truncate">{asset.name}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {asset.serial_number && (
              <span className="text-[11px] text-slate-500 font-mono">{asset.serial_number}</span>
            )}
            {asset.equipment_type && (
              <span className="text-[11px] text-slate-400 truncate">· {asset.equipment_type}</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            {asset.storage_location && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400">
                <MapPin className="w-2.5 h-2.5" /> {asset.storage_location}
              </span>
            )}
            {asset.operating_hours != null && asset.asset_type === 'rig' && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400">
                <Gauge className="w-2.5 h-2.5" /> {asset.operating_hours}h
              </span>
            )}
            <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${maintMeta.tint}`}>
              <MaintIcon className="w-2.5 h-2.5" /> {maintMeta.label}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeClass}`}>
            {(asset.compliance_status || 'unknown').toUpperCase()}
          </span>
          {isInUse && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">
              <Navigation className="w-2.5 h-2.5" /> In Use
            </span>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
      </button>
    );
  };

  if (rotaLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const total = inUseAssets.length + assignedAssets.length;

  if (total === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center mx-auto mb-4 ring-4 ring-emerald-50">
          <PackageOpen className="w-10 h-10 text-emerald-300" />
        </div>
        <p className="text-slate-700 font-bold text-base">No gear assigned to you</p>
        <p className="text-slate-400 text-sm mt-1">Scan a QR code to start using it</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {inUseAssets.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Navigation className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">In Use Today</h3>
            <span className="text-xs text-slate-400 font-medium">({inUseAssets.length})</span>
          </div>
          <div className="space-y-2.5">
            {inUseAssets.map(a => renderAssetCard(a, true))}
          </div>
        </div>
      )}

      {assignedAssets.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center">
              <Wrench className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Assigned to Me</h3>
            <span className="text-xs text-slate-400 font-medium">({assignedAssets.length})</span>
          </div>
          <div className="space-y-2.5">
            {assignedAssets.map(a => renderAssetCard(a, false))}
          </div>
        </div>
      )}
    </div>
  );
}