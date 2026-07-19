import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Truck, Package, ArrowRightLeft, CheckCircle2, Clock, PackageCheck, MapPin, X } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/StateViews';
import WidgetShell from '@/components/dashboard/WidgetShell';
import { useJobFilter } from '@/components/dashboard/JobFilterContext';

export default function DeliveryStats({ onNavigate, onSelectJob, jobs = [] }) {
  const [drillType, setDrillType] = useState(null);
  const { selectedJobId } = useJobFilter();
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: ['dashboard-deliveries', todayStr],
    queryFn: () => base44.entities.DeliveryLog.filter({ scheduled_date: todayStr }, '-created_date', 200)
  });

  const todays = deliveries.filter(d => d.scheduled_date === todayStr && (selectedJobId === 'all' || d.job_id === selectedJobId));
  const siteDeliveries = todays.filter(d => d.delivery_type === 'site_delivery');
  const collections = todays.filter(d => d.delivery_type === 'supplier_collection');
  const handovers = todays.filter(d => d.delivery_type === 'item_handover');
  const completed = todays.filter(d => d.status === 'completed');
  const inProgress = todays.filter(d => d.status === 'in_progress');
  const pending = todays.filter(d => d.status === 'pending');

  const cards = [
    { key: 'site_delivery', label: 'To Site', value: siteDeliveries.length, icon: Truck, gradient: 'stat-gradient-emerald', sub: `${siteDeliveries.filter(d => d.status === 'completed').length} done`, items: siteDeliveries },
    { key: 'supplier_collection', label: 'Collections', value: collections.length, icon: Package, gradient: 'stat-gradient-blue', sub: `${collections.filter(d => d.status === 'completed').length} done`, items: collections },
    { key: 'item_handover', label: 'Handovers', value: handovers.length, icon: ArrowRightLeft, gradient: 'stat-gradient-amber', sub: `${handovers.filter(d => d.status === 'completed').length} done`, items: handovers },
    { key: 'completed', label: 'Completed', value: completed.length, icon: CheckCircle2, gradient: 'stat-gradient-slate', sub: `${pending.length + inProgress.length} remaining`, items: completed },
  ];

  const activeDrill = drillType ? cards.find(c => c.key === drillType) : null;

  const statusTone = (s) => s === 'completed' ? 'bg-emerald-50 text-emerald-700'
    : s === 'in_progress' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500';

  if (isLoading) {
    return (
      <WidgetShell icon={PackageCheck} title="Deliveries & Collections" subtitle="Today's delivery activity">
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:gap-4">
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
        <>
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:gap-4">
            {cards.map((stat, i) => {
              const Icon = stat.icon;
              const active = drillType === stat.key;
              return (
                <motion.button key={stat.key} type="button"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, duration: 0.3 }}
                  onClick={() => setDrillType(active ? null : stat.key)}
                  className={`bg-slate-50 border rounded-xl p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3 text-left transition ${active ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/40'}`}>
                  <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${stat.gradient} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                    <Icon className="w-4 h-4 sm:w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-lg sm:text-xl font-bold text-slate-900 leading-tight">{stat.value}</p>
                    <p className="text-xs text-slate-500 font-medium truncate">{stat.label}</p>
                    <p className="text-[11px] text-slate-400 truncate">{stat.sub}</p>
                  </div>
                </motion.button>
              );
            })}
          </div>

          <AnimatePresence>
            {activeDrill && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{activeDrill.label} today</p>
                    <button type="button" onClick={() => setDrillType(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded transition">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {activeDrill.items.length === 0 ? (
                    <p className="text-xs text-slate-400 py-2">None scheduled today.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-52 overflow-y-auto">
                      {activeDrill.items.map(d => {
                        const job = jobs.find(j => j.id === d.job_id);
                        const clickable = !!onSelectJob && !!job;
                        return (
                          <button key={d.id} type="button"
                            onClick={() => clickable && onSelectJob(job)}
                            disabled={!clickable}
                            className={`w-full flex items-center gap-2 text-left p-2 rounded-lg bg-white border border-slate-100 transition ${clickable ? 'hover:border-emerald-200 hover:bg-emerald-50/30 cursor-pointer' : 'cursor-default'}`}>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-slate-800 truncate">{d.job_name || d.items || 'Delivery task'}</p>
                              <p className="text-[10px] text-slate-400 truncate flex items-center gap-1 flex-wrap">
                                <span className="inline-flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" /> {format(new Date(d.scheduled_date + 'T00:00:00'), 'dd MMM')}</span>
                                {d.driver_staff_name && <><span>·</span><span>{d.driver_staff_name}</span></>}
                                {d.delivery_address && <><span>·</span><span className="inline-flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{d.delivery_address.substring(0, 24)}</span></>}
                              </p>
                            </div>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${statusTone(d.status)}`}>{d.status}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </WidgetShell>
  );
}