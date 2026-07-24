import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { canAccessSection } from '@/utils/access';
import AdminNav from '@/components/AdminNav';
import DashboardOverview from '@/components/DashboardOverview';
import JobManager from '@/components/JobManager';
import SettingsPage from '@/components/SettingsPage';
import JobDetail from '@/components/JobDetail';
import SchedulingHub from '@/components/SchedulingHub';
import { JobFilterProvider } from '@/components/dashboard/JobFilterContext';

export default function AdminDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const activeSection = searchParams.get('section') || 'overview';
  const jobIdParam = searchParams.get('job');
  const settingsTab = searchParams.get('tab') || 'hub';
  const [profile, setProfile] = useState(null);
  const [jobCache, setJobCache] = useState({});
  const [selectedJob, setSelectedJob] = useState(null);

  useEffect(() => {
    (async () => {
      try { const res = await base44.functions.invoke('getMyStaffProfile'); setProfile(res.data); } catch (e) {}
    })();
  }, []);

  // Resolve the selected job from the URL param (cache first, else fetch).
  useEffect(() => {
    if (activeSection !== 'job-detail' || !jobIdParam) return;
    if (jobCache[jobIdParam]) { setSelectedJob(jobCache[jobIdParam]); return; }
    let cancelled = false;
    base44.entities.Job.get(jobIdParam)
      .then(j => { if (!cancelled) { setSelectedJob(j); setJobCache(c => ({ ...c, [jobIdParam]: j })); } })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, jobIdParam]);

  // Guard: reset to overview if the active section isn't accessible to this role.
  useEffect(() => {
    if (profile && activeSection !== 'job-detail' && !canAccessSection(profile, activeSection)) {
      setSearchParams({ section: 'overview' }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, activeSection]);

  // Navigation helper — pushes a new history entry so the browser back
  // button walks back through sections and job details (proper back stack).
  const goTo = useCallback((section, opts = {}) => {
    const params = { section };
    if (opts.job) {
      params.job = opts.job.id;
      setJobCache(c => ({ ...c, [opts.job.id]: opts.job }));
      setSelectedJob(opts.job);
    }
    if (opts.settingsTab) params.tab = opts.settingsTab;
    setSearchParams(params);
  }, [setSearchParams]);

  const openJob = useCallback((job) => goTo('job-detail', { job }), [goTo]);

  // Cross-component navigation event (used by nav, settings, etc.)
  useEffect(() => {
    const handler = (e) => {
      const { section, job, settingsTab: tab } = e.detail || {};
      if (!section) return;
      if (profile && !canAccessSection(profile, section)) return;
      goTo(section, { job, settingsTab: tab });
    };
    window.addEventListener('app-navigate', handler);
    return () => window.removeEventListener('app-navigate', handler);
  }, [profile, goTo]);

  const slideDetail = activeSection === 'job-detail';

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-slate-100/80">
      <AdminNav activeSection={activeSection} setActiveSection={goTo} />
      <main className="flex-1 overflow-auto pt-[calc(3.5rem+env(safe-area-inset-top))] lg:pt-0 lg:pb-0" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="px-4 pt-1.5 pb-4 md:p-6 max-w-7xl mx-auto w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, x: slideDetail ? 24 : 0, y: slideDetail ? 0 : 8 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, x: slideDetail ? 24 : 0, y: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              {activeSection === 'overview' && (
                <JobFilterProvider>
                  <DashboardOverview onNavigate={goTo} onSelectJob={openJob} />
                </JobFilterProvider>
              )}
              {activeSection === 'job-detail' && selectedJob && (
                <JobDetail job={selectedJob} onBack={() => navigate(-1)} />
              )}
              {activeSection === 'jobs' && <JobManager onNavigateRota={() => goTo('scheduling')} />}
              {(activeSection === 'scheduling' || activeSection === 'rota' || activeSection === 'calendar') && (
                <SchedulingHub initialTab={activeSection === 'calendar' ? 'calendar' : 'rota'} />
              )}
              {activeSection === 'timesheets' && <SettingsPage initialTab="timesheets" />}
              {activeSection === 'teams' && <SettingsPage initialTab="teams" />}
              {activeSection === 'compliance' && <SettingsPage initialTab="compliance" />}
              {activeSection === 'log-qc' && <SettingsPage initialTab="log-qc" />}
              {activeSection === 'billing' && <SettingsPage initialTab="invoicing" onSelectJob={openJob} />}
              {activeSection === 'settings' && <SettingsPage initialTab={settingsTab} onSelectJob={openJob} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}