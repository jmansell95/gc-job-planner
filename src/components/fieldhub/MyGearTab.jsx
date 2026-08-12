import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import {
  Wrench, Package, Truck, Anchor, Plug, Cog, ShieldCheck, ShieldAlert,
  ShieldX, Navigation, ChevronRight, Loader2, PackageOpen,
} from 'lucide-react';

const TYPE_ICON = {
  rig: Cog, machinery: Wrench, trailer: Package, vehicle: Truck,
  lifting: Anchor, portable_appliance: Plug,
};

const STATUS_META = {
  compliant: { Icon: ShieldCheck, tint: 'text-emerald-600 bg-emerald-50', label: 'Compliant' },
  expiring: { Icon: ShieldAlert, tint: 'text-amber-600 bg-amber-50', label: 'Expiring' },
  expired: { Icon: ShieldX, tint: 'text-red-600 bg-red-50', label: 'Expired' },
  unknown: { Icon: ShieldAlert, tint: 'text-slate-500 bg-slate-50', label: 'Unknown' },
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

  // Fetch today's rota assignments to find rigs actively in use
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
    const statusMeta = STATUS_META[asset.compliance_status] || STATUS_META.unknown;
    const StatusIcon = statusMeta.Icon;
    return (
      <button
        key={asset.id}
        onClick={() => onOpenAsset?.(asset)}
        className="w-full flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-3 hover:border-emerald-300 hover:shadow-sm transition active:scale-[0.99] text-left"
      >
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isInUse ? 'bg-emerald-100' : 'bg-slate-100'
        }`}>
          <Icon className={`w-5 h-5 ${isInUse ? 'text-emerald-700' : 'text-slate-500'}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900 truncate">{asset.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {asset.serial_number && (
              <span className="text-[11px] text-slate-500 font-mono">{asset.serial_number}</span>
            )}
            {asset.equipment_type && (
              <span className="text-[11px] text-slate-400 truncate">· {asset.equipment_type}</span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${statusMeta.tint}`}>
            <StatusIcon className="w-3 h-3" /> {statusMeta.label}
          </span>
          {isInUse && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700">
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
        <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <PackageOpen className="w-10 h-10 text-slate-300" />
        </div>
        <p className="text-slate-500 font-medium text-base">No gear assigned to you</p>
        <p className="text-slate-400 text-sm mt-1">Scan a rig QR code to start using it</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {inUseAssets.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Navigation className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-800">In Use Today</h3>
            <span className="text-xs text-slate-400">({inUseAssets.length})</span>
          </div>
          <div className="space-y-2">
            {inUseAssets.map(a => renderAssetCard(a, true))}
          </div>
        </div>
      )}

      {assignedAssets.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Wrench className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-800">Assigned to Me</h3>
            <span className="text-xs text-slate-400">({assignedAssets.length})</span>
          </div>
          <div className="space-y-2">
            {assignedAssets.map(a => renderAssetCard(a, false))}
          </div>
        </div>
      )}
    </div>
  );
}