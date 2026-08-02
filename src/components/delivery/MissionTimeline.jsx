import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, Package, ArrowRightLeft, Clock, Navigation, Phone, PlayCircle, CheckCircle2, Truck, User } from 'lucide-react';
import { format } from 'date-fns';

const typeConfig = {
  site_delivery: { label: 'Delivery', icon: Truck, dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200', iconText: 'text-emerald-600' },
  supplier_collection: { label: 'Collection', icon: Package, dot: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200', iconText: 'text-blue-600' },
  item_handover: { label: 'Handover', icon: ArrowRightLeft, dot: 'bg-purple-500', badge: 'bg-purple-100 text-purple-700 ring-1 ring-purple-200', iconText: 'text-purple-600' }
};

function legTone(minutes) {
  if (!minutes || minutes === 0) return { line: 'bg-slate-200', text: 'text-slate-400', label: '' };
  if (minutes <= 30) return { line: 'bg-emerald-400', text: 'text-emerald-600', label: 'Clear' };
  if (minutes <= 45) return { line: 'bg-amber-400', text: 'text-amber-600', label: 'Moderate' };
  return { line: 'bg-red-400', text: 'text-red-600', label: 'Heavy' };
}

export default function MissionTimeline({ deliveries, jobs, vehicles, allStaff, onStart, onComplete, canPerformActions, autoExpandId }) {
  // Sort by optimized sequence index; unoptimized go last by scheduled order
  const sorted = [...deliveries].sort((a, b) => {
    const aIdx = a.optimized_sequence_index;
    const bIdx = b.optimized_sequence_index;
    if (aIdx != null && bIdx != null) return aIdx - bIdx;
    if (aIdx != null) return -1;
    if (bIdx != null) return 1;
    return 0;
  });

  const totalDuration = sorted.reduce((sum, d) => sum + (d.leg_duration_minutes || 0), 0);
  const totalDistance = sorted.reduce((sum, d) => sum + (d.leg_distance_miles || 0), 0);
  const lastEta = sorted.length > 0 ? sorted[sorted.length - 1].optimized_eta : null;

  return (
    <div className="space-y-0">
      {/* Mission Summary Bar */}
      <div className="sticky top-14 z-20 bg-white/90 backdrop-blur-md border border-slate-200 rounded-2xl shadow-sm p-3 mb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-sm">
              <Navigation className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Mission</p>
              <p className="text-sm font-bold text-slate-900">{sorted.length} stops</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-right">
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase">Drive Time</p>
              <p className="text-sm font-bold text-slate-800 tabular-nums">{formatDuration(totalDuration)}</p>
            </div>
            <div className="w-px h-8 bg-slate-200" />
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase">Distance</p>
              <p className="text-sm font-bold text-slate-800 tabular-nums">{totalDistance.toFixed(1)} mi</p>
            </div>
            {lastEta && (
              <>
                <div className="w-px h-8 bg-slate-200" />
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase">Finish ETA</p>
                  <p className="text-sm font-bold text-emerald-700 tabular-nums">{format(new Date(lastEta), 'HH:mm')}</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative pl-8">
        {/* Vertical flow line */}
        <div className="absolute left-3.5 top-2 bottom-2 w-0.5 bg-slate-200" />

        {sorted.map((delivery, idx) => {
          const isLast = idx === sorted.length - 1;
          const type = typeConfig[delivery.delivery_type] || typeConfig.site_delivery;
          const TypeIcon = type.icon;
          const job = jobs.find(j => j.id === delivery.job_id);
          const vehicle = vehicles.find(v => v.id === delivery.vehicle_id);
          const handoverTo = allStaff.find(s => s.id === delivery.handover_to_staff_id);
          const navAddress = delivery.delivery_type === 'supplier_collection' ? delivery.pickup_address : delivery.delivery_address;
          const tone = legTone(delivery.leg_duration_minutes);
          const isCompleted = delivery.status === 'completed';
          const isInProgress = delivery.status === 'in_progress';
          const isPending = delivery.status === 'pending';
          const seq = delivery.optimized_sequence_index;

          return (
            <div key={delivery.id} className="relative pb-4">
              {/* Sequence number dot on the timeline */}
              <div className={`absolute -left-[18px] top-1 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold ring-2 ring-white shadow-sm ${isCompleted ? 'bg-emerald-600 text-white' : type.dot + ' text-white'}`}>
                {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : (seq || idx + 1)}
              </div>

              {/* Leg connector with traffic info (shown before the card, for stops after the first) */}
              {idx > 0 && delivery.leg_duration_minutes > 0 && (
                <div className="absolute -left-[14px] top-[-18px] flex items-center gap-1.5">
                  <div className={`w-1 h-3 rounded-full ${tone.line}`} />
                  <span className={`text-[10px] font-semibold ${tone.text} bg-white px-1.5 py-0.5 rounded-full shadow-sm ring-1 ring-slate-100`}>
                    {delivery.leg_duration_minutes} min{delivery.leg_distance_miles ? ` · ${delivery.leg_distance_miles}mi` : ''}
                  </span>
                </div>
              )}

              {/* Card */}
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${isCompleted ? 'opacity-60' : ''} ${isInProgress ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200'}`}
              >
                {/* Header */}
                <div className="p-3.5 pb-2.5">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${type.badge}`}>
                        <TypeIcon className="w-3 h-3" />{type.label}
                      </span>
                      {delivery.optimized_eta && !isCompleted && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                          <Clock className="w-3 h-3" />ETA {format(new Date(delivery.optimized_eta), 'HH:mm')}
                        </span>
                      )}
                    </div>
                    {isInProgress && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 ring-1 ring-blue-200">
                        <PlayCircle className="w-3 h-3" /> Active
                      </span>
                    )}
                    {isCompleted && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                        <CheckCircle2 className="w-3 h-3" /> Done
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 leading-tight truncate">{delivery.job_name || navAddress || 'Delivery task'}</h3>

                  {navAddress && (
                    <div className="mt-1.5 flex items-start gap-1.5">
                      <MapPin className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${type.iconText}`} />
                      <p className="text-xs font-medium text-slate-700 break-words leading-snug">{navAddress}</p>
                    </div>
                  )}

                  {/* Handover relay indicator */}
                  {delivery.handover_to_staff_name && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-purple-600">
                      <User className="w-3.5 h-3.5" />
                      <span className="font-medium">Relay to {delivery.handover_to_staff_name}</span>
                    </div>
                  )}
                  {delivery.handover_from_staff_name && (
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-purple-600">
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span className="font-medium">From {delivery.handover_from_staff_name}</span>
                    </div>
                  )}

                  {/* Items summary */}
                  {delivery.items && (
                    <p className="mt-1.5 text-xs text-slate-500 truncate">{delivery.items.split(',').slice(0, 3).join(', ')}{delivery.items.split(',').length > 3 ? '…' : ''}</p>
                  )}
                </div>

                {/* Actions */}
                {!isCompleted && canPerformActions && (
                  <div className="px-3.5 pb-3 flex gap-2">
                    {navAddress && (
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(navAddress)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 active:scale-95 transition touch-manipulation"
                      >
                        <Navigation className="w-4 h-4" /> Navigate
                      </a>
                    )}
                    {isPending && (
                      <button onClick={() => onStart(delivery.id)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 active:scale-95 transition touch-manipulation">
                        <PlayCircle className="w-4 h-4" /> Start
                      </button>
                    )}
                    {isInProgress && (
                      <button onClick={() => onComplete(delivery)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 active:scale-95 transition touch-manipulation">
                        <CheckCircle2 className="w-4 h-4" /> Sign Off
                      </button>
                    )}
                    {delivery.contact_phone && (
                      <a href={`tel:${delivery.contact_phone}`} className="flex items-center justify-center w-10 py-2.5 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl active:scale-95 transition touch-manipulation">
                        <Phone className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                )}
              </motion.div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatDuration(minutes) {
  if (!minutes) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}