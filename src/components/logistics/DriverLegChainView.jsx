import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Package, Truck, ArrowRightLeft, ChevronRight, Navigation,
  CheckCircle2, Clock, MapPin, User, Link2
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/StateViews';

const LEG_CONFIG = {
  collect: { icon: Package, label: 'Collect', badge: 'bg-blue-100 text-blue-700 ring-blue-200', accent: 'border-l-blue-400' },
  transfer: { icon: ArrowRightLeft, label: 'Transfer', badge: 'bg-amber-100 text-amber-700 ring-amber-200', accent: 'border-l-amber-400' },
  deliver: { icon: Truck, label: 'Deliver', badge: 'bg-emerald-100 text-emerald-700 ring-emerald-200', accent: 'border-l-emerald-400' },
};

const STATUS_CONFIG = {
  pending: { label: 'Pending', cls: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' },
  in_transit: { label: 'In Transit', cls: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  complete: { label: 'Complete', cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
};

function captureGPS() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 5000, enableHighAccuracy: true }
    );
  });
}

export default function DriverLegChainView({ staffId }) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [actingLegId, setActingLegId] = useState(null);

  const { data: legs = [], isLoading } = useQuery({
    queryKey: ['my-delivery-legs', staffId, todayStr],
    queryFn: () => base44.entities.DeliveryLeg.filter({ driver_id: staffId, scheduled_date: todayStr }),
    enabled: !!staffId,
  });

  const { data: allStaff = [] } = useQuery({ queryKey: ['delivery-leg-staff'], queryFn: () => base44.entities.Staff.filter({ is_active: true }) });

  const sortedLegs = [...(legs || [])].sort((a, b) => (a.leg_sequence || 0) - (b.leg_sequence || 0));
  const activeLegs = sortedLegs.filter(l => l.status !== 'complete');
  const completedLegs = sortedLegs.filter(l => l.status === 'complete');

  const handleCollect = async (leg) => {
    setActingLegId(leg.id);
    try {
      const gps = await captureGPS();
      await base44.entities.DeliveryLeg.update(leg.id, {
        status: 'in_transit',
        collected_at: new Date().toISOString(),
        ...(gps ? { gps_lat: gps.lat, gps_lng: gps.lng } : {}),
      });
      toast({ title: 'Gear collected', description: `Leg ${leg.leg_sequence} — gear is in transit` });
      queryClient.invalidateQueries({ queryKey: ['my-delivery-legs'] });
    } catch (e) {
      toast({ title: 'Could not update', description: e.message, variant: 'destructive' });
    } finally {
      setActingLegId(null);
    }
  };

  const handleDeliver = async (leg) => {
    setActingLegId(leg.id);
    try {
      const gps = await captureGPS();
      await base44.entities.DeliveryLeg.update(leg.id, {
        status: 'complete',
        delivered_at: new Date().toISOString(),
        ...(gps ? { gps_lat: gps.lat, gps_lng: gps.lng } : {}),
      });

      // Auto-update linked gear location based on leg type
      if (leg.job_cost_item_id) {
        const newLocation = leg.leg_type === 'deliver' ? 'site' : (leg.leg_type === 'collect' ? 'depot' : 'in_transit');
        try {
          await base44.entities.JobCostItem.update(leg.job_cost_item_id, {
            current_location: newLocation,
            location_updated_at: new Date().toISOString(),
          });
        } catch (e) {
          console.error('Gear location update error:', e);
        }
      }

      toast({ title: 'Delivered', description: `Leg ${leg.leg_sequence} — gear delivered to ${leg.to_location}` });
      queryClient.invalidateQueries({ queryKey: ['my-delivery-legs'] });
    } catch (e) {
      toast({ title: 'Could not update', description: e.message, variant: 'destructive' });
    } finally {
      setActingLegId(null);
    }
  };

  if (!staffId) return null;

  if (isLoading) {
    return (
      <div className="mb-4">
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    );
  }

  if (sortedLegs.length === 0) return null;

  return (
    <div className="mb-4">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
          <Link2 className="w-4 h-4 text-amber-600" />
        </div>
        <h2 className="text-lg md:text-xl font-bold text-slate-900">My Delivery Chain</h2>
        <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-amber-50 text-amber-700 ring-1 ring-amber-100">
          {activeLegs.length} active
        </span>
      </div>

      {/* Active legs timeline */}
      <div className="space-y-2.5">
        {activeLegs.map((leg, idx) => {
          const cfg = LEG_CONFIG[leg.leg_type] || LEG_CONFIG.collect;
          const st = STATUS_CONFIG[leg.status] || STATUS_CONFIG.pending;
          const Icon = cfg.icon;
          const handoverDriver = leg.handover_to_driver_id ? allStaff.find(s => s.id === leg.handover_to_driver_id) : null;
          const isActing = actingLegId === leg.id;

          return (
            <div key={leg.id} className={`bg-white rounded-2xl border border-slate-200 border-l-4 ${cfg.accent} shadow-sm overflow-hidden`}>
              <div className="p-3.5">
                {/* Top row: sequence + type + status */}
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold">{leg.leg_sequence}</span>
                    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold ring-1 ${cfg.badge}`}>
                      <Icon className="w-3 h-3" />{cfg.label}
                    </span>
                    {leg.scheduled_time && (
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />{leg.scheduled_time}
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${st.cls}`}>{st.label}</span>
                </div>

                {/* Route */}
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">From</p>
                    <p className="text-sm font-semibold text-slate-700 truncate">{leg.from_location || '—'}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">To</p>
                    <p className="text-sm font-semibold text-slate-700 truncate">{leg.to_location || '—'}</p>
                  </div>
                </div>

                {/* Job + vehicle */}
                {leg.job_name && (
                  <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />{leg.job_name}
                  </p>
                )}

                {/* Handover partner for transfers */}
                {leg.leg_type === 'transfer' && handoverDriver && (
                  <p className="text-xs text-amber-600 mb-1 flex items-center gap-1">
                    <User className="w-3 h-3" />Handover to: {handoverDriver.name}
                  </p>
                )}

                {/* Notes */}
                {leg.notes && (
                  <p className="text-xs text-slate-400 italic mb-2">{leg.notes}</p>
                )}

                {/* Action button */}
                <div className="pt-1">
                  {leg.status === 'pending' && (
                    <button
                      onClick={() => handleCollect(leg)}
                      disabled={isActing}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                    >
                      {isActing ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Package className="w-4 h-4" />}
                      {isActing ? 'Confirming…' : 'Collect Gear'}
                    </button>
                  )}
                  {leg.status === 'in_transit' && (
                    <button
                      onClick={() => handleDeliver(leg)}
                      disabled={isActing}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
                    >
                      {isActing ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      {isActing ? 'Confirming…' : 'Confirm Delivery'}
                    </button>
                  )}
                </div>
              </div>

              {/* Collected timestamp */}
              {leg.collected_at && leg.status === 'in_transit' && (
                <div className="bg-amber-50 px-3.5 py-1.5 text-[10px] text-amber-600 flex items-center gap-1">
                  <Clock className="w-3 h-3" />Collected at {format(new Date(leg.collected_at), 'HH:mm')}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Completed legs summary */}
      {completedLegs.length > 0 && (
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          <span>{completedLegs.length} leg{completedLegs.length !== 1 ? 's' : ''} completed today</span>
        </div>
      )}
    </div>
  );
}