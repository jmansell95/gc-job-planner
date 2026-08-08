import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Wrench, Truck, Trash2, Package, ClipboardList, Loader2, History,
  User, MapPin, Calendar, ArrowRightLeft,
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

export default function AssetMovementHistory({ asset }) {
  const { data: services = [], isLoading: loadingServices } = useQuery({
    queryKey: ['service-records', asset?.id],
    queryFn: () => base44.entities.ServiceRecord.filter({ site_asset_id: asset.id }),
    enabled: !!asset,
  });
  const { data: scraps = [], isLoading: loadingScraps } = useQuery({
    queryKey: ['scrap-logs', asset?.id],
    queryFn: () => base44.entities.ScrapLog.filter({ asset_id: asset.id }),
    enabled: !!asset,
  });
  const { data: deliveries = [], isLoading: loadingDeliveries } = useQuery({
    queryKey: ['asset-deliveries', asset?.id],
    queryFn: async () => {
      const all = await base44.entities.DeliveryLog.list('-created_date', 200);
      const q = (asset.name || '').toLowerCase();
      const sn = (asset.serial_number || '').toLowerCase();
      return all.filter(d => {
        const items = (d.items || '').toLowerCase();
        return (q && items.includes(q)) || (sn && items.includes(sn));
      });
    },
    enabled: !!asset,
  });

  const isLoading = loadingServices || loadingScraps || loadingDeliveries;

  // Merge all events into a single timeline sorted by date descending
  const timeline = React.useMemo(() => {
    const events = [];
    (services || []).forEach(s => events.push({
      key: `svc-${s.id}`, type: s.record_type || 'service', date: s.date, title: EVENT_META[s.record_type]?.label || 'Service',
      subtitle: s.notes || s.result, actor: s.tested_by_name || s.created_by_name || '—',
      extra: s.result ? `Result: ${s.result}` : null,
    }));
    (scraps || []).forEach(s => events.push({
      key: `scrap-${s.id}`, type: 'scrap', date: s.scrapped_date, title: 'Scrapped',
      subtitle: s.reason, actor: s.scrapped_by_name || '—',
      extra: s.estimated_weight_kg ? `Est. ${s.estimated_weight_kg}kg ${s.scrap_category || ''}` : null,
    }));
    (deliveries || []).forEach(d => events.push({
      key: `del-${d.id}`, type: 'delivery', date: d.scheduled_date || d.created_date, title: 'Booked to Vehicle',
      subtitle: d.delivery_address || d.items, actor: d.driver_staff_name || d.signed_by_name || '—',
      extra: d.delivery_type ? d.delivery_type.replace(/_/g, ' ') : null,
    }));
    events.sort((a, b) => {
      const da = a.date ? new Date(a.date.includes('T') ? a.date : a.date + 'T00:00:00').getTime() : 0;
      const db = b.date ? new Date(b.date.includes('T') ? b.date : b.date + 'T00:00:00').getTime() : 0;
      return db - da;
    });
    return events;
  }, [services, scraps, deliveries]);

  if (!asset) return null;

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center border bg-white border-slate-200"><History className="w-3.5 h-3.5 text-slate-600" /></div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-800">Movement & History</p>
          <p className="text-[10px] text-slate-400">{timeline.length} events · who booked it in/out, services, scrap</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : timeline.length === 0 ? (
        <div className="px-4 py-6 text-center text-xs text-slate-400">No history yet — services, deliveries and scrap events will appear here.</div>
      ) : (
        <div className="max-h-[280px] overflow-y-auto">
          {timeline.map((ev, idx) => {
            const meta = EVENT_META[ev.type] || EVENT_META.service;
            return (
              <div key={ev.key} className="flex gap-3 px-4 py-2.5 border-b border-slate-50 last:border-0">
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center ${meta.tint}`}><meta.icon className="w-3.5 h-3.5" /></div>
                  {idx < timeline.length - 1 && <div className="w-px flex-1 bg-slate-200 mt-1" />}
                </div>
                <div className="min-w-0 flex-1 pb-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-800">{ev.title}</p>
                    <span className="text-[10px] text-slate-400 flex items-center gap-0.5"><Calendar className="w-2.5 h-2.5" /> {ev.date ? safeFormat(ev.date, 'dd MMM yyyy') : '—'}</span>
                  </div>
                  {ev.subtitle && <p className="text-[11px] text-slate-500 mt-0.5 truncate">{ev.subtitle}</p>}
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