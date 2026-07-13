import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Database, RefreshCw, CheckCircle2, AlertCircle, Info, Clock } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const stockBadge = {
  in_stock: { label: 'In Stock', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  low_stock: { label: 'Low Stock', cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  out_of_stock: { label: 'Out of Stock', cls: 'bg-red-50 text-red-700 border border-red-200' },
  needs_service: { label: 'Needs Service', cls: 'bg-orange-50 text-orange-700 border border-orange-200' },
  unknown: { label: 'Unknown', cls: 'bg-slate-100 text-slate-500 border border-slate-200' },
};

const syncBadge = {
  synced: { label: 'Synced', cls: 'bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
  pending: { label: 'Pending', cls: 'bg-amber-50 text-amber-700', icon: Clock },
  failed: { label: 'Failed', cls: 'bg-red-50 text-red-700', icon: AlertCircle },
  never: { label: 'Never', cls: 'bg-slate-100 text-slate-500', icon: AlertCircle },
};

export default function AssetPandaSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['site-assets-panda'],
    queryFn: () => base44.entities.SiteAsset.list(),
  });

  const syncedCount = assets.filter(a => a.panda_asset_id).length;
  const syncedRecently = assets.filter(a => a.sync_status === 'synced').length;
  const neverSyncedCount = assets.filter(a => !a.sync_status || a.sync_status === 'never').length;
  const issuesCount = assets.filter(a => a.stock_level === 'out_of_stock' || a.stock_level === 'needs_service').length;
  const lastSync = assets
    .map(a => a.last_sync_timestamp)
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a))[0];

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await base44.functions.invoke('syncAssetPanda', {});
      const data = res?.data || res;
      queryClient.invalidateQueries({ queryKey: ['site-assets-panda'] });
      queryClient.invalidateQueries({ queryKey: ['site-assets'] });
      queryClient.invalidateQueries({ queryKey: ['equipment-catalogue'] });
      toast({
        title: data?.synced >= 0 ? `Synced ${data.synced} assets` : 'Sync started',
        description: data?.message || 'Inventory and billing rates refreshed from Asset Panda.',
      });
    } catch (err) {
      console.error(err);
      toast({
        title: 'Sync not available',
        description: 'The Asset Panda sync will be available once the API key is confirmed. Set it in Dashboard → Settings → Environment Variables.',
        variant: 'destructive',
      });
    }
    setSyncing(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Database className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Asset Panda Sync</h2>
            <p className="text-sm text-slate-500">Live inventory, stock levels & billing rates from Asset Panda</p>
          </div>
        </div>
        <button onClick={handleSync} disabled={syncing || isLoading}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition text-sm font-semibold disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing…' : 'Sync Now'}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-500 font-medium">Linked Assets</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{syncedCount}</p>
          <p className="text-[11px] text-slate-400">with Asset Panda ID</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-500 font-medium">Synced</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{syncedRecently}</p>
          <p className="text-[11px] text-slate-400">latest data pulled</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-500 font-medium">Never Synced</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{neverSyncedCount}</p>
          <p className="text-[11px] text-slate-400">need linking</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-500 font-medium">Stock Issues</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{issuesCount}</p>
          <p className="text-[11px] text-slate-400">out of stock / service</p>
        </div>
      </div>

      <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800 space-y-1">
          <p className="font-semibold">How the sync works</p>
          <p className="text-blue-700">Asset Panda is the single source of truth for your inventory. The scheduled sync pulls each asset's name, serial number, stock level and daily billing rate into your Site Assets catalogue, then auto-deactivates any item flagged as <em>out of stock</em> or <em>needs service</em> so it can't be added to a job.</p>
          <p className="text-blue-700 text-xs">The <strong>ASSET_PANDA_API_KEY</strong> secret is set in Dashboard → Settings → Environment Variables. Ask Base44 support if you can't see that section.</p>
          {lastSync && (
            <p className="text-blue-600 text-xs flex items-center gap-1 pt-1">
              <Clock className="w-3 h-3" /> Last sync: {new Date(lastSync).toLocaleString('en-GB')}
            </p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Asset Sync Status</h3>
        </div>
        {isLoading ? (
          <div className="p-6 text-center text-slate-400 text-sm">Loading assets…</div>
        ) : assets.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-sm">No site assets yet. Add assets in the Assets settings tab first.</div>
        ) : (
          <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
            {assets.map(a => {
              const sb = stockBadge[a.stock_level || 'unknown'] || stockBadge.unknown;
              const sy = syncBadge[a.sync_status || 'never'] || syncBadge.never;
              const SyncIcon = sy.icon;
              return (
                <div key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">{a.name}</p>
                    <p className="text-xs text-slate-400 truncate">
                      {a.serial_number || 'No serial'}{a.panda_asset_id ? ' · Linked to Panda' : ' · Not linked'}
                    </p>
                  </div>
                  {a.daily_billing_rate != null && (
                    <span className="text-xs font-semibold text-emerald-700 flex-shrink-0">
                      £{Number(a.daily_billing_rate).toFixed(0)}/day
                    </span>
                  )}
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${sb.cls}`}>{sb.label}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 flex-shrink-0 ${sy.cls}`}>
                    <SyncIcon className="w-2.5 h-2.5" /> {sy.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}