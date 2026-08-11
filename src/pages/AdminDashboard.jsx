import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { canAccessSection } from '@/utils/access';
import { STANDALONE_ROUTES } from '@/utils/standaloneRoutes';
import AdminNav from '@/components/AdminNav';
import MobileBottomNav from '@/components/MobileBottomNav';
import DashboardOverview from '@/components/DashboardOverview';
import JobManager from '@/components/JobManager';
import SettingsPage from '@/components/SettingsPage';
import JobDetail from '@/components/JobDetail';
import SchedulingHub from '@/components/SchedulingHub';
import InvestigationHub from '@/components/investigation/InvestigationHub';
import AdminDeliveryHub from '@/pages/AdminDeliveryHub';
import ErrorBoundary from '@/components/ErrorBoundary';
import Breadcrumbs from '@/components/Breadcrumbs';
import RedAlertBanner from '@/components/safety/RedAlertBanner';
import { JobFilterProvider } from '@/components/dashboard/JobFilterContext';

const SECTION_LABELS = {
  overview: 'Dashboard',
  'job-detail': 'Job Detail',
  jobs: 'Jobs',
  scheduling: 'Scheduling',
  rota: 'Scheduling',
  calendar: 'Calendar',
  logistics: 'Deliveries',
  timesheets: 'Timesheets',
  teams: 'Staff',
  compliance: 'Compliance & Audit',
  safety: 'Safety',
  'safety-hub': 'Safety Hub',
  'log-qc': 'Audit',
  investigation: 'Investigation Hub',
  billing: 'Financial Control',
  settings: 'System',
  assets: 'Assets & Fleet',
  vehicles: 'Fleet',
  staff: 'Staff & Teams',
  contacts: 'Contacts',
  automations: 'Automations',
  'price-list': 'Price List',
  reports: 'Reports',
  import: 'Import',
  audit: 'Audit',
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeSection, setActiveSection] = useState('overview');
  const [selectedJob, setSelectedJob] = useState(null);
  const [settingsTab, setSettingsTab] = useState('hub');
  const [profile, setProfile] = useState(null);

  // Read navigation state passed from other pages (e.g. Vehicles → Manage Records).
  // Standalone sections are redirected immediately so the dashboard never
  // tries to render a panel it doesn't have (which caused blank screens).
  useEffect(() => {
    const navState = location.state;
    if (navState?.section && STANDALONE_ROUTES[navState.section]) {
      navigate(STANDALONE_ROUTES[navState.section], { replace: true });
    } else if (navState?.section) {
      setActiveSection(navState.section);
    }
    if (navState?.settingsTab) setSettingsTab(navState.settingsTab);
    if (navState?.job) setSelectedJob(navState.job);
    // Clear state so a refresh doesn't re-trigger the section switch
    if (navState) window.history.replaceState({}, document.title);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Wrapper that sends standalone sections (Staff, Contacts, Price List, etc.)
  // straight to their own routes — avoids the blank-flash round-trip through
  // the internal section state.
  const handleSetActiveSection = (section) => {
    if (STANDALONE_ROUTES[section]) {
      navigate(STANDALONE_ROUTES[section]);
    } else {
      setActiveSection(section);
    }
  };

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
        handleSetActiveSection(section);
      }
    };
    window.addEventListener('app-navigate', handler);
    return () => window.removeEventListener('app-navigate', handler);
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col lg:flex-row min-h-screen page-bg-vibrant">
      <AdminNav activeSection={activeSection} setActiveSection={handleSetActiveSection} onSettingsTabClick={(tab) => { setSettingsTab(tab); setActiveSection('settings'); }} />
      <div className="flex-1 flex flex-col min-h-0">
        <RedAlertBanner />
      <main className="flex-1 overflow-auto pt-[calc(3.5rem+env(safe-area-inset-top)-25px)] lg:pt-0">
        <div className="px-4 pb-24 md:px-6 lg:pb-4 lg:pt-6 w-full">
          <Breadcrumbs sectionLabel={SECTION_LABELS[activeSection]} />
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
                  onNavigate={handleSetActiveSection}
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
            {activeSection === 'investigation' && <InvestigationHub onNavigate={handleSetActiveSection} />}
            {activeSection === 'settings' && <SettingsPage initialTab={settingsTab} onSelectJob={(job) => { setSelectedJob(job); setActiveSection('job-detail'); }} />}
            </ErrorBoundary>
          </motion.div>
        </div>
      </main>
      <MobileBottomNav />
      </div>
    </div>
  );
}