import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Truck, Package, ClipboardList, Calendar, MapPin, Trash2, PoundSterling, Weight, User, Navigation } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import PrintPickList from './PrintPickList';

const typeBadge = {
  site_delivery: { label: 'Delivery', cls: 'bg-emerald-100 text-emerald-700', icon: Truck },
  supplier_collection: { label: 'Collection', cls: 'bg-blue-100 text-blue-700', icon: Package },
  item_handover: { label: 'Handover', cls: 'bg-purple-100 text-purple-700', icon: ClipboardList }
};

const statusBadge = {
  pending: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-blue-50 text-blue-700',
  completed: 'bg-emerald-50 text-emerald-700',
  failed: 'bg-red-50 text-red-700'
};

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function DeliveryList({ deliveries = [], jobId, canSeeCosts }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleDelete = async (id) => {
    if (!confirm('Delete this delivery task?')) return;
    try {
      await base44.entities.DeliveryLog.delete(id);
      queryClient.invalidateQueries({ queryKey: ['job-deliveries', jobId] });
      toast({ title: 'Delivery deleted' });
    } catch (e) { toast({ title: 'Error', description: 'Could not delete.' }); }
  };

  if (deliveries.length === 0) {
    return (
      <div className="text-center py-6 text-slate-400 text-sm border border-dashed border-slate-200 rounded-lg">
        No deliveries planned yet. Select items above and tap "Plan Load" to assign a driver.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {deliveries.map(d => {
        const tcfg = typeBadge[d.delivery_type] || typeBadge.site_delivery;
        const TIcon = tcfg.icon;
        return (
          <div key={d.id} className="bg-white rounded-lg border border-slate-200 p-3 flex items-start gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${tcfg.cls}`}>
              <TIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${tcfg.cls}`}>{tcfg.label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${statusBadge[d.status] || statusBadge.pending}`}>{d.status}</span>
              </div>
              <p className="text-sm font-semibold text-slate-900 truncate">{d.items || 'No items listed'}</p>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-400">
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(new Date(d.scheduled_date + 'T00:00:00'), 'dd MMM')}</span>
                <span>·</span>
                <span className="flex items-center gap-1"><User className="w-3 h-3" />{d.driver_staff_name || 'Unassigned'}</span>
                {d.delivery_address && <><span>·</span><span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{d.delivery_address.substring(0, 30)}{d.delivery_address.length > 30 ? '…' : ''}</span></>}
              </div>
              {d.signed_by_name && d.status === 'completed' && (
                <p className="text-xs text-emerald-600 mt-1">Signed by {d.signed_by_name}</p>
              )}
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                {canSeeCosts && d.chargeable && Number(d.charge_amount) > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <PoundSterling className="w-2.5 h-2.5" /> {fmt(Number(d.charge_amount))}
                  </span>
                )}
                {canSeeCosts && Number(d.weight_kg) > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    <Weight className="w-2.5 h-2.5" /> {Math.round(Number(d.weight_kg))} kg
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              {((d.pickup_address && d.delivery_address) || d.delivery_address) && (
                <a href={d.pickup_address && d.delivery_address
                  ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(d.pickup_address)}&destination=${encodeURIComponent(d.delivery_address)}`
                  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.delivery_address)}`
                } target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-emerald-700 hover:text-emerald-900 font-medium px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition">
                  <Navigation className="w-3 h-3" /> Route
                </a>
              )}
              <PrintPickList delivery={d} />
              {d.status === 'pending' && (
                <button onClick={() => handleDelete(d.id)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"><Trash2 className="w-3.5 h-3.5" /></button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}