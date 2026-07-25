import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Search, X, ScanLine, Loader2, RefreshCw, CheckCircle2, AlertTriangle,
  ShieldCheck, ShieldAlert, ShieldX, Cog, Wrench, Package, Truck, Anchor,
  Database, Clock, Link2, AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { safeFormat } from '@/utils/format';
import AssetPassport from '@/components/logistics/AssetPassport';

const TYPE_META = {
  rig: { label: 'Rig', icon: Cog, tint: 'bg-blue-50 text-blue-700 border-blue-200' },
  machinery: { label: 'Machinery', icon: Wrench, tint: 'bg-purple-50 text-purple-700 border-purple-200' },
  trailer: { label: 'Trailer', icon: Package, tint: 'bg-amber-50 text-amber-700 border-amber-200' },
  vehicle: { label: 'Vehicle', icon: Truck, tint: 'bg-slate-50 text-slate-700 border-slate-200' },
  lifting: { label: 'Lifting Gear', icon: Anchor, tint: 'bg-teal-50 text-teal-700 border-teal-200' },
};

const STOCK_META = {
  in_stock: { label: 'In Stock', tone: 'text-emerald-700 bg-emerald-50 border-emerald-200', Icon: CheckCircle2 },
  low_stock: { label: 'Low Stock', tone: 'text-amber-700 bg-amber-50 border-amber-200', Icon: AlertTriangle },
  out_of_stock: { label: 'Out of Stock', tone: 'text-red-700 bg-red-50 border-red-200', Icon: AlertCircle },
  needs_service: { label: 'Needs Service', tone: 'text-orange-700 bg-orange-50 border-orange-200', Icon: AlertTriangle },
  unknown: { label: 'Unknown', tone: 'text-slate-600 bg-slate-50 border-slate-200', Icon: AlertCircle },
};

const COMPLIANCE_META = {
  compliant: { label: 'Compliant', tone: 'text-emerald-700 bg-emerald-50 border-emerald-200', Icon: ShieldCheck },
  expiring: { label: 'Expiring Soon', tone: 'text-amber-700 bg-amber-50 border-amber-200', Icon: ShieldAlert },
  expired: { label: 'Expired', tone: 'text-red-700 bg-red-50 border-red-200', Icon: ShieldX },
  unknown: { label: 'Unknown', tone: 'text-slate-600 bg-slate-50 border-slate-200', Icon: ShieldAlert },
};

const SYNC_META = {
  synced: { label: 'Synced', tone: 'text-emerald-700' },
  pending: { label: 'Pending', tone: 'text-amber-700' },
  failed: { label: 'Failed', tone: 'text-red-700' },
  never: { label: 'Never synced', tone: 'text-slate-500' },
};

