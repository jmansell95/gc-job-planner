import React from 'react';
import { CheckCircle2, AlertCircle, Info, Clock } from 'lucide-react';

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

export default function AssetPandaSyncStatus({ assets, config, isLoading, lastSync }) {
  const syncedCount = assets.filter(a => a.panda_asset_id).length;
  const syncedRecently = assets.filter(a => a.sync_status === 'synced').length;
  const neverSyncedCount = assets.filter(a => !a.sync_status || a.sync_status === 'never').length;
  const issuesCount = assets.filter(a => a.stock_level === 'out_of_stock' || a.stock_level === 'needs_service').length;

  return (
    <>
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

      {config?.last_sync_summary && (
        <div className={`flex items-start gap-2.5 rounded-xl p-4 border ${config.last_sync_status === 'failed' ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
          {config.last_sync_status === 'failed'
            ? <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            : <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />}
          <div className="text-sm">
            <p className={`font-semibold ${config.last_sync_status === 'failed' ? 'text-red-800' : 'text-emerald-800'}`}>Last sync result</p>
            <p className={config.last_sync_status === 'failed' ? 'text-red-700' : 'text-emerald-700'}>{config.last_sync_summary}</p>
            {lastSync && <p className="text-xs mt-1 opacity-70 flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(lastSync).toLocaleString('en-GB')}</p>}
          </div>
        </div>
      )}

      <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800 space-y-1">
          <p className="font-semibold">How the sync works</p>
          <p className="text-blue-700">Asset Panda is the single source of truth for your inventory. The sync pulls each asset's name, serial number, stock level and daily billing rate into your Site Assets catalogue, auto-classifies rigs, and can auto-deactivate any item flagged as <em>out of stock</em> or <em>needs service</em> so it can't be added to a job.</p>
          <p className="text-blue-700 text-xs">Enter your credentials above, then click <strong>Sync Now</strong>. Field mappings are optional — the sync auto-detects them from your Asset Panda group's field labels.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Asset Sync Status</h3>
        </div>
        {isLoading ? (
          <div className="p-6 text-center text-slate-400 text-sm">Loading assets…</div>
        ) : assets.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-sm">No site assets yet. Run a sync once your credentials are saved to pull them in from Asset Panda.</div>
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
                      {a.serial_number || 'No serial'}{a.panda_asset_id ? ' · Linked to Panda' : ' · Not linked'}{a.is_rig ? ' · Rig' : ''}
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
    </>
  );
}