import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import QuickLogModal from './QuickLogModal';

// "Log My Work" floating action button — sits above the tab bar, gives crews
// one-tap access to log investigation data for their active job without
// navigating through the full shift wizard.
export default function LogWorkFab({ assignments = [], jobs = [], staff, canLog = true }) {
  const [open, setOpen] = useState(false);

  if (!canLog || !staff?.id) return null;

  // Find today's active (started, not completed) assignment as the default job
  const todayStr = new Date().toISOString().slice(0, 10);
  const activeAssignment = assignments.find(a =>
    a.assigned_date === todayStr && a.status === 'started'
  ) || assignments.find(a => a.assigned_date === todayStr && a.status !== 'completed');

  const eligibleJobs = assignments
    .filter(a => a.assigned_date === todayStr)
    .map(a => jobs.find(j => j.id === a.job_id))
    .filter(Boolean);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        type="button"
        className="fixed right-4 sm:right-6 z-40 flex items-center gap-2.5 px-6 py-4 rounded-2xl command-gradient text-white font-bold text-base shadow-lg shadow-[#2E5A1A]/30 active:scale-95 transition touch-manipulation"
        style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <Plus className="w-6 h-6" />
        Log My Work
      </button>

      <QuickLogModal
        open={open}
        onClose={() => setOpen(false)}
        staff={staff}
        jobs={eligibleJobs}
        defaultJobId={activeAssignment?.job_id}
      />
    </>
  );
}