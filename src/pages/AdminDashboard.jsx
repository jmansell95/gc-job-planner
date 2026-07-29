import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { canAccessSection } from '@/utils/access';
import AdminNav from '@/components/AdminNav';
import DashboardOverview from '@/components/DashboardOverview';
import JobManager from '@/components/JobManager';
import SettingsPage from '@/components/SettingsPage';
import JobDetail from '@/components/JobDetail';
import SchedulingHub from '@/components/SchedulingHub';
import SafetyCultureCheckHub from '@/components/safety/SafetyCultureCheckHub';
import AdminDeliveryHub from '@/pages/AdminDeliveryHub';
import ErrorBoundary from '@/components/ErrorBoundary';
import Breadcrumbs from '@/components/Breadcrumbs';
import { JobFilterProvider } from '@/components/dashboard/JobFilterContext';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeSection, setActiveSection] = useState('overview');
  const [selectedJob, setSelectedJob] = useState(null);
  const [settingsTab, setSettingsTab] = useState('hub');
  const [profile, setProfile] = useState(null);

  // Read navigation state passed from other pages (e.g. Vehicles → Manage Records)
  useEffect(() => {
    const navState = location.state;
    if (navState?.section) setActiveSection(navState.section);
    if (navState?.settingsTab) setSettingsTab(navState.settingsTab);
    // Clear state so a refresh doesn't re-trigger the section switch
    if (navState) window.history.replaceState({}, document.title);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The dashboard "Deliveries" stat monitor routes to the dedicated driver
  // delivery page rather than an embedded admin section. Intercept the
  // navigation, push the route, and reset the section so the admin dashboard
  // doesn't render a blank panel.
  useEffect(() => {
    if (activeSection === 'deliveries') {
      navigate('/deliveries');
      setActiveSection('overview');
    }
    if (activeSection === 'fleet') {
      navigate('/rig-hub');
      setActiveSection('overview');
    }
    if (activeSection === 'vehicles') {
      navigate('/vehicles');
      setActiveSection('overview');
    }
  }, [activeSection, navigate]);

  useEffect(() => {
    (async () => {
      try { const res = await base44.functions.invoke('getMyStaffProfile'); setProfile(res.data); } catch (e) {}
    })();
  }, []);

  // Guard: reset to overview if the active section isn't accessible to this user's role.
  // 'job-detail' is a sub-view reached from the dashboard, not a nav section — skip the guard for it.
  useEffect(() => {
    if (profile && activeSection !== 'job-detail' && !canAccessSection(profile, activeSection)) {
      setActiveSection('overview');
    }
  }, [profile, activeSection]);

  useEffect(() => {
    const handler = (e) => {
      const { section, job, settingsTab: tab } = e.detail || {};
      if (job) setSelectedJob(job);
      if (tab) setSettingsTab(tab);
      if (section) {
        if (profile && !canAccessSection(profile, section)) return;
        setActiveSection(section);
      }
    };
    window.addEventListener('app-navigate', handler);
    return () => window.removeEventListener('app-navigate', handler);
  }, [profile]);

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-slate-100/80">
      <AdminNav activeSection={activeSection} setActiveSection={setActiveSection} />
      <main className="flex-1 overflow-auto pt-[calc(1.6875rem_+_env(safe-area-inset-top))] lg:pt-0 lg:pb-0" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="px-4 pb-4 md:px-6 md:pb-6 lg:pt-6 w-full">
          <Breadcrumbs />
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <ErrorBoundary key={activeSection}>
            {activeSection === 'overview' && (
              <JobFilterProvider>
                <DashboardOverview
                  onNavigate={setActiveSection}
                  onSelectJob={(job) => { setSelectedJob(job); setActiveSection('job-detail'); }}
                />
              </JobFilterProvider>
            )}
            {activeSection === 'job-detail' && selectedJob && (
              <JobDetail job={selectedJob} onBack={() => setActiveSection('overview')} />
            )}
            {activeSection === 'jobs' && <JobManager onNavigateRota={() => setActiveSection('scheduling')} />}
            {(activeSection === 'scheduling' || activeSection === 'rota' || activeSection === 'calendar') && (
              <SchedulingHub initialTab={activeSection === 'calendar' ? 'calendar' : 'rota'} />
            )}
            {activeSection === 'logistics' && <AdminDeliveryHub />}
            {activeSection === 'timesheets' && <SettingsPage initialTab="timesheets" />}
            {activeSection === 'teams' && <SettingsPage initialTab="teams" />}
            {activeSection === 'compliance' && <SettingsPage initialTab="compliance" />}
            {activeSection === 'safety-hub' && <SafetyCultureCheckHub onNavigate={setActiveSection} />}
            {activeSection === 'log-qc' && <SettingsPage initialTab="log-qc" />}
            {activeSection === 'billing' && <SettingsPage initialTab="invoicing" onSelectJob={(job) => { setSelectedJob(job); setActiveSection('job-detail'); }} />}
            {activeSection === 'settings' && <SettingsPage initialTab={settingsTab} onSelectJob={(job) => { setSelectedJob(job); setActiveSection('job-detail'); }} />}
            </ErrorBoundary>
          </motion.div>
        </div>
      </main>
    </div>
  );
}