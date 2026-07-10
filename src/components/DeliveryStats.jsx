import React from 'react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Truck, Package, ArrowRightLeft, CheckCircle2, Clock, PackageCheck } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/StateViews';

export default function DeliveryStats({ onNavigate }) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: ['dashboard-deliveries', todayStr],
    queryFn: () => base44.entities.DeliveryLog.filter({ scheduled_date: todayStr }, '-created_date', 200)
  });

  const todays = deliveries.filter(d => d.scheduled_date === todayStr);
  const siteDeliveries = todays.filter(d => d.delivery_type === 'site_delivery');
  const collections = todays.filter(d => d.delivery_type === 'supplier_collection');
  const handovers = todays.filter(d => d.delivery_type === 'item_handover');
  const completed = todays.filter(d => d.status === 'completed');
  const inProgress = todays.filter(d => d.status === 'in_progress');
  const pending = todays.filter(d => d.status === 'pending');

  const cards = [
    { label: 'To Site', value: siteDeliveries.length, icon: Truck, gradient: 'stat-gradient-emerald', sub: `${siteDeliveries.filter(d => d.status === 'completed').length} done` },
    { label: 'Collections', value: collections.length, icon: Package, gradient: 'stat-gradient-blue', sub: `${collections.filter(d => d.status === 'completed').length} done` },
    { label: 'Handovers', value: handovers.length, icon: ArrowRightLeft, gradient: 'stat-gradient-amber', sub: `${handovers.filter(d => d.status === 'completed').length} done` },
    { label: 'Completed', value: completed.length, icon: CheckCircle2, gradient: 'stat-gradient-slate', sub: `${pending.length + inProgress.length} remaining` },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
    );
  }

  if (todays.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <PackageCheck className="w-4 h-4 text-emerald-600" />
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Deliveries &amp; Collections Today</h2>
        <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">{todays.length}</span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {cards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, duration: 0.3 }}
              className="card-modern rounded-2xl p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${stat.gradient} flex items-center justify-center flex-shrink-0 shadow-md`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold text-slate-900 leading-tight">{stat.value}</p>
                <p className="text-xs text-slate-500 font-medium">{stat.label}</p>
                <p className="text-[11px] text-slate-400 truncate">{stat.sub}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}