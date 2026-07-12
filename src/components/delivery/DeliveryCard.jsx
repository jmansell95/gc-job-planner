import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Navigation, Truck, Package, Clock, CheckCircle2, PlayCircle, Phone, FileText, ChevronDown, CloudOff, Building2, ArrowRightLeft, XCircle } from 'lucide-react';
import { format } from 'date-fns';

const typeConfig = {
  site_delivery: { label: 'Site Delivery', icon: Truck, accent: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200' },
  supplier_collection: { label: 'Supplier Collection', icon: Package, accent: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200' },
  item_handover: { label: 'Item Handover', icon: ArrowRightLeft, accent: 'bg-purple-500', badge: 'bg-purple-100 text-purple-700 ring-1 ring-purple-200' }
};

const statusConfig = {
  pending: { label: 'Pending', icon: Clock, badge: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200' },
  in_progress: { label: 'In Progress', icon: PlayCircle, badge: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' },
  completed: { label: 'Completed', icon: CheckCircle2, badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
  failed: { label: 'Failed', icon: Clock, badge: 'bg-red-50 text-red-700 ring-1 ring-red-200' }
};

export default function DeliveryCard({ delivery, job, vehicle, vehicleTotalWeight = 0, onStart, onComplete, canPerformActions = true, isOfflinePending = false, defaultExpanded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded || delivery.status === 'in_progress');
  const type = typeConfig[delivery.delivery_type] || typeConfig.site_delivery;
  const status = statusConfig[delivery.status] || statusConfig.pending;
  const TypeIcon = type.icon;
  const StatusIcon = status.icon;
  const isCompleted = delivery.status === 'completed';
  const isInProgress = delivery.status === 'in_progress';

  const navAddress = delivery.delivery_type === 'supplier_collection' ? delivery.pickup_address : delivery.delivery_address;
  const destLabel = delivery.delivery_type === 'supplier_collection' ? 'Pickup' : 'Deliver to';

  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } } }}
      className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
    >
      <div className={`h-1.5 ${type.accent}`} />

      {/* Weight safety banner — driver only needs green tick / red cross */}
      {vehicle?.max_weight_kg && !isCompleted && (
        <div className={`flex items-center gap-2 px-4 py-2.5 ${vehicleTotalWeight > vehicle.max_weight_kg ? 'bg-red-50 border-b border-red-200' : 'bg-emerald-50 border-b border-emerald-200'}`}>
          {vehicleTotalWeight > vehicle.max_weight_kg ? (
            <>
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-sm font-bold text-red-700">Overweight — do not drive</p>
              <span className="ml-auto text-xs font-semibold text-red-500">{Math.round(vehicleTotalWeight)} / {vehicle.max_weight_kg} kg</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <p className="text-sm font-bold text-emerald-700">Under weight — safe to drive</p>
              <span className="ml-auto text-xs font-semibold text-emerald-500">{Math.round(vehicleTotalWeight)} / {vehicle.max_weight_kg} kg</span>
            </>
          )}
        </div>
      )}

      {/* Offline pending banner */}
      {isOfflinePending && (
        <div className="flex items-center gap-2 bg-amber-50 border-b border-amber-100 px-4 py-2">
          <CloudOff className="w-4 h-4 text-amber-600" />
          <p className="text-xs font-semibold text-amber-800">Signed off offline — waiting for signal to sync</p>
        </div>
      )}

      {/* Compact header */}
      <button onClick={() => setExpanded(e => !e)} className="w-full text-left p-4 flex items-start gap-3 hover:bg-slate-50/60 transition">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${type.badge}`}>
              <TypeIcon className="w-3 h-3 inline mr-0.5" />{type.label}
            </span>
            {delivery.po_number && (
              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500">PO: {delivery.po_number}</span>
            )}
          </div>
          <h3 className="text-base font-bold text-slate-900 leading-tight">{delivery.items || delivery.job_name || 'Delivery task'}</h3>
          {delivery.job_name && delivery.items && (
            <p className="text-xs text-slate-400 mt-0.5 truncate">{delivery.job_name}</p>
          )}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100 text-xs">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-medium text-slate-700">{format(new Date(delivery.scheduled_date + 'T00:00:00'), 'EEE dd MMM')}</span>
            </span>
            {delivery.contact_name && (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-medium text-slate-700">{delivery.contact_name}</span>
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${status.badge}`}>
            <StatusIcon className="w-3 h-3" /> <span className="hidden sm:inline">{status.label}</span>
          </span>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-100 pt-4">
          {/* Navigation — most prominent action */}
          {navAddress && !isCompleted && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(navAddress)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100 hover:bg-emerald-100 transition mb-3 group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Navigation className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide">{destLabel}</p>
                  <p className="font-semibold text-emerald-900 text-sm truncate">{navAddress}</p>
                </div>
              </div>
              <span className="text-xs font-bold text-emerald-700 group-hover:translate-x-0.5 transition">Navigate →</span>
            </a>
          )}

          {/* Action buttons */}
          {!isCompleted && (
            <div className="flex flex-wrap gap-2 mb-4">
              {!canPerformActions && (
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-500 rounded-xl text-xs font-semibold">
                  <Clock className="w-3.5 h-3.5" /> Outside working hours
                </div>
              )}
              {canPerformActions && delivery.status === 'pending' && (
                <button
                  onClick={() => onStart(delivery.id)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 active:scale-95 transition text-sm font-semibold touch-manipulation"
                >
                  <PlayCircle className="w-4 h-4" /> Start
                </button>
              )}
              {canPerformActions && isInProgress && (
                <button
                  onClick={() => onComplete(delivery)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 active:scale-95 transition text-sm font-semibold touch-manipulation"
                >
                  <CheckCircle2 className="w-4 h-4" /> Sign Off
                </button>
              )}
            </div>
          )}

          {/* Details grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div className="space-y-2">
              {delivery.pickup_address && (
                <div className="flex items-start gap-2 text-sm text-slate-600">
                  <Package className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Pickup from</span>
                    <p className="break-words">{delivery.pickup_address}</p>
                  </div>
                </div>
              )}
              {delivery.delivery_address && (
                <div className="flex items-start gap-2 text-sm text-slate-600">
                  <MapPin className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Deliver to</span>
                    <p className="break-words">{delivery.delivery_address}</p>
                  </div>
                </div>
              )}
              {delivery.contact_phone && (
                <a href={`tel:${delivery.contact_phone}`} className="flex items-center gap-2 text-sm text-emerald-700 font-semibold hover:underline">
                  <Phone className="w-4 h-4" /> {delivery.contact_phone}
                </a>
              )}
              {vehicle && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Truck className="w-4 h-4 text-slate-400" /> <span className="font-mono font-medium">{vehicle.registration_number}</span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              {delivery.items && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="font-semibold text-slate-900 text-xs mb-1">Items</p>
                  <p className="text-slate-600 text-sm whitespace-pre-wrap leading-relaxed">{delivery.items}</p>
                </div>
              )}
              {delivery.notes && (
                <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100">
                  <p className="font-semibold text-slate-900 text-xs mb-1">Notes</p>
                  <p className="text-slate-600 text-sm whitespace-pre-wrap leading-relaxed">{delivery.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Completed summary */}
          {isCompleted && (
            <div className="bg-emerald-50/50 rounded-xl border border-emerald-100 p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-sm text-emerald-700">
                <CheckCircle2 className="w-4 h-4" />
                <span className="font-semibold">Signed off by {delivery.signed_by_name || 'recipient'}</span>
                {delivery.completed_at && (
                  <span className="text-xs text-slate-400 ml-auto">{format(new Date(delivery.completed_at), 'dd MMM yyyy, HH:mm')}</span>
                )}
              </div>
              {delivery.condition_report && (
                <p className="text-xs text-slate-600 pl-6">Condition: {delivery.condition_report}</p>
              )}
              {delivery.synced_from_offline && (
                <p className="text-[10px] text-amber-600 pl-6 flex items-center gap-1">
                  <CloudOff className="w-3 h-3" /> Completed offline, synced later
                </p>
              )}
              {delivery.signature_url && (
                <div className="pl-6">
                  <img src={delivery.signature_url} alt="Signature" className="max-h-20 rounded-lg border border-slate-200" />
                </div>
              )}
              {delivery.photo_urls && (
                <div className="pl-6 flex gap-2 flex-wrap">
                  {delivery.photo_urls.split(',').filter(Boolean).map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                      <img src={url} alt={`Evidence ${i + 1}`} className="w-16 h-16 object-cover rounded-lg border border-slate-200" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}