export default function AssetLens({ open, onClose, assets = [] }) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const [passportAsset, setPassportAsset] = useState(null);

  const { data: config = null, isLoading: cfgLoading } = useQuery({
    queryKey: ['assetpanda-config'],
    queryFn: async () => { const list = await base44.entities.AssetPandaConfig.filter({ key: 'global' }); return list[0] || null; },
    enabled: open,
  });

  // Fetch assets when none are passed in as a prop (e.g. when opened from the
  // admin nav sidebar rather than the SiteAssetManager page).
  const { data: fetchedAssets = [] } = useQuery({
    queryKey: ['site-assets'],
    queryFn: () => base44.entities.SiteAsset.list('-created_date', 500),
    enabled: open && assets.length === 0,
  });
  const allAssets = assets.length > 0 ? assets : fetchedAssets;

  const match = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return allAssets.find((a) => {
      const sn = (a.serial_number || '').toLowerCase().trim();
      const pid = (a.panda_asset_id || '').toLowerCase().trim();
      const nm = (a.name || '').toLowerCase().trim();
      return sn === q || pid === q || nm === q || (sn && sn.includes(q)) || (pid && pid.includes(q));
    }) || null;
  }, [query, allAssets]);

  if (!open) return null;

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    setSyncError(null);
    try {
      const res = await base44.functions.invoke('syncAssetPanda', {});
      setSyncResult(res);
      queryClient.invalidateQueries({ queryKey: ['site-assets'] });
      queryClient.invalidateQueries({ queryKey: ['assetpanda-config'] });
    } catch (e) {
      setSyncError(e?.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const typeMeta = match ? TYPE_META[match.asset_type] || TYPE_META.machinery : null;
  const stockMeta = match ? STOCK_META[match.stock_level] || STOCK_META.unknown : null;
  const compMeta = match ? COMPLIANCE_META[match.compliance_status] || COMPLIANCE_META.unknown : null;
  const syncMeta = match ? SYNC_META[match.sync_status] || SYNC_META.never : null;

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 pt-8 sm:pt-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <ScanLine className="w-4 h-4 text-emerald-700" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Asset Lens</h3>
              <p className="text-[11px] text-slate-400">Live lookup from Asset Panda</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Search / scan input */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Scan or enter serial / Asset Panda ID / name</label>
            <div className="relative">
              <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && match) e.preventDefault(); }}
                placeholder="e.g. RIG-01, AP-4f3a2b..."
                className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm font-mono"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <Database className="w-3 h-3" /> {allAssets.length} assets in local cache · last sync {config?.last_sync_at ? safeFormat(config.last_sync_at, 'dd MMM HH:mm') : 'never'}
            </p>
          </div>

          {/* Config status */}
          {cfgLoading ? null : !config?.group_id ? (
            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Asset Panda isn't configured. Add your API token + group ID in Settings → Asset Panda Sync Data to enable live sync.</span>
            </div>
          ) : null}

          {/* Result */}
          {query.trim() && !match && (
            <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-4 py-6 justify-center">
              <AlertCircle className="w-4 h-4 text-slate-400" />
              No asset matches “{query}”.
            </div>
          )}

          {match && typeMeta && (
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              {/* Asset identity */}
              <div className="px-4 py-3.5 flex items-center gap-3 border-b border-slate-100">
                <div className={`w-11 h-11 rounded-lg flex items-center justify-center border ${typeMeta.tint}`}>
                  <typeMeta.icon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900 truncate">{match.name}</p>
                  <p className="text-xs text-slate-400 flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono">{match.serial_number || '—'}</span>
                    {match.rig_type && match.rig_type !== 'n/a' && <span className="text-[10px] uppercase font-semibold text-slate-500">{match.rig_type}</span>}
                    {!match.is_active && <span className="text-[10px] uppercase font-bold text-red-600">Inactive</span>}
                  </p>
                </div>
              </div>

              {/* Live status grid */}
              <div className="grid grid-cols-2 divide-x divide-slate-100">
                <div className="px-4 py-3">
                  <p className="text-[10px] uppercase font-medium text-slate-400 mb-1">Stock / Condition</p>
                  <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full border ${stockMeta.tone}`}>
                    <stockMeta.Icon className="w-3.5 h-3.5" /> {stockMeta.label}
                  </div>
                </div>
                <div className="px-4 py-3">
                  <p className="text-[10px] uppercase font-medium text-slate-400 mb-1">Compliance</p>
                  <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full border ${compMeta.tone}`}>
                    <compMeta.Icon className="w-3.5 h-3.5" /> {compMeta.label}
                  </div>
                  {match.compliance_expiry_date && (
                    <p className="text-[10px] text-slate-400 mt-1">Expires {safeFormat(match.compliance_expiry_date, 'dd MMM yyyy')}</p>
                  )}
                </div>
              </div>

              {/* Sync provenance */}
              <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/60 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Link2 className="w-3 h-3" /> Asset Panda link
                  </span>
                  <span className={`font-medium ${syncMeta.tone} flex items-center gap-1`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${match.sync_status === 'synced' ? 'bg-emerald-500' : match.sync_status === 'failed' ? 'bg-red-500' : 'bg-slate-300'}`} />
                    {syncMeta.label}
                  </span>
                </div>
                {match.last_sync_timestamp && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Clock className="w-3 h-3" /> Last synced
                    </span>
                    <span className="text-slate-600 font-medium">{safeFormat(match.last_sync_timestamp, 'dd MMM yyyy HH:mm')}</span>
                  </div>
                )}
                {match.panda_asset_id && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Panda ID</span>
                    <span className="text-slate-600 font-mono truncate ml-2 max-w-[60%] text-right">{match.panda_asset_id}</span>
                  </div>
                )}
                {match.responsible_person && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Responsible</span>
                    <span className="text-slate-600">{match.responsible_person}</span>
                  </div>
                )}
                {match.tooling_notes && (
                  <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/70">Tooling: {match.tooling_notes}</p>
                )}
              </div>

              {/* Maintenance summary */}
              {match.maintenance_status && match.maintenance_status !== 'unknown' && (
                <div className="px-4 py-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Next service</span>
                  <span className={`font-semibold ${match.maintenance_status === 'overdue' ? 'text-red-600' : match.maintenance_status === 'due_soon' ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {match.next_service_date ? safeFormat(match.next_service_date, 'dd MMM yyyy') : '—'}
                  </span>
                </div>
              )}

              {/* Linked equipment */}
              {Array.isArray(match.linked_equipment_ids) && match.linked_equipment_ids.length > 0 && (
                <div className="px-4 py-2.5 border-t border-slate-100">
                  <p className="text-[10px] uppercase font-medium text-slate-400 mb-1">{match.linked_equipment_ids.length} linked item(s)</p>
                  <div className="flex flex-wrap gap-1">
                    {match.linked_equipment_ids.slice(0, 6).map((id) => {
                      const eq = allAssets.find((a) => a.id === id);
                      return eq ? (
                        <span key={id} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{eq.name}</span>
                      ) : null;
                    })}
                  </div>
                </div>
              )}

              <div className="px-4 py-3 border-t border-slate-100">
                <button
                  onClick={() => setPassportAsset(match)}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-medium transition"
                >
                  <ScanLine className="w-3.5 h-3.5" /> Open full passport
                </button>
              </div>
            </div>
          )}

          {/* Sync action */}
          <div className="pt-1">
            <button
              onClick={handleSync}
              disabled={syncing || !config?.group_id}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium text-sm"
            >
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {syncing ? 'Syncing from Asset Panda…' : 'Refresh all from Asset Panda'}
            </button>
            {syncError && (
              <p className="text-xs text-red-600 mt-2 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" /> {syncError}
              </p>
            )}
            {syncResult && (
              <p className="text-xs text-emerald-700 mt-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> {syncResult.summary || 'Sync complete'}
              </p>
            )}
            <p className="text-[10px] text-slate-400 mt-2 text-center">Refresh pulls the latest stock & condition for every asset from Asset Panda.</p>
          </div>
        </div>
      </div>
      <AssetPassport asset={passportAsset} onClose={() => setPassportAsset(null)} allAssets={allAssets} />
    </div>
  );
}