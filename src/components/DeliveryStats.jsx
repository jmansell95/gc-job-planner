import React from 'react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Truck, Package, ArrowRightLeft, CheckCircle2, Clock, PackageCheck } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/StateViews';
import WidgetShell from '@/components/dashboard/WidgetShell';

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
      <WidgetShell icon={PackageCheck} title="Deliveries & Collections" subtitle="Today's delivery activity">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3 lg:gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 sm:h-24 rounded-xl" />)}
        </div>
      </WidgetShell>
    );
  }

  return (
    <WidgetShell icon={PackageCheck} title="Deliveries & Collections" subtitle="Today's delivery activity"
      action={<span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">{todays.length}</span>}>
      {todays.length === 0 ? (
        <div className="py-8 text-center text-slate-400 text-sm">
          <PackageCheck className="w-8 h-8 text-slate-200 mx-auto mb-2" />
          No deliveries or collections scheduled for today
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3 lg:gap-4">
          {cards.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, duration: 0.3 }}
                className="bg-slate-50 border border-slate-100 rounded-xl p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3">
                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${stat.gradient} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg sm:text-xl font-bold text-slate-900 leading-tight">{stat.value}</p>
                  <p className="text-xs text-slate-500 font-medium truncate">{stat.label}</p>
                  <p className="text-[11px] text-slate-400 truncate">{stat.sub}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </WidgetShell>
  );
}