import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Navigation, Truck, Package, Clock, CheckCircle2, PlayCircle, Phone, ChevronDown, CloudOff, ArrowRightLeft, XCircle, ClipboardList, FileText, FlaskConical, ScanLine } from 'lucide-react';
import { format } from 'date-fns';

const typeConfig = {
  site_delivery: { label: 'Delivery', icon: Truck, accent: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200' },
  supplier_collection: { label: 'Collection', icon: Package, accent: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200' },
  item_handover: { label: 'Handover', icon: ArrowRightLeft, accent: 'bg-purple-500', badge: 'bg-purple-100 text-purple-700 ring-1 ring-purple-200' },
  sample_collection: { label: 'Sample Collect', icon: FlaskConical, accent: 'bg-teal-500', badge: 'bg-teal-100 text-teal-700 ring-1 ring-teal-200' },
  sample_delivery: { label: 'Sample to Lab', icon: FlaskConical, accent: 'bg-cyan-500', badge: 'bg-cyan-100 text-cyan-700 ring-1 ring-cyan-200' }
};

const statusConfig = {
  pending: { label: 'Pending', icon: Clock, badge: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200' },
  in_progress: { label: 'Active', icon: PlayCircle, badge: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' },
  completed: { label: 'Done', icon: CheckCircle2, badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
  failed: { label: 'Failed', icon: Clock, badge: 'bg-red-50 text-red-700 ring-1 ring-red-200' }
};

export default function DeliveryCard({ delivery, job, vehicle, vehicleTotalWeight = 0, onStart, onComplete, onScanCollect, canPerformActions = true, isOfflinePending = false, defaultExpanded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded || delivery.status === 'in_progress');
  const type = typeConfig[delivery.delivery_type] || typeConfig.site_delivery;
  const status = statusConfig[delivery.status] || statusConfig.pending;
  const TypeIcon = type.icon;
  const StatusIcon = status.icon;
  const isCompleted = delivery.status === 'completed';
  const isInProgress = delivery.status === 'in_progress';
  const isPending = delivery.status === 'pending';
  const overWeight = vehicle?.max_weight_kg && vehicleTotalWeight > vehicle.max_weight_kg;

  const isSampleRun = delivery.delivery_type === 'sample_collection' || delivery.delivery_type === 'sample_delivery';
  const navAddress = (delivery.delivery_type === 'supplier_collection' || delivery.delivery_type === 'sample_collection') ? delivery.pickup_address : delivery.delivery_address;
  const destLabel = (delivery.delivery_type === 'supplier_collection' || delivery.delivery_type === 'sample_collection') ? 'Collect from' : 'Deliver to';
  const DestIcon = (delivery.delivery_type === 'supplier_collection' || delivery.delivery_type === 'sample_collection') ? Package : MapPin;
  const sampleIdList = (delivery.sample_ids || '').split(',').map(s => s.trim()).filter(Boolean);

  // Split items into scannable lines
  const itemsText = delivery.items || '';
  const itemLines = itemsText.split(/\n|,(?=\s)/).map(s => s.trim()).filter(Boolean);
  const hasItems = itemLines.length > 0;

  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } } }}
      className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
    >
      <div className={`h-1.5 ${type.accent}`} />

      {/* Weight safety banner */}
      {vehicle?.max_weight_kg && !isCompleted && (
        <div className={`flex items-center gap-2 px-4 py-2.5 ${overWeight ? 'bg-red-50 border-b border-red-200' : 'bg-emerald-50 border-b border-emerald-200'}`}>
          {overWeight ? (
            <>
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-sm font-bold text-red-700">Overweight — do not drive</p>
              <span className="ml-auto text-xs font-semibold text-red-500">{Math.round(vehicleTotalWeight)}/{vehicle.max_weight_kg}kg</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <p className="text-sm font-bold text-emerald-700">Under weight — safe to drive</p>
              <span className="ml-auto text-xs font-semibold text-emerald-500">{Math.round(vehicleTotalWeight)}/{vehicle.max_weight_kg}kg</span>
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

      {/* Header row — always visible */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${type.badge}`}>
              <TypeIcon className="w-3 h-3" />{type.label}
            </span>
            {delivery.po_number && (
              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500">PO: {delivery.po_number}</span>
            )}
            {isSampleRun && sampleIdList.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-teal-50 text-teal-700 ring-1 ring-teal-200">
                <FlaskConical className="w-3 h-3" /> {sampleIdList.length} sample{sampleIdList.length === 1 ? '' : 's'}
              </span>
            )}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${status.badge}`}>
              <StatusIcon className="w-3 h-3" />{status.label}
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 flex-shrink-0">
            <Clock className="w-3 h-3" />{format(new Date(delivery.scheduled_date + 'T00:00:00'), 'EEE dd MMM')}
          </span>
        </div>

        <h3 className="text-base font-bold text-slate-900 leading-tight">{delivery.job_name || navAddress || 'Delivery task'}</h3>

        {/* Destination — prominent */}
        {navAddress && (
          <div className="mt-2 flex items-start gap-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${delivery.delivery_type === 'supplier_collection' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
              <DestIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{destLabel}</p>
              <p className="text-sm font-semibold text-slate-800 break-words leading-snug">{navAddress}</p>
            </div>
          </div>
        )}

        {/* Items — scannable summary, always visible */}
        {hasItems && (
          <div className="mt-2.5 rounded-xl bg-slate-50 border border-slate-100 p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <ClipboardList className="w-3.5 h-3.5 text-slate-500" />
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">In this delivery ({itemLines.length})</p>
            </div>
            {itemLines.length <= 3 ? (
              <ul className="space-y-0.5">
                {itemLines.map((line, i) => (
                  <li key={i} className="text-sm text-slate-700 leading-snug flex gap-1.5">
                    <span className="text-slate-300 mt-0.5">•</span><span className="break-words">{line}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <>
                <ul className="space-y-0.5">
                  {itemLines.slice(0, 3).map((line, i) => (
                    <li key={i} className="text-sm text-slate-700 leading-snug flex gap-1.5">
                      <span className="text-slate-300 mt-0.5">•</span><span className="break-words">{line}</span>
                    </li>
                  ))}
                  <li className="text-xs text-slate-400 pl-3.5">+ {itemLines.length - 3} more — tap details</li>
                </ul>
              </>
            )}
          </div>
        )}

        {/* Contact quick row */}
        {(delivery.contact_name || delivery.contact_phone) && !isCompleted && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {delivery.contact_name && (
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-medium">{delivery.contact_name}</span>
              </span>
            )}
            {delivery.contact_phone && (
              <a href={`tel:${delivery.contact_phone}`} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-100 text-xs font-semibold text-emerald-700 active:scale-95 transition touch-manipulation">
                <Phone className="w-3.5 h-3.5" /> Call
              </a>
            )}
          </div>
        )}
      </div>

      {/* Persistent actions — no expand needed for active deliveries */}
      {!isCompleted && canPerformActions && (navAddress || isPending || isInProgress) && (
        <div className="px-4 pb-3 space-y-2">
          {navAddress && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(navAddress)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 active:scale-[0.98] transition touch-manipulation shadow-sm"
            >
              <Navigation className="w-5 h-5" /> Navigate
            </a>
          )}
          {delivery.delivery_type === 'supplier_collection' && onScanCollect && (
            <button
              onClick={() => onScanCollect(delivery)}
              className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 active:scale-[0.98] transition touch-manipulation shadow-sm"
            >
              <ScanLine className="w-5 h-5" /> Scan to Collect
            </button>
          )}
          <div className="flex gap-2">
            {isPending && (
              <button
                onClick={() => onStart(delivery.id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 active:scale-95 transition text-sm font-semibold touch-manipulation"
              >
                <PlayCircle className="w-4 h-4" /> Start
              </button>
            )}
            {isInProgress && (
              <button
                onClick={() => onComplete(delivery)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 active:scale-95 transition text-sm font-bold touch-manipulation"
              >
                <CheckCircle2 className="w-4 h-4" /> Sign Off
              </button>
            )}
          </div>
        </div>
      )}

      {!isCompleted && !canPerformActions && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-500 rounded-xl text-xs font-semibold">
            <Clock className="w-3.5 h-3.5" /> Outside working hours
          </div>
        </div>
      )}

      {/* Details toggle */}
      <button onClick={() => setExpanded(e => !e)} className="w-full flex items-center justify-center gap-1 py-2 border-t border-slate-100 text-xs font-medium text-slate-500 hover:bg-slate-50 transition">
        {expanded ? 'Hide details' : 'More details'}
        <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">
          <div className="grid grid-cols-1 gap-3">
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
            {vehicle && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Truck className="w-4 h-4 text-slate-400" /> <span className="font-mono font-medium">{vehicle.registration_number}</span>
              </div>
            )}
            {isSampleRun && sampleIdList.length > 0 && (
              <div className="p-3 bg-teal-50/60 rounded-xl border border-teal-100">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <FlaskConical className="w-3.5 h-3.5 text-teal-600" />
                  <p className="font-semibold text-slate-900 text-xs">Samples in this run ({sampleIdList.length})</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {sampleIdList.map(id => (
                    <span key={id} className="px-1.5 py-0.5 bg-white text-teal-700 rounded text-[10px] font-mono border border-teal-200">{id}</span>
                  ))}
                </div>
                {isCompleted && delivery.samples_accounted && (
                  <p className="text-[10px] text-emerald-600 mt-2 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Driver confirmed all samples accounted for
                  </p>
                )}
              </div>
            )}
            {delivery.notes && (
              <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100">
                <p className="font-semibold text-slate-900 text-xs mb-1">Notes</p>
                <p className="text-slate-600 text-sm whitespace-pre-wrap leading-relaxed">{delivery.notes}</p>
              </div>
            )}
          </div>

          {/* Completed summary */}
          {isCompleted && (
            <div className="bg-emerald-50/50 rounded-xl border border-emerald-100 p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-sm text-emerald-700">
                <CheckCircle2 className="w-4 h-4" />
                <span className="font-semibold">Signed off by {delivery.signed_by_name || 'recipient'}</span>
                {delivery.completed_at && (
                  <span className="text-xs text-slate-400 ml-auto">{format(new Date(delivery.completed_at), 'dd MMM, HH:mm')}</span>
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