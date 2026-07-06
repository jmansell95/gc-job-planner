import React, { useState } from 'react';
import { motion } from 'framer-motion';
import AdminNav from '@/components/AdminNav';
import DashboardOverview from '@/components/DashboardOverview';
import JobManager from '@/components/JobManager';
import TeamManager from '@/components/TeamManager';
import WeeklyRotaBuilder from '@/components/WeeklyRotaBuilder';
import SettingsPage from '@/components/SettingsPage';
import JobDetail from '@/components/JobDetail';
import TimesheetManager from '@/components/TimesheetManager';
import CalendarView from '@/components/CalendarView';
import WeeklyInsightsPage from '@/components/WeeklyInsightsPage';
import ReportsManager from '@/components/ReportsManager';

export default function AdminDashboard() {
  const [activeSection, setActiveSection] = useState('overview');
  const [selectedJob, setSelectedJob] = useState(null);

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-slate-100">
      <AdminNav activeSection={activeSection} setActiveSection={setActiveSection} />
      <main className="flex-1 overflow-auto pt-[calc(3.5rem+env(safe-area-inset-top))] pb-0 lg:pt-0 lg:pb-0">
        <div className="p-4 md:p-8 max-w-7xl mx-auto w-full">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {activeSection === 'overview' && (
              <DashboardOverview
                onNavigate={setActiveSection}
                onSelectJob={(job) => { setSelectedJob(job); setActiveSection('job-detail'); }}
              />
            )}
            {activeSection === 'job-detail' && selectedJob && (
              <JobDetail job={selectedJob} onBack={() => setActiveSection('overview')} />
            )}
            {activeSection === 'jobs' && <JobManager />}
            {activeSection === 'rota' && <WeeklyRotaBuilder />}
            {activeSection === 'timesheets' && <TimesheetManager />}
            {activeSection === 'calendar' && <CalendarView />}
            {activeSection === 'teams' && <TeamManager />}
            {activeSection === 'reports' && <ReportsManager />}
            {activeSection === 'insights' && <WeeklyInsightsPage />}
            {activeSection === 'settings' && <SettingsPage />}
          </motion.div>
        </div>
      </main>
    </div>
  );
}