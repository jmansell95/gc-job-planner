import React from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { MapPin, Package, User, Clock, CheckCircle2, PlayCircle, ArrowRightLeft, Truck, FileText, Phone, AlertTriangle, ShieldCheck, ArrowDownToLine } from 'lucide-react';

const typeConfig = {
  site_delivery: { label: 'Delivery', icon: Truck, accent: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', dot: 'bg-emerald-500' },
  supplier_collection: { label: 'Collection', icon: Package, accent: 'bg-blue-500', badge: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200', dot: 'bg-blue-500' },
  item_handover: { label: 'Handover', icon: ArrowRightLeft, accent: 'bg-purple-500', badge: 'bg-purple-50 text-purple-700 ring-1 ring-purple-200', dot: 'bg-purple-500' }
};

const statusConfig = {
  pending: { label: 'Scheduled', icon: Clock, color: 'text-slate-500' },
  in_progress: { label: 'In Transit', icon: PlayCircle, color: 'text-blue-600' },
  completed: { label: 'Completed', icon: CheckCircle2, color: 'text-emerald-600' },
  failed: { label: 'Failed', icon: AlertTriangle, color: 'text-red-600' }
};

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
}

export default function DeliveryBoardCard({ delivery, job, driver, onClick }) {
  const type = typeConfig[delivery.delivery_type] || typeConfig.site_delivery;
  const status = statusConfig[delivery.status] || statusConfig.pending;
  const TypeIcon = type.icon;
  const StatusIcon = status.icon;
  const isCompleted = delivery.status === 'completed';
  const isHandoverChain = !!delivery.parent_delivery_id;
  const driverName = delivery.driver_staff_name || driver?.name || 'Unassigned';
  const dest = delivery.delivery_type === 'supplier_collection' ? delivery.pickup_address : delivery.delivery_address;

  const itemLines = (delivery.items || '').split(/\n|,(?=\s)/).map(s => s.trim()).filter(Boolean);
  const isOverdue = delivery.status === 'pending' && delivery.scheduled_date && new Date(delivery.scheduled_date + 'T23:59:59') < new Date();
  const isAtRisk = delivery.status === 'pending' && delivery.scheduled_date && !isOverdue && new Date(delivery.scheduled_date) < new Date(Date.now() + 24 * 60 * 60 * 1000);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      onClick={() => onClick?.(delivery)}
      className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden cursor-pointer hover:shadow-md hover:border-slate-300 transition ${isOverdue ? 'ring-2 ring-rose-300' : isAtRisk ? 'ring-2 ring-amber-200' : ''}`}
    >
      <div className={`h-1 ${type.accent}`} />
      <div className="p-3 space-y-2">
        {/* Type + status + date */}
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${type.badge}`}>
              <TypeIcon className="w-3 h-3" />{type.label}
            </span>
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${status.color}`}>
              <StatusIcon className="w-3 h-3" />{status.label}
            </span>
            {isHandoverChain && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                <ArrowDownToLine className="w-2.5 h-2.5" />chained
              </span>
            )}
            {isOverdue && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
                <AlertTriangle className="w-2.5 h-2.5" />overdue
              </span>
            )}
            {isAtRisk && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                <Clock className="w-2.5 h-2.5" />at risk
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-400 flex-shrink-0">{format(new Date(delivery.scheduled_date + 'T00:00:00'), 'dd MMM')}</span>
        </div>

        {/* Job name */}
        <p className="text-sm font-bold text-slate-900 leading-tight truncate">{delivery.job_name || job?.name || 'Delivery task'}</p>

        {/* Destination */}
        {dest && (
          <div className="flex items-start gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-slate-600 leading-snug line-clamp-2">{dest}</p>
          </div>
        )}

        {/* Items count */}
        {itemLines.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Package className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span>{itemLines.length} item{itemLines.length > 1 ? 's' : ''}</span>
            <span className="text-slate-300">·</span>
            <span className="truncate">{itemLines[0]}{itemLines.length > 1 ? '…' : ''}</span>
          </div>
        )}

        {/* Driver */}
        <div className="flex items-center justify-between pt-1.5 border-t border-slate-100">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
              {initials(driverName)}
            </div>
            <span className="text-xs font-medium text-slate-700 truncate">{driverName}</span>
          </div>
          {isCompleted && delivery.signed_by_name && (
            <div className="flex items-center gap-1 text-[10px] text-emerald-600 flex-shrink-0">
              <ShieldCheck className="w-3 h-3" />
              <span className="truncate max-w-[80px]">{delivery.signed_by_name}</span>
            </div>
          )}
        </div>

        {/* Handover indicator */}
        {delivery.handover_to_staff_name && isCompleted && (
          <div className="flex items-center gap-1 text-[10px] text-purple-600 bg-purple-50 rounded px-1.5 py-1">
            <ArrowRightLeft className="w-2.5 h-2.5" />
            <span className="truncate">Handed to {delivery.handover_to_staff_name}</span>
          </div>
        )}
        {delivery.handover_from_staff_name && !isCompleted && (
          <div className="flex items-center gap-1 text-[10px] text-purple-600 bg-purple-50 rounded px-1.5 py-1">
            <ArrowDownToLine className="w-2.5 h-2.5" />
            <span className="truncate">From {delivery.handover_from_staff_name} — deliver to recipient</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}