import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2, Check, X, SkipForward, RefreshCw, Loader2, ArrowRightLeft, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const fmt = (n) => (n == null ? '—' : '£' + Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

export default function AssetPandaLinkReview() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [acting, setActing] = useState(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['asset-panda-link-review'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getAssetPandaLinkReview', {});
      return res.data;
    },
  });

  const counts = data?.counts || { confirmed: 0, proposed: 0, unmatched: 0, skipped: 0, total: 0 };
  const proposed = data?.proposed || [];
  const confirmed = data?.confirmed || [];
  const skipped = data?.skipped || [];
  const unmatched = data?.unmatched || [];

  const act = async (assetId, action, rateCardItemId) => {
    setActing(`${assetId}-${action}`);
    try {
      await base44.functions.invoke('confirmAssetPandaLink', {
        asset_id: assetId,
        action,
        rate_card_item_id: rateCardItemId,
      });
      queryClient.invalidateQueries({ queryKey: ['asset-panda-link-review'] });
      queryClient.invalidateQueries({ queryKey: ['site-assets'] });
      queryClient.invalidateQueries({ queryKey: ['site-assets-panda'] });
      toast({
        title: action === 'confirm' ? 'Link confirmed' : action === 'skip' ? 'Link skipped' : 'Link removed',
        description: action === 'confirm'
          ? 'Rate card price will now take precedence for this asset.'
          : action === 'skip'
          ? 'Asset Panda cost will be used as the fallback price.'
          : 'Asset is back to unmatched.',
      });
    } catch (err) {
      toast({ title: 'Could not update link', description: err?.response?.data?.error || err.message, variant: 'destructive' });
    }
    setActing(null);
  };

  const [bulkConfirming, setBulkConfirming] = useState(false);
  const confirmAllProposed = async () => {
    if (proposed.length === 0) return;
    if (!confirm(`Confirm all ${proposed.length} proposed links? The Master Price List price will take precedence for each asset.`)) return;
    setBulkConfirming(true);
    let ok = 0;
    let fail = 0;
    for (const { asset, rateCardItem } of proposed) {
      try {
        await base44.functions.invoke('confirmAssetPandaLink', {
          asset_id: asset.id,
          action: 'confirm',
          rate_card_item_id: rateCardItem?.id,
        });
        ok++;
      } catch {
        fail++;
      }
    }
    queryClient.invalidateQueries({ queryKey: ['asset-panda-link-review'] });
    queryClient.invalidateQueries({ queryKey: ['site-assets'] });
    queryClient.invalidateQueries({ queryKey: ['site-assets-panda'] });
    toast({
      title: `${ok} links confirmed`,
      description: fail > 0 ? `${fail} could not be confirmed.` : 'All proposed links are now confirmed.',
      variant: fail > 0 ? 'destructive' : 'default',
    });
    setBulkConfirming(false);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <ArrowRightLeft className="w-4 h-4 text-blue-600" />
        <h3 className="text-sm font-semibold text-slate-900">Review Links</h3>
        <span className="text-[11px] text-slate-400 hidden sm:inline">— confirm rate-card matches so the rate card price takes precedence</span>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200 transition disabled:opacity-50"
        >
          {isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Refresh
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Counts */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Confirmed', value: counts.confirmed, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
            { label: 'Proposed', value: counts.proposed, cls: 'bg-amber-50 text-amber-700 border-amber-200' },
            { label: 'Unmatched', value: counts.unmatched, cls: 'bg-slate-50 text-slate-600 border-slate-200' },
            { label: 'Skipped', value: counts.skipped, cls: 'bg-blue-50 text-blue-700 border-blue-200' },
          ].map((c) => (
            <div key={c.label} className={`rounded-lg border px-2 py-2 text-center ${c.cls}`}>
              <p className="text-lg font-extrabold tabular-nums">{c.value}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide">{c.label}</p>
            </div>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
          </div>
        ) : (
          <>
            {/* Proposed — the action items */}
            {proposed.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Awaiting your confirmation ({proposed.length})
                  </p>
                  <button
                    onClick={confirmAllProposed}
                    disabled={bulkConfirming}
                    className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-semibold hover:bg-emerald-800 transition disabled:opacity-50"
                  >
                    {bulkConfirming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Confirm all ({proposed.length})
                  </button>
                </div>
                {proposed.map(({ asset, rateCardItem }) => (
                  <div key={asset.id} className="border border-amber-200 rounded-lg p-3 bg-amber-50/40">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                      {/* Asset Panda side */}
                      <div className="bg-white rounded-lg border border-slate-200 p-2.5">
                        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wide mb-1">Asset Panda</p>
                        <p className="text-sm font-semibold text-slate-900 truncate">{asset.name}</p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {asset.serial_number ? `${asset.serial_number} · ` : ''}
                          {asset.panda_group_label || 'Asset Panda'}
                        </p>
                        <p className="text-xs text-slate-600 mt-1">
                          Cost: <span className="font-semibold">{fmt(asset.cost_price)}</span>
                          {asset.charge_out_price != null && <> · Charge: <span className="font-semibold">{fmt(asset.charge_out_price)}</span></>}
                        </p>
                      </div>
                      {/* Rate card side */}
                      <div className="bg-white rounded-lg border border-slate-200 p-2.5">
                        <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide mb-1">Master Price List</p>
                        <p className="text-sm font-semibold text-slate-900 truncate">{rateCardItem?.description || '—'}</p>
                        <p className="text-[11px] text-slate-400 truncate">{rateCardItem?.subcategory || ''}</p>
                        <p className="text-xs text-slate-600 mt-1">
                          Cost: <span className="font-semibold">{fmt(rateCardItem?.cost_price ?? rateCardItem?.price)}</span>
                          {rateCardItem?.price != null && <> · Charge: <span className="font-semibold">{fmt(rateCardItem.price)}</span></>}
                          {rateCardItem?.unit && <span className="text-slate-400">/{rateCardItem.unit}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => act(asset.id, 'confirm', rateCardItem?.id)}
                        disabled={acting === `${asset.id}-confirm`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-semibold hover:bg-emerald-800 transition disabled:opacity-50"
                      >
                        {acting === `${asset.id}-confirm` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Confirm link
                      </button>
                      <button
                        onClick={() => act(asset.id, 'skip')}
                        disabled={acting === `${asset.id}-skip`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200 transition disabled:opacity-50"
                      >
                        {acting === `${asset.id}-skip` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SkipForward className="w-3.5 h-3.5" />} Use AP cost
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Confirmed */}
            {confirmed.length > 0 && (
              <details className="border border-emerald-200 rounded-lg bg-emerald-50/30">
                <summary className="px-3 py-2.5 cursor-pointer text-xs font-bold text-emerald-700 uppercase tracking-wide flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" /> Confirmed ({confirmed.length})
                </summary>
                <div className="px-3 pb-3 space-y-1.5">
                  {confirmed.map(({ asset, rateCardItem }) => (
                    <div key={asset.id} className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 p-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 truncate">{asset.name}</p>
                        <p className="text-[11px] text-slate-400 truncate">→ {rateCardItem?.description} · {fmt(rateCardItem?.price)}{rateCardItem?.unit ? `/${rateCardItem.unit}` : ''}</p>
                      </div>
                      <button
                        onClick={() => act(asset.id, 'unlink')}
                        disabled={acting === `${asset.id}-unlink`}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition flex-shrink-0"
                        aria-label="Unlink"
                      >
                        {acting === `${asset.id}-unlink` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {/* Skipped */}
            {skipped.length > 0 && (
              <details className="border border-blue-200 rounded-lg bg-blue-50/30">
                <summary className="px-3 py-2.5 cursor-pointer text-xs font-bold text-blue-700 uppercase tracking-wide flex items-center gap-1.5">
                  <SkipForward className="w-3.5 h-3.5" /> Skipped — using AP cost ({skipped.length})
                </summary>
                <div className="px-3 pb-3 space-y-1.5">
                  {skipped.map(({ asset }) => (
                    <div key={asset.id} className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 p-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 truncate">{asset.name}</p>
                        <p className="text-[11px] text-slate-400 truncate">AP cost: {fmt(asset.cost_price)}</p>
                      </div>
                      <button
                        onClick={() => act(asset.id, 'unlink')}
                        disabled={acting === `${asset.id}-unlink`}
                        className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition flex-shrink-0"
                        aria-label="Re-match"
                      >
                        {acting === `${asset.id}-unlink` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {/* Unmatched */}
            {unmatched.length > 0 && (
              <details className="border border-slate-200 rounded-lg bg-slate-50/30">
                <summary className="px-3 py-2.5 cursor-pointer text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5" /> Unmatched — no rate card found ({unmatched.length})
                </summary>
                <div className="px-3 pb-3 space-y-1.5">
                  {unmatched.map(({ asset }) => (
                    <div key={asset.id} className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 p-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 truncate">{asset.name}</p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {asset.serial_number ? `${asset.serial_number} · ` : ''}
                          AP cost: {fmt(asset.cost_price)}
                        </p>
                      </div>
                      <span className="text-[10px] text-slate-400 italic px-2">Add a matching rate card item to link</span>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {proposed.length === 0 && confirmed.length === 0 && skipped.length === 0 && unmatched.length === 0 && (
              <div className="text-center py-6 text-sm text-slate-400">
                No synced assets yet. Run a sync to propose rate-card links.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}