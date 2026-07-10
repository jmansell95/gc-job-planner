import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { JobStatusChart, StaffUtilizationChart, JobTypeBreakdownChart } from '@/components/DashboardCharts';
import DashboardInsights from '@/components/DashboardInsights';
import FieldCrewsToday from '@/components/FieldCrewsToday';

const cardVariants = {
  hidden: { opacity: 0, y: 14 },
  show: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.35 } })
};

export function KpiStatsWidget({ stats, onNavigate }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {stats.map((stat, i) => {
        const Icon = stat.icon;
        return (
          <motion.button key={stat.label} custom={i} initial="hidden" animate="show" variants={cardVariants}
            onClick={() => onNavigate(stat.nav)}
            className="card-modern rounded-2xl p-4 sm:p-5 flex items-center gap-3 sm:gap-4 text-left group">
            <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl ${stat.gradient} flex items-center justify-center flex-shrink-0 shadow-md`}>
              <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">{stat.value}</p>
              <p className="text-xs text-slate-500 font-medium">{stat.label}</p>
              <p className="text-[11px] text-slate-400 truncate">{stat.sub}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition ml-auto flex-shrink-0" />
          </motion.button>
        );
      })}
    </div>
  );
}

export function FieldCrewsWidget({ todaysRotas, staff, jobs, vehicles, onSelectJob, onNavigate }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <FieldCrewsToday todaysRotas={todaysRotas} staff={staff} jobs={jobs} vehicles={vehicles} onSelectJob={onSelectJob} onNavigate={onNavigate} />
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.35 }}>
        <DashboardInsights />
      </motion.div>
    </div>
  );
}

export function ChartsWidget({ jobs, staff, rotas, weekDays }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <JobStatusChart jobs={jobs} />
      <JobTypeBreakdownChart jobs={jobs} />
      <div className="lg:col-span-2">
        <StaffUtilizationChart staff={staff} rotas={rotas} weekDays={weekDays} />
      </div>
    </div>
  );
}