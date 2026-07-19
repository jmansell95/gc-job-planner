import React from 'react';
import { motion } from 'framer-motion';
import { Grid3x3, BarChart3 } from 'lucide-react';
import { JobStatusChart, StaffUtilizationChart, JobTypeBreakdownChart } from '@/components/DashboardCharts';
import FieldCrewsToday from '@/components/FieldCrewsToday';
import WidgetShell from '@/components/dashboard/WidgetShell';
import StatCard from '@/components/dashboard/StatCard';

const cardVariants = {
  hidden: { opacity: 0, y: 14 },
  show: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.35 } })
};

export function KpiStatsWidget({ stats, onNavigate }) {
  return (
    <WidgetShell icon={Grid3x3} title="Key Metrics" subtitle="Today's operational snapshot">
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {stats.map((stat, i) => (
          <motion.div key={stat.label} custom={i} initial="hidden" animate="show" variants={cardVariants}>
            <StatCard icon={stat.icon} value={stat.value} label={stat.label} sub={stat.sub} gradient={stat.gradient} arrow onClick={() => onNavigate(stat.nav)} />
          </motion.div>
        ))}
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