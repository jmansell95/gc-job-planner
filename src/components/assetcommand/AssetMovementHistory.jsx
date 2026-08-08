import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Wrench, Truck, Trash2, Package, ClipboardList, Loader2, History,
  User, Calendar, ArrowRightLeft, Layers,
} from 'lucide-react';
import { safeFormat } from '@/utils/format';

const EVENT_META = {
  service: { icon: Wrench, tint: 'bg-amber-100 text-amber-600', label: 'Service Logged' },
  repair: { icon: Wrench, tint: 'bg-orange-100 text-orange-600', label: 'Repair Logged' },
  loler_inspection: { icon: Wrench, tint: 'bg-blue-100 text-blue-600', label: 'LOLER Inspection' },
  puwer_inspection: { icon: Wrench, tint: 'bg-blue-100 text-blue-600', label: 'PUWER Inspection' },
  pat_inspection: { icon: Wrench, tint: 'bg-purple-100 text-purple-600', label: 'PAT Test' },
  pre_use_check: { icon: ClipboardList, tint: 'bg-slate-100 text-slate-600', label: 'Pre-use Check' },
  booked_to_vehicle: { icon: Truck, tint: 'bg-emerald-100 text-emerald-600', label: 'Booked to Vehicle' },
  scrap: { icon: Trash2, tint: 'bg-red-100 text-red-600', label: 'Scrapped' },
  delivery: { icon: ArrowRightLeft, tint: 'bg-blue-100 text-blue-600', label: 'Delivery / Movement' },
};

/**
 * Asset Movement History — unified timeline of services, deliveries, and
 * scrap events. Accepts either a single `asset` or an `assets` array.
 * When multiple assets are passed, events from all assets are merged into
 * one chronological timeline, with each event tagged with its asset name.
 */
