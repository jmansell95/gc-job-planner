import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Grid3x3, BarChart3 } from 'lucide-react';
import { JobStatusChart, StaffUtilizationChart, JobTypeBreakdownChart } from '@/components/DashboardCharts';
import FieldCrewsToday from '@/components/FieldCrewsToday';
import WidgetShell from '@/components/dashboard/WidgetShell';

const cardVariants = {
  hidden: { opacity: 0, y: 14 },
  show: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.35 } })
};

export function KpiStatsWidget({ stats, onNavigate }) {
  return (
    <WidgetShell icon={Grid3x3} title="Key Metrics" subtitle="Today's operational snapshot">
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.button key={stat.label} custom={i} initial="hidden" animate="show" variants={cardVariants}
              onClick={() => onNavigate(stat.nav)}
              className={`${stat.gradient} relative overflow-hidden rounded-xl p-4 sm:p-5 flex items-center gap-3 sm:gap-4 text-left group hover:shadow-lg hover:-translate-y-0.5 transition shadow-sm`}>
              <div className="absolute inset-0 bg-white/10 pointer-events-none" />
              <div className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-white/20 ring-1 ring-white/30 flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
                <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div className="relative min-w-0">
                <p className="text-2xl sm:text-3xl font-bold text-white leading-tight">{stat.value}</p>
                <p className="text-xs text-white/90 font-medium">{stat.label}</p>
                <p className="text-[11px] text-white/70 truncate">{stat.sub}</p>
              </div>
              <ArrowRight className="relative w-4 h-4 text-white/60 group-hover:text-white group-hover:translate-x-0.5 transition ml-auto flex-shrink-0" />
            </motion.button>
          );
        })}
      </div>
    </WidgetShell>
  );
}

export function FieldCrewsWidget({ todaysRotas, staff, jobs, vehicles, onSelectJob, onNavigate }) {
  return (
    <FieldCrewsToday todaysRotas={todaysRotas} staff={staff} jobs={jobs} vehicles={vehicles} onSelectJob={onSelectJob} onNavigate={onNavigate} />
  );
}

export function ChartsWidget({ jobs, staff, rotas, weekDays }) {
  return (
    <WidgetShell icon={BarChart3} title="Charts" subtitle="Jobs, types & crew utilisation">
      <div className="grid grid-cols-1 gap-4">
        <JobStatusChart jobs={jobs} />
        <JobTypeBreakdownChart jobs={jobs} />
        <StaffUtilizationChart staff={staff} rotas={rotas} weekDays={weekDays} />
      </div>
    </WidgetShell>
  );
}