export default function AssetMovementHistory({ asset, assets: propAssets }) {
  // Normalize to array — accept either `assets` (array) or `asset` (single)
  const assets = React.useMemo(() => {
    if (propAssets && propAssets.length > 0) return propAssets;
    if (asset) return [asset];
    return [];
  }, [asset, propAssets]);

  const isMulti = assets.length > 1;

  // Fetch service records for all assets
  const assetIds = assets.map(a => a.id);
  const { data: services = [], isLoading: loadingServices } = useQuery({
    queryKey: ['service-records-multi', assetIds],
    queryFn: async () => {
      const all = await base44.entities.ServiceRecord.list('-created_date', 500);
      return all.filter(s => assetIds.includes(s.site_asset_id));
    },
    enabled: assets.length > 0,
  });
  const { data: scraps = [], isLoading: loadingScraps } = useQuery({
    queryKey: ['scrap-logs-multi', assetIds],
    queryFn: async () => {
      const all = await base44.entities.ScrapLog.list('-created_date', 200);
      return all.filter(s => assetIds.includes(s.asset_id));
    },
    enabled: assets.length > 0,
  });
  const { data: deliveries = [], isLoading: loadingDeliveries } = useQuery({
    queryKey: ['asset-deliveries-multi', assetIds],
    queryFn: async () => {
      const all = await base44.entities.DeliveryLog.list('-created_date', 200);
      const names = assets.map(a => (a.name || '').toLowerCase()).filter(Boolean);
      const serials = assets.map(a => (a.serial_number || '').toLowerCase()).filter(Boolean);
      return all.filter(d => {
        const items = (d.items || '').toLowerCase();
        return names.some(n => items.includes(n)) || serials.some(sn => items.includes(sn));
      });
    },
    enabled: assets.length > 0,
  });

  const isLoading = loadingServices || loadingScraps || loadingDeliveries;

  // Build a lookup from asset id → name for tagging events
  const assetNameMap = React.useMemo(() => {
    const m = {};
    assets.forEach(a => { m[a.id] = a.name; });
    return m;
  }, [assets]);

  // Merge all events into a single timeline sorted by date descending
  const timeline = React.useMemo(() => {
    const events = [];
    (services || []).forEach(s => events.push({
      key: `svc-${s.id}`, type: s.record_type || 'service', date: s.date, title: EVENT_META[s.record_type]?.label || 'Service',
      subtitle: s.notes || s.result, actor: s.tested_by_name || s.created_by_name || '—',
      extra: s.result ? `Result: ${s.result}` : null,
      assetId: s.site_asset_id, assetName: assetNameMap[s.site_asset_id] || '—',
    }));
    (scraps || []).forEach(s => events.push({
      key: `scrap-${s.id}`, type: 'scrap', date: s.scrapped_date, title: 'Scrapped',
      subtitle: s.reason, actor: s.scrapped_by_name || '—',
      extra: s.estimated_weight_kg ? `Est. ${s.estimated_weight_kg}kg ${s.scrap_category || ''}` : null,
      assetId: s.asset_id, assetName: assetNameMap[s.asset_id] || '—',
    }));
    (deliveries || []).forEach(d => {
      // Match delivery to the asset(s) it references
      const matchedNames = assets.filter(a => {
        const items = (d.items || '').toLowerCase();
        return (a.name && items.includes(a.name.toLowerCase())) || (a.serial_number && items.includes(a.serial_number.toLowerCase()));
      });
      if (matchedNames.length === 0) matchedNames.push(assets[0]);
      matchedNames.forEach(a => events.push({
        key: `del-${d.id}-${a.id}`, type: 'delivery', date: d.scheduled_date || d.created_date, title: 'Booked to Vehicle',
        subtitle: d.delivery_address || d.items, actor: d.driver_staff_name || d.signed_by_name || '—',
        extra: d.delivery_type ? d.delivery_type.replace(/_/g, ' ') : null,
        assetId: a.id, assetName: a.name || '—',
      }));
    });
    events.sort((a, b) => {
      const da = a.date ? new Date(a.date.includes('T') ? a.date : a.date + 'T00:00:00').getTime() : 0;
      const db = b.date ? new Date(b.date.includes('T') ? b.date : b.date + 'T00:00:00').getTime() : 0;
      return db - da;
    });
    return events;
  }, [services, scraps, deliveries, assets, assetNameMap]);

  if (assets.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center border bg-white border-slate-200">
          {isMulti ? <Layers className="w-3.5 h-3.5 text-emerald-600" /> : <History className="w-3.5 h-3.5 text-slate-600" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-800">
            {isMulti ? `Movement & History — ${assets.length} Items` : 'Movement & History'}
          </p>
          <p className="text-[10px] text-slate-400">
            {timeline.length} event{timeline.length !== 1 ? 's' : ''} · {isMulti ? 'merged timeline across all items' : 'who booked it in/out, services, scrap'}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : timeline.length === 0 ? (
        <div className="px-4 py-6 text-center text-xs text-slate-400">No history yet — services, deliveries and scrap events will appear here.</div>
      ) : (
        <div className="max-h-[320px] overflow-y-auto">
          {timeline.map((ev, idx) => {
            const meta = EVENT_META[ev.type] || EVENT_META.service;
            return (
              <div key={ev.key} className="flex gap-3 px-4 py-2.5 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition">
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center ${meta.tint}`}>
                    <meta.icon className="w-3.5 h-3.5" />
                  </div>
                  {idx < timeline.length - 1 && <div className="w-px flex-1 bg-slate-200 mt-1" />}
                </div>
                <div className="min-w-0 flex-1 pb-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-800">{ev.title}</p>
                    <span className="text-[10px] text-slate-400 flex items-center gap-0.5 flex-shrink-0">
                      <Calendar className="w-2.5 h-2.5" /> {ev.date ? safeFormat(ev.date, 'dd MMM yyyy') : '—'}
                    </span>
                  </div>
                  {isMulti && (
                    <p className="text-[10px] text-emerald-600 font-semibold mt-0.5 flex items-center gap-1">
                      <Package className="w-2.5 h-2.5" /> {ev.assetName}
                    </p>
                  )}
                  {ev.subtitle && <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{ev.subtitle}</p>}
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                    <span className="flex items-center gap-0.5"><User className="w-2.5 h-2.5" /> {ev.actor}</span>
                    {ev.extra && <span className="flex items-center gap-0.5"><Package className="w-2.5 h-2.5" /> {ev.extra}